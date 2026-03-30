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
}

// --------------------------------------------------------------------------
// Payloads específicos por evento
// --------------------------------------------------------------------------

export interface MKMemberWebhookData {
  id: number
  name: string
  email: string
  bio: string | null
  image_url: string | null
  blocked: boolean
  unlimited: boolean
  sign_in_count: number
  current_sign_in_at: string | null
  last_seen_at: string | null
  meta: Record<string, unknown>
}

export interface MKSubscriptionWebhookData {
  id: number
  member_id: number
  plan_id: number
  status: string
  expire_at: string | null
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
  member_id: number
  lesson_id: number
  progress: number            // 0–100
  completed_at: string | null
}

export interface MKCommentWebhookData {
  id: number
  member_id: number
  lesson_id: number
  body: string
  status: string
}
