import type { LessonRating, LessonRatingInsert } from '../../shared/types.js'
export type { LessonRating, LessonRatingInsert }

export interface UpsertLessonRatingInput {
  mkId: number
  userId: number
  lessonId: number
  stars: number
}
