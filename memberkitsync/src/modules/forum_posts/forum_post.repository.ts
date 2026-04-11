import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type { ForumPostInsert, UpsertForumPostInput } from './forum_post.types.js'

export async function upsertForumPost(input: UpsertForumPostInput): Promise<void> {
  const row: ForumPostInsert = {
    mk_id: input.mkId,
    user_id: input.userId,
    forum_id: input.forumId,
    title: input.title,
    occurred_at: input.occurredAt,
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  }

  const { error } = await supabase
    .from('forum_posts')
    .upsert(row, { onConflict: 'mk_id' })

  if (error) throw new SupabaseError(`Falha ao upsert forum_post mk_id=${input.mkId}`, error)
}
