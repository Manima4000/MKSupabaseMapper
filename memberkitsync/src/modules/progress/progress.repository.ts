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
    mk_id: input.mkId ?? null,
    user_id: input.userId,
    event_type: input.eventType,
    mk_course_id: input.mkCourseId ?? null,
    mk_lesson_id: input.mkLessonId ?? null,
    trackable: input.trackable ?? null,
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

// Upsert por mk_id — usado pelo sync histórico para evitar duplicatas em re-runs
export async function upsertUserActivityByMkId(input: CreateUserActivityInput): Promise<void> {
  const row: UserActivityInsert = {
    mk_id: input.mkId ?? null,
    user_id: input.userId,
    event_type: input.eventType,
    mk_course_id: input.mkCourseId ?? null,
    mk_lesson_id: input.mkLessonId ?? null,
    trackable: input.trackable ?? null,
    occurred_at: input.occurredAt,
  }

  const { error } = await supabase
    .from('user_activities')
    .upsert(row, { onConflict: 'mk_id' })

  if (error) throw new SupabaseError('Falha ao upsert user_activity', error)
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
