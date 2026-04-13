import type { MKQuizAttempt } from '../../sync/memberkit-api.client.js'
import type { UpsertQuizAttemptInput } from './quiz_attempt.types.js'

export function mkQuizAttemptToUpsertInput(
  mk: MKQuizAttempt,
  userId: number,
): UpsertQuizAttemptInput {
  return {
    mkId: mk.id,
    userId,
    quizMkId: mk.quiz.id,
    quizTitle: mk.quiz.title,
    answeredQuestionsCount: mk.answered_questions_count,
    correctAnswersCount: mk.correct_answers_count,
    startedAt: mk.started_at ?? null,
    ...(mk.created_at !== undefined && { createdAt: mk.created_at }),
    ...(mk.updated_at !== undefined && { updatedAt: mk.updated_at }),
  }
}
