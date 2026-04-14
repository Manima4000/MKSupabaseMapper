import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  Lesson,
  LessonInsert,
  LessonVideo,
  LessonVideoInsert,
  LessonFile,
  LessonFileInsert,
  UpsertLessonInput,
  UpsertLessonVideoInput,
  UpsertLessonFileInput,
} from './lesson.types.js'

export async function upsertLesson(input: UpsertLessonInput): Promise<Lesson> {
  const row: LessonInsert = {
    mk_id: input.mkId,
    section_id: input.sectionId,
    title: input.title,
    position: input.position,
    slug: input.slug,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.updatedAt !== undefined && { updated_at: input.updatedAt }),
  }

  const { data, error } = await supabase
    .from('lessons')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert lesson mk_id=${input.mkId}`, error)
  return data as Lesson
}

export async function upsertLessonVideo(input: UpsertLessonVideoInput): Promise<LessonVideo> {
  const row: LessonVideoInsert = {
    mk_id: input.mkId,
    lesson_id: input.lessonId,
    uid: input.uid,
    source: input.source,
    duration_seconds: input.durationSeconds,
  }

  const { data, error } = await supabase
    .from('lesson_videos')
    .upsert(row, { onConflict: 'lesson_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert lesson_video lesson_id=${input.lessonId}`, error)
  return data as LessonVideo
}

export async function upsertLessonFiles(inputs: UpsertLessonFileInput[]): Promise<void> {
  if (inputs.length === 0) return

  const rows: LessonFileInsert[] = inputs.map((input) => ({
    mk_id: input.mkId,
    lesson_id: input.lessonId,
    filename: input.filename,
    url: input.url,
  }))

  const { error } = await supabase
    .from('lesson_files')
    .upsert(rows, { onConflict: 'mk_id' })

  if (error) throw new SupabaseError('Falha ao upsert lesson_files', error)
}

export async function getLessonByMkId(mkId: number): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select()
    .eq('mk_id', mkId)
    .maybeSingle()

  if (error) throw new SupabaseError(`Falha ao buscar lesson mk_id=${mkId}`, error)
  return data as Lesson | null
}

export async function deleteOrphanedLessons(knownMkIds: number[]): Promise<number> {
  if (knownMkIds.length === 0) return 0

  const { error, count } = await supabase
    .from('lessons')
    .delete({ count: 'exact' })
    .not('mk_id', 'in', `(${knownMkIds.join(',')})`)

  if (error) throw new SupabaseError('Falha ao deletar lessons órfãs', error)
  return count ?? 0
}

export async function getAllLessons(): Promise<Pick<Lesson, 'id' | 'mk_id'>[]> {
  const PAGE_SIZE = 1000
  const results: Pick<Lesson, 'id' | 'mk_id'>[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('lessons')
      .select('id, mk_id')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new SupabaseError('Falha ao buscar todas as lessons', error)
    results.push(...(data as Pick<Lesson, 'id' | 'mk_id'>[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return results
}
