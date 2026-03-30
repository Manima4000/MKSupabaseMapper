import { describe, it, expect } from 'vitest'
import { mkEnrollmentToUpsertInput } from '../enrollment.mapper.js'
import type { MKEnrollmentPayload } from '../enrollment.types.js'

const base: MKEnrollmentPayload = {
  id: 100,
  member_id: 1,
  course_id: 2,
  member_area_id: 3,
  status: 'active',
  expire_at: '2025-12-31T23:59:59Z',
}

describe('mkEnrollmentToUpsertInput', () => {
  it('maps all fields with resolved IDs', () => {
    const result = mkEnrollmentToUpsertInput(base, 10, 20, 30)

    expect(result).toEqual({
      mkId: 100,
      userId: 10,
      courseId: 20,
      classroomId: 30,
      status: 'active',
      expireDate: '2025-12-31T23:59:59Z',
    })
  })

  it('accepts null classroomId', () => {
    const result = mkEnrollmentToUpsertInput(base, 10, 20, null)

    expect(result.classroomId).toBeNull()
  })

  it('accepts null expireDate', () => {
    const result = mkEnrollmentToUpsertInput({ ...base, expire_at: null }, 10, 20, null)

    expect(result.expireDate).toBeNull()
  })

  it.each([
    ['active', 'active'],
    ['inactive', 'inactive'],
    ['pending', 'pending'],
    ['expired', 'expired'],
  ])('maps known status "%s" → "%s"', (raw, expected) => {
    const result = mkEnrollmentToUpsertInput({ ...base, status: raw }, 1, 2, null)

    expect(result.status).toBe(expected)
  })

  it('normalizes unknown status to "inactive"', () => {
    const result = mkEnrollmentToUpsertInput({ ...base, status: 'cancelled' }, 1, 2, null)

    expect(result.status).toBe('inactive')
  })
})
