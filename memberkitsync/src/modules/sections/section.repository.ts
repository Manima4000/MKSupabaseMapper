import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { Section, SectionInsert, UpsertSectionInput } from './section.types.js'

export async function upsertSection(input: UpsertSectionInput): Promise<Section> {
  const row: SectionInsert = {
    mk_id: input.mkId,
    course_id: input.courseId,
    name: input.name,
    position: input.position,
    slug: input.slug,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.updatedAt !== undefined && { updated_at: input.updatedAt }),
  }

  const { data, error } = await supabase
    .from('sections')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert section mk_id=${input.mkId}`, error)
  return data as Section
}

export async function deleteOrphanedSections(knownMkIds: number[]): Promise<number> {
  if (knownMkIds.length === 0) return 0

  const { error, count } = await supabase
    .from('sections')
    .delete({ count: 'exact' })
    .not('mk_id', 'in', `(${knownMkIds.join(',')})`)

  if (error) throw new SupabaseError('Falha ao deletar sections órfãs', error)
  return count ?? 0
}

export async function getSectionByMkId(mkId: number): Promise<Section | null> {
  const { data, error } = await supabase
    .from('sections')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar section mk_id=${mkId}`, error)
  return data as Section | null
}
