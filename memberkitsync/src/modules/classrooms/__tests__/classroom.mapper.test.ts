import { describe, it, expect } from 'vitest'
import { mkClassroomToUpsertInput } from '../classroom.mapper.js'
import type { MKClassroomPayload } from '../classroom.types.js'

describe('mkClassroomToUpsertInput', () => {
  it('maps all fields', () => {
    const mk: MKClassroomPayload = { id: 15, name: 'Turma ESA 2024' }

    expect(mkClassroomToUpsertInput(mk)).toEqual({
      mkId: 15,
      name: 'Turma ESA 2024',
    })
  })

  it('maps only mkId and name — no extra fields', () => {
    const mk: MKClassroomPayload = { id: 1, name: 'X' }
    const result = mkClassroomToUpsertInput(mk)

    expect(Object.keys(result)).toEqual(['mkId', 'name'])
  })
})
