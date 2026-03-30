import { logger } from '../../shared/logger.js'
import { mkPlanToUpsertInput, mkSubscriptionToUpsertInput } from './membership.mapper.js'
import { upsertMembershipLevel, upsertMembership } from './membership.repository.js'
import { linkMembershipLevelToClassroom, upsertClassroom } from '../classrooms/classroom.repository.js'
import { mkClassroomToUpsertInput } from '../classrooms/classroom.mapper.js'
import type { MKPlanPayload, MKSubscriptionPayload, Membership, MembershipLevel } from './membership.types.js'

// Sincroniza um plano com suas turmas vinculadas
export async function syncPlan(mkPlan: MKPlanPayload): Promise<MembershipLevel> {
  const level = await upsertMembershipLevel(mkPlanToUpsertInput(mkPlan))
  logger.debug({ mkId: mkPlan.id, levelId: level.id }, 'MembershipLevel sincronizado')

  for (const mkClassroom of mkPlan.member_areas) {
    const classroom = await upsertClassroom(mkClassroomToUpsertInput(mkClassroom))
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
