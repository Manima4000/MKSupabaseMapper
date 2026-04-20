export interface WeeklyGlobalStat {
  week_start: string
  total_lessons_completed: number
  active_students: number
  avg_lessons_per_active_student: number
  median_lessons_per_active_student: number
}

export interface YearlyComparisonPoint {
  year: number
  iso_week: number
  week_start: string
  lessons_completed: number
  active_students: number
  avg_lessons_per_student: number
  median_lessons_per_student: number
}

export interface SubscriptionSummaryRow {
  membership_level_id: number
  level_name: string
  active_count: number
  pending_count?: number
  expired_count?: number
  inactive_count?: number
  total_count?: number
}

export interface SubscriptionWeeklyTrendRow {
  week_start: string
  membership_level_id: number
  level_name: string
  active_students: number
  lessons_completed: number
  estimated_hours: number
  lessons_per_student: number
  hours_per_student: number
}

export interface OverviewKpis {
  totalLessons: number
  activeStudents: number
  avgLessonsPerStudent: number
  medianLessonsPerStudent: number
}

export interface NewEnrollmentSummaryRow {
  membership_level_id: number
  level_name: string
  new_enrollments: number
}

export interface OverviewResponse {
  kpis: OverviewKpis
  weekly: WeeklyGlobalStat[]
  yearlyComparison: YearlyComparisonPoint[]
  subscriptions: SubscriptionSummaryRow[]
  newEnrollments: NewEnrollmentSummaryRow[]
}

export interface SubscriptionPageResponse {
  kpis: {
    totalActive: number
    criticalRisk: number
    avgProgress: number
    avgHoursPerStudent: number
  }
  weeklyTrend: SubscriptionWeeklyTrendRow[]
}

export interface ExpiringSubscriptionSummaryRow {
  membership_level_id: number
  level_name: string
  expira_7d: number
  expira_8_14d: number
  expira_15_30d: number
  recuperavel_7d: number
  recuperavel_8_14d: number
  recuperavel_15_30d: number
}

export interface ExpiringStudentRow {
  membership_id: number
  user_id: number
  nome: string
  email: string
  telefone: string | null
  plano: string
  expire_date: string
  dias_restantes: number
  last_activity_date: string | null
  ultima_avaliacao: string | null
  recuperavel: boolean
}

export interface ExpiringResponse {
  summary: ExpiringSubscriptionSummaryRow[]
  students: ExpiringStudentRow[]
}
