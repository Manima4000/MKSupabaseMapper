import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { Enrollment, EnrollmentInsert, UpsertEnrollmentInput } from './enrollment.types.js'

export async function upsertEnrollment(input: UpsertEnrollmentInput): Promise<Enrollment> {
  const row: EnrollmentInsert = {
    mk_id: input.mkId ?? null,
    user_id: input.userId,
    course_id: input.courseId,
    classroom_id: input.classroomId,
    status: input.status,
    expire_date: input.expireDate,
  }

  // Webhook path: conflict on mk_id (the enrollment has a known MemberKit ID).
  // Sync path: conflict on (user_id, course_id) since inline enrollments have no ID.
  const onConflict = input.mkId != null ? 'mk_id' : 'user_id, course_id'

  const { data, error } = await supabase
    .from('enrollments')
    .upsert(row, { onConflict })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert enrollment user_id=${input.userId} course_id=${input.courseId}`, error)
  return data as Enrollment
}

export async function getEnrollmentByMkId(mkId: number): Promise<Enrollment | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar enrollment mk_id=${mkId}`, error)
  return data as Enrollment | null
}
