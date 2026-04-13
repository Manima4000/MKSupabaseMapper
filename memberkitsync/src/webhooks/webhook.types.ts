// Tipos dos payloads de webhook enviados pela MemberKit

export type MKWebhookEventType =
  | 'member.created'
  | 'member.updated'
  | 'membership.created'
  | 'membership.updated'
  | 'enrollment.created'
  | 'enrollment.updated'
  | 'lesson_status.saved'
  | 'comment.created'
  | 'user.last_seen'
  | 'user.signed_in'
  | 'lesson.created'
  | 'lesson.updated'
  | 'rating.saved'
  | 'lesson_file.downloaded'
  | 'invite_pass.created'
  | 'integration_log.received'
  | 'page_agreement.accepted'
  | 'forum_post.created'
  | 'login.sent'
  | string // fallback para eventos desconhecidos

// Envelope genérico do webhook
export interface MKWebhookEnvelope {
  event: MKWebhookEventType
  fired_at: string
  data: Record<string, unknown>
  [key: string]: unknown
}

// --------------------------------------------------------------------------
// Payloads específicos por evento
// --------------------------------------------------------------------------

export interface MKMemberWebhookData {
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

// membership.created / membership.updated
export interface MKSubscriptionWebhookData {
  id: number
  status: string
  expire_date: string | null
  created_at?: string
  updated_at?: string
  membership_level: {
    id: number
    name: string
    trial_period: number
    classroom_ids: number[]
  }
  user: {
    id: number
    full_name: string | null
    email: string
    sign_in_count: number
    current_sign_in_at: string | null
    last_seen_at: string | null
    metadata: Record<string, unknown> | null
    created_at?: string
    updated_at?: string
  }
}

// enrollment.created / enrollment.updated
// Real payload: user.id (not member_id), classroom_id (not member_area_id), expire_date (not expire_at)
export interface MKEnrollmentWebhookData {
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
    metadata?: Record<string, unknown>
  }
}

// lesson_status.saved
export interface MKLessonStatusWebhookData {
  id: number | null
  progress: number            // 0–100
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
  user: {
    id: number
    full_name: string | null
    email: string
  }
  course: {
    id: number
    name: string
  }
  lesson: {
    id: number
    title: string
    slug: string | null
  }
}

// comment.created
export interface MKCommentWebhookData {
  id: number
  content: string
  status: string
  parent_id: number | null
  classroom_id: number | null
  created_at: string
  updated_at: string
  user: {
    id: number
    full_name: string | null
    email: string
  }
  lesson: {
    id: number
    slug: string | null
    title: string
    course: {
      id: number
      name: string
    }
  }
}

// user.last_seen / user.signed_in  (same payload shape)
export interface MKUserLoginWebhookData {
  id: number
  full_name: string | null
  email: string
  sign_in_count: number
  current_sign_in_at: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

// lesson.created / lesson.updated
export interface MKLessonCatalogWebhookData {
  id: number
  slug: string | null
  title: string
  position: number
  created_at: string
  updated_at: string
  section: {
    id: number
    slug: string | null
    name: string
    position: number
    created_at: string
    updated_at: string
  }
  course: {
    id: number
    name: string
    position: number
    created_at: string
    updated_at: string
    category: {
      id: number
      name: string
      position: number
    } | null
  }
  video: {
    id: number
    source: string
    uid: string
    duration: number
  } | null
  files: Array<{
    id: number
    filename: string
    url: string
  }>
}

// rating.saved
export interface MKRatingWebhookData {
  id: number
  stars: number
  created_at: string
  updated_at: string
  user: {
    id: number
    full_name: string | null
    email: string
  }
  lesson: {
    id: number
    slug: string | null
    title: string
    course: {
      id: number
      name: string
    }
  }
}

// lesson_file.downloaded
// Payload real: data.user, data.lesson, data.file, data.clicked_at (sem campo trackable)
export interface MKLessonFileDownloadedWebhookData {
  user: {
    id: number
    full_name: string | null
    email: string
    sign_in_count?: number
    current_sign_in_at?: string | null
    last_seen_at?: string | null
    metadata?: Record<string, unknown>
    created_at?: string
  }
  lesson: {
    id: number
    slug: string | null
    title: string
    created_at?: string
  }
  file?: {
    id: number
    filename: string
    url: string
    content_type?: string
    byte_size?: number
    created_at?: string
  }
  clicked_at: string
}

// invite_pass.created
export interface MKInvitePassWebhookData {
  id: number
  created_at: string
  updated_at: string
  user: {
    id: number
    full_name: string | null
    email: string
    sign_in_count: number
    current_sign_in_at: string | null
    last_seen_at: string | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  invite: {
    id: number
    title: string
  }
}
