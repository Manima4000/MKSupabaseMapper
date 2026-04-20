import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  OverviewKpis,
  OverviewResponse,
  SubscriptionSummaryRow,
  WeeklyGlobalStat,
  YearlyComparisonPoint,
  SubscriptionPageResponse,
  SubscriptionWeeklyTrendRow,
  SubscriptionEngagementRow,
  NewEnrollmentSummaryRow,
  ExpiringSubscriptionSummaryRow,
  ExpiringStudentRow,
  ExpiringResponse,
} from './analytics.types.js'


export async function getOverview(from: string, to: string): Promise<OverviewResponse> {
  const [weekly, yearlyComparison, activeStudents, subscriptions, newEnrollments] = await Promise.all([
    getWeeklyGlobalStats(from, to),
    getYearlyComparison(),
    getActiveStudentsCount(from, to),
    getSubscriptionSummary(),
    getNewEnrollmentsSummary(from, to),
  ])

  const kpis = computeKpis(weekly, activeStudents)

  return { kpis, weekly, yearlyComparison, subscriptions, newEnrollments }
}

export async function getSubscriptionAnalytics(from: string, to: string, membershipLevelId?: number): Promise<SubscriptionPageResponse> {
  const [trend, engagement] = await Promise.all([
    getSubscriptionWeeklyTrend(from, to, membershipLevelId),
    getSubscriptionEngagement(membershipLevelId),
  ])

  // Calcular KPIs específicos (ou globais se membershipLevelId for undefined)
  const filteredEngagement = membershipLevelId 
    ? engagement.filter(e => e.membership_level_id === membershipLevelId)
    : engagement

  const totalActive = filteredEngagement.reduce((sum, e) => sum + (e.active_students ?? 0), 0)
  const criticalRisk = filteredEngagement.reduce((sum, e) => sum + (e.students_critical ?? 0), 0)
  const avgProgress = totalActive > 0 
    ? filteredEngagement.reduce((sum, e) => sum + (e.avg_progress_pct ?? 0) * (e.active_students ?? 0), 0) / totalActive 
    : 0
  const avgHours = totalActive > 0
    ? filteredEngagement.reduce((sum, e) => sum + (e.total_study_hours ?? 0), 0) / totalActive
    : 0

  return {
    kpis: {
      totalActive,
      criticalRisk,
      avgProgress: Math.round(avgProgress * 10) / 10,
      avgHoursPerStudent: Math.round(avgHours * 10) / 10
    },
    weeklyTrend: trend,
  }
}

