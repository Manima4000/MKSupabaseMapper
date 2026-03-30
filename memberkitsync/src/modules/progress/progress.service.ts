import { logger } from '../../shared/logger.js'
import { webhookLessonProgressToInput, buildUserActivity } from './progress.mapper.js'
import { upsertLessonProgress, createUserActivity } from './progress.repository.js'
import type { LessonProgress, UserActivity } from './progress.types.js'

export interface LessonProgressWebhookPayload {
  mk_id?: number | null
  user_id: number
  lesson_id: number
  progress: number
  completed_at?: string | null
  // campos extras do webhook para registrar no log de atividades
  user_mk_id: number
  lesson_mk_id: number
  raw_payload: Record<string, unknown>
}

export async function handleLessonProgress(payload: LessonProgressWebhookPayload): Promise<LessonProgress> {
  const input = webhookLessonProgressToInput(payload)
  const progress = await upsertLessonProgress(input)
  logger.debug({ userId: payload.user_id, lessonId: payload.lesson_id, pct: payload.progress }, 'Progresso atualizado')
  return progress
}

export async function logUserActivity(
  userId: number,
  eventType: string,
  rawPayload: Record<string, unknown>,
  occurredAt?: string,
): Promise<UserActivity> {
  const input = buildUserActivity(userId, eventType, rawPayload, occurredAt)
  return createUserActivity(input)
}
