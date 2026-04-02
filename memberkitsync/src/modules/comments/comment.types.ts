import type { Comment, CommentInsert, CommentStatus } from '../../shared/types.js'
export type { Comment, CommentInsert, CommentStatus }

export interface UpsertCommentInput {
  mkId: number
  userId: number    // internal DB user_id (already resolved)
  lessonId: number  // internal DB lesson_id (already resolved)
  body: string
  status: CommentStatus
}
