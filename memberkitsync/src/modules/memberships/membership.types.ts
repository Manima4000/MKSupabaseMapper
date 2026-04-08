import type {
  Membership,
  MembershipInsert,
  MembershipLevel,
  MembershipLevelInsert,
  MembershipStatus,
} from '../../shared/types.js'
import type { MKMembershipLevel } from '../../sync/memberkit-api.client.js'

export type { Membership, MembershipInsert, MembershipLevel, MembershipLevelInsert, MembershipStatus }

// Minimal interface accepted by the subscription mapper.
// Satisfied by both the REST API response (MKMembership) and webhook payloads
// (MKSubscriptionWebhookData), which use different field names for the expire
// date. The mapper handles both via dynamic field access.
export interface MKSubscriptionPayload {
  id: number
  status: string
  expire_date?: string | null
  expire_at?: string | null
  created_at?: string
}

export type MKPlanPayload = MKMembershipLevel

export interface UpsertMembershipLevelInput {
  mkId: number
  name: string
  trialPeriod: number
  createdAt?: string
}

export interface UpsertMembershipInput {
  mkId: number
  userId: number
  membershipLevelId: number
  status: MembershipStatus
  expireDate: string | null
  createdAt?: string
}
