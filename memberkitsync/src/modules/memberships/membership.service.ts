import { logger } from '../../shared/logger.js'
import { mkPlanToUpsertInput, mkSubscriptionToUpsertInput } from './membership.mapper.js'
import { upsertMembershipLevel, upsertMembership } from './membership.repository.js'
import { linkMembershipLevelToClassroom, getClassroomByMkId } from '../classrooms/classroom.repository.js'
import type { MKPlanPayload, MKSubscriptionPayload, Membership, MembershipLevel } from './membership.types.js'

// Sincroniza um nível de assinatura e vincula às classrooms já sincronizadas
export async function syncPlan(mkPlan: MKPlanPayload): Promise<MembershipLevel> {
  const level = await upsertMembershipLevel(mkPlanToUpsertInput(mkPlan))
  logger.debug({ mkId: mkPlan.id, levelId: level.id }, 'MembershipLevel sincronizado')

  for (const classroomMkId of mkPlan.classroom_ids ?? []) {
    const classroom = await getClassroomByMkId(classroomMkId)
    if (!classroom) {
      logger.warn({ classroomMkId }, 'Classroom não encontrada para vincular ao plano, pulando')
      continue
    }
    await linkMembershipLevelToClassroom(level.id, classroom.id)
  }

  return level
}

export async function syncSubscription(
  mkSubscription: MKSubscriptionPayload,
  userId: number,
  membershipLevelId: number,
): Promise<Membership> {
  const input = mkSubscriptionToUpsertInput(mkSubscription, userId, membershipLevelId)
  const membership = await upsertMembership(input)
  logger.debug({ mkId: mkSubscription.id }, 'Membership sincronizada')
  return membership
}
