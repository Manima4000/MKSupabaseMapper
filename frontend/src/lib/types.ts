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
  pending_count: number
  expired_count: number
  inactive_count: number
  total_count: number
}

export interface OverviewKpis {
  totalLessons: number
  activeStudents: number
  avgLessonsPerStudent: number
  medianLessonsPerStudent: number
}

export interface OverviewResponse {
  kpis: OverviewKpis
  weekly: WeeklyGlobalStat[]
  yearlyComparison: YearlyComparisonPoint[]
  subscriptions: SubscriptionSummaryRow[]
}
