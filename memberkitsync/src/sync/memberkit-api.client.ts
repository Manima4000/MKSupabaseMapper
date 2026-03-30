import { env } from '../config/env.js'
import { MemberKitApiError } from '../shared/errors.js'
import type { PaginationMeta } from '../shared/pagination.js'

// ============================================================================
// MemberKit API response shapes
// NOTE: Ajuste os tipos conforme a documentação real da sua conta MemberKit
// ============================================================================

export interface MKCategory {
  id: number
  name: string
  position: number
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
  video: MKLessonVideo | null
  files: MKLessonFile[]
}

export interface MKSection {
  id: number
  name: string
  position: number
  slug: string | null
  lessons: MKLesson[]
}

export interface MKCourse {
  id: number
  name: string
  position: number
  category: MKCategory | null
  sections: MKSection[]
}

export interface MKMember {
  id: number
  name: string
  email: string
  blocked: boolean
  unlimited: boolean
  sign_in_count: number
  current_sign_in_at: string | null
  last_seen_at: string | null
  meta: Record<string, unknown>
}

export interface MKMembersResponse {
  members: MKMember[]
  total_count: number
  current_page: number
  total_pages: number
}

export interface MKClassroom {
  id: number
  name: string
}

export interface MKPlan {
  id: number
  name: string
  trial_period: number
  member_areas: MKClassroom[]
}

export interface MKSubscription {
  id: number
  member_id: number
  plan_id: number
  status: string
  expire_at: string | null
}

export interface MKSubscriptionsResponse {
  subscriptions: MKSubscription[]
  total_count: number
  current_page: number
  total_pages: number
}

export interface MKEnrollment {
  id: number
  member_id: number
  course_id: number
  member_area_id: number | null
  status: string
  expire_at: string | null
}

export interface MKEnrollmentsResponse {
  enrollments: MKEnrollment[]
  total_count: number
  current_page: number
  total_pages: number
}

// ============================================================================
// Client
// ============================================================================

export class MemberKitClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(baseUrl = env.MEMBERKIT_API_URL, apiKey = env.MEMBERKIT_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set('api_key', this.apiKey)

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new MemberKitApiError(
        `MemberKit API ${response.status} em ${path}: ${body}`,
        { status: response.status, body },
      )
    }

    return response.json() as Promise<T>
  }

  // --------------------------------------------------------------------------
  // Courses (retorna catálogo completo com sections e lessons embutidos)
  // --------------------------------------------------------------------------
  async getCourses(): Promise<MKCourse[]> {
    return this.get<MKCourse[]>('/courses')
  }

  // --------------------------------------------------------------------------
  // Classrooms / Member Areas
  // --------------------------------------------------------------------------
  async getClassrooms(): Promise<MKClassroom[]> {
    return this.get<MKClassroom[]>('/member_areas')
  }

  // --------------------------------------------------------------------------
  // Plans / Membership Levels (inclui classrooms vinculadas)
  // --------------------------------------------------------------------------
  async getPlans(): Promise<MKPlan[]> {
    return this.get<MKPlan[]>('/plans')
  }

  // --------------------------------------------------------------------------
  // Members (paginado)
  // --------------------------------------------------------------------------
  async getMembers(page: number, perPage: number): Promise<{ items: MKMember[]; meta: PaginationMeta }> {
    const data = await this.get<MKMembersResponse>('/members', { page, per_page: perPage })
    return {
      items: data.members,
      meta: {
        current_page: data.current_page,
        total_pages: data.total_pages,
        total_count: data.total_count,
      },
    }
  }

  // --------------------------------------------------------------------------
  // Subscriptions / Memberships (paginado)
  // --------------------------------------------------------------------------
  async getSubscriptions(page: number, perPage: number): Promise<{ items: MKSubscription[]; meta: PaginationMeta }> {
    const data = await this.get<MKSubscriptionsResponse>('/subscriptions', { page, per_page: perPage })
    return {
      items: data.subscriptions,
      meta: {
        current_page: data.current_page,
        total_pages: data.total_pages,
        total_count: data.total_count,
      },
    }
  }

  // --------------------------------------------------------------------------
  // Enrollments (paginado)
  // --------------------------------------------------------------------------
  async getEnrollments(page: number, perPage: number): Promise<{ items: MKEnrollment[]; meta: PaginationMeta }> {
    const data = await this.get<MKEnrollmentsResponse>('/enrollments', { page, per_page: perPage })
    return {
      items: data.enrollments,
      meta: {
        current_page: data.current_page,
        total_pages: data.total_pages,
        total_count: data.total_count,
      },
    }
  }
}
