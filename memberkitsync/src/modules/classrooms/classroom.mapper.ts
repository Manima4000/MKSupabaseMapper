import type { MKClassroomPayload, UpsertClassroomInput } from './classroom.types.js'

export function mkClassroomToUpsertInput(mk: MKClassroomPayload): UpsertClassroomInput {
  return {
    mkId: mk.id,
    name: mk.name,
  }
}
