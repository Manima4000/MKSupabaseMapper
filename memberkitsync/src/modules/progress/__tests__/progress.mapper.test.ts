import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildUserActivity } from '../progress.mapper.js'

describe('buildUserActivity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-15T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps all fields including custom occurredAt', () => {
    const result = buildUserActivity(42, 'lesson_status_saved', 5, '2024-03-10T08:00:00Z')

    expect(result).toEqual({
      userId: 42,
      eventType: 'lesson_status_saved',
      mkLessonId: 5,
      trackable: null,
      occurredAt: '2024-03-10T08:00:00Z',
    })
  })

  it('defaults occurredAt to now when not provided', () => {
    const result = buildUserActivity(1, 'member.created', null)

    expect(result.occurredAt).toBe('2024-03-15T09:00:00.000Z')
  })

  it('includes trackable when provided', () => {
    const result = buildUserActivity(10, 'lesson_status_saved', 3, '2024-03-10T08:00:00Z', {
      progress: 100,
      completed_at: '2024-03-10T08:00:00Z',
    })

    expect(result.trackable).toEqual({ progress: 100, completed_at: '2024-03-10T08:00:00Z' })
  })
})
