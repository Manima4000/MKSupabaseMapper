import { logger } from '../../shared/logger.js'
import { mkCategoryToUpsertInput, mkCourseToUpsertInput } from './course.mapper.js'
import { upsertCategory, upsertCourse, getCategoryByMkId } from './course.repository.js'
import { upsertSection } from '../sections/section.repository.js'
import { mkSectionToUpsertInput } from '../sections/section.mapper.js'
import { upsertLesson, upsertLessonVideo, upsertLessonFiles } from '../lessons/lesson.repository.js'
import { mkLessonToUpsertInput, mkVideoToUpsertInput, mkFilesToUpsertInput } from '../lessons/lesson.mapper.js'
import type { MKCoursePayload, Course } from './course.types.js'

// Sincroniza um curso completo: categorias → curso → sections → lessons → vídeos/arquivos
export async function syncCourse(mkCourse: MKCoursePayload): Promise<Course> {
  // 1. Upsert categoria (se existir)
  let categoryId: number | null = null
  if (mkCourse.category) {
    const cat = await upsertCategory(mkCategoryToUpsertInput(mkCourse.category))
    categoryId = cat.id
  }

  // 2. Upsert curso
  const course = await upsertCourse(mkCourseToUpsertInput(mkCourse, categoryId))
  logger.debug({ mkId: mkCourse.id, courseId: course.id }, 'Curso sincronizado')

  // 3. Upsert sections e lessons
  for (const mkSection of mkCourse.sections) {
    const section = await upsertSection(mkSectionToUpsertInput(mkSection, course.id))
    logger.debug({ mkId: mkSection.id, sectionId: section.id }, 'Section sincronizada')

    for (const mkLesson of mkSection.lessons) {
      const lesson = await upsertLesson(mkLessonToUpsertInput(mkLesson, section.id))

      const videoInput = mkVideoToUpsertInput(mkLesson, lesson.id)
      if (videoInput) await upsertLessonVideo(videoInput)

      const fileInputs = mkFilesToUpsertInput(mkLesson, lesson.id)
      if (fileInputs.length > 0) await upsertLessonFiles(fileInputs)
    }
  }

  return course
}

export { getCategoryByMkId }
