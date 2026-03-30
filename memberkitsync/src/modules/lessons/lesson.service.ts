import { getLessonByMkId } from './lesson.repository.js'
import type { Lesson } from './lesson.types.js'

export async function resolveLessonByMkId(mkId: number): Promise<Lesson | null> {
  return getLessonByMkId(mkId)
}
