import { env } from '../config/env.js'
import { MemberKitApiError } from '../shared/errors.js'
import { logger } from '../shared/logger.js'
import type { PaginationMeta } from '../shared/pagination.js'

// ============================================================================
// MemberKit API response shapes
// NOTE: Ajuste os tipos conforme a documentação real da sua conta MemberKit
// ============================================================================

export interface MKCategory {
  id: number
  name: string
  position: number
  created_at?: string
}

export interface MKLessonFile {
  id: number
  filename: string
  url: string
}

export interface MKLessonVideo {
  id: number
  uid: string | null
  source: string | null
  duration: number | null
}

export interface MKLesson {
  id: number
  title: string
  position: number
  slug: string | null
  created_at?: string
  video?: MKLessonVideo | null
  files?: MKLessonFile[]
}

export interface MKSection {
  id: number
  name: string
  position: number
  slug: string | null
  created_at?: string
  lessons: MKLesson[]
}

export interface MKCourse {
  id: number
  name: string
  position: number
  created_at?: string
  category: MKCategory | null
  sections: MKSection[]
}

export interface MKCoursesResponse {
  courses: MKCourse[]
  total_count: number
  current_page: number
  total_pages: number
}

export interface MKUser {
  id: number
  full_name: string | null
  email: string
  blocked: boolean
  unlimited: boolean
  sign_in_count: number
  current_sign_in_at: string | null
  last_seen_at: string | null
  metadata: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

// Keep MKMember as an alias for backwards compatibility within the codebase
export type MKMember = MKUser

// Enrollment as it appears inline inside GET /users/{id}
export interface MKUserEnrollment {
  id: number
  status: string
  course_id: number
  classroom_id: number | null
  expire_date: string | null
}

// Membership as it appears inline inside GET /users/{id}
export interface MKUserMembership {
  id: number
  status: string
  membership_level_id: number
  expire_date: string | null
}

// Metadata as returned by GET /users/{id}
export interface MKUserMetadata {
  cpf_cnpj: string | null
  phone_local_code: string | null
  phone_number: string | null
  [key: string]: unknown
}

// Full user detail returned by GET /users/{id}
export interface MKUserDetail extends MKUser {
  metadata: MKUserMetadata
  created_at: string
  updated_at: string
  enrollments: MKUserEnrollment[]
  memberships: MKUserMembership[]
}

export interface MKClassroom {
  id: number
  name: string
  created_at?: string
}

export interface MKMembershipLevel {
  id: number
  name: string
  trial_period: number
  classroom_ids: number[]
  created_at?: string
  updated_at?: string
}

// Keep MKPlan as an alias for backwards compatibility within the codebase
export type MKPlan = MKMembershipLevel

export interface MKMembership {
  id: number
  status: string
  membership_level_id: number
  expire_date: string | null
  created_at?: string
  updated_at?: string
  user: {
    id: number
    full_name: string | null
    email: string
    created_at?: string
    updated_at?: string
  }
}

// Keep MKSubscription as an alias for backwards compatibility within the codebase
export type MKSubscription = MKMembership

// Webhook enrollment payload shape (enrollment.created / enrollment.updated).
// NOTE: real MK payload uses user.id (nested), classroom_id, and expire_date.
export interface MKEnrollment {
  id: number
  course_id: number
  classroom_id: number | null
  status: string
  expire_date: string | null
  created_at?: string
  user: {
    id: number
    full_name: string | null
    email: string
  }
}

export interface MKComment {
  id: number
  content: string
  status: string
  parent_id: number | null
  classroom_id: number | null
  created_at: string
  updated_at: string
  lesson: {
    id: number
    title: string
    url: string
    course: {
      id: number
      name: string
    }
  }
  user: {
    id: number
    full_name: string | null
    email: string
  }
}

export interface MKTrackableLessonStatus {
  id: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface MKTrackableRating {
  id: number
  stars: number
  created_at: string
  updated_at: string
}

export interface MKTrackableComment {
  id: number
  status: string
  content: string
  classroom_id: number | null
  created_at: string
  updated_at: string
}

export interface MKTrackableForumPost {
  id: number
  title: string
  forum_id: number
  created_at: string
  updated_at: string
}

export interface MKTrackableForumComment {
  id: number
  content: string
  forum_post_id: number
  created_at: string
  updated_at: string
}

export type MKTrackable =
  | MKTrackableLessonStatus
  | MKTrackableRating
  | MKTrackableComment
  | MKTrackableForumPost
  | MKTrackableForumComment

export interface MKQuizAttempt {
  id: number
  answered_questions_count: number
  correct_answers_count: number
  quiz: {
    id: number
    title: string
    description: string | null
  }
  user: {
    id: number
    full_name: string | null
    email: string
  }
  started_at: string | null
  created_at: string
  updated_at: string
}

export interface MKUserActivity {
  id: number
  course_id: number | null
  lesson_id: number | null
  trackable_type: 'LessonStatus' | 'Rating' | 'Comment' | 'ForumPost' | 'ForumComment' | string
  trackable: MKTrackable | null
  created_at: string
}

// ============================================================================
// Client
// ============================================================================

export class MemberKitClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  private readonly maxRequestsPerMinute = 115
  private requestTimestamps: number[] = []
  // Serializes concurrent throttle() calls to prevent race conditions where
  // multiple parallel Promise.all branches all pass the rate-limit check
  // before any of them records their timestamp.
  private throttleQueue: Promise<void> = Promise.resolve()

