import type {
  MKLessonPayload,
  UpsertLessonInput,
  UpsertLessonVideoInput,
  UpsertLessonFileInput,
} from './lesson.types.js'

export function mkLessonToUpsertInput(mk: MKLessonPayload, sectionId: number): UpsertLessonInput {
  return {
    mkId: mk.id,
    sectionId,
    title: mk.title,
    position: mk.position,
    slug: mk.slug ?? null,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}

export function mkVideoToUpsertInput(mk: MKLessonPayload, lessonId: number): UpsertLessonVideoInput | null {
  if (!mk.video) return null
  return {
    mkId: mk.video.id ?? null,
    lessonId,
    uid: mk.video.uid ?? null,
    source: mk.video.source ?? null,
    durationSeconds: mk.video.duration ?? null,
  }
}

export function mkFilesToUpsertInput(mk: MKLessonPayload, lessonId: number): UpsertLessonFileInput[] {
  return (mk.files ?? []).map((f) => ({
    mkId: f.id ?? null,
    lessonId,
    filename: f.filename,
    url: f.url,
  }))
}
