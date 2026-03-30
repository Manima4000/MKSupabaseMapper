import { describe, it, expect } from 'vitest'
import { mkPlanToUpsertInput, mkSubscriptionToUpsertInput } from '../membership.mapper.js'
import type { MKPlanPayload, MKSubscriptionPayload } from '../membership.types.js'

describe('mkPlanToUpsertInput', () => {
  it('maps plan fields correctly', () => {
    const mk: MKPlanPayload = {
      id: 7,
      name: 'Assinatura ESA Anual',
      trial_period: 14,
      member_areas: [],
    }

    expect(mkPlanToUpsertInput(mk)).toEqual({
      mkId: 7,
      name: 'Assinatura ESA Anual',
      trialPeriod: 14,
    })
  })

  it('maps trial_period = 0 (no trial)', () => {
    const mk: MKPlanPayload = { id: 1, name: 'Plan', trial_period: 0, member_areas: [] }

    expect(mkPlanToUpsertInput(mk).trialPeriod).toBe(0)
  })
})

describe('mkSubscriptionToUpsertInput', () => {
  const base: MKSubscriptionPayload = {
    id: 200,
    member_id: 5,
    plan_id: 7,
    status: 'active',
    expire_at: '2025-01-01T00:00:00Z',
  }

  it('maps all fields with resolved user and level IDs', () => {
    const result = mkSubscriptionToUpsertInput(base, 10, 20)

    expect(result).toEqual({
      mkId: 200,
      userId: 10,
      membershipLevelId: 20,
      status: 'active',
      expireDate: '2025-01-01T00:00:00Z',
    })
  })

  it('accepts null expireDate', () => {
    const result = mkSubscriptionToUpsertInput({ ...base, expire_at: null }, 10, 20)

    expect(result.expireDate).toBeNull()
  })

  it.each([
    ['active', 'active'],
    ['inactive', 'inactive'],
    ['pending', 'pending'],
    ['expired', 'expired'],
  ])('maps known status "%s" → "%s"', (raw, expected) => {
    const result = mkSubscriptionToUpsertInput({ ...base, status: raw }, 1, 2)

    expect(result.status).toBe(expected)
  })

  it('normalizes unknown status to "inactive"', () => {
    const result = mkSubscriptionToUpsertInput({ ...base, status: 'cancelled' }, 1, 2)

    expect(result.status).toBe('inactive')
  })
})
