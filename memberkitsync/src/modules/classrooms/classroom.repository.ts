import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { Classroom, ClassroomInsert, UpsertClassroomInput } from './classroom.types.js'

export async function upsertClassroom(input: UpsertClassroomInput): Promise<Classroom> {
  const row: ClassroomInsert = {
    mk_id: input.mkId,
    name: input.name,
  }

  const { data, error } = await supabase
    .from('classrooms')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert classroom mk_id=${input.mkId}`, error)
  return data as Classroom
}

export async function getClassroomByMkId(mkId: number): Promise<Classroom | null> {
  const { data, error } = await supabase
    .from('classrooms')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar classroom mk_id=${mkId}`, error)
  return data as Classroom | null
}

export async function linkMembershipLevelToClassroom(
  membershipLevelId: number,
  classroomId: number,
): Promise<void> {
  const { error } = await supabase
    .from('membership_level_classrooms')
    .upsert(
      { membership_level_id: membershipLevelId, classroom_id: classroomId },
      { onConflict: 'membership_level_id,classroom_id' },
    )

  if (error) {
    throw new SupabaseError(
      `Falha ao vincular membership_level ${membershipLevelId} → classroom ${classroomId}`,
      error,
    )
  }
}
