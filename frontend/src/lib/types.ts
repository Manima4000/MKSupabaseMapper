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

export interface SubscriptionRiskRow {
  membership_level_id: number
  level_name: string
  active_students: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  critical_pct: number
  high_pct: number
  medium_pct: number
  low_pct: number
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

export interface SubscriptionEngagementRow {
  membership_level_id: number
  level_name: string
  active_students: number
  avg_progress_pct: number
  total_lessons_completed: number
  total_study_hours: number
  avg_study_hours_per_student: number
  students_critical: number
  students_high: number
  students_medium: number
  students_low: number
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

export interface SubscriptionPageResponse {
  kpis: {
    totalActive: number
    criticalRisk: number
    avgProgress: number
    avgHoursPerStudent: number
  }
  riskDistribution: SubscriptionRiskRow[]
  weeklyTrend: SubscriptionWeeklyTrendRow[]
  engagementTable: SubscriptionEngagementRow[]
}
