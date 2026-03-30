import type { LessonProgress, LessonProgressInsert, UserActivity, UserActivityInsert } from '../../shared/types.js'

export type { LessonProgress, LessonProgressInsert, UserActivity, UserActivityInsert }

export interface UpsertLessonProgressInput {
  mkId: number | null
  userId: number
  lessonId: number
  progress: number
  completedAt: string | null
}

export interface CreateUserActivityInput {
  userId: number
  eventType: string
  payload: Record<string, unknown>
  occurredAt: string
}
