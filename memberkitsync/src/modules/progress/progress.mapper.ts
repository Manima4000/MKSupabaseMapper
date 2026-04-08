import type { CreateUserActivityInput } from './progress.types.js'
import type { MKUserActivity, MKTrackable } from '../../sync/memberkit-api.client.js'

export function buildUserActivity(
  userId: number,
  eventType: string,
  mkLessonId: number | null,
  occurredAt?: string,
  trackable?: MKTrackable | null,
  mkCourseId?: number | null,
  mkId?: number | null,
): CreateUserActivityInput {
  return {
    mkId: mkId ?? null,
    userId,
    eventType,
    mkCourseId: mkCourseId ?? null,
    mkLessonId,
    trackable: trackable ?? null,
    occurredAt: occurredAt ?? new Date().toISOString(),
  }
}

// Converte MKUserActivity (do endpoint /users/{id}/activities) para CreateUserActivityInput
export function mkActivityToCreateInput(
  activity: MKUserActivity,
  userId: number,
): CreateUserActivityInput {
  return {
    mkId: activity.id,
    userId,
    eventType: activity.trackable_type,
    mkCourseId: activity.course_id ?? null,
    mkLessonId: activity.lesson_id ?? null,
    trackable: activity.trackable ?? null,
    occurredAt: activity.created_at,
  }
}
