import type {
  Course,
  CourseInsert,
  Category,
  CategoryInsert,
} from '../../shared/types.js'
import type { MKCourse, MKCategory } from '../../sync/memberkit-api.client.js'

export type { Course, CourseInsert, Category, CategoryInsert }
export type MKCoursePayload = MKCourse
export type MKCategoryPayload = MKCategory

export interface UpsertCategoryInput {
  mkId: number
  name: string
  position: number
  createdAt?: string
}

export interface UpsertCourseInput {
  mkId: number
  name: string
  position: number
  categoryId: number | null
  createdAt?: string
}
