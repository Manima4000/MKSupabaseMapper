// Global types mirroring the database schema

// ============================================================================
// ENUMS
// ============================================================================

export type MembershipStatus = 'inactive' | 'pending' | 'active' | 'expired'
export type EnrollmentStatus = 'inactive' | 'pending' | 'active' | 'expired'
export type CommentStatus = 'pending' | 'approved' | 'rejected'
export type WebhookLogStatus = 'received' | 'processed' | 'failed'

// ============================================================================
// DATABASE ROW TYPES (what SELECT returns)
// ============================================================================

export interface Category {
  id: number
  mk_id: number
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface Course {
  id: number
  mk_id: number
  name: string
  position: number
  category_id: number | null
  created_at: string
  updated_at: string
}

export interface Section {
  id: number
  mk_id: number
  course_id: number
  name: string
  position: number
  slug: string | null
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: number
  mk_id: number
  section_id: number
  title: string
  position: number
  slug: string | null
  created_at: string
  updated_at: string
}

export interface LessonVideo {
  id: number
  mk_id: number | null
  lesson_id: number
  uid: string | null
  source: string | null
  duration_seconds: number | null
  created_at: string
}

export interface LessonFile {
  id: number
  mk_id: number | null
  lesson_id: number
  filename: string
  url: string
  created_at: string
}

export interface Classroom {
  id: number
  mk_id: number
  name: string
  created_at: string
  updated_at: string
}

export interface MembershipLevel {
  id: number
  mk_id: number
  name: string
  trial_period: number
  created_at: string
  updated_at: string
}

export interface MembershipLevelClassroom {
  id: number
  membership_level_id: number
  classroom_id: number
}

export interface User {
  id: number
  mk_id: number
  full_name: string
  email: string
  blocked: boolean
  unlimited: boolean
  sign_in_count: number
  current_sign_in_at: string | null
  last_seen_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Membership {
  id: number
  mk_id: number
  user_id: number
  membership_level_id: number
  status: MembershipStatus
  expire_date: string | null
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: number
  mk_id: number
  user_id: number
  course_id: number
  classroom_id: number | null
  status: EnrollmentStatus
  expire_date: string | null
  created_at: string
  updated_at: string
}

export interface LessonProgress {
  id: number
  mk_id: number | null
  user_id: number
  lesson_id: number
  progress: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserActivity {
  id: number
  user_id: number
  event_type: string
  payload: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface WebhookLog {
  id: number
  event_type: string
  payload: Record<string, unknown>
  status: WebhookLogStatus
  error_message: string | null
  processed_at: string | null
  created_at: string
}

// ============================================================================
// INSERT TYPES (omit auto-generated fields)
// ============================================================================

export type CategoryInsert = Omit<Category, 'id' | 'created_at' | 'updated_at'>
export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at'>
export type SectionInsert = Omit<Section, 'id' | 'created_at' | 'updated_at'>
export type LessonInsert = Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
export type LessonVideoInsert = Omit<LessonVideo, 'id' | 'created_at'>
export type LessonFileInsert = Omit<LessonFile, 'id' | 'created_at'>
export type ClassroomInsert = Omit<Classroom, 'id' | 'created_at' | 'updated_at'>
export type MembershipLevelInsert = Omit<MembershipLevel, 'id' | 'created_at' | 'updated_at'>
export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at'>
export type MembershipInsert = Omit<Membership, 'id' | 'created_at' | 'updated_at'>
export type EnrollmentInsert = Omit<Enrollment, 'id' | 'created_at' | 'updated_at'>
export type LessonProgressInsert = Omit<LessonProgress, 'id' | 'created_at' | 'updated_at'>
export type UserActivityInsert = Omit<UserActivity, 'id' | 'created_at'>
export type WebhookLogInsert = Omit<WebhookLog, 'id' | 'created_at'>

// ============================================================================
// VIEW TYPES
// ============================================================================

export interface StudentCourseProgress {
  user_id: number
  course_id: number
  course_name: string
  student_name: string
  student_email: string
  enrollment_status: EnrollmentStatus
  total_lessons: number
  completed_lessons: number
  progress_pct: number
  last_activity_at: string | null
}

export interface InactiveStudent {
  user_id: number
  full_name: string
  email: string
  last_seen_at: string | null
  sign_in_count: number
  days_inactive: number
  active_subscriptions: string[] | null
}

export interface SubscriptionSummary {
  membership_level_id: number
  level_name: string
  active_count: number
  pending_count: number
  expired_count: number
  inactive_count: number
  total_count: number
}
