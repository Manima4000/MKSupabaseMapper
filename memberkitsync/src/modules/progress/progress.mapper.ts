import type { UpsertLessonProgressInput, CreateUserActivityInput } from './progress.types.js'

// Converte payload de webhook lesson_status_saved para input de progresso
export function webhookLessonProgressToInput(payload: {
  mk_id?: number | null
  user_mk_id: number
  lesson_mk_id: number
  progress: number
  completed_at?: string | null
  user_id: number
  lesson_id: number
}): UpsertLessonProgressInput {
  return {
    mkId: payload.mk_id ?? null,
    userId: payload.user_id,
    lessonId: payload.lesson_id,
    progress: payload.progress,
    completedAt: payload.completed_at ?? null,
  }
}

export function buildUserActivity(
  userId: number,
  eventType: string,
  payload: Record<string, unknown>,
  occurredAt?: string,
): CreateUserActivityInput {
  return {
    userId,
    eventType,
    payload,
    occurredAt: occurredAt ?? new Date().toISOString(),
  }
}
