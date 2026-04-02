import { logger } from '../shared/logger.js'
import { fetchAllPages, runConcurrent } from '../shared/pagination.js'
import type { MKUser } from './memberkit-api.client.js'
import type { User } from '../modules/users/user.types.js'
import { MemberKitClient } from './memberkit-api.client.js'
import { syncCourse } from '../modules/courses/course.service.js'
import { upsertClassroom } from '../modules/classrooms/classroom.repository.js'
import { mkClassroomToUpsertInput } from '../modules/classrooms/classroom.mapper.js'
import { syncPlan } from '../modules/memberships/membership.service.js'
import { syncUser } from '../modules/users/user.service.js'
import { syncSubscription } from '../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../modules/enrollments/enrollment.repository.js'
import { mkUserEnrollmentToUpsertInput } from '../modules/enrollments/enrollment.mapper.js'
import { getUserByMkId, getAllUsers } from '../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../modules/classrooms/classroom.repository.js'
import { upsertUserActivityByMkId } from '../modules/progress/progress.repository.js'
import { mkActivityToCreateInput } from '../modules/progress/progress.mapper.js'
import { getAllLessons, getLessonByMkId, upsertLessonVideo, upsertLessonFiles } from '../modules/lessons/lesson.repository.js'
import { mkVideoToUpsertInput, mkFilesToUpsertInput } from '../modules/lessons/lesson.mapper.js'
import { upsertComment } from '../modules/comments/comment.repository.js'
import { mkCommentToUpsertInput } from '../modules/comments/comment.mapper.js'

export class SyncOrchestrator {
  constructor(private readonly client: MemberKitClient) {}

