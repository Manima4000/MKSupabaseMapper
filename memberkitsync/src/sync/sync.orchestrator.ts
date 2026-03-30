import { logger } from '../shared/logger.js'
import { fetchAllPages } from '../shared/pagination.js'
import { MemberKitClient } from './memberkit-api.client.js'
import { syncCourse } from '../modules/courses/course.service.js'
import { upsertClassroom } from '../modules/classrooms/classroom.repository.js'
import { mkClassroomToUpsertInput } from '../modules/classrooms/classroom.mapper.js'
import { syncPlan } from '../modules/memberships/membership.service.js'
import { syncUser } from '../modules/users/user.service.js'
import { syncSubscription } from '../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../modules/enrollments/enrollment.repository.js'
import { mkEnrollmentToUpsertInput } from '../modules/enrollments/enrollment.mapper.js'
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
    await this.syncMembers()
    await this.syncSubscriptions()
    await this.syncEnrollments()

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    logger.info({ elapsed: `${elapsed}s` }, 'Sync completo finalizado')
  }

  // --------------------------------------------------------------------------
  // 1. Catálogo: courses + categories + sections + lessons + vídeos/arquivos
  // --------------------------------------------------------------------------
  private async syncCatalog(): Promise<void> {
    logger.info('Sincronizando catálogo de cursos...')
    const courses = await this.client.getCourses()
    logger.info({ count: courses.length }, 'Cursos encontrados')

    for (const mkCourse of courses) {
      try {
        await syncCourse(mkCourse)
      } catch (err) {
        logger.error({ mkId: mkCourse.id, err }, 'Erro ao sincronizar curso')
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Classrooms / Member Areas
  // --------------------------------------------------------------------------
  private async syncClassrooms(): Promise<void> {
    logger.info('Sincronizando classrooms...')
    const classrooms = await this.client.getClassrooms()

    for (const mk of classrooms) {
      await upsertClassroom(mkClassroomToUpsertInput(mk))
    }
    logger.info({ count: classrooms.length }, 'Classrooms sincronizadas')
  }

  // --------------------------------------------------------------------------
  // 3. Plans / Membership Levels (inclui vinculação com classrooms)
  // --------------------------------------------------------------------------
  private async syncPlans(): Promise<void> {
    logger.info('Sincronizando planos de assinatura...')
    const plans = await this.client.getPlans()

    for (const mk of plans) {
      await syncPlan(mk)
    }
    logger.info({ count: plans.length }, 'Planos sincronizados')
  }

  // --------------------------------------------------------------------------
  // 4. Members / Users (paginado)
  // --------------------------------------------------------------------------
  private async syncMembers(): Promise<void> {
    logger.info('Sincronizando membros...')
    const members = await fetchAllPages(
      (client, page, perPage) => client.getMembers(page, perPage),
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
  }

  // --------------------------------------------------------------------------
  // 5. Subscriptions / Memberships (paginado)
  // --------------------------------------------------------------------------
  private async syncSubscriptions(): Promise<void> {
    logger.info('Sincronizando assinaturas...')
    const subs = await fetchAllPages(
      (client, page, perPage) => client.getSubscriptions(page, perPage),
      this.client,
    )

    let synced = 0
    for (const mk of subs) {
      try {
        const user = await getUserByMkId(mk.member_id)
        const level = await getMembershipLevelByMkId(mk.plan_id)

        if (!user) {
          logger.warn({ memberMkId: mk.member_id }, 'Usuário não encontrado para assinatura, pulando')
          continue
        }
        if (!level) {
          logger.warn({ planMkId: mk.plan_id }, 'Plano não encontrado para assinatura, pulando')
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
  // 6. Enrollments (paginado)
  // --------------------------------------------------------------------------
  private async syncEnrollments(): Promise<void> {
    logger.info('Sincronizando matrículas...')
    const enrollments = await fetchAllPages(
      (client, page, perPage) => client.getEnrollments(page, perPage),
      this.client,
    )

    let synced = 0
    for (const mk of enrollments) {
      try {
        const user = await getUserByMkId(mk.member_id)
        const course = await getCourseByMkId(mk.course_id)
        const classroom = mk.member_area_id ? await getClassroomByMkId(mk.member_area_id) : null

        if (!user) {
          logger.warn({ memberMkId: mk.member_id }, 'Usuário não encontrado para matrícula, pulando')
          continue
        }
        if (!course) {
          logger.warn({ courseMkId: mk.course_id }, 'Curso não encontrado para matrícula, pulando')
          continue
        }

        await upsertEnrollment(
          mkEnrollmentToUpsertInput(mk, user.id, course.id, classroom?.id ?? null),
        )
        synced++
      } catch (err) {
        logger.error({ mkId: mk.id, err }, 'Erro ao sincronizar matrícula')
      }
    }
    logger.info({ total: enrollments.length, synced }, 'Matrículas sincronizadas')
  }
}
