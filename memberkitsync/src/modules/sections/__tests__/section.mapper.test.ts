import { describe, it, expect } from 'vitest'
import { mkSectionToUpsertInput } from '../section.mapper.js'
import type { MKSectionPayload } from '../section.types.js'

describe('mkSectionToUpsertInput', () => {
  const base: MKSectionPayload = {
    id: 30,
    name: 'Módulo 1 — Aritmética',
    position: 1,
    slug: 'modulo-1-aritmetica',
    lessons: [],
  }

  it('maps all fields with courseId', () => {
    const result = mkSectionToUpsertInput(base, 5)

    expect(result).toEqual({
      mkId: 30,
      courseId: 5,
      name: 'Módulo 1 — Aritmética',
      position: 1,
      slug: 'modulo-1-aritmetica',
    })
  })

  it('maps null slug', () => {
    const result = mkSectionToUpsertInput({ ...base, slug: null }, 5)

    expect(result.slug).toBeNull()
  })

  it('does not expose lessons in output', () => {
    const result = mkSectionToUpsertInput(base, 5)

    expect(result).not.toHaveProperty('lessons')
  })
})
