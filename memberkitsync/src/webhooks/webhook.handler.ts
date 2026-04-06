import { createHash } from 'node:crypto'
import { logger } from '../shared/logger.js'
import { supabase } from '../config/supabase.js'
import { SupabaseError } from '../shared/errors.js'
import { syncUser } from '../modules/users/user.service.js'
import { syncSubscription } from '../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../modules/enrollments/enrollment.repository.js'
import { mkEnrollmentToUpsertInput } from '../modules/enrollments/enrollment.mapper.js'
import { logUserActivity } from '../modules/progress/progress.service.js'
import {
  getUserByMkId,
  upsertUser,
  updateUserLoginData,
} from '../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../modules/classrooms/classroom.repository.js'
import {
  getLessonByMkId,
  upsertLesson,
  upsertLessonVideo,
  upsertLessonFiles,
} from '../modules/lessons/lesson.repository.js'
import { upsertSection } from '../modules/sections/section.repository.js'
import { upsertComment } from '../modules/comments/comment.repository.js'
import { upsertLessonRating } from '../modules/lesson_ratings/lesson_rating.repository.js'
import type {
  MKWebhookEnvelope,
  MKMemberWebhookData,
  MKSubscriptionWebhookData,
  MKEnrollmentWebhookData,
  MKLessonStatusWebhookData,
  MKCommentWebhookData,
  MKUserLoginWebhookData,
  MKLessonCatalogWebhookData,
  MKRatingWebhookData,
  MKLessonFileDownloadedWebhookData,
  MKInvitePassWebhookData,
} from './webhook.types.js'
import type { WebhookLogInsert } from '../shared/types.js'
import type { MKTrackableLessonStatus } from '../sync/memberkit-api.client.js'

// Dispatcher principal: roteia cada evento para o handler correto
export async function dispatchWebhook(envelope: MKWebhookEnvelope): Promise<void> {
  const { event, data, fired_at } = envelope

  const payloadHash = createHash('sha256').update(JSON.stringify(envelope)).digest('hex')

  // Verifica idempotência: ignora se o mesmo webhook já foi processado com sucesso
  const duplicate = await isAlreadyProcessed(payloadHash)
  if (duplicate) {
    logger.info({ event, payloadHash }, 'Webhook duplicado ignorado (já processado)')
    return
  }

  logger.info({ event }, 'Webhook recebido')

  // Registra o webhook no log (auditoria)
  const logId = await insertWebhookLog(event, envelope, 'received', payloadHash)

  try {
    switch (event) {
      case 'member.created':
      case 'member.updated':
        await handleMemberEvent(data as unknown as MKMemberWebhookData)
        break

      // NOTE: MemberKit fires membership.created / membership.updated (not subscription.*)
      case 'membership.created':
      case 'membership.updated':
        await handleSubscriptionEvent(data as unknown as MKSubscriptionWebhookData)
        break

      case 'enrollment.created':
      case 'enrollment.updated':
        await handleEnrollmentEvent(data as unknown as MKEnrollmentWebhookData)
        break

      case 'lesson_status.saved':
        await handleLessonStatusEvent(data as unknown as MKLessonStatusWebhookData, fired_at)
        break

      case 'comment.created':
        await handleCommentEvent(data as unknown as MKCommentWebhookData)
        break

      case 'user.last_seen':
      case 'user.signed_in':
        await handleUserLoginEvent(data as unknown as MKUserLoginWebhookData)
        break

      case 'lesson.created':
      case 'lesson.updated':
        await handleLessonCatalogEvent(data as unknown as MKLessonCatalogWebhookData)
        break

      case 'rating.saved':
        await handleRatingEvent(data as unknown as MKRatingWebhookData)
        break

      case 'lesson_file.downloaded':
        await handleLessonFileDownloadedEvent(data as unknown as MKLessonFileDownloadedWebhookData, fired_at)
        break

      case 'invite_pass.created':
        await handleInvitePassEvent(data as unknown as MKInvitePassWebhookData)
        break

      // Received and logged, but no DB action needed
      case 'integration_log.received':
      case 'page_agreement.accepted':
      case 'forum_post.created':
      case 'login.sent':
        logger.info({ event }, 'Evento de webhook registrado mas não processado')
        break

      default:
        logger.warn({ event }, 'Evento de webhook não tratado')
    }

    await updateWebhookLog(logId, 'processed')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ event, err }, 'Erro ao processar webhook')
    await updateWebhookLog(logId, 'failed', message)
    throw err
  }
}

// ----------------------------------------------------------------------------
// Handlers por evento
// ----------------------------------------------------------------------------

async function handleMemberEvent(data: MKMemberWebhookData): Promise<void> {
  await syncUser(data)
}

async function handleSubscriptionEvent(data: MKSubscriptionWebhookData): Promise<void> {
  const user = await getUserByMkId(data.user.id)
  if (!user) {
    logger.warn({ memberMkId: data.user.id }, 'Usuário não encontrado para webhook de assinatura')
    return
  }

  const level = await getMembershipLevelByMkId(data.membership_level.id)
  if (!level) {
    logger.warn({ planMkId: data.membership_level.id }, 'Plano não encontrado para webhook de assinatura')
    return
  }

  await syncSubscription(data, user.id, level.id)
}

async function handleEnrollmentEvent(data: MKEnrollmentWebhookData): Promise<void> {
  const user = await getUserByMkId(data.user.id)
  const course = await getCourseByMkId(data.course_id)
  const classroom = data.classroom_id ? await getClassroomByMkId(data.classroom_id) : null

  if (!user || !course) {
    logger.warn({ data }, 'Usuário ou curso não encontrado para webhook de matrícula')
    return
  }

  await upsertEnrollment(
    mkEnrollmentToUpsertInput(data, user.id, course.id, classroom?.id ?? null),
  )
}

