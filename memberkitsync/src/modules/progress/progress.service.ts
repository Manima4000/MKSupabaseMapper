import { buildUserActivity } from './progress.mapper.js'
import { createUserActivity } from './progress.repository.js'
import type { UserActivity } from './progress.types.js'
import type { MKTrackable } from '../../sync/memberkit-api.client.js'

export async function logUserActivity(
  userId: number,
  eventType: string,
  mkLessonId: number | null,
  occurredAt?: string,
  trackable?: MKTrackable | null,
  mkCourseId?: number | null,
): Promise<UserActivity> {
  const input = buildUserActivity(userId, eventType, mkLessonId, occurredAt, trackable, mkCourseId)
  return createUserActivity(input)
}
