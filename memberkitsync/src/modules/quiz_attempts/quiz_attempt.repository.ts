import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { QuizAttempt, QuizAttemptInsert, UpsertQuizAttemptInput } from './quiz_attempt.types.js'

export async function upsertQuizAttempt(input: UpsertQuizAttemptInput): Promise<QuizAttempt> {
  const row: QuizAttemptInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    quiz_mk_id: input.quizMkId,
    quiz_title: input.quizTitle,
    answered_questions_count: input.answeredQuestionsCount,
    correct_answers_count: input.correctAnswersCount,
    started_at: input.startedAt,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { data, error } = await supabase
    .from('quiz_attempts')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert quiz_attempt mk_id=${input.mkId}`, error)
  return data as QuizAttempt
}
