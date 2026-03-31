import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock state so it can be referenced inside vi.mock factories AND tests
// ---------------------------------------------------------------------------
const mockSingle = vi.hoisted(() => vi.fn())
const mockEq = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest before any import)
// ---------------------------------------------------------------------------
vi.mock('../../config/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: mockSingle })),
      })),
      update: vi.fn(() => ({ eq: mockEq })),
    })),
  },
}))

vi.mock('../../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../modules/users/user.service.js', () => ({
  syncUser: vi.fn(),
}))

vi.mock('../../modules/memberships/membership.service.js', () => ({
  syncSubscription: vi.fn(),
  syncPlan: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.repository.js', () => ({
  upsertEnrollment: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.mapper.js', () => ({
  mkEnrollmentToUpsertInput: vi.fn((data, userId, courseId, classroomId) => ({
    mkId: data.id, userId, courseId, classroomId, status: data.status, expireDate: data.expire_at,
  })),
}))

vi.mock('../../modules/progress/progress.service.js', () => ({
  handleLessonProgress: vi.fn(),
  logUserActivity: vi.fn(),
}))

vi.mock('../../modules/users/user.repository.js', () => ({
  getUserByMkId: vi.fn(),
}))

vi.mock('../../modules/memberships/membership.repository.js', () => ({
  getMembershipLevelByMkId: vi.fn(),
}))

vi.mock('../../modules/courses/course.repository.js', () => ({
  getCourseByMkId: vi.fn(),
}))

vi.mock('../../modules/classrooms/classroom.repository.js', () => ({
  getClassroomByMkId: vi.fn(),
}))

