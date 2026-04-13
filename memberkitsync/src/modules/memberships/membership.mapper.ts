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
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
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
  // REST API uses expire_date; webhook payloads may use expire_at
  const expireDate = (mk as unknown as Record<string, unknown>)['expire_date'] as string | null | undefined
    ?? (mk as unknown as Record<string, unknown>)['expire_at'] as string | null | undefined
    ?? null
  return {
    mkId: mk.id,
    userId,
    membershipLevelId,
    status: normalizeStatus(mk.status),
    expireDate,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
