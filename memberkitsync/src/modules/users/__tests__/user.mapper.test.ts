import { describe, it, expect } from 'vitest'
import { mkMemberToUpsertInput } from '../user.mapper.js'
import type { MKUserPayload } from '../user.types.js'

const base: MKUserPayload = {
  id: 42,
  full_name: 'João Silva',
  email: 'joao@example.com',
  blocked: false,
  unlimited: true,
  sign_in_count: 10,
  current_sign_in_at: '2024-01-01T00:00:00Z',
  last_seen_at: '2024-01-15T12:00:00Z',
  metadata: { plan: 'gold', tags: ['esa'] },
}

describe('mkMemberToUpsertInput', () => {
  it('maps all fields to snake_case → camelCase correctly', () => {
    const result = mkMemberToUpsertInput(base)

    expect(result).toEqual({
      mkId: 42,
      fullName: 'João Silva',
      email: 'joao@example.com',
      phone: null,
      blocked: false,
      unlimited: true,
      signInCount: 10,
      currentSignInAt: '2024-01-01T00:00:00Z',
      lastSeenAt: '2024-01-15T12:00:00Z',
      metadata: { plan: 'gold', tags: ['esa'] },
    })
  })

  it('preserves null for optional date fields', () => {
    const result = mkMemberToUpsertInput({ ...base, current_sign_in_at: null, last_seen_at: null })

    expect(result.currentSignInAt).toBeNull()
    expect(result.lastSeenAt).toBeNull()
  })

  it('defaults metadata to empty object when metadata is undefined-like', () => {
    // metadata is typed as Record<string,unknown>, but API may return null/undefined
    const result = mkMemberToUpsertInput({ ...base, metadata: undefined as unknown as Record<string, unknown> })

    expect(result.metadata).toEqual({})
  })

  it('maps blocked: true correctly', () => {
    const result = mkMemberToUpsertInput({ ...base, blocked: true, unlimited: false })

    expect(result.blocked).toBe(true)
    expect(result.unlimited).toBe(false)
  })

  it('maps sign_in_count = 0', () => {
    const result = mkMemberToUpsertInput({ ...base, sign_in_count: 0 })

    expect(result.signInCount).toBe(0)
  })
})