vi.mock('../../modules/lessons/lesson.repository.js', () => ({
  getLessonByMkId: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are declared
// ---------------------------------------------------------------------------
import { dispatchWebhook } from '../webhook.handler.js'
import { syncUser } from '../../modules/users/user.service.js'
import { syncSubscription } from '../../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../../modules/enrollments/enrollment.repository.js'
import { handleLessonProgress, logUserActivity } from '../../modules/progress/progress.service.js'
import { getUserByMkId } from '../../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../../modules/classrooms/classroom.repository.js'
import { getLessonByMkId } from '../../modules/lessons/lesson.repository.js'

const mockSyncUser = vi.mocked(syncUser)
const mockSyncSubscription = vi.mocked(syncSubscription)
const mockUpsertEnrollment = vi.mocked(upsertEnrollment)
const mockHandleLessonProgress = vi.mocked(handleLessonProgress)
const mockLogUserActivity = vi.mocked(logUserActivity)
const mockGetUserByMkId = vi.mocked(getUserByMkId)
const mockGetMembershipLevelByMkId = vi.mocked(getMembershipLevelByMkId)
const mockGetCourseByMkId = vi.mocked(getCourseByMkId)
const mockGetClassroomByMkId = vi.mocked(getClassroomByMkId)
const mockGetLessonByMkId = vi.mocked(getLessonByMkId)

beforeEach(() => {
  vi.clearAllMocks()
  // Default: supabase webhook_log insert returns id = 1
  mockSingle.mockResolvedValue({ data: { id: 1 }, error: null })
  mockEq.mockResolvedValue({ error: null })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchWebhook', () => {
  describe('member.created / member.updated', () => {
    const memberData = {
      id: 42,
      name: 'João',
      email: 'joao@test.com',
      blocked: false,
      unlimited: false,
      sign_in_count: 5,
      current_sign_in_at: null,
      last_seen_at: null,
      meta: {},
    }

    it('calls syncUser with the member data for member.created', async () => {
      mockSyncUser.mockResolvedValue({ id: 1, mk_id: 42 } as never)

      await dispatchWebhook({ event: 'member.created', fired_at: '2024-01-01T00:00:00Z', data: memberData })

      expect(mockSyncUser).toHaveBeenCalledOnce()
      expect(mockSyncUser).toHaveBeenCalledWith(memberData)
    })

    it('calls syncUser for member.updated', async () => {
      mockSyncUser.mockResolvedValue({ id: 1, mk_id: 42 } as never)

      await dispatchWebhook({ event: 'member.updated', fired_at: '2024-01-01T00:00:00Z', data: memberData })

      expect(mockSyncUser).toHaveBeenCalledOnce()
    })
  })

  describe('subscription events', () => {
    const subData = { id: 200, member_id: 5, plan_id: 7, status: 'active', expire_at: null }

    it('calls syncSubscription when user and level exist', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10, mk_id: 5 } as never)
      mockGetMembershipLevelByMkId.mockResolvedValue({ id: 20, mk_id: 7 } as never)
      mockSyncSubscription.mockResolvedValue(undefined as never)

      await dispatchWebhook({ event: 'subscription.created', fired_at: '2024-01-01T00:00:00Z', data: subData })

      expect(mockSyncSubscription).toHaveBeenCalledWith(subData, 10, 20)
    })

    it('skips syncSubscription and warns when user is not found', async () => {
      mockGetUserByMkId.mockResolvedValue(null)
      mockGetMembershipLevelByMkId.mockResolvedValue({ id: 20 } as never)

      await dispatchWebhook({ event: 'subscription.updated', fired_at: '2024-01-01T00:00:00Z', data: subData })

      expect(mockSyncSubscription).not.toHaveBeenCalled()
    })

    it('skips syncSubscription and warns when membership level is not found', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetMembershipLevelByMkId.mockResolvedValue(null)

      await dispatchWebhook({ event: 'subscription.expired', fired_at: '2024-01-01T00:00:00Z', data: subData })

      expect(mockSyncSubscription).not.toHaveBeenCalled()
    })
  })

  describe('enrollment events', () => {
    const enrollData = { id: 300, member_id: 5, course_id: 8, member_area_id: 3, status: 'active', expire_at: null }

    it('calls upsertEnrollment when user and course exist', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockGetClassroomByMkId.mockResolvedValue({ id: 30 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined as never)

      await dispatchWebhook({ event: 'enrollment.created', fired_at: '2024-01-01T00:00:00Z', data: enrollData })

      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })

    it('skips upsertEnrollment when user is not found', async () => {
      mockGetUserByMkId.mockResolvedValue(null)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)

      await dispatchWebhook({ event: 'enrollment.updated', fired_at: '2024-01-01T00:00:00Z', data: enrollData })

      expect(mockUpsertEnrollment).not.toHaveBeenCalled()
    })

    it('skips upsertEnrollment when course is not found', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue(null)

      await dispatchWebhook({ event: 'enrollment.created', fired_at: '2024-01-01T00:00:00Z', data: enrollData })

      expect(mockUpsertEnrollment).not.toHaveBeenCalled()
    })

    it('proceeds without classroom when member_area_id is null', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined as never)

      await dispatchWebhook({
        event: 'enrollment.created',
        fired_at: '2024-01-01T00:00:00Z',
        data: { ...enrollData, member_area_id: null },
      })

      expect(mockGetClassroomByMkId).not.toHaveBeenCalled()
      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })
  })

  describe('lesson_status_saved', () => {
    const lessonData = { id: 400, member_id: 5, lesson_id: 9, progress: 80, completed_at: null }

    it('calls handleLessonProgress and logUserActivity when user and lesson exist', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetLessonByMkId.mockResolvedValue({ id: 30 } as never)
      mockHandleLessonProgress.mockResolvedValue(undefined as never)
      mockLogUserActivity.mockResolvedValue(undefined as never)

      await dispatchWebhook({ event: 'lesson_status_saved', fired_at: '2024-01-01T00:00:00Z', data: lessonData })

      expect(mockHandleLessonProgress).toHaveBeenCalledOnce()
      expect(mockLogUserActivity).toHaveBeenCalledWith(10, 'lesson_status_saved', lessonData, '2024-01-01T00:00:00Z')
    })

    it('skips progress when user is not found', async () => {
      mockGetUserByMkId.mockResolvedValue(null)
      mockGetLessonByMkId.mockResolvedValue({ id: 30 } as never)

      await dispatchWebhook({ event: 'lesson_status_saved', fired_at: '2024-01-01T00:00:00Z', data: lessonData })

      expect(mockHandleLessonProgress).not.toHaveBeenCalled()
    })

    it('skips progress when lesson is not found', async () => {
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetLessonByMkId.mockResolvedValue(null)

      await dispatchWebhook({ event: 'lesson_status_saved', fired_at: '2024-01-01T00:00:00Z', data: lessonData })

      expect(mockHandleLessonProgress).not.toHaveBeenCalled()
    })
  })

  describe('unknown event', () => {
    it('does not throw and logs a warning', async () => {
      await expect(
        dispatchWebhook({ event: 'comment.created', fired_at: '2024-01-01T00:00:00Z', data: {} }),
      ).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('updates webhook_log to "failed" when handler throws, then re-throws', async () => {
      const err = new Error('DB explodiu')
      mockSyncUser.mockRejectedValue(err)

      await expect(
        dispatchWebhook({ event: 'member.created', fired_at: '2024-01-01T00:00:00Z', data: { id: 1, name: 'X', email: 'x@x.com', blocked: false, unlimited: false, sign_in_count: 0, current_sign_in_at: null, last_seen_at: null, meta: {} } }),
      ).rejects.toThrow('DB explodiu')

      // updateWebhookLog('failed') triggers supabase.from().update().eq()
      expect(mockEq).toHaveBeenCalledWith('id', 1)
    })
  })
})
