import { logger } from '../shared/logger.js'
import { supabase } from '../config/supabase.js'
import { SupabaseError } from '../shared/errors.js'
import { syncUser } from '../modules/users/user.service.js'
import { syncSubscription } from '../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../modules/enrollments/enrollment.repository.js'
import { mkEnrollmentToUpsertInput } from '../modules/enrollments/enrollment.mapper.js'
import { handleLessonProgress, logUserActivity } from '../modules/progress/progress.service.js'
import { getUserByMkId } from '../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../modules/classrooms/classroom.repository.js'
import { getLessonByMkId } from '../modules/lessons/lesson.repository.js'
import type {
  MKWebhookEnvelope,
  MKMemberWebhookData,
  MKSubscriptionWebhookData,
  MKEnrollmentWebhookData,
  MKLessonStatusWebhookData,
} from './webhook.types.js'
import type { WebhookLogInsert } from '../shared/types.js'

// Dispatcher principal: roteia cada evento para o handler correto
export async function dispatchWebhook(envelope: MKWebhookEnvelope): Promise<void> {
  const { event, data, fired_at } = envelope

  logger.info({ event }, 'Webhook recebido')

  // Registra o webhook no log (auditoria)
  const logId = await insertWebhookLog(event, envelope, 'received')

  try {
    switch (event) {
      case 'member.created':
      case 'member.updated':
        await handleMemberEvent(data as unknown as MKMemberWebhookData)
        break

      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.expired':
        await handleSubscriptionEvent(data as unknown as MKSubscriptionWebhookData)
        break

      case 'enrollment.created':
      case 'enrollment.updated':
        await handleEnrollmentEvent(data as unknown as MKEnrollmentWebhookData)
        break

      case 'lesson_status_saved':
        await handleLessonStatusEvent(data as unknown as MKLessonStatusWebhookData, fired_at)
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
  const user = await getUserByMkId(data.member_id)
  if (!user) {
    logger.warn({ memberMkId: data.member_id }, 'Usuário não encontrado para webhook de assinatura')
    return
  }

  const level = await getMembershipLevelByMkId(data.plan_id)
  if (!level) {
    logger.warn({ planMkId: data.plan_id }, 'Plano não encontrado para webhook de assinatura')
    return
  }

  await syncSubscription(data, user.id, level.id)
}

async function handleEnrollmentEvent(data: MKEnrollmentWebhookData): Promise<void> {
  const user = await getUserByMkId(data.member_id)
  const course = await getCourseByMkId(data.course_id)
  const classroom = data.member_area_id ? await getClassroomByMkId(data.member_area_id) : null

  if (!user || !course) {
    logger.warn({ data }, 'Usuário ou curso não encontrado para webhook de matrícula')
    return
  }

  await upsertEnrollment(
    mkEnrollmentToUpsertInput(data, user.id, course.id, classroom?.id ?? null),
  )
}

async function handleLessonStatusEvent(data: MKLessonStatusWebhookData, firedAt: string): Promise<void> {
  const user = await getUserByMkId(data.member_id)
  const lesson = await getLessonByMkId(data.lesson_id)

  if (!user || !lesson) {
    logger.warn({ data }, 'Usuário ou aula não encontrado para webhook de progresso')
    return
  }

  await handleLessonProgress({
    mk_id: data.id ?? null,
    user_id: user.id,
    lesson_id: lesson.id,
    progress: data.progress,
    completed_at: data.completed_at,
    user_mk_id: data.member_id,
    lesson_mk_id: data.lesson_id,
    raw_payload: data as unknown as Record<string, unknown>,
  })

  // Registra atividade do aluno
  await logUserActivity(user.id, 'lesson_status_saved', data.lesson_id, firedAt)
}

// ----------------------------------------------------------------------------
// Webhook log helpers
// ----------------------------------------------------------------------------

async function insertWebhookLog(
  eventType: string,
  payload: Record<string, unknown>,
  status: 'received' | 'processed' | 'failed',
): Promise<number> {
  const row: WebhookLogInsert = {
    event_type: eventType,
    payload,
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
