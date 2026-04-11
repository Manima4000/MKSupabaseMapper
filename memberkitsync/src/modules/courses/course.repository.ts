import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { Category, CategoryInsert, Course, CourseInsert } from './course.types.js'
import type { UpsertCategoryInput, UpsertCourseInput } from './course.types.js'

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

export async function upsertCategory(input: UpsertCategoryInput): Promise<Category> {
  const row: CategoryInsert = {
    mk_id: input.mkId,
    name: input.name,
    position: input.position,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { data, error } = await supabase
    .from('categories')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert category mk_id=${input.mkId}`, error)
  return data as Category
}

export async function getCategoryByMkId(mkId: number): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar category mk_id=${mkId}`, error)
  return data as Category | null
}

// ----------------------------------------------------------------------------
// Courses
// ----------------------------------------------------------------------------

export async function upsertCourse(input: UpsertCourseInput): Promise<Course> {
  const row: CourseInsert = {
    mk_id: input.mkId,
    name: input.name,
    position: input.position,
    category_id: input.categoryId,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { data, error } = await supabase
    .from('courses')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert course mk_id=${input.mkId}`, error)
  return data as Course
}

export async function deleteOrphanedCourses(knownMkIds: number[]): Promise<number> {
  if (knownMkIds.length === 0) return 0

  const { error, count } = await supabase
    .from('courses')
    .delete({ count: 'exact' })
    .not('mk_id', 'in', `(${knownMkIds.join(',')})`)

  if (error) throw new SupabaseError('Falha ao deletar courses órfãos', error)
  return count ?? 0
}

export async function getCourseByMkId(mkId: number): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar course mk_id=${mkId}`, error)
  return data as Course | null
}
