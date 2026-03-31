import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('../../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../shared/pagination.js', () => ({
  fetchAllPages: vi.fn(),
}))

vi.mock('../../modules/courses/course.service.js', () => ({
  syncCourse: vi.fn(),
}))

vi.mock('../../modules/classrooms/classroom.repository.js', () => ({
  upsertClassroom: vi.fn(),
  getClassroomByMkId: vi.fn(),
}))

vi.mock('../../modules/classrooms/classroom.mapper.js', () => ({
  mkClassroomToUpsertInput: vi.fn((mk) => ({ mkId: mk.id, name: mk.name })),
}))

vi.mock('../../modules/memberships/membership.service.js', () => ({
  syncPlan: vi.fn(),
  syncSubscription: vi.fn(),
}))

vi.mock('../../modules/users/user.service.js', () => ({
  syncUser: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.repository.js', () => ({
  upsertEnrollment: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.mapper.js', () => ({
  mkEnrollmentToUpsertInput: vi.fn((mk, userId, courseId, classroomId) => ({
    mkId: mk.id, userId, courseId, classroomId,
  })),
  mkUserEnrollmentToUpsertInput: vi.fn((mk, userId, courseId, classroomId) => ({
    mkId: null, userId, courseId, classroomId,
  })),
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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { SyncOrchestrator } from '../sync.orchestrator.js'
import { fetchAllPages } from '../../shared/pagination.js'
import { syncCourse } from '../../modules/courses/course.service.js'
import { upsertClassroom } from '../../modules/classrooms/classroom.repository.js'
import { syncPlan, syncSubscription } from '../../modules/memberships/membership.service.js'
import { syncUser } from '../../modules/users/user.service.js'
import { upsertEnrollment } from '../../modules/enrollments/enrollment.repository.js'
import { getUserByMkId } from '../../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../../modules/classrooms/classroom.repository.js'

const mockFetchAllPages = vi.mocked(fetchAllPages)
const mockSyncCourse = vi.mocked(syncCourse)
const mockUpsertClassroom = vi.mocked(upsertClassroom)
const mockSyncPlan = vi.mocked(syncPlan)
const mockSyncUser = vi.mocked(syncUser)
const mockSyncSubscription = vi.mocked(syncSubscription)
const mockUpsertEnrollment = vi.mocked(upsertEnrollment)
const mockGetUserByMkId = vi.mocked(getUserByMkId)
const mockGetMembershipLevelByMkId = vi.mocked(getMembershipLevelByMkId)
const mockGetCourseByMkId = vi.mocked(getCourseByMkId)
const mockGetClassroomByMkId = vi.mocked(getClassroomByMkId)

// ---------------------------------------------------------------------------
// Mock MemberKitClient factory
// ---------------------------------------------------------------------------
function makeMockClient() {
  return {
    getCourses: vi.fn().mockResolvedValue([]),
    getClassrooms: vi.fn().mockResolvedValue([]),
    getMembershipLevels: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn(),
    getMemberships: vi.fn(),
    getUserDetail: vi.fn().mockResolvedValue({ enrollments: [] }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncOrchestrator.run()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: paginated endpoints return empty arrays
    mockFetchAllPages.mockResolvedValue([])
  })

  it('calls all sync stages when client returns empty data', async () => {
    const client = makeMockClient()
    const orchestrator = new SyncOrchestrator(client as never)

    await orchestrator.run()

    expect(client.getCourses).toHaveBeenCalledOnce()
    expect(client.getClassrooms).toHaveBeenCalledOnce()
    expect(client.getMembershipLevels).toHaveBeenCalledOnce()
    // fetchAllPages is used for members and subscriptions only
    expect(mockFetchAllPages).toHaveBeenCalledTimes(2)
    // getUserDetail is not called when there are no members
    expect(client.getUserDetail).not.toHaveBeenCalled()
  })

  describe('syncCatalog', () => {
    it('calls syncCourse once per course returned by getCourses()', async () => {
      const client = makeMockClient()
      const courses = [
        { id: 1, name: 'Curso A', position: 1, category: null, sections: [] },
        { id: 2, name: 'Curso B', position: 2, category: null, sections: [] },
      ]
      client.getCourses.mockResolvedValue(courses)
      mockSyncCourse.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncCourse).toHaveBeenCalledTimes(2)
      expect(mockSyncCourse).toHaveBeenCalledWith(courses[0])
      expect(mockSyncCourse).toHaveBeenCalledWith(courses[1])
    })

    it('continues syncing remaining courses when one course throws', async () => {
      const client = makeMockClient()
      client.getCourses.mockResolvedValue([
        { id: 1, name: 'Bad Course', position: 1, category: null, sections: [] },
        { id: 2, name: 'Good Course', position: 2, category: null, sections: [] },
      ])
      mockSyncCourse
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await expect(orchestrator.run()).resolves.toBeUndefined()

      expect(mockSyncCourse).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncClassrooms', () => {
    it('calls upsertClassroom once per classroom', async () => {
      const client = makeMockClient()
      client.getClassrooms.mockResolvedValue([
        { id: 10, name: 'Turma ESA' },
        { id: 11, name: 'Turma EsSA' },
      ])
      mockUpsertClassroom.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertClassroom).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncPlans', () => {
    it('calls syncPlan once per plan', async () => {
      const client = makeMockClient()
      client.getMembershipLevels.mockResolvedValue([
        { id: 1, name: 'Plano A', trial_period: 0, classroom_ids: [] },
        { id: 2, name: 'Plano B', trial_period: 7, classroom_ids: [] },
      ])
      mockSyncPlan.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncPlan).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncMembers', () => {
    it('calls syncUser once per member returned by fetchAllPages', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', blocked: false, unlimited: false, sign_in_count: 1, current_sign_in_at: null, last_seen_at: null, meta: {} },
        { id: 2, name: 'Bob', email: 'bob@test.com', blocked: false, unlimited: false, sign_in_count: 0, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)  // members call
        .mockResolvedValueOnce([])        // subscriptions call
      mockSyncUser.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncUser).toHaveBeenCalledTimes(2)
    })

    it('continues syncing remaining members when one throws', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Bad', email: 'bad@test.com', blocked: false, unlimited: false, sign_in_count: 0, current_sign_in_at: null, last_seen_at: null, meta: {} },
        { id: 2, name: 'Good', email: 'good@test.com', blocked: false, unlimited: false, sign_in_count: 0, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)
        .mockResolvedValueOnce([])
      mockSyncUser
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await expect(orchestrator.run()).resolves.toBeUndefined()

      expect(mockSyncUser).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncSubscriptions', () => {
    it('calls syncSubscription when user and level are found', async () => {
      const client = makeMockClient()
      const subs = [{ id: 100, member_id: 1, plan_id: 2, status: 'active', expire_at: null }]
      mockFetchAllPages
        .mockResolvedValueOnce([])   // members
        .mockResolvedValueOnce(subs) // subscriptions
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetMembershipLevelByMkId.mockResolvedValue({ id: 20 } as never)
      mockSyncSubscription.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncSubscription).toHaveBeenCalledWith(subs[0], 10, 20)
    })

    it('skips subscription when user is not found', async () => {
      const client = makeMockClient()
      mockFetchAllPages
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, member_id: 99, plan_id: 2, status: 'active', expire_at: null }])
      mockGetUserByMkId.mockResolvedValue(null)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncSubscription).not.toHaveBeenCalled()
    })
  })

  describe('syncEnrollments', () => {
    it('calls getUserDetail once per member and upsertEnrollment per enrollment', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', blocked: false, unlimited: false, sign_in_count: 1, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)  // members
        .mockResolvedValueOnce([])        // subscriptions
      mockSyncUser.mockResolvedValue(undefined as never)

      const enrollments = [
        { status: 'active', course_id: 2, classroom_id: 3, expire_date: null },
      ]
      client.getUserDetail.mockResolvedValue({ ...members[0], enrollments })
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockGetClassroomByMkId.mockResolvedValue({ id: 30 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(client.getUserDetail).toHaveBeenCalledWith(1)
      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })

    it('skips enrollments when course is not found', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', blocked: false, unlimited: false, sign_in_count: 1, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)
        .mockResolvedValueOnce([])
      mockSyncUser.mockResolvedValue(undefined as never)

      client.getUserDetail.mockResolvedValue({
        ...members[0],
        enrollments: [{ status: 'active', course_id: 999, classroom_id: null, expire_date: null }],
      })
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue(null)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertEnrollment).not.toHaveBeenCalled()
    })

    it('skips all enrollments when user is not found in DB', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', blocked: false, unlimited: false, sign_in_count: 1, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)
        .mockResolvedValueOnce([])
      mockSyncUser.mockResolvedValue(undefined as never)

      client.getUserDetail.mockResolvedValue({
        ...members[0],
        enrollments: [{ status: 'active', course_id: 2, classroom_id: null, expire_date: null }],
      })
      mockGetUserByMkId.mockResolvedValue(null)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertEnrollment).not.toHaveBeenCalled()
    })

    it('handles null classroom_id (no classroom lookup)', async () => {
      const client = makeMockClient()
      const members = [
        { id: 1, name: 'Alice', email: 'alice@test.com', blocked: false, unlimited: false, sign_in_count: 1, current_sign_in_at: null, last_seen_at: null, meta: {} },
      ]
      mockFetchAllPages
        .mockResolvedValueOnce(members)
        .mockResolvedValueOnce([])
      mockSyncUser.mockResolvedValue(undefined as never)

      client.getUserDetail.mockResolvedValue({
        ...members[0],
        enrollments: [{ status: 'active', course_id: 2, classroom_id: null, expire_date: null }],
      })
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined as never)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockGetClassroomByMkId).not.toHaveBeenCalled()
      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })
  })
})
