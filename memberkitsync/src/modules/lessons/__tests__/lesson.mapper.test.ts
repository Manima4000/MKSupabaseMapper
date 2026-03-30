import { describe, it, expect } from 'vitest'
import { mkLessonToUpsertInput, mkVideoToUpsertInput, mkFilesToUpsertInput } from '../lesson.mapper.js'
import type { MKLessonPayload } from '../lesson.types.js'

const baseLesson: MKLessonPayload = {
  id: 80,
  title: 'Aula 01 — Frações',
  position: 1,
  slug: 'aula-01-fracoes',
  video: {
    id: 10,
    uid: 'abc-uid-123',
    source: 'cloudflare',
    duration: 1820,
  },
  files: [
    { id: 1, filename: 'apostila.pdf', url: 'https://cdn.example.com/apostila.pdf' },
    { id: 2, filename: 'exercicios.pdf', url: 'https://cdn.example.com/exercicios.pdf' },
  ],
}

describe('mkLessonToUpsertInput', () => {
  it('maps all lesson fields with sectionId', () => {
    const result = mkLessonToUpsertInput(baseLesson, 50)

    expect(result).toEqual({
      mkId: 80,
      sectionId: 50,
      title: 'Aula 01 — Frações',
      position: 1,
      slug: 'aula-01-fracoes',
    })
  })

  it('maps null slug', () => {
    const result = mkLessonToUpsertInput({ ...baseLesson, slug: null }, 50)

    expect(result.slug).toBeNull()
  })

  it('does not include video or files in lesson input', () => {
    const result = mkLessonToUpsertInput(baseLesson, 50)

    expect(result).not.toHaveProperty('video')
    expect(result).not.toHaveProperty('files')
  })
})

describe('mkVideoToUpsertInput', () => {
  it('maps video fields with lessonId', () => {
    const result = mkVideoToUpsertInput(baseLesson, 80)

    expect(result).toEqual({
      mkId: 10,
      lessonId: 80,
      uid: 'abc-uid-123',
      source: 'cloudflare',
      durationSeconds: 1820,
    })
  })

  it('returns null when lesson has no video', () => {
    const result = mkVideoToUpsertInput({ ...baseLesson, video: null }, 80)

    expect(result).toBeNull()
  })

  it('maps null uid and source', () => {
    const result = mkVideoToUpsertInput(
      { ...baseLesson, video: { id: 1, uid: null, source: null, duration: null } },
      80,
    )

    expect(result?.uid).toBeNull()
    expect(result?.source).toBeNull()
    expect(result?.durationSeconds).toBeNull()
  })
})

describe('mkFilesToUpsertInput', () => {
  it('maps all files with lessonId', () => {
    const result = mkFilesToUpsertInput(baseLesson, 80)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      mkId: 1,
      lessonId: 80,
      filename: 'apostila.pdf',
      url: 'https://cdn.example.com/apostila.pdf',
    })
    expect(result[1]).toEqual({
      mkId: 2,
      lessonId: 80,
      filename: 'exercicios.pdf',
      url: 'https://cdn.example.com/exercicios.pdf',
    })
  })

  it('returns empty array when lesson has no files', () => {
    const result = mkFilesToUpsertInput({ ...baseLesson, files: [] }, 80)

    expect(result).toEqual([])
  })
})
