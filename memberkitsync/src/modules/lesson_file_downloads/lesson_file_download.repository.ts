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

  // Quando file_id é conhecido: deduplicar por (user_id, file_id) — mesmo arquivo não é duplicado.
  // Quando file_id é null (campo ausente no payload): apenas INSERT, sem dedup possível.
  // O índice único (user_id, file_id) não deduplica NULLs no PostgreSQL (NULL != NULL).
  if (input.fileId != null) {
    const { error } = await supabase
      .from('lesson_file_downloads')
      .upsert(row, { onConflict: 'user_id,file_id' })
    if (error) throw new SupabaseError(`Falha ao upsert lesson_file_download user=${input.userId}`, error)
  } else {
    const { error } = await supabase
      .from('lesson_file_downloads')
      .insert(row)
    if (error) throw new SupabaseError(`Falha ao inserir lesson_file_download user=${input.userId}`, error)
  }
}
