import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  LessonProgress,
  LessonProgressInsert,
  UserActivity,
  UserActivityInsert,
  UpsertLessonProgressInput,
  CreateUserActivityInput,
} from './progress.types.js'

export async function upsertLessonProgress(input: UpsertLessonProgressInput): Promise<LessonProgress> {
  const row: LessonProgressInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    lesson_id: input.lessonId,
    progress: input.progress,
    completed_at: input.completedAt,
  }

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert(row, { onConflict: 'user_id,lesson_id' })
    .select()
    .single()

  if (error) {
    throw new SupabaseError(
      `Falha ao upsert lesson_progress user=${input.userId} lesson=${input.lessonId}`,
      error,
    )
  }
  return data as LessonProgress
}

export async function createUserActivity(input: CreateUserActivityInput): Promise<UserActivity> {
  const row: UserActivityInsert = {
    user_id: input.userId,
    event_type: input.eventType,
    payload: input.payload,
    occurred_at: input.occurredAt,
  }

  const { data, error } = await supabase
    .from('user_activities')
    .insert(row)
    .select()
    .single()

  if (error) throw new SupabaseError('Falha ao criar user_activity', error)
  return data as UserActivity
}

export async function getLessonProgressByUserAndLesson(
  userId: number,
  lessonId: number,
): Promise<LessonProgress | null> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select()
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (error) throw new SupabaseError('Falha ao buscar lesson_progress', error)
  return data as LessonProgress | null
}
