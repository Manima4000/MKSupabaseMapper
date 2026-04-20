import { Suspense } from 'react'
import { fetchSubscriptions, fetchOverview, fetchRiskScores } from '@/lib/api-client'
import { resolveRange, type RangePreset } from '@/lib/date-range'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import KpiCard from '@/components/dashboard/kpi-card'
import DateRangePicker from '@/components/dashboard/date-range-picker'
import WeeklyEfficiencyLine from '@/components/charts/weekly-velocity-line'
import WeeklyLessonsChart from '@/components/charts/weekly-lessons-bar'
import SubscriptionSelector from '@/components/dashboard/subscription-selector'
import StudentRiskTable from '@/components/dashboard/student-risk-table'
import type { SubscriptionWeeklyTrendRow } from '@/lib/types'

interface Props {
  searchParams: Promise<{ 
    from?: string; 
    to?: string; 
    preset?: string;
    membershipLevelId?: string 
  }>
}

/**
 * Pivota os dados para os gráficos.
 * Como o foco é em 1 plano agora, o pivot é simplificado.
 */
function pivotTrendData(data: SubscriptionWeeklyTrendRow[], key: 'lessons_completed' | 'lessons_per_student'): { chartData: any[], planName: string } {
  if (!data || data.length === 0) return { chartData: [], planName: '' }

  const sortedData = [...data].sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
  const planName = sortedData[0].level_name
  
  const chartData = sortedData.map(row => ({
    label: format(parseISO(row.week_start), 'dd/MM', { locale: ptBR }),
    [row.level_name]: parseFloat(String(row[key] || 0))
  }))

  return { chartData, planName }
}

export default async function SubscriptionsPage({ searchParams }: Props) {
  const { from, to, preset, membershipLevelId } = await searchParams
  const range = resolveRange(from, to, preset)
  
  // Pegamos a lista de planos para saber qual o ID default se a URL estiver vazia
  const overviewData = await fetchOverview(range.from, range.to)
  const subscriptionsList = overviewData.subscriptions
  
  const DEFAULT_PLAN_ID = 8 // Curso de Oficial: EFOMM, AFA e Escola Naval

  const selectedPlanId = membershipLevelId 
    ? parseInt(membershipLevelId) 
    : DEFAULT_PLAN_ID

  if (!selectedPlanId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground font-mono">NENHUM PLANO ATIVO ENCONTRADO.</p>
      </div>
    )
  }

  // Fetch de dados focado no plano
  const [data, riskScores] = await Promise.all([
    fetchSubscriptions(range.from, range.to, selectedPlanId),
    fetchRiskScores(selectedPlanId)
  ])

  const { kpis, weeklyTrend } = data

  const { chartData: volumeData, planName: currentPlan } = pivotTrendData(weeklyTrend, 'lessons_completed')
  const { chartData: efficiencyData } = pivotTrendData(weeklyTrend, 'lessons_per_student')

  return (
    <div className="space-y-10 max-w-[1400px]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/[0.05] pb-8">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <p className="data-label" style={{ color: 'var(--accent-gold)' }}>
              SAÚDE DA TROPA & RETENÇÃO
            </p>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Assinaturas
          </h1>
          <p className="font-sans text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
            Análise tática profunda do produto selecionado.
          </p>
        </div>
        
        <div className="flex flex-col gap-4 items-end">
          <div className="flex gap-4">
            <Suspense>
              <SubscriptionSelector subscriptions={subscriptionsList} />
            </Suspense>
            <div className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <Suspense>
                <DateRangePicker currentPreset={range.preset as RangePreset} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <KpiCard
          title="EFETIVO DO PLANO"
          value={kpis.totalActive}
          subtitle="Assinaturas Ativas"
          accent="var(--accent-gold)"
          delay={0.05}
        />
        <KpiCard
          title="RISCO CRÍTICO"
          value={kpis.criticalRisk}
          subtitle="Atenção Imediata"
          accent="#EF4444"
          delay={0.10}
        />
        <KpiCard
          title="PROGRESSO MÉDIO"
          value={`${kpis.avgProgress}%`}
          subtitle="Média dos Alunos"
          accent="var(--accent-gold)"
          delay={0.15}
        />
        <KpiCard
          title="HORAS / ALUNO"
          value={`${kpis.avgHoursPerStudent}h`}
          subtitle="Tempo de Missão"
          accent="var(--accent-gold)"
          delay={0.20}
        />
      </div>

      {/* ── Performance ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeeklyLessonsChart data={volumeData} plans={[currentPlan]} />
        <WeeklyEfficiencyLine data={efficiencyData} plans={[currentPlan]} />
      </div>

      {/* ── Ação (Radar de Risco) ───────────────────────────────────────── */}
      <div className="animate-fade-up">
        <StudentRiskTable data={riskScores} />
      </div>

    </div>
  )
}
