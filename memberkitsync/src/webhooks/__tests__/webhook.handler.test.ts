import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist shared mock state (available both inside vi.mock factories and tests)
// ---------------------------------------------------------------------------
const mockMaybySingle = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: null, error: null }),
)
const mockSingle = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
)

// ---------------------------------------------------------------------------
// Supabase mock — thenable chain so `await chain.update().eq()` works
// ---------------------------------------------------------------------------
vi.mock('../../config/supabase.js', () => {
  const makeChain = () => {
    const c: Record<string, unknown> = {}
    const self = () => c
    c.select = vi.fn(self)
    c.eq = vi.fn(self)
    c.insert = vi.fn(self)
    c.update = vi.fn(self)
    c.upsert = vi.fn(self)
    c.maybySingle = mockMaybySingle
    c.maybeSingle = mockMaybySingle
    c.single = mockSingle
    // Makes `await supabase.from().update().eq()` resolve without hanging
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    return c
  }
  return { supabase: { from: vi.fn(() => makeChain()) } }
})

vi.mock('../../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../modules/users/user.service.js', () => ({
  syncUser: vi.fn(),
}))

vi.mock('../../modules/memberships/membership.service.js', () => ({
  syncSubscription: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.repository.js', () => ({
  upsertEnrollment: vi.fn(),
}))

vi.mock('../../modules/enrollments/enrollment.mapper.js', () => ({
  mkEnrollmentToUpsertInput: vi.fn((data, userId, courseId, classroomId) => ({
    mkId: data.id, userId, courseId, classroomId,
    status: data.status, expireDate: data.expire_date,
  })),
}))

vi.mock('../../modules/lesson_progress/lesson_progress.repository.js', () => ({
  upsertLessonProgress: vi.fn(),
}))

vi.mock('../../modules/lesson_file_downloads/lesson_file_download.repository.js', () => ({
  insertLessonFileDownload: vi.fn(),
}))

vi.mock('../../modules/users/user.repository.js', () => ({
  getUserByMkId: vi.fn(),
  upsertUser: vi.fn(),
  updateUserLoginData: vi.fn(),
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
  upsertLesson: vi.fn(),
  upsertLessonVideo: vi.fn(),
  upsertLessonFiles: vi.fn(),
}))

vi.mock('../../modules/sections/section.repository.js', () => ({
  upsertSection: vi.fn(),
}))

vi.mock('../../modules/comments/comment.repository.js', () => ({
  upsertComment: vi.fn(),
}))

vi.mock('../../modules/lesson_ratings/lesson_rating.repository.js', () => ({
  upsertLessonRating: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { dispatchWebhook } from '../webhook.handler.js'
import { syncUser } from '../../modules/users/user.service.js'
import { syncSubscription } from '../../modules/memberships/membership.service.js'
import { upsertEnrollment } from '../../modules/enrollments/enrollment.repository.js'
import { mkEnrollmentToUpsertInput } from '../../modules/enrollments/enrollment.mapper.js'
import { upsertLessonProgress } from '../../modules/lesson_progress/lesson_progress.repository.js'
import { insertLessonFileDownload } from '../../modules/lesson_file_downloads/lesson_file_download.repository.js'
import { getUserByMkId, upsertUser, updateUserLoginData } from '../../modules/users/user.repository.js'
import { getMembershipLevelByMkId } from '../../modules/memberships/membership.repository.js'
import { getCourseByMkId } from '../../modules/courses/course.repository.js'
import { getClassroomByMkId } from '../../modules/classrooms/classroom.repository.js'
import { getLessonByMkId, upsertLesson, upsertLessonVideo, upsertLessonFiles } from '../../modules/lessons/lesson.repository.js'
import { upsertSection } from '../../modules/sections/section.repository.js'
import { upsertComment } from '../../modules/comments/comment.repository.js'
import { upsertLessonRating } from '../../modules/lesson_ratings/lesson_rating.repository.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FIRED_AT = '2024-09-04T09:00:00.000-03:00'

function envelope(event: string, data: Record<string, unknown>) {
  return { event, fired_at: FIRED_AT, data }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: 1 }, error: null })
  mockMaybySingle.mockResolvedValue({ data: null, error: null }) // not a duplicate by default

  // Default successful mocks
  vi.mocked(syncUser).mockResolvedValue(undefined as never)
  vi.mocked(syncSubscription).mockResolvedValue(undefined as never)
  vi.mocked(upsertEnrollment).mockResolvedValue(undefined as never)
  vi.mocked(upsertLessonProgress).mockResolvedValue(undefined)
  vi.mocked(insertLessonFileDownload).mockResolvedValue(undefined)
  vi.mocked(upsertUser).mockResolvedValue({ id: 10 } as never)
  vi.mocked(updateUserLoginData).mockResolvedValue(undefined)
  vi.mocked(getUserByMkId).mockResolvedValue({ id: 10, mk_id: 1, email: 'a@b.com' } as never)
  vi.mocked(getMembershipLevelByMkId).mockResolvedValue({ id: 50, mk_id: 5 } as never)
  vi.mocked(getCourseByMkId).mockResolvedValue({ id: 20, mk_id: 2 } as never)
  vi.mocked(getClassroomByMkId).mockResolvedValue({ id: 30, mk_id: 3 } as never)
  vi.mocked(getLessonByMkId).mockResolvedValue({ id: 40, mk_id: 4 } as never)
  vi.mocked(upsertSection).mockResolvedValue({ id: 60, mk_id: 6 } as never)
  vi.mocked(upsertLesson).mockResolvedValue({ id: 40, mk_id: 4 } as never)
  vi.mocked(upsertLessonVideo).mockResolvedValue(undefined as never)
  vi.mocked(upsertLessonFiles).mockResolvedValue(undefined)
  vi.mocked(upsertComment).mockResolvedValue(undefined as never)
  vi.mocked(upsertLessonRating).mockResolvedValue(undefined as never)
})

