import type {
  MKCoursePayload,
  MKCategoryPayload,
  UpsertCategoryInput,
  UpsertCourseInput,
} from './course.types.js'

export function mkCategoryToUpsertInput(mk: MKCategoryPayload): UpsertCategoryInput {
  return {
    mkId: mk.id,
    name: mk.name,
    position: mk.position,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
  }
}

export function mkCourseToUpsertInput(mk: MKCoursePayload, categoryId: number | null): UpsertCourseInput {
  return {
    mkId: mk.id,
    name: mk.name,
    position: mk.position,
    categoryId,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
