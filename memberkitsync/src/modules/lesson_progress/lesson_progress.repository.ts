import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { LessonProgressInsert, UpsertLessonProgressInput } from './lesson_progress.types.js'

export async function upsertLessonProgress(input: UpsertLessonProgressInput): Promise<void> {
  const row: LessonProgressInsert = {
    mk_id: input.mkId ?? null,
    user_id: input.userId,
    lesson_id: input.lessonId,
    completed_at: input.completedAt,
    occurred_at: input.occurredAt,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  // Upsert by (user_id, lesson_id) — keep the most recent event
  const { error } = await supabase
    .from('lesson_progress')
    .upsert(row, { onConflict: 'user_id,lesson_id' })

  if (error) throw new SupabaseError(`Falha ao upsert lesson_progress user=${input.userId} lesson=${input.lessonId}`, error)
}
