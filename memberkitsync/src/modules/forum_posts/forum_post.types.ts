import type { ForumPost, ForumPostInsert } from '../../shared/types.js'
export type { ForumPost, ForumPostInsert }

export interface UpsertForumPostInput {
  mkId: number
  userId: number
  forumId: number
  title: string
  occurredAt: string
  createdAt?: string
}
