import { describe, it, expect } from 'vitest'
import { mkClassroomToUpsertInput } from '../classroom.mapper.js'
import type { MKClassroomPayload } from '../classroom.types.js'

describe('mkClassroomToUpsertInput', () => {
  it('maps all fields', () => {
    const mk: MKClassroomPayload = {
      id: 15,
      name: 'Turma ESA 2024',
      master: true,
      course_name: 'Matemática 1 - ESA',
      users_count: 42,
      comments_count: 7,
      average_progress: 63.5,
      created_at: '2023-11-07T05:31:56Z',
      updated_at: '2023-11-08T05:31:56Z',
    }

    expect(mkClassroomToUpsertInput(mk, 99)).toEqual({
      mkId: 15,
      name: 'Turma ESA 2024',
      master: true,
      courseName: 'Matemática 1 - ESA',
      courseId: 99,
      usersCount: 42,
      commentsCount: 7,
      averageProgress: 63.5,
      createdAt: '2023-11-07T05:31:56Z',
      updatedAt: '2023-11-08T05:31:56Z',
    })
  })

  it('maps required fields without timestamps when they are absent', () => {
    const mk: MKClassroomPayload = {
      id: 1,
      name: 'X',
      master: false,
      course_name: 'Curso Y',
      users_count: 0,
      comments_count: 0,
      average_progress: 0,
    }
    const result = mkClassroomToUpsertInput(mk, null)

    expect(result).toEqual({
      mkId: 1,
      name: 'X',
      master: false,
      courseName: 'Curso Y',
      courseId: null,
      usersCount: 0,
      commentsCount: 0,
      averageProgress: 0,
    })
    expect(Object.keys(result)).not.toContain('createdAt')
    expect(Object.keys(result)).not.toContain('updatedAt')
  })
})
