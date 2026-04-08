import type { MKComment } from '../../sync/memberkit-api.client.js'
import type { UpsertCommentInput, CommentStatus } from './comment.types.js'

export function mkCommentToUpsertInput(
  mk: MKComment,
  userId: number,
  lessonId: number,
): UpsertCommentInput {
  return {
    mkId: mk.id,
    userId,
    lessonId,
    body: mk.content,
    status: (mk.status as CommentStatus) ?? 'pending',
    createdAt: mk.created_at,
  }
}
