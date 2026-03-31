import type { Enrollment, EnrollmentInsert, EnrollmentStatus } from '../../shared/types.js'
import type { MKEnrollment, MKUserEnrollment } from '../../sync/memberkit-api.client.js'

export type { Enrollment, EnrollmentInsert, EnrollmentStatus }

// Webhook payload shape (has id + member_id)
export type MKEnrollmentPayload = MKEnrollment

// Inline shape from GET /users/{id} (no id, uses classroom_id + expire_date)
export type { MKUserEnrollment }

export interface UpsertEnrollmentInput {
  mkId?: number | null
  userId: number
  courseId: number
  classroomId: number | null
  status: EnrollmentStatus
  expireDate: string | null
}
