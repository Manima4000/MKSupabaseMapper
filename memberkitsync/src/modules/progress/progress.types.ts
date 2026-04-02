import type { UserActivity, UserActivityInsert } from '../../shared/types.js'
import type { MKTrackable } from '../../sync/memberkit-api.client.js'

export type { UserActivity, UserActivityInsert }

export interface CreateUserActivityInput {
  mkId?: number | null
  userId: number
  eventType: string
  mkCourseId?: number | null
  mkLessonId?: number | null
  trackable?: MKTrackable | null
  occurredAt: string
}
