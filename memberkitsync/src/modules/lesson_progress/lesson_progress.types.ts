import type { LessonProgress, LessonProgressInsert } from '../../shared/types.js'
export type { LessonProgress, LessonProgressInsert }

export interface UpsertLessonProgressInput {
  mkId?: number | null
  userId: number
  lessonId: number
  completedAt: string | null
  occurredAt: string
  createdAt?: string
}
