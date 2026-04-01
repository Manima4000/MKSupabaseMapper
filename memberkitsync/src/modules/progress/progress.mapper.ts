import type { UpsertLessonProgressInput, CreateUserActivityInput } from './progress.types.js'
import type { MKUserActivity } from '../../sync/memberkit-api.client.js'

// Converte payload de webhook lesson_status_saved para input de progresso
export function webhookLessonProgressToInput(payload: {
  mk_id?: number | null
  user_mk_id: number
  lesson_mk_id: number
  progress: number
  completed_at?: string | null
  user_id: number
  lesson_id: number
}): UpsertLessonProgressInput {
  return {
    mkId: payload.mk_id ?? null,
    userId: payload.user_id,
    lessonId: payload.lesson_id,
    progress: payload.progress,
    completedAt: payload.completed_at ?? null,
  }
}

export function buildUserActivity(
  userId: number,
  eventType: string,
  mkLessonId: number | null,
  occurredAt?: string,
): CreateUserActivityInput {
  return {
    userId,
    eventType,
    mkLessonId,
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
