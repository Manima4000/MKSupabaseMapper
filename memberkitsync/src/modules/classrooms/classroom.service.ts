import { mkClassroomToUpsertInput } from './classroom.mapper.js'
import { upsertClassroom } from './classroom.repository.js'
import { getCourseByName } from '../courses/course.repository.js'
import type { Classroom, MKClassroomPayload } from './classroom.types.js'

// Resolves course_id from course_name (exact match against courses.name) before upserting.
export async function syncClassroom(mk: MKClassroomPayload): Promise<Classroom> {
  const course = await getCourseByName(mk.course_name)
  return upsertClassroom(mkClassroomToUpsertInput(mk, course?.id ?? null))
}
