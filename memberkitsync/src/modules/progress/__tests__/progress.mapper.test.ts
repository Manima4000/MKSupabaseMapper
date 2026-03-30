import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { webhookLessonProgressToInput, buildUserActivity } from '../progress.mapper.js'

describe('webhookLessonProgressToInput', () => {
  it('maps all fields correctly', () => {
    const result = webhookLessonProgressToInput({
      mk_id: 99,
      user_mk_id: 1,
      lesson_mk_id: 2,
      progress: 75,
      completed_at: '2024-06-01T10:00:00Z',
      user_id: 10,
      lesson_id: 20,
    })

    expect(result).toEqual({
      mkId: 99,
      userId: 10,
      lessonId: 20,
      progress: 75,
      completedAt: '2024-06-01T10:00:00Z',
    })
  })

  it('defaults mkId to null when not provided', () => {
    const result = webhookLessonProgressToInput({
      mk_id: null,
      user_mk_id: 1,
      lesson_mk_id: 2,
      progress: 50,
      completed_at: null,
      user_id: 5,
      lesson_id: 10,
    })

    expect(result.mkId).toBeNull()
    expect(result.completedAt).toBeNull()
  })

  it('maps progress = 100 (fully completed)', () => {
    const result = webhookLessonProgressToInput({
      mk_id: 1,
      user_mk_id: 1,
      lesson_mk_id: 1,
      progress: 100,
      completed_at: '2024-06-01T10:00:00Z',
      user_id: 1,
      lesson_id: 1,
    })

    expect(result.progress).toBe(100)
    expect(result.completedAt).toBe('2024-06-01T10:00:00Z')
  })
})

describe('buildUserActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-15T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps all fields including custom occurredAt', () => {
    const payload = { lesson_id: 5, progress: 80 }
    const result = buildUserActivity(42, 'lesson_status_saved', payload, '2024-03-10T08:00:00Z')

    expect(result).toEqual({
      userId: 42,
      eventType: 'lesson_status_saved',
      payload,
      occurredAt: '2024-03-10T08:00:00Z',
    })
  })

  it('defaults occurredAt to now when not provided', () => {
    const result = buildUserActivity(1, 'member.created', {})

    expect(result.occurredAt).toBe('2024-03-15T09:00:00.000Z')
  })
})
