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
  mkId?: number | null
  userId: number
  eventType: string
  mkCourseId?: number | null
  mkLessonId?: number | null
  trackable?: Record<string, unknown> | null
  occurredAt: string
}
