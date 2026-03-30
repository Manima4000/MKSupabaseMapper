import { describe, it, expect } from 'vitest'
import { mkCategoryToUpsertInput, mkCourseToUpsertInput } from '../course.mapper.js'
import type { MKCategoryPayload, MKCoursePayload } from '../course.types.js'

describe('mkCategoryToUpsertInput', () => {
  it('maps all fields', () => {
    const mk: MKCategoryPayload = { id: 10, name: 'Matemática', position: 1 }

    expect(mkCategoryToUpsertInput(mk)).toEqual({
      mkId: 10,
      name: 'Matemática',
      position: 1,
    })
  })

  it('maps position = 0', () => {
    const mk: MKCategoryPayload = { id: 1, name: 'Cat', position: 0 }

    expect(mkCategoryToUpsertInput(mk).position).toBe(0)
  })
})

describe('mkCourseToUpsertInput', () => {
  const mk: MKCoursePayload = {
    id: 55,
    name: 'ESA - Matemática I',
    position: 3,
    category: null,
    sections: [],
  }

  it('maps all fields with a categoryId', () => {
    const result = mkCourseToUpsertInput(mk, 7)

    expect(result).toEqual({
      mkId: 55,
      name: 'ESA - Matemática I',
      position: 3,
      categoryId: 7,
    })
  })

  it('accepts null categoryId', () => {
    const result = mkCourseToUpsertInput(mk, null)

    expect(result.categoryId).toBeNull()
  })

  it('does not expose sections or category in the output', () => {
    const result = mkCourseToUpsertInput(mk, null)

    expect(result).not.toHaveProperty('sections')
    expect(result).not.toHaveProperty('category')
  })
})
