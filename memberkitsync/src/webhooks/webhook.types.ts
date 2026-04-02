// Tipos dos payloads de webhook enviados pela MemberKit
// NOTE: Ajuste conforme os eventos reais configurados na sua conta MemberKit

export type MKWebhookEventType =
  | 'member.created'
  | 'member.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.expired'
  | 'enrollment.created'
  | 'enrollment.updated'
  | 'lesson_status_saved'
  | 'comment.created'
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
  meta: Record<string, unknown>
}

export interface MKSubscriptionWebhookData {
  id: number
  status: string
  expire_date: string | null
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
  }
}

export interface MKEnrollmentWebhookData {
  id: number
  member_id: number
  course_id: number
  member_area_id: number | null
  status: string
  expire_at: string | null
}

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
