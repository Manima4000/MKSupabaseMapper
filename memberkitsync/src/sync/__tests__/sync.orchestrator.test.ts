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
    getPlans: vi.fn().mockResolvedValue([]),
    getMembers: vi.fn(),
    getSubscriptions: vi.fn(),
    getEnrollments: vi.fn(),
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

  it('calls all 6 sync stages when client returns empty data', async () => {
    const client = makeMockClient()
    const orchestrator = new SyncOrchestrator(client as never)

    await orchestrator.run()

    expect(client.getCourses).toHaveBeenCalledOnce()
    expect(client.getClassrooms).toHaveBeenCalledOnce()
    expect(client.getPlans).toHaveBeenCalledOnce()
    // fetchAllPages is used for members, subscriptions, enrollments
    expect(mockFetchAllPages).toHaveBeenCalledTimes(3)
  })

  describe('syncCatalog', () => {
    it('calls syncCourse once per course returned by getCourses()', async () => {
      const client = makeMockClient()
      const courses = [
        { id: 1, name: 'Curso A', position: 1, category: null, sections: [] },
        { id: 2, name: 'Curso B', position: 2, category: null, sections: [] },
      ]
      client.getCourses.mockResolvedValue(courses)
      mockSyncCourse.mockResolvedValue(undefined)

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
        .mockResolvedValueOnce(undefined)

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
      mockUpsertClassroom.mockResolvedValue(undefined)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertClassroom).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncPlans', () => {
    it('calls syncPlan once per plan', async () => {
      const client = makeMockClient()
      client.getPlans.mockResolvedValue([
        { id: 1, name: 'Plano A', trial_period: 0, member_areas: [] },
        { id: 2, name: 'Plano B', trial_period: 7, member_areas: [] },
      ])
      mockSyncPlan.mockResolvedValue(undefined)

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
      // fetchAllPages is called three times (members, subscriptions, enrollments)
      mockFetchAllPages
        .mockResolvedValueOnce(members)   // members call
        .mockResolvedValueOnce([])         // subscriptions call
        .mockResolvedValueOnce([])         // enrollments call
      mockSyncUser.mockResolvedValue(undefined)

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
        .mockResolvedValueOnce([])
      mockSyncUser
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(undefined)

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
        .mockResolvedValueOnce([])   // enrollments
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetMembershipLevelByMkId.mockResolvedValue({ id: 20 } as never)
      mockSyncSubscription.mockResolvedValue(undefined)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncSubscription).toHaveBeenCalledWith(subs[0], 10, 20)
    })

    it('skips subscription when user is not found', async () => {
      const client = makeMockClient()
      mockFetchAllPages
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, member_id: 99, plan_id: 2, status: 'active', expire_at: null }])
        .mockResolvedValueOnce([])
      mockGetUserByMkId.mockResolvedValue(null)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockSyncSubscription).not.toHaveBeenCalled()
    })
  })

  describe('syncEnrollments', () => {
    it('calls upsertEnrollment when user, course and classroom are found', async () => {
      const client = makeMockClient()
      const enrollments = [{ id: 500, member_id: 1, course_id: 2, member_area_id: 3, status: 'active', expire_at: null }]
      mockFetchAllPages
        .mockResolvedValueOnce([])           // members
        .mockResolvedValueOnce([])           // subscriptions
        .mockResolvedValueOnce(enrollments)  // enrollments
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockGetClassroomByMkId.mockResolvedValue({ id: 30 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })

    it('skips enrollment when course is not found', async () => {
      const client = makeMockClient()
      mockFetchAllPages
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, member_id: 1, course_id: 999, member_area_id: null, status: 'active', expire_at: null }])
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue(null)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockUpsertEnrollment).not.toHaveBeenCalled()
    })

    it('handles null member_area_id (no classroom lookup)', async () => {
      const client = makeMockClient()
      mockFetchAllPages
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, member_id: 1, course_id: 2, member_area_id: null, status: 'active', expire_at: null }])
      mockGetUserByMkId.mockResolvedValue({ id: 10 } as never)
      mockGetCourseByMkId.mockResolvedValue({ id: 20 } as never)
      mockUpsertEnrollment.mockResolvedValue(undefined)

      const orchestrator = new SyncOrchestrator(client as never)
      await orchestrator.run()

      expect(mockGetClassroomByMkId).not.toHaveBeenCalled()
      expect(mockUpsertEnrollment).toHaveBeenCalledOnce()
    })
  })
})
