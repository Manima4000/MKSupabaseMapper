import { supabase } from '../../config/supabase.js'
import { SupabaseError } from '../../shared/errors.js'
import type {
  OverviewKpis,
  OverviewResponse,
  SubscriptionSummaryRow,
  WeeklyGlobalStat,
  YearlyComparisonPoint,
} from './analytics.types.js'

export async function getOverview(from: string, to: string): Promise<OverviewResponse> {
  const [weekly, yearlyComparison, activeStudents, subscriptions] = await Promise.all([
    getWeeklyGlobalStats(from, to),
    getYearlyComparison(),
    getActiveStudentsCount(from, to),
    getSubscriptionSummary(),
  ])

  const kpis = computeKpis(weekly, activeStudents)

  return { kpis, weekly, yearlyComparison, subscriptions }
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
    .select('level_name, active_count')
    .gt('active_count', 0) // Remove planos sem nenhum aluno ativo para limpar o gráfico
    .order('active_count', { ascending: false }) // Os planos maiores primeiro (hierarquia militar)

  if (error) throw new SupabaseError('Falha ao buscar mvw_subscription_summary', error)
  return (data ?? []) as SubscriptionSummaryRow[]
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
