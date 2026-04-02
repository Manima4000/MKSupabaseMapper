import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { Comment, CommentInsert, UpsertCommentInput } from './comment.types.js'

export async function upsertComment(input: UpsertCommentInput): Promise<Comment> {
  const row: CommentInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    lesson_id: input.lessonId,
    body: input.body,
    status: input.status,
  }

  const { data, error } = await supabase
    .from('comments')
    .upsert(row, { onConflict: 'mk_id' })
    .select()
    .single()

  if (error) throw new SupabaseError(`Falha ao upsert comment mk_id=${input.mkId}`, error)
  return data as Comment
}