async function handleLessonStatusEvent(
  data: MKLessonStatusWebhookData,
  firedAt: string,
): Promise<void> {
  const user = await getUserByMkId(data.user.id)

  if (!user) {
    logger.warn({ data }, 'Usuário não encontrado para webhook de progresso')
    return
  }

  const trackable: MKTrackableLessonStatus = {
    id: data.id ?? 0,
    completed_at: data.completed_at,
    created_at: data.created_at ?? firedAt,
    updated_at: data.updated_at ?? firedAt,
  }
  await logUserActivity(user.id, 'lesson_status.saved', data.lesson.id, firedAt, trackable, data.course.id)
}

async function handleCommentEvent(data: MKCommentWebhookData): Promise<void> {
  const user = await getUserByMkId(data.user.id)
  const lesson = await getLessonByMkId(data.lesson.id)

  if (!user || !lesson) {
    logger.warn({ data }, 'Usuário ou aula não encontrado para webhook de comentário')
    return
  }

  await upsertComment({
    mkId: data.id,
    userId: user.id,
    lessonId: lesson.id,
    body: data.content,
    status: data.status as import('../shared/types.js').CommentStatus,
  })
}

async function handleUserLoginEvent(data: MKUserLoginWebhookData): Promise<void> {
  await updateUserLoginData(data.id, {
    sign_in_count: data.sign_in_count,
    current_sign_in_at: data.current_sign_in_at,
    last_seen_at: data.last_seen_at,
  })
}

async function handleLessonCatalogEvent(data: MKLessonCatalogWebhookData): Promise<void> {
  const course = await getCourseByMkId(data.course.id)
  if (!course) {
    logger.warn({ courseMkId: data.course.id }, 'Curso não encontrado para webhook de aula')
    return
  }

  const section = await upsertSection({
    mkId: data.section.id,
    courseId: course.id,
    name: data.section.name,
    position: data.section.position,
    slug: data.section.slug,
  })

  const lesson = await upsertLesson({
    mkId: data.id,
    sectionId: section.id,
    title: data.title,
    position: data.position,
    slug: data.slug,
  })

  if (data.video) {
    await upsertLessonVideo({
      mkId: data.video.id ?? null,
      lessonId: lesson.id,
      uid: data.video.uid ?? null,
      source: data.video.source ?? null,
      durationSeconds: data.video.duration ?? null,
    })
  }

  if (data.files.length > 0) {
    await upsertLessonFiles(
      data.files.map((f) => ({
        mkId: f.id ?? null,
        lessonId: lesson.id,
        filename: f.filename,
        url: f.url,
      })),
    )
  }
}

async function handleRatingEvent(data: MKRatingWebhookData): Promise<void> {
  const user = await getUserByMkId(data.user.id)
  const lesson = await getLessonByMkId(data.lesson.id)

  if (!user || !lesson) {
    logger.warn({ data }, 'Usuário ou aula não encontrado para webhook de avaliação')
    return
  }

  await upsertLessonRating({
    mkId: data.id,
    userId: user.id,
    lessonId: lesson.id,
    stars: data.stars,
  })
}

async function handleLessonFileDownloadedEvent(
  data: MKLessonFileDownloadedWebhookData,
  firedAt: string,
): Promise<void> {
  const user = await getUserByMkId(data.user.id)

  if (!user) {
    logger.warn({ data }, 'Usuário não encontrado para webhook de download de material')
    return
  }

  await logUserActivity(user.id, 'lesson_file.downloaded', data.lesson.id, firedAt, null, null)
}

async function handleInvitePassEvent(data: MKInvitePassWebhookData): Promise<void> {
  await upsertUser({
    mkId: data.user.id,
    fullName: data.user.full_name ?? '',
    email: data.user.email,
    blocked: false,
    unlimited: false,
    signInCount: data.user.sign_in_count,
    currentSignInAt: data.user.current_sign_in_at,
    lastSeenAt: data.user.last_seen_at,
    metadata: data.user.metadata ?? {},
  })
}

// ----------------------------------------------------------------------------
// Webhook log helpers
// ----------------------------------------------------------------------------

async function isAlreadyProcessed(payloadHash: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('payload_hash', payloadHash)
    .eq('status', 'processed')
    .maybeSingle()

  if (error) {
    // Em caso de erro na consulta, permite prosseguir (melhor processar duas vezes do que perder)
    logger.warn({ error }, 'Erro ao verificar duplicidade de webhook, prosseguindo')
    return false
  }
  return data !== null
}

async function insertWebhookLog(
  eventType: string,
  payload: Record<string, unknown>,
  status: 'received' | 'processed' | 'failed',
  payloadHash: string,
): Promise<number> {
  const row: WebhookLogInsert = {
    event_type: eventType,
    payload,
    payload_hash: payloadHash,
    status,
    error_message: null,
    processed_at: null,
  }

  const { data, error } = await supabase
    .from('webhook_logs')
    .insert(row)
    .select('id')
    .single()

  if (error) throw new SupabaseError('Falha ao inserir webhook_log', error)
  return (data as { id: number }).id
}

async function updateWebhookLog(
  id: number,
  status: 'processed' | 'failed',
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_logs')
    .update({
      status,
      processed_at: new Date().toISOString(),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq('id', id)

  if (error) logger.error({ id, error }, 'Falha ao atualizar webhook_log')
}
