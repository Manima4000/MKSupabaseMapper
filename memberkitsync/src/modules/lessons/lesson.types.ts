import type {
  Lesson,
  LessonInsert,
  LessonVideo,
  LessonVideoInsert,
  LessonFile,
  LessonFileInsert,
} from '../../shared/types.js'
import type { MKLesson } from '../../sync/memberkit-api.client.js'

export type { Lesson, LessonInsert, LessonVideo, LessonVideoInsert, LessonFile, LessonFileInsert }
export type MKLessonPayload = MKLesson

export interface UpsertLessonInput {
  mkId: number
  sectionId: number
  title: string
  position: number
  slug: string | null
  createdAt?: string
  updatedAt?: string
}

export interface UpsertLessonVideoInput {
  mkId: number | null
  lessonId: number
  uid: string | null
  source: string | null
  durationSeconds: number | null
}

export interface UpsertLessonFileInput {
  mkId: number | null
  lessonId: number
  filename: string
  url: string
}