export async function getExpiringSoon(membershipLevelId?: number): Promise<ExpiringResponse> {
  const now    = new Date()
  const in30d  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  let query = supabase
    .from('mvw_expiring_subscriptions')
    .select('membership_id, membership_level_id, level_name, user_id, nome, email, telefone, expire_date, last_activity_date, ultima_avaliacao')
    .gte('expire_date', now.toISOString())
    .lte('expire_date', in30d.toISOString())
    .order('expire_date', { ascending: true })
    .limit(500)

  if (membershipLevelId) {
    query = query.eq('membership_level_id', membershipLevelId)
  }

  const { data, error } = await query

  if (error) throw new SupabaseError('Falha ao buscar mvw_expiring_subscriptions', error)

  const rows = data ?? []

  // Agregação de resumo por plano × bucket em TypeScript
  const in7d   = new Date(now.getTime() +  7 * 24 * 60 * 60 * 1000)
  const in14d  = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const levelMap = new Map<number, ExpiringSubscriptionSummaryRow>()
  for (const row of rows) {
    const exp = new Date(row.expire_date)
    const recuperavel = row.last_activity_date != null && new Date(row.last_activity_date) >= ago30d
    const entry = levelMap.get(row.membership_level_id) ?? {
      membership_level_id: row.membership_level_id,
      level_name: row.level_name,
      expira_7d: 0, expira_8_14d: 0, expira_15_30d: 0,
      recuperavel_7d: 0, recuperavel_8_14d: 0, recuperavel_15_30d: 0,
    }
    if (exp <= in7d) {
      entry.expira_7d++
      if (recuperavel) entry.recuperavel_7d++
    } else if (exp <= in14d) {
      entry.expira_8_14d++
      if (recuperavel) entry.recuperavel_8_14d++
    } else {
      entry.expira_15_30d++
      if (recuperavel) entry.recuperavel_15_30d++
    }
    levelMap.set(row.membership_level_id, entry)
  }

  const summary = Array.from(levelMap.values())
    .sort((a, b) => b.expira_7d - a.expira_7d || (b.expira_8_14d + b.expira_15_30d) - (a.expira_8_14d + a.expira_15_30d))

  const students: ExpiringStudentRow[] = rows.map(row => {
    const recuperavel = row.last_activity_date != null && new Date(row.last_activity_date) >= ago30d
    return {
      membership_id: row.membership_id,
      user_id: row.user_id,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      plano: row.level_name,
      expire_date: row.expire_date,
      dias_restantes: Math.ceil((new Date(row.expire_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      last_activity_date: row.last_activity_date ?? null,
      ultima_avaliacao: row.ultima_avaliacao ?? null,
      recuperavel,
    }
  })

  return { summary, students }
}

async function getSubscriptionWeeklyTrend(from: string, to: string, membershipLevelId?: number): Promise<SubscriptionWeeklyTrendRow[]> {
  let query = supabase
    .from('mvw_subscription_weekly_trend_normalized')
    .select('*')
    .gte('week_start', from)
    .lte('week_start', to)
  
  if (membershipLevelId) {
    query = query.eq('membership_level_id', membershipLevelId)
  }

  const { data, error } = await query.order('week_start', { ascending: true })

  if (error) throw new SupabaseError('Falha ao buscar mvw_subscription_weekly_trend_normalized', error)
  return (data ?? []) as SubscriptionWeeklyTrendRow[]
}

async function getSubscriptionEngagement(membershipLevelId?: number): Promise<SubscriptionEngagementRow[]> {
  let query = supabase
    .from('mvw_subscription_engagement')
    .select('*')
  
  if (membershipLevelId) {
    query = query.eq('membership_level_id', membershipLevelId)
  }

  const { data, error } = await query.order('level_name')

  if (error) throw new SupabaseError('Falha ao buscar mvw_subscription_engagement', error)
  return (data ?? []) as SubscriptionEngagementRow[]
}

async function getWeeklyGlobalStats(from: string, to: string): Promise<WeeklyGlobalStat[]> {
  const { data, error } = await supabase
    .from('mvw_weekly_global_stats')
    .select('*')
    .gte('week_start', from)
    .lte('week_start', to)
    .order('week_start')

  if (error) throw new SupabaseError('Falha ao buscar mvw_weekly_global_stats', error)
  return (data ?? []) as WeeklyGlobalStat[]
}

async function getYearlyComparison(): Promise<YearlyComparisonPoint[]> {
  const { data, error } = await supabase
    .from('mvw_yearly_weekly_comparison')
    .select('*')
    .order('year')
    .order('iso_week')

  if (error) throw new SupabaseError('Falha ao buscar mvw_yearly_weekly_comparison', error)
  return (data ?? []) as YearlyComparisonPoint[]
}

// COUNT(DISTINCT user_id) feito no banco via RPC — evita o limite de 1000 linhas
// do PostgREST que causava subcontagem em períodos longos.
async function getActiveStudentsCount(from: string, to: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('fn_active_students_count', { p_from: from, p_to: to })

  if (error) throw new SupabaseError('Falha ao contar alunos ativos', error)
  return (data as number) ?? 0
}

async function getSubscriptionSummary(): Promise<SubscriptionSummaryRow[]> {
  const { data, error } = await supabase
    .from('mvw_subscription_summary')
    .select('membership_level_id, level_name, active_count')
    .gt('active_count', 0) // Remove planos sem nenhum aluno ativo para limpar o gráfico
    .order('active_count', { ascending: false }) // Os planos maiores primeiro (hierarquia militar)

  if (error) throw new SupabaseError('Falha ao buscar mvw_subscription_summary', error)
  return (data ?? []) as SubscriptionSummaryRow[]
}

async function getNewEnrollmentsSummary(from: string, to: string): Promise<NewEnrollmentSummaryRow[]> {
  const { data, error } = await supabase
    .rpc('fn_new_enrollments_summary', { p_from: from, p_to: to })

  if (error) throw new SupabaseError('Falha ao contar novas matrículas', error)
  return (data ?? []) as NewEnrollmentSummaryRow[]
}

function computeKpis(weekly: WeeklyGlobalStat[], activeStudents: number): OverviewKpis {
  const totalLessons = weekly.reduce((sum, w) => sum + (w.total_lessons_completed ?? 0), 0)

  const totalStudentWeeks = weekly.reduce((sum, w) => sum + (w.active_students ?? 0), 0)
  const weightedAvg =
    totalStudentWeeks > 0
      ? weekly.reduce(
          (sum, w) => sum + (w.avg_lessons_per_active_student ?? 0) * (w.active_students ?? 0),
          0,
        ) / totalStudentWeeks
      : 0

  const medians = weekly.map(w => w.median_lessons_per_active_student ?? 0).sort((a, b) => a - b)
  const mid = Math.floor(medians.length / 2)
  const medianOfMedians =
    medians.length === 0
      ? 0
      : medians.length % 2 === 0
        ? ((medians[mid - 1] ?? 0) + (medians[mid] ?? 0)) / 2
        : (medians[mid] ?? 0)

  return {
    totalLessons,
    activeStudents,
    avgLessonsPerStudent: Math.round(weightedAvg * 10) / 10,
    medianLessonsPerStudent: Math.round(medianOfMedians * 10) / 10,
  }
}