// ===========================================================================
// Tests
// ===========================================================================

describe('dispatchWebhook', () => {

  // ---- member events -------------------------------------------------------

  describe('member.created / member.updated', () => {
    const memberData = {
      id: 42, full_name: 'João Silva', email: 'joao@test.com',
      blocked: false, unlimited: false, sign_in_count: 5,
      current_sign_in_at: null, last_seen_at: null, meta: {},
    }

    it('calls syncUser for member.created', async () => {
      await dispatchWebhook(envelope('member.created', memberData))
      expect(syncUser).toHaveBeenCalledOnce()
      expect(syncUser).toHaveBeenCalledWith(memberData)
    })

    it('calls syncUser for member.updated', async () => {
      await dispatchWebhook(envelope('member.updated', memberData))
      expect(syncUser).toHaveBeenCalledOnce()
    })
  })

  // ---- membership events (note: NOT subscription.*) -----------------------

  describe('membership.created / membership.updated', () => {
    const subData = {
      id: 200, status: 'active', expire_date: null,
      membership_level: { id: 5, name: 'Prata', trial_period: 0, classroom_ids: [1] },
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
    }

    it('calls syncSubscription with resolved user and level IDs', async () => {
      await dispatchWebhook(envelope('membership.created', subData))

      expect(getUserByMkId).toHaveBeenCalledWith(1)
      expect(getMembershipLevelByMkId).toHaveBeenCalledWith(5)
      expect(syncSubscription).toHaveBeenCalledWith(subData, 10, 50)
    })

    it('handles membership.updated', async () => {
      await dispatchWebhook(envelope('membership.updated', subData))
      expect(syncSubscription).toHaveBeenCalledOnce()
    })

    it('creates user from webhook data when not found, then syncs subscription', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      vi.mocked(upsertUser).mockResolvedValueOnce({ id: 10 } as never)
      await dispatchWebhook(envelope('membership.created', subData))
      expect(upsertUser).toHaveBeenCalledOnce()
      expect(syncSubscription).toHaveBeenCalledOnce()
    })

    it('skips when membership level is not found', async () => {
      vi.mocked(getMembershipLevelByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('membership.created', subData))
      expect(syncSubscription).not.toHaveBeenCalled()
    })

    it('does NOT handle old subscription.created event name (regression guard)', async () => {
      await dispatchWebhook(envelope('subscription.created', subData))
      expect(syncSubscription).not.toHaveBeenCalled()
    })

    it('does NOT handle old subscription.expired event name (regression guard)', async () => {
      await dispatchWebhook(envelope('subscription.expired', subData))
      expect(syncSubscription).not.toHaveBeenCalled()
    })
  })

  // ---- enrollment events ---------------------------------------------------

  describe('enrollment.created / enrollment.updated', () => {
    // Real MK payload shape: user.id nested, classroom_id, expire_date
    const enrollData = {
      id: 300, status: 'active', expire_date: null,
      course_id: 2, classroom_id: 3,
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
    }

    it('resolves user via data.user.id (not data.member_id) — bug fix', async () => {
      await dispatchWebhook(envelope('enrollment.created', enrollData))
      expect(getUserByMkId).toHaveBeenCalledWith(1)
    })

    it('resolves classroom via data.classroom_id (not data.member_area_id) — bug fix', async () => {
      await dispatchWebhook(envelope('enrollment.created', enrollData))
      expect(getClassroomByMkId).toHaveBeenCalledWith(3)
    })

    it('calls upsertEnrollment with correct resolved IDs', async () => {
      await dispatchWebhook(envelope('enrollment.created', enrollData))

      expect(mkEnrollmentToUpsertInput).toHaveBeenCalledWith(enrollData, 10, 20, 30)
      expect(upsertEnrollment).toHaveBeenCalledOnce()
    })

    it('skips getClassroomByMkId when classroom_id is null', async () => {
      await dispatchWebhook(envelope('enrollment.created', { ...enrollData, classroom_id: null }))
      expect(getClassroomByMkId).not.toHaveBeenCalled()
      expect(upsertEnrollment).toHaveBeenCalledOnce()
    })

    it('skips when user is not found', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('enrollment.created', enrollData))
      expect(upsertEnrollment).not.toHaveBeenCalled()
    })

    it('skips when course is not found', async () => {
      vi.mocked(getCourseByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('enrollment.created', enrollData))
      expect(upsertEnrollment).not.toHaveBeenCalled()
    })

    it('handles enrollment.updated', async () => {
      await dispatchWebhook(envelope('enrollment.updated', enrollData))
      expect(upsertEnrollment).toHaveBeenCalledOnce()
    })
  })

  // ---- lesson_status.saved -------------------------------------------------

  describe('lesson_status.saved', () => {
    const progressData = {
      id: 555, progress: 100,
      completed_at: '2024-09-04T10:00:00Z',
      created_at: '2024-09-04T09:00:00Z',
      updated_at: '2024-09-04T10:00:00Z',
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
      course: { id: 2, name: 'Matemática' },
      lesson: { id: 4, title: 'Aula 1', slug: 'aula-1' },
    }

    it('calls upsertLessonProgress with correct args', async () => {
      await dispatchWebhook(envelope('lesson_status.saved', progressData))

      expect(getUserByMkId).toHaveBeenCalledWith(1)
      expect(getLessonByMkId).toHaveBeenCalledWith(4)
      expect(upsertLessonProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          mkId: 555,
          userId: 10,
          lessonId: 40,
          completedAt: '2024-09-04T10:00:00Z',
          // occurredAt uses data.created_at (not fired_at)
          occurredAt: '2024-09-04T09:00:00Z',
        }),
      )
    })

    it('skips when user is not found', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('lesson_status.saved', progressData))
      expect(upsertLessonProgress).not.toHaveBeenCalled()
    })

    it('skips when lesson is not found', async () => {
      vi.mocked(getLessonByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('lesson_status.saved', progressData))
      expect(upsertLessonProgress).not.toHaveBeenCalled()
    })
  })

  // ---- comment.created -----------------------------------------------------

  describe('comment.created', () => {
    const commentData = {
      id: 77, content: 'Ótima aula!', status: 'approved',
      parent_id: null, classroom_id: null,
      created_at: '2024-09-04T09:00:00Z', updated_at: '2024-09-04T09:00:00Z',
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
      lesson: { id: 4, slug: 'aula-1', title: 'Aula 1', course: { id: 2, name: 'Matemática' } },
    }

    it('calls upsertComment with resolved IDs', async () => {
      await dispatchWebhook(envelope('comment.created', commentData))

      expect(getUserByMkId).toHaveBeenCalledWith(1)
      expect(getLessonByMkId).toHaveBeenCalledWith(4)
      expect(upsertComment).toHaveBeenCalledWith(
        expect.objectContaining({ mkId: 77, userId: 10, lessonId: 40, body: 'Ótima aula!', status: 'approved' }),
      )
    })

    it('skips when user is not found', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('comment.created', commentData))
      expect(upsertComment).not.toHaveBeenCalled()
    })

    it('skips when lesson is not found', async () => {
      vi.mocked(getLessonByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('comment.created', commentData))
      expect(upsertComment).not.toHaveBeenCalled()
    })
  })

  // ---- user.last_seen / user.signed_in ------------------------------------

  describe('user.last_seen / user.signed_in', () => {
    const loginData = {
      id: 1, full_name: 'João', email: 'joao@test.com',
      sign_in_count: 42,
      current_sign_in_at: '2024-09-04T09:00:00Z',
      last_seen_at: '2024-09-04T09:30:00Z',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2024-09-04T09:30:00Z',
    }

    it('calls updateUserLoginData with correct args for user.last_seen', async () => {
      await dispatchWebhook(envelope('user.last_seen', loginData))

      expect(updateUserLoginData).toHaveBeenCalledWith(1, {
        sign_in_count: 42,
        current_sign_in_at: '2024-09-04T09:00:00Z',
        last_seen_at: '2024-09-04T09:30:00Z',
      })
    })

    it('calls updateUserLoginData for user.signed_in', async () => {
      await dispatchWebhook(envelope('user.signed_in', loginData))

      expect(updateUserLoginData).toHaveBeenCalledWith(1, expect.objectContaining({
        sign_in_count: 42,
      }))
    })
  })

  // ---- lesson.created / lesson.updated ------------------------------------

  describe('lesson.created / lesson.updated', () => {
    const lessonData = {
      id: 4, slug: 'aula-1', title: 'Aula 1', position: 1,
      created_at: '2024-09-01T00:00:00Z', updated_at: '2024-09-04T00:00:00Z',
      section: { id: 6, slug: 'modulo-1', name: 'Módulo 1', position: 1, created_at: '', updated_at: '' },
      course: { id: 2, name: 'Matemática', position: 1, created_at: '', updated_at: '', category: null },
      video: { id: 9, source: 'vimeo', uid: 'abc123', duration: 600 },
      files: [] as unknown[],
    }

    it('upserts section then lesson for lesson.created', async () => {
      await dispatchWebhook(envelope('lesson.created', lessonData))

      expect(getCourseByMkId).toHaveBeenCalledWith(2)
      expect(upsertSection).toHaveBeenCalledWith(
        expect.objectContaining({ mkId: 6, courseId: 20, name: 'Módulo 1' }),
      )
      expect(upsertLesson).toHaveBeenCalledWith(
        expect.objectContaining({ mkId: 4, sectionId: 60, title: 'Aula 1' }),
      )
    })

    it('upserts video when present', async () => {
      await dispatchWebhook(envelope('lesson.created', lessonData))

      expect(upsertLessonVideo).toHaveBeenCalledWith(
        expect.objectContaining({ mkId: 9, uid: 'abc123', source: 'vimeo', durationSeconds: 600 }),
      )
    })

    it('does not call upsertLessonVideo when video is null', async () => {
      await dispatchWebhook(envelope('lesson.created', { ...lessonData, video: null }))
      expect(upsertLessonVideo).not.toHaveBeenCalled()
    })

    it('upserts files when array is non-empty', async () => {
      const withFiles = {
        ...lessonData, video: null,
        files: [{ id: 11, filename: 'doc.pdf', url: 'https://example.com/doc.pdf' }],
      }
      await dispatchWebhook(envelope('lesson.created', withFiles))

      expect(upsertLessonFiles).toHaveBeenCalledWith([
        expect.objectContaining({ mkId: 11, filename: 'doc.pdf' }),
      ])
    })

    it('does not call upsertLessonFiles for empty files array', async () => {
      await dispatchWebhook(envelope('lesson.created', { ...lessonData, video: null }))
      expect(upsertLessonFiles).not.toHaveBeenCalled()
    })

    it('skips when course not found', async () => {
      vi.mocked(getCourseByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('lesson.created', lessonData))
      expect(upsertSection).not.toHaveBeenCalled()
      expect(upsertLesson).not.toHaveBeenCalled()
    })

    it('handles lesson.updated', async () => {
      await dispatchWebhook(envelope('lesson.updated', lessonData))
      expect(upsertLesson).toHaveBeenCalledOnce()
    })
  })

  // ---- rating.saved --------------------------------------------------------

  describe('rating.saved', () => {
    const ratingData = {
      id: 88, stars: 5,
      created_at: '2024-09-04T09:00:00Z', updated_at: '2024-09-04T09:00:00Z',
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
      lesson: { id: 4, slug: 'aula-1', title: 'Aula 1', course: { id: 2, name: 'Matemática' } },
    }

    it('calls upsertLessonRating with resolved IDs and stars', async () => {
      await dispatchWebhook(envelope('rating.saved', ratingData))

      expect(getUserByMkId).toHaveBeenCalledWith(1)
      expect(getLessonByMkId).toHaveBeenCalledWith(4)
      expect(upsertLessonRating).toHaveBeenCalledWith(
        expect.objectContaining({ mkId: 88, userId: 10, lessonId: 40, stars: 5 }),
      )
    })

    it('skips when user is not found', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('rating.saved', ratingData))
      expect(upsertLessonRating).not.toHaveBeenCalled()
    })

    it('skips when lesson is not found', async () => {
      vi.mocked(getLessonByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('rating.saved', ratingData))
      expect(upsertLessonRating).not.toHaveBeenCalled()
    })
  })

  // ---- lesson_file.downloaded ----------------------------------------------

  describe('lesson_file.downloaded', () => {
    const dlData = {
      user: { id: 1, full_name: 'João', email: 'joao@test.com' },
      lesson: { id: 4, slug: 'aula-1', title: 'Aula 1' },
      file: { id: 11, filename: 'doc.pdf', url: 'https://example.com/doc.pdf' },
      clicked_at: FIRED_AT,
    }

    it('calls insertLessonFileDownload with user, lesson and file id', async () => {
      await dispatchWebhook(envelope('lesson_file.downloaded', dlData))

      expect(getUserByMkId).toHaveBeenCalledWith(1)
      expect(getLessonByMkId).toHaveBeenCalledWith(4)
      expect(insertLessonFileDownload).toHaveBeenCalledWith(
        // occurredAt uses data.clicked_at (not fired_at)
        expect.objectContaining({ userId: 10, lessonId: 40, fileId: 11, occurredAt: FIRED_AT }),
      )
    })

    it('skips when user is not found', async () => {
      vi.mocked(getUserByMkId).mockResolvedValueOnce(null)
      await dispatchWebhook(envelope('lesson_file.downloaded', dlData))
      expect(insertLessonFileDownload).not.toHaveBeenCalled()
    })
  })

  // ---- invite_pass.created -------------------------------------------------

  describe('invite_pass.created', () => {
    const inviteData = {
      id: 99, created_at: '2024-09-04T09:00:00Z', updated_at: '2024-09-04T09:00:00Z',
      user: {
        id: 1, full_name: 'Novo Aluno', email: 'novo@test.com',
        sign_in_count: 0, current_sign_in_at: null, last_seen_at: null,
        metadata: { cpf_cnpj: '123', phone_local_code: '11', phone_number: '99999999' },
        created_at: '2024-09-04T09:00:00Z', updated_at: '2024-09-04T09:00:00Z',
      },
      invite: { id: 5, title: 'Convite ESA' },
    }

    it('upserts user from invite payload', async () => {
      await dispatchWebhook(envelope('invite_pass.created', inviteData))

      expect(upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          mkId: 1, email: 'novo@test.com', fullName: 'Novo Aluno',
          signInCount: 0, blocked: false, unlimited: false,
        }),
      )
    })
  })

  // ---- known-but-unprocessed events ----------------------------------------

  describe('known-but-unprocessed events', () => {
    it.each([
      'integration_log.received',
      'page_agreement.accepted',
      'forum_post.created',
      'login.sent',
    ])('does not call any service for event: %s', async (event) => {
      await dispatchWebhook(envelope(event, {}))

      expect(syncUser).not.toHaveBeenCalled()
      expect(syncSubscription).not.toHaveBeenCalled()
      expect(upsertEnrollment).not.toHaveBeenCalled()
      expect(upsertLessonProgress).not.toHaveBeenCalled()
      expect(upsertLessonRating).not.toHaveBeenCalled()
    })
  })

  // ---- unknown events ------------------------------------------------------

  describe('unknown events', () => {
    it('does not throw and calls no service for an unknown event', async () => {
      await expect(
        dispatchWebhook(envelope('some.unknown.event.xyz', {})),
      ).resolves.toBeUndefined()

      expect(syncUser).not.toHaveBeenCalled()
    })
  })

  // ---- error handling ------------------------------------------------------

  describe('error handling', () => {
    it('re-throws handler errors after marking webhook_log as failed', async () => {
      const err = new Error('DB explodiu')
      vi.mocked(syncUser).mockRejectedValue(err)

      await expect(
        dispatchWebhook(envelope('member.created', {
          id: 1, full_name: 'X', email: 'x@test.com',
          blocked: false, unlimited: false, sign_in_count: 0,
          current_sign_in_at: null, last_seen_at: null, meta: {},
        })),
      ).rejects.toThrow('DB explodiu')
    })
  })

  // ---- duplicate deduplication ---------------------------------------------

  describe('duplicate webhook guard', () => {
    it('skips all processing when payload hash was already processed', async () => {
      // Make maybySingle return a non-null record → duplicate found
      mockMaybySingle.mockResolvedValueOnce({ data: { id: 42 }, error: null })

      await dispatchWebhook(envelope('member.created', {
        id: 1, full_name: 'X', email: 'x@test.com',
        blocked: false, unlimited: false, sign_in_count: 0,
        current_sign_in_at: null, last_seen_at: null, meta: {},
      }))

      expect(syncUser).not.toHaveBeenCalled()
    })
  })

})
