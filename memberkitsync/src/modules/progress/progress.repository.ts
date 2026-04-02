import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  UserActivity,
  UserActivityInsert,
  CreateUserActivityInput,
} from './progress.types.js'

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
