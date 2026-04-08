import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { LessonRating, LessonRatingInsert, UpsertLessonRatingInput } from './lesson_rating.types.js'

export async function upsertLessonRating(input: UpsertLessonRatingInput): Promise<LessonRating> {
  const row: LessonRatingInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    lesson_id: input.lessonId,
    stars: input.stars,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { data, error } = await supabase
    .from('lesson_ratings')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert lesson_rating mk_id=${input.mkId}`, error)
  return data as LessonRating
}
