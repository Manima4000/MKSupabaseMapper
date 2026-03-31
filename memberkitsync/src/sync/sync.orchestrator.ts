import { logger } from '../shared/logger.js'
import { fetchAllPages } from '../shared/pagination.js'
import type { MKUser } from './memberkit-api.client.js'
import { MemberKitClient } from './memberkit-api.client.js'
import { syncCourse } from '../modules/courses/course.service.js'
import { upsertClassroom } from '../modules/classrooms/classroom.repository.js'
import { mkClassroomToUpsertInput } from '../modules/classrooms/classroom.mapper.js'
import { syncPlan } from '../modules/memberships/membership.service.js'
import { syncUser } from '../modules/users/user.service.js'
import { syncSubscription } from '../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../modules/enrollments/enrollment.repository.js'
import { mkUserEnrollmentToUpsertInput } from '../modules/enrollments/enrollment.mapper.js'
import { getUserByMkId } from '../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../modules/classrooms/classroom.repository.js'

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

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, 'Sync completo finalizado')
  }

  // --------------------------------------------------------------------------
  // 1. Catálogo: courses + categories + sections + lessons + vídeos/arquivos
  // --------------------------------------------------------------------------
  async syncCatalog(): Promise<void> {
    logger.info('Sincronizando catálogo de cursos...')
    const courses = await this.client.getCourses()
    logger.info({ count: courses.length }, 'Cursos encontrados')

    for (const course of courses) {
      try {
        await syncCourse(course)
      } catch (err) {
        logger.error({ mkId: course.id, err }, 'Erro ao sincronizar curso')
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Classrooms / Member Areas
  // --------------------------------------------------------------------------
  async syncClassrooms(): Promise<void> {
    logger.info('Sincronizando classrooms...')
    const classrooms = await this.client.getClassrooms()

    for (const mk of classrooms) {
      await upsertClassroom(mkClassroomToUpsertInput(mk))
    }
    logger.info({ count: classrooms.length }, 'Classrooms sincronizadas')
  }

  // --------------------------------------------------------------------------
  // 3. Membership Levels (vincula classrooms já sincronizadas)
  // --------------------------------------------------------------------------
  async syncPlans(): Promise<void> {
    logger.info('Sincronizando níveis de assinatura...')
    const levels = await this.client.getMembershipLevels()

    for (const mk of levels) {
      await syncPlan(mk)
    }
    logger.info({ count: levels.length }, 'Níveis de assinatura sincronizados')
  }

  // --------------------------------------------------------------------------
  // 4. Members / Users (paginado) — returns the list for use in syncEnrollments
  // --------------------------------------------------------------------------
  async syncMembers(): Promise<MKUser[]> {
    logger.info('Sincronizando membros...')
    const members = await fetchAllPages(
      (client, page, perPage) => client.getUsers(page, perPage),
      this.client,
    )

    let synced = 0
    for (const mk of members) {
      try {
        await syncUser(mk)
        synced++
      } catch (err) {
        logger.error({ mkId: mk.id, err }, 'Erro ao sincronizar membro')
      }
    }
    logger.info({ total: members.length, synced }, 'Membros sincronizados')
    return members
  }

  // --------------------------------------------------------------------------
  // 5. Subscriptions / Memberships (paginado)
  // --------------------------------------------------------------------------
  async syncSubscriptions(): Promise<void> {
    logger.info('Sincronizando assinaturas...')
    const subs = await fetchAllPages(
      (client, page, perPage) => client.getMemberships(page, perPage),
      this.client,
    )

    let synced = 0
    for (const mk of subs) {
      try {
        const user = await getUserByMkId(mk.user.id)
        const level = await getMembershipLevelByMkId(mk.membership_level_id)

        if (!user) {
          logger.warn({ memberMkId: mk.user.id }, 'Usuário não encontrado para assinatura, pulando')
          continue
        }
        if (!level) {
          logger.warn({ membershipLevelMkId: mk.membership_level_id }, 'Plano não encontrado para assinatura, pulando')
          continue
        }

        await syncSubscription(mk, user.id, level.id)
        synced++
      } catch (err) {
        logger.error({ mkId: mk.id, err }, 'Erro ao sincronizar assinatura')
      }
    }
    logger.info({ total: subs.length, synced }, 'Assinaturas sincronizadas')
  }

  // --------------------------------------------------------------------------
  // 6. Enrollments — fetched per-user from GET /users/{id}
  // There is no standalone /enrollments endpoint in the MemberKit API.
  // When called standalone (no members passed), fetches members from API.
  // --------------------------------------------------------------------------
  async syncEnrollments(members?: MKUser[]): Promise<void> {
    if (!members) {
      members = await fetchAllPages(
        (client, page, perPage) => client.getUsers(page, perPage),
        this.client,
      )
    }
    logger.info('Sincronizando matrículas...')
    let total = 0
    let synced = 0

    for (const member of members) {
      try {
        const detail = await this.client.getUserDetail(member.id)
        total += detail.enrollments.length

        const user = await getUserByMkId(member.id)
        if (!user) {
          logger.warn({ memberMkId: member.id }, 'Usuário não encontrado, pulando matrículas')
          continue
        }

        for (const enrollment of detail.enrollments) {
          try {
            const course = await getCourseByMkId(enrollment.course_id)
            if (!course) {
              logger.warn({ memberMkId: member.id, courseMkId: enrollment.course_id }, 'Curso não encontrado para matrícula, pulando')
              continue
            }

            const classroom = enrollment.classroom_id
              ? await getClassroomByMkId(enrollment.classroom_id)
              : null

            await upsertEnrollment(
              mkUserEnrollmentToUpsertInput(enrollment, user.id, course.id, classroom?.id ?? null),
            )
            synced++
          } catch (err) {
            logger.error({ memberMkId: member.id, courseMkId: enrollment.course_id, err }, 'Erro ao sincronizar matrícula')
          }
        }
      } catch (err) {
        logger.error({ memberMkId: member.id, err }, 'Erro ao buscar detalhes do membro')
      }
    }

    logger.info({ total, synced }, 'Matrículas sincronizadas')
  }
}
