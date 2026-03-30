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
  }
}

export function mkCourseToUpsertInput(mk: MKCoursePayload, categoryId: number | null): UpsertCourseInput {
  return {
    mkId: mk.id,
    name: mk.name,
    position: mk.position,
    categoryId,
  }
}