  async run(): Promise<void> {
    logger.info('Iniciando sync completo MemberKit → Supabase')
    const start = Date.now()

    await this.syncCatalog()
    await this.syncClassrooms()
    await this.syncPlans()
    const members = await this.syncMembers()
    await this.syncSubscriptions()
    await this.syncEnrollments(members)
    await this.syncActivities(members)
    await this.syncComments()

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, `Sync completo finalizado em ${elapsed}s`)
  }

  // --------------------------------------------------------------------------
  // 1. Catálogo: courses + categories + sections + lessons + vídeos/arquivos
  // --------------------------------------------------------------------------
  async syncCatalog(): Promise<void> {
    logger.info('=== [1/6] Sincronizando catálogo de cursos... ===')
    const t = Date.now()
    const courses = await this.client.getCourses()
    logger.info({ count: courses.length }, `${courses.length} cursos encontrados`)

    await runConcurrent(courses, async course => {
      try {
        await syncCourse(course)
      } catch (err) {
        logger.error({ mkId: course.id, err }, 'Erro ao sincronizar curso')
      }
    }, 20, 'syncCatalog')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ count: courses.length, elapsed }, `[syncCatalog] ${courses.length} cursos em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 2. Classrooms / Member Areas
  // --------------------------------------------------------------------------
  async syncClassrooms(): Promise<void> {
    logger.info('=== [2/6] Sincronizando classrooms... ===')
    const t = Date.now()
    const classrooms = await this.client.getClassrooms()

    await runConcurrent(classrooms, mk => upsertClassroom(mkClassroomToUpsertInput(mk)), 20, 'syncClassrooms')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ count: classrooms.length, elapsed }, `[syncClassrooms] ${classrooms.length} classrooms em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 3. Membership Levels (vincula classrooms já sincronizadas)
  // --------------------------------------------------------------------------
  async syncPlans(): Promise<void> {
    logger.info('=== [3/6] Sincronizando níveis de assinatura... ===')
    const t = Date.now()
    const levels = await this.client.getMembershipLevels()

    await runConcurrent(levels, mk => syncPlan(mk), 20, 'syncPlans')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ count: levels.length, elapsed }, `[syncPlans] ${levels.length} níveis em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 4. Members / Users (paginado) — returns the list for use in syncEnrollments
  // --------------------------------------------------------------------------
  async syncMembers(): Promise<MKUser[]> {
    logger.info('=== [4/6] Sincronizando membros... ===')
    const t = Date.now()
    const members = await fetchAllPages(
      (client, page, perPage) => client.getUsers(page, perPage),
      this.client,
      100,
      'syncMembers',
    )

    let synced = 0
    await runConcurrent(members, async mk => {
      try {
        await syncUser(mk)
        synced++
      } catch (err) {
        logger.error({ mkId: mk.id, err }, 'Erro ao sincronizar membro')
      }
    }, 20, 'syncMembers')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: members.length, synced, elapsed }, `[syncMembers] ${synced}/${members.length} membros em ${elapsed}`)
    return members
  }

  // --------------------------------------------------------------------------
  // 5. Subscriptions / Memberships (paginado)
  // --------------------------------------------------------------------------
  async syncSubscriptions(): Promise<void> {
    logger.info('=== [5/6] Sincronizando assinaturas... ===')
    const t = Date.now()
    const subs = await fetchAllPages(
      (client, page, perPage) => client.getMemberships(page, perPage),
      this.client,
      100,
      'syncSubscriptions',
    )

    let synced = 0
    await runConcurrent(subs, async mk => {
      try {
        const [user, level] = await Promise.all([
          getUserByMkId(mk.user.id),
          getMembershipLevelByMkId(mk.membership_level_id),
        ])

        if (!user) {
          logger.warn({ memberMkId: mk.user.id }, 'Usuário não encontrado para assinatura, pulando')
          return
        }
        if (!level) {
          logger.warn({ membershipLevelMkId: mk.membership_level_id }, 'Plano não encontrado para assinatura, pulando')
          return
        }

        await syncSubscription(mk, user.id, level.id)
        synced++
      } catch (err) {
        logger.error({ mkId: mk.id, err }, 'Erro ao sincronizar assinatura')
      }
    }, 20, 'syncSubscriptions')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: subs.length, synced, elapsed }, `[syncSubscriptions] ${synced}/${subs.length} assinaturas em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 6. Enrollments — fetched per-user from GET /users/{id}
  // There is no standalone /enrollments endpoint in the MemberKit API.
  // When called standalone (no members passed), fetches members from API.
  // --------------------------------------------------------------------------
  async syncEnrollments(members?: MKUser[]): Promise<void> {
    logger.info('=== [6/6] Sincronizando matrículas... ===')
    const t = Date.now()

    if (!members) {
      members = await fetchAllPages(
        (client, page, perPage) => client.getUsers(page, perPage),
        this.client,
        100,
        'syncEnrollments:users',
      )
    }

    let total = 0
    let synced = 0
    let membersProcessed = 0
    const memberCount = members.length

    await runConcurrent(members, async member => {
      try {
        const [detail, user] = await Promise.all([
          this.client.getUserDetail(member.id),
          getUserByMkId(member.id),
        ])
        total += detail.enrollments.length
        membersProcessed++

        const logStep = Math.max(5, Math.floor(memberCount / 20))
        if (membersProcessed % logStep === 0 || membersProcessed === memberCount) {
          const pct = Math.round((membersProcessed / memberCount) * 100)
          logger.info(
            { membersProcessed, memberCount, pct, enrollmentsSoFar: synced },
            `[syncEnrollments] ${membersProcessed}/${memberCount} membros (${pct}%), ${synced} matrículas sincronizadas`,
          )
        }

        if (!user) {
          logger.warn({ memberMkId: member.id }, 'Usuário não encontrado, pulando matrículas')
          return
        }

        await runConcurrent(detail.enrollments, async enrollment => {
          try {
            const [course, classroom] = await Promise.all([
              getCourseByMkId(enrollment.course_id),
              enrollment.classroom_id ? getClassroomByMkId(enrollment.classroom_id) : Promise.resolve(null),
            ])

            if (!course) {
              logger.warn({ memberMkId: member.id, courseMkId: enrollment.course_id }, 'Curso não encontrado para matrícula, pulando')
              return
            }

            await upsertEnrollment(
              mkUserEnrollmentToUpsertInput(enrollment, user.id, course.id, classroom?.id ?? null),
            )
            synced++
          } catch (err) {
            logger.error({ memberMkId: member.id, courseMkId: enrollment.course_id, err }, 'Erro ao sincronizar matrícula')
          }
        }, 5) // 5 enrollments por membro em paralelo
      } catch (err) {
        logger.error({ memberMkId: member.id, err }, 'Erro ao buscar detalhes do membro')
      }
    })

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total, synced, elapsed }, `[syncEnrollments] ${synced}/${total} matrículas em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 7. User Activities — fetched per-user from GET /users/{id}/activities
  // Upserts by mk_id so re-runs are idempotent.
  // --------------------------------------------------------------------------
  async syncActivities(members?: MKUser[]): Promise<void> {
    logger.info('=== [7/7] Sincronizando atividades dos usuários... ===')
    const t = Date.now()

    // Resolve lista de { id: internal, mkId } sem bater na API do MK se não necessário
    let usersToProcess: Array<{ internalId: number; mkId: number }>

    if (members) {
      // Chamada via full sync: members já disponíveis, resolve internal id do banco
      const resolved = await Promise.all(
        members.map(async m => {
          const user = await getUserByMkId(m.id)
          return user ? { internalId: user.id, mkId: m.id } : null
        }),
      )
      usersToProcess = resolved.filter((u): u is NonNullable<typeof u> => u !== null)
    } else {
      // Chamada standalone: usa usuários já no banco, sem precisar buscar na API do MK
      logger.info('[syncActivities] Buscando usuários do banco de dados (sem chamar MK API)...')
      const dbUsers = await getAllUsers()
      usersToProcess = dbUsers.map(u => ({ internalId: u.id, mkId: u.mk_id }))
      logger.info({ count: usersToProcess.length }, `[syncActivities] ${usersToProcess.length} usuários encontrados no banco`)
    }

    let totalActivities = 0
    let syncedActivities = 0

    await runConcurrent(usersToProcess, async ({ internalId, mkId }) => {
      try {
        const activities = await fetchAllPages(
          (client, page, perPage) => client.getUserActivities(mkId, page, perPage),
          this.client,
          100,
          `syncActivities:user${mkId}`,
        )

        totalActivities += activities.length

        await runConcurrent(activities, async activity => {
          try {
            await upsertUserActivityByMkId(mkActivityToCreateInput(activity, internalId))
            syncedActivities++
          } catch (err) {
            logger.error({ memberMkId: mkId, activityId: activity.id, err }, '[syncActivities] Erro ao upsert atividade')
          }
        }, 10)
      } catch (err) {
        logger.error({ memberMkId: mkId, err }, '[syncActivities] Erro ao buscar atividades do membro')
      }
    }, 5, 'syncActivities')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: totalActivities, synced: syncedActivities, elapsed }, `[syncActivities] ${syncedActivities}/${totalActivities} atividades em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 8. Comments (paginado) — endpoint: /comments
  // Deve ser executado após users e lessons estarem sincronizados.
  // --------------------------------------------------------------------------
  async syncComments(): Promise<void> {
    logger.info('=== [8/8] Sincronizando comentários... ===')
    const t = Date.now()

    const comments = await fetchAllPages(
      (client, page, perPage) => client.getComments(page, perPage),
      this.client,
      100,
      'syncComments',
    )

    let synced = 0
    await runConcurrent(comments, async mk => {
      try {
        const [user, lesson] = await Promise.all([
          getUserByMkId(mk.user.id),
          getLessonByMkId(mk.lesson.id),
        ])

        if (!user) {
          logger.warn({ commentMkId: mk.id, userMkId: mk.user.id }, '[syncComments] Usuário não encontrado, pulando')
          return
        }
        if (!lesson) {
          logger.warn({ commentMkId: mk.id, lessonMkId: mk.lesson.id }, '[syncComments] Aula não encontrada, pulando')
          return
        }

        await upsertComment(mkCommentToUpsertInput(mk, user.id, lesson.id))
        synced++
      } catch (err) {
        logger.error({ commentMkId: mk.id, err }, '[syncComments] Erro ao sincronizar comentário')
      }
    }, 20, 'syncComments')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: comments.length, synced, elapsed }, `[syncComments] ${synced}/${comments.length} comentários em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // Comments (standalone, DB-based) — re-sincroniza comentários por aula
  // Lê as aulas já no banco e busca GET /lessons/{mk_id}/comments para cada
  // uma, sem precisar paginar o endpoint global /comments.
  // Use quando quiser re-sincronizar comentários sem refazer o sync completo.
  // --------------------------------------------------------------------------
  async syncCommentsByLesson(): Promise<void> {
    logger.info('=== [standalone] Sincronizando comentários por aula (DB-based)... ===')
    const t = Date.now()

    const lessons = await getAllLessons()
    logger.info({ count: lessons.length }, `[syncCommentsByLesson] ${lessons.length} aulas encontradas no banco`)

    let totalComments = 0
    let synced = 0
    let failed = 0

    await runConcurrent(lessons, async ({ id: lessonInternalId, mk_id: lessonMkId }) => {
      try {
        const comments = await fetchAllPages(
          (client, page, perPage) => client.getCommentsByLesson(lessonMkId, page, perPage),
          this.client,
          100,
          `syncCommentsByLesson:lesson${lessonMkId}`,
        )

        totalComments += comments.length

        await runConcurrent(comments, async mk => {
          try {
            const user = await getUserByMkId(mk.user.id)
            if (!user) {
              logger.warn({ commentMkId: mk.id, userMkId: mk.user.id }, '[syncCommentsByLesson] Usuário não encontrado, pulando')
              return
            }

            await upsertComment(mkCommentToUpsertInput(mk, user.id, lessonInternalId))
            synced++
          } catch (err) {
            logger.error({ commentMkId: mk.id, lessonMkId, err }, '[syncCommentsByLesson] Erro ao upsert comentário')
            failed++
          }
        }, 10)
      } catch (err) {
        logger.error({ lessonMkId, err }, '[syncCommentsByLesson] Erro ao buscar comentários da aula')
        failed++
      }
    }, 5, 'syncCommentsByLesson')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: totalComments, synced, failed, elapsed }, `[syncCommentsByLesson] ${synced}/${totalComments} comentários em ${elapsed}`)
  }

  // --------------------------------------------------------------------------
  // 9. Lesson Media (standalone) — re-sync videos + files from DB lessons
  // Busca as lessons já no banco e re-sincroniza vídeo + arquivos de cada uma
  // chamando GET /lessons/{id} diretamente, sem refazer o catálogo inteiro.
  // --------------------------------------------------------------------------
  async syncLessonMedia(): Promise<void> {
    logger.info('=== [8/8] Sincronizando vídeos e arquivos das aulas (do banco)... ===')
    const t = Date.now()

    const lessons = await getAllLessons()
    logger.info({ count: lessons.length }, `[syncLessonMedia] ${lessons.length} aulas encontradas no banco`)

    let synced = 0
    let failed = 0

    await runConcurrent(lessons, async ({ id, mk_id }) => {
      try {
        const detail = await this.client.getLessonDetail(mk_id)

        const videoInput = mkVideoToUpsertInput(detail, id)
        if (videoInput) await upsertLessonVideo(videoInput)

        const fileInputs = mkFilesToUpsertInput(detail, id)
        if (fileInputs.length > 0) await upsertLessonFiles(fileInputs)

        synced++
      } catch (err) {
        logger.error({ lessonMkId: mk_id, err }, '[syncLessonMedia] Erro ao sincronizar mídia da aula')
        failed++
      }
    }, 20, 'syncLessonMedia')

    const elapsed = `${((Date.now() - t) / 1000).toFixed(1)}s`
    logger.info({ total: lessons.length, synced, failed, elapsed }, `[syncLessonMedia] ${synced}/${lessons.length} aulas em ${elapsed}`)
  }
}
