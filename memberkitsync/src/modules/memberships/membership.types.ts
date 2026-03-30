import type {
  Membership,
  MembershipInsert,
  MembershipLevel,
  MembershipLevelInsert,
  MembershipStatus,
} from '../../shared/types.js'
import type { MKSubscription, MKPlan } from '../../sync/memberkit-api.client.js'

export type { Membership, MembershipInsert, MembershipLevel, MembershipLevelInsert, MembershipStatus }
export type MKSubscriptionPayload = MKSubscription
export type MKPlanPayload = MKPlan

export interface UpsertMembershipLevelInput {
  mkId: number
  name: string
  trialPeriod: number
}

export interface UpsertMembershipInput {
  mkId: number
  userId: number
  membershipLevelId: number
  status: MembershipStatus
  expireDate: string | null
}
