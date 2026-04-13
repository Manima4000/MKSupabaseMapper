import type { MKUserPayload, UpsertUserInput } from './user.types.js'

function extractPhone(metadata: Record<string, unknown>): string | null {
  const code = metadata.phone_local_code as string | null | undefined
  const number = metadata.phone_number as string | null | undefined
  if (code && number) return `${code}${number}`
  if (number) return number
  return null
}

export function mkMemberToUpsertInput(mk: MKUserPayload): UpsertUserInput {
  const metadata = mk.metadata ?? {}
  return {
    mkId: mk.id,
    fullName: mk.full_name ?? mk.email,
    email: mk.email,
    phone: extractPhone(metadata),
    blocked: mk.blocked,
    unlimited: mk.unlimited,
    signInCount: mk.sign_in_count,
    currentSignInAt: mk.current_sign_in_at ?? null,
    lastSeenAt: mk.last_seen_at ?? null,
    metadata,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
