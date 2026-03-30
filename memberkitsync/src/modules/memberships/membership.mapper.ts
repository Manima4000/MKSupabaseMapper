import type {
  MKSubscriptionPayload,
  MKPlanPayload,
  UpsertMembershipLevelInput,
  UpsertMembershipInput,
  MembershipStatus,
} from './membership.types.js'

export function mkPlanToUpsertInput(mk: MKPlanPayload): UpsertMembershipLevelInput {
  return {
    mkId: mk.id,
    name: mk.name,
    trialPeriod: mk.trial_period,
  }
}

const STATUS_MAP: Record<string, MembershipStatus> = {
  active: 'active',
  inactive: 'inactive',
  pending: 'pending',
  expired: 'expired',
}

function normalizeStatus(raw: string): MembershipStatus {
  return STATUS_MAP[raw] ?? 'inactive'
}

export function mkSubscriptionToUpsertInput(
  mk: MKSubscriptionPayload,
  userId: number,
  membershipLevelId: number,
): UpsertMembershipInput {
  return {
    mkId: mk.id,
    userId,
    membershipLevelId,
    status: normalizeStatus(mk.status),
    expireDate: mk.expire_at ?? null,
  }
}
