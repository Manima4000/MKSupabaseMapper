import type { MKSectionPayload, UpsertSectionInput } from './section.types.js'

export function mkSectionToUpsertInput(mk: MKSectionPayload, courseId: number): UpsertSectionInput {
  return {
    mkId: mk.id,
    courseId,
    name: mk.name,
    position: mk.position,
    slug: mk.slug ?? null,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
