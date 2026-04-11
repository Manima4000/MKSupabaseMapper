import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { ForumCommentInsert, UpsertForumCommentInput } from './forum_comment.types.js'

export async function upsertForumComment(input: UpsertForumCommentInput): Promise<void> {
  const row: ForumCommentInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    forum_post_id: input.forumPostId,
    content: input.content,
    occurred_at: input.occurredAt,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { error } = await supabase
    .from('forum_comments')
    .upsert(row, { onConflict: 'mk_id' })

  if (error) throw new SupabaseError(`Falha ao upsert forum_comment mk_id=${input.mkId}`, error)
}
