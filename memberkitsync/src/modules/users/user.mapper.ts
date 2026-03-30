import type { MKUserPayload, UpsertUserInput } from './user.types.js'

export function mkMemberToUpsertInput(mk: MKUserPayload): UpsertUserInput {
  return {
    mkId: mk.id,
    fullName: mk.name,
    email: mk.email,
    blocked: mk.blocked,
    unlimited: mk.unlimited,
    signInCount: mk.sign_in_count,
    currentSignInAt: mk.current_sign_in_at ?? null,
    lastSeenAt: mk.last_seen_at ?? null,
    metadata: mk.meta ?? {},
  }
}