  constructor(baseUrl = env.MEMBERKIT_API_URL, apiKey = env.MEMBERKIT_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
  }

  private throttle(): Promise<void> {
    this.throttleQueue = this.throttleQueue.then(() => this.doThrottle())
    return this.throttleQueue
  }

  private async doThrottle(): Promise<void> {
    const now = Date.now()
    const windowStart = now - 60_000
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart)

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldest = this.requestTimestamps[0]
      if (oldest !== undefined) {
        const waitMs = oldest + 60_000 - now + 100
        logger.debug({ waitMs }, 'Rate limit reached, aguardando janela de 60s...')
        await new Promise(resolve => setTimeout(resolve, waitMs))
      }

      const after = Date.now()
      this.requestTimestamps = this.requestTimestamps.filter(t => t > after - 60_000)
    }

    this.requestTimestamps.push(Date.now())
  }

  // Returns parsed JSON body AND raw response headers so callers can read
  // MemberKit's pagination headers (Total-Pages, Current-Page, Total-Count).
  private async get<T>(
    path: string,
    params: Record<string, string | number> = {},
    retries = 3,
  ): Promise<{ data: T; headers: Headers }> {
    await this.throttle()

    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set('api_key', this.apiKey)

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }

    const reqStart = Date.now()
    logger.debug({ path, params }, `GET ${path}`)

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    const ms = Date.now() - reqStart
    logger.debug({ path, status: response.status, ms }, `GET ${path} → ${response.status} (${ms}ms)`)

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After')
      const waitMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 60_000
      logger.warn({ path, waitMs, retriesLeft: retries }, 'Rate limited (429), aguardando...')
      await new Promise(resolve => setTimeout(resolve, waitMs))
      if (retries > 0) return this.get<T>(path, params, retries - 1)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new MemberKitApiError(
        `MemberKit API ${response.status} em ${path}: ${body}`,
        { status: response.status, body },
      )
    }

    return { data: await response.json() as T, headers: response.headers }
  }

  // Reads MemberKit's pagination headers into a PaginationMeta object.
  // Headers: Current-Page, Page-Limit, Total-Pages, Total-Count, Link
  private parseMeta(headers: Headers, page: number, itemCount: number): PaginationMeta {
    return {
      current_page: parseInt(headers.get('Current-Page') ?? String(page), 10),
      total_pages: parseInt(headers.get('Total-Pages') ?? '1', 10),
      total_count: parseInt(headers.get('Total-Count') ?? String(itemCount), 10),
      page_limit: parseInt(headers.get('Page-Limit') ?? '0', 10),
    }
  }

  // --------------------------------------------------------------------------
  // Courses — two-step fetch:
  //   1. GET /courses to get the paginated list of course IDs
  //   2. GET /courses/{id} for each course to get sections + lessons
  // --------------------------------------------------------------------------
  async getCourses(): Promise<MKCourse[]> {
    // Step 1: collect all course stubs (id + basic fields)
    const { data: firstPage, headers: firstHeaders } = await this.get<MKCourse[] | MKCoursesResponse>('/courses', { page: 1, per_page: 100 })

    const stubs: MKCourse[] = []

    if (Array.isArray(firstPage)) {
      const meta = this.parseMeta(firstHeaders, 1, firstPage.length)
      stubs.push(...firstPage)
      for (let page = 2; page <= meta.total_pages; page++) {
        const { data } = await this.get<MKCourse[]>('/courses', { page, per_page: 100 })
        stubs.push(...(Array.isArray(data) ? data : []))
      }
    } else {
      stubs.push(...firstPage.courses)
      for (let page = 2; page <= firstPage.total_pages; page++) {
        const { data } = await this.get<MKCoursesResponse>('/courses', { page, per_page: 100 })
        stubs.push(...data.courses)
      }
    }

    // Step 2: busca detalhes de todos os cursos em paralelo — o throttle
    // garante no máximo 115 req/min; os Promises só enfileiram timestamps.
    logger.info({ total: stubs.length }, `[getCourses] ${stubs.length} cursos encontrados — buscando detalhes em paralelo...`)
    const results = await Promise.all(
      stubs.map((stub, i) =>
        this.getCourseDetail(stub.id).then(detail => {
          logger.info(
            { courseId: stub.id, name: stub.name, progress: `${i + 1}/${stubs.length}` },
            `[getCourses] curso ${i + 1}/${stubs.length} concluído: "${stub.name}"`,
          )
          return detail
        }),
      ),
    )
    return results
  }

  // --------------------------------------------------------------------------
  // Course detail — endpoint: /courses/{id}
  // Returns the course with its sections and nested lessons (with video/files).
  // --------------------------------------------------------------------------
  async getCourseDetail(courseId: number): Promise<MKCourse> {
    const { data } = await this.get<MKCourse>(`/courses/${courseId}`)
    const totalSections = data.sections?.length ?? 0
    const totalLessons = data.sections?.reduce((sum, s) => sum + (s.lessons?.length ?? 0), 0) ?? 0
    logger.info(
      { courseId, name: data.name, sections: totalSections, lessons: totalLessons },
      `[getCourseDetail] "${data.name}": ${totalSections} seções, ${totalLessons} aulas`,
    )
    return data
  }

  // --------------------------------------------------------------------------
  // Lesson detail — endpoint: /lessons/{id}
  // Returns a single lesson with its video and files.
  // --------------------------------------------------------------------------
  async getLessonDetail(lessonId: number): Promise<MKLesson> {
    const { data } = await this.get<MKLesson>(`/lessons/${lessonId}`)
    return {
      ...data,
      files: data.files ?? [],
    }
  }

  // --------------------------------------------------------------------------
  // Classrooms — endpoint: /classrooms
  // --------------------------------------------------------------------------
  async getClassrooms(): Promise<MKClassroom[]> {
    const { data } = await this.get<MKClassroom[]>('/classrooms')
    return data
  }

  // --------------------------------------------------------------------------
  // Membership Levels — endpoint: /membership_levels (each has classroom_ids)
  // --------------------------------------------------------------------------
  async getMembershipLevels(): Promise<MKMembershipLevel[]> {
    const { data } = await this.get<MKMembershipLevel[]>('/membership_levels')
    return data
  }

  // --------------------------------------------------------------------------
  // Users (paginado) — endpoint: /users
  // Pagination metadata comes from response headers, not the JSON body.
  // --------------------------------------------------------------------------
  async getUsers(page: number, perPage: number): Promise<{ items: MKUser[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKUser[]>('/users', { page, per_page: perPage })
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }

  // --------------------------------------------------------------------------
  // Memberships / Subscriptions (paginado) — endpoint: /memberships
  // Pagination metadata comes from response headers, not the JSON body.
  // --------------------------------------------------------------------------
  async getMemberships(page: number, perPage: number): Promise<{ items: MKMembership[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKMembership[]>('/memberships', { page, per_page: perPage })
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }

  // --------------------------------------------------------------------------
  // User Detail — endpoint: /users/{id}
  // Returns full user profile including inline enrollments[].
  // This is the correct way to get a user's enrollments — there is no
  // standalone /enrollments endpoint in the MemberKit API.
  // --------------------------------------------------------------------------
  async getUserDetail(userId: number): Promise<MKUserDetail> {
    const { data } = await this.get<MKUserDetail>(`/users/${userId}`)
    return {
      ...data,
      enrollments: data.enrollments ?? [],
    }
  }

  // --------------------------------------------------------------------------
  // Comments (paginado) — endpoint: /comments
  // --------------------------------------------------------------------------
  async getComments(page: number, perPage: number): Promise<{ items: MKComment[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKComment[]>('/comments', { page, per_page: perPage })
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }

  // --------------------------------------------------------------------------
  // Comments por aula (paginado) — endpoint: /lessons/{lessonId}/comments
  // Usado para re-sincronização baseada no banco (DB-based sync).
  // --------------------------------------------------------------------------
  async getCommentsByLesson(lessonId: number, page: number, perPage: number): Promise<{ items: MKComment[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKComment[]>(`/lessons/${lessonId}/comments`, { page, per_page: perPage })
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }

  // --------------------------------------------------------------------------
  // Quiz Attempts (paginado) — endpoint: /quiz_attempts
  // --------------------------------------------------------------------------
  async getQuizAttempts(page: number, perPage: number): Promise<{ items: MKQuizAttempt[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKQuizAttempt[]>('/quiz_attempts', { page, per_page: perPage })
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }

  // --------------------------------------------------------------------------
  // User Activities (paginado) — endpoint: /users/{user_id}/activities
  // --------------------------------------------------------------------------
  async getUserActivities(
    userId: number,
    page: number,
    perPage: number,
  ): Promise<{ items: MKUserActivity[]; meta: PaginationMeta }> {
    const { data, headers } = await this.get<MKUserActivity[]>(
      `/users/${userId}/activities`,
      { page, per_page: perPage },
    )
    const items = Array.isArray(data) ? data : []
    return { items, meta: this.parseMeta(headers, page, items.length) }
  }
}
