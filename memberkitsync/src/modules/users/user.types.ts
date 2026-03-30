import type { User, UserInsert } from '../../shared/types.js'
import type { MKMember } from '../../sync/memberkit-api.client.js'

export type { User, UserInsert }

// Payload da MemberKit para um membro
export type MKUserPayload = MKMember

// Dados necessários para upsert de um usuário
export interface UpsertUserInput {
  mkId: number
  fullName: string
  email: string
  blocked: boolean
  unlimited: boolean
  signInCount: number
  currentSignInAt: string | null
  lastSeenAt: string | null
  metadata: Record<string, unknown>
}
