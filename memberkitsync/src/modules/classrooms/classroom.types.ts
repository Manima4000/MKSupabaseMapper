import type { Classroom, ClassroomInsert } from '../../shared/types.js'
import type { MKClassroom } from '../../sync/memberkit-api.client.js'

export type { Classroom, ClassroomInsert }
export type MKClassroomPayload = MKClassroom

export interface UpsertClassroomInput {
  mkId: number
  name: string
  createdAt?: string
}
