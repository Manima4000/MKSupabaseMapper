import type { MKClassroomPayload, UpsertClassroomInput } from './classroom.types.js'

export function mkClassroomToUpsertInput(
  mk: MKClassroomPayload,
  courseId: number | null,
): UpsertClassroomInput {
  return {
    mkId: mk.id,
    name: mk.name,
    master: mk.master,
    courseName: mk.course_name,
    courseId,
    usersCount: mk.users_count,
    commentsCount: mk.comments_count,
    averageProgress: mk.average_progress,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
