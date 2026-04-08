import type { QuizAttempt, QuizAttemptInsert } from '../../shared/types.js'
export type { QuizAttempt, QuizAttemptInsert }

export interface UpsertQuizAttemptInput {
  mkId: number
  userId: number         // internal DB user_id (already resolved)
  quizMkId: number
  quizTitle: string
  answeredQuestionsCount: number
  correctAnswersCount: number
  startedAt: string | null
  createdAt?: string
}
