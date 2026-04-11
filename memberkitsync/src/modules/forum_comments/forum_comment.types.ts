import type { ForumComment, ForumCommentInsert } from '../../shared/types.js'
export type { ForumComment, ForumCommentInsert }

export interface UpsertForumCommentInput {
  mkId: number
  userId: number
  forumPostId: number
  content: string
  occurredAt: string
  createdAt?: string
}
