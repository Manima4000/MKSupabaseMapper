import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { LessonFileDownloadInsert, InsertLessonFileDownloadInput } from './lesson_file_download.types.js'

export async function insertLessonFileDownload(input: InsertLessonFileDownloadInput): Promise<void> {
  const row: LessonFileDownloadInsert = {
    user_id: input.userId,
    lesson_id: input.lessonId ?? null,
    file_id: input.fileId ?? null,
    occurred_at: input.occurredAt,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { error } = await supabase
    .from('lesson_file_downloads')
    .upsert(row, { onConflict: 'user_id,occurred_at' })

  if (error) throw new SupabaseError(`Falha ao upsert lesson_file_download user=${input.userId}`, error)
}
