import type { MKEnrollmentPayload, MKUserEnrollment, UpsertEnrollmentInput, EnrollmentStatus } from './enrollment.types.js'

const STATUS_MAP: Record<string, EnrollmentStatus> = {
  active: 'active',
  inactive: 'inactive',
  pending: 'pending',
  expired: 'expired',
}

function normalizeStatus(raw: string): EnrollmentStatus {
  return STATUS_MAP[raw] ?? 'inactive'
}

// Used by the webhook path — payload has id + user.id + classroom_id + expire_date
export function mkEnrollmentToUpsertInput(
  mk: MKEnrollmentPayload,
  userId: number,
  courseId: number,
  classroomId: number | null,
): UpsertEnrollmentInput {
  return {
    mkId: mk.id,
    userId,
    courseId,
    classroomId,
    status: normalizeStatus(mk.status),
    expireDate: mk.expire_date ?? null,
  }
}

// Used by the sync path — inline enrollment from GET /users/{id}
export function mkUserEnrollmentToUpsertInput(
  mk: MKUserEnrollment,
  userId: number,
  courseId: number,
  classroomId: number | null,
): UpsertEnrollmentInput {
  return {
    mkId: mk.id,
    userId,
    courseId,
    classroomId,
    status: normalizeStatus(mk.status),
    expireDate: mk.expire_date ?? null,
  }
}
