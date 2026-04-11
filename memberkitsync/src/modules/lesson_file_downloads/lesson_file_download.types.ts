import type { LessonFileDownload, LessonFileDownloadInsert } from '../../shared/types.js'
export type { LessonFileDownload, LessonFileDownloadInsert }

export interface InsertLessonFileDownloadInput {
  userId: number
  lessonId?: number | null
  fileId?: number | null
  occurredAt: string
  createdAt?: string
}
