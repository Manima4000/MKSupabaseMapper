import type { Enrollment, EnrollmentInsert, EnrollmentStatus } from '../../shared/types.js'
import type { MKEnrollment } from '../../sync/memberkit-api.client.js'

export type { Enrollment, EnrollmentInsert, EnrollmentStatus }
export type MKEnrollmentPayload = MKEnrollment

export interface UpsertEnrollmentInput {
  mkId: number
  userId: number
  courseId: number
  classroomId: number | null
  status: EnrollmentStatus
  expireDate: string | null
}
