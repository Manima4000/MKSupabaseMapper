import { Suspense } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchOverview } from '@/lib/api-client'
import { resolveRange, type RangePreset } from '@/lib/date-range'
import KpiCard from '@/components/dashboard/kpi-card'
import DateRangePicker from '@/components/dashboard/date-range-picker'
import SubscriptionBreakdownBar from '@/components/charts/subscription-breakdown-bar'
import ActiveStudentsArea from '@/components/charts/active-students-area'
import YearlyComparisonLine from '@/components/charts/yearly-comparison-line'
import AvgMedianLine from '@/components/charts/avg-median-line'
import type { YearlyComparisonPoint } from '@/lib/types'

interface Props {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>
}

function pivotYearlyData(data: YearlyComparisonPoint[], metric: 'lessons_completed' | 'avg_lessons_per_student' | 'median_lessons_per_student'): Record<string, number>[] {
  const map = new Map<number, Record<string, number>>()
  for (const row of data) {
    if (!map.has(row.iso_week)) map.set(row.iso_week, { iso_week: row.iso_week })
    map.get(row.iso_week)![String(row.year)] = row[metric]
  }
  return Array.from(map.values()).sort((a, b) => (a.iso_week as number) - (b.iso_week as number))
}

export default async function OverviewPage({ searchParams }: Props) {
  const { from, to, preset } = await searchParams
  const range = resolveRange(from, to, preset)

  const data = await fetchOverview(range.from, range.to)
  const { kpis, weekly, yearlyComparison, subscriptions } = data

  // Formatação de dados no Servidor (Thin-Client pattern)
  
  // 1. Assinaturas (Truncate nome)
  const formattedSubscriptions = subscriptions.map(d => ({
    name: d.level_name.length > 20 ? d.level_name.slice(0, 18) + '…' : d.level_name,
    active_count: d.active_count
  }))

  // 2. Gráficos Semanais (Parse da Data e mapeamento de chaves)
  const formattedWeekly = weekly.map(d => ({
    label: format(parseISO(d.week_start), 'dd/MM', { locale: ptBR }),
    active_students: d.active_students,
    Média: d.avg_lessons_per_active_student,
    Mediana: d.median_lessons_per_active_student
  }))

  // 3. Pivotação do Gráfico Anual
  // Como o usuário pode trocar a métrica no cliente, precisamos enviar os 3 pivôs já calculados
  const years = [...new Set(yearlyComparison.map(d => d.year))].sort()
  const formattedYearly = {
    years,
    lessons_completed: pivotYearlyData(yearlyComparison, 'lessons_completed'),
    avg_lessons_per_student: pivotYearlyData(yearlyComparison, 'avg_lessons_per_student'),
    median_lessons_per_student: pivotYearlyData(yearlyComparison, 'median_lessons_per_student')
  }

  return (
    <div className="space-y-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-8 border-b border-[var(--border-subtle)] pb-10">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-blue)]">
              Relatório Geral
            </p>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Visão Geral
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-4">
            Análise detalhada de engajamento e métricas de retenção.
          </p>
        </div>
        <div className="p-1 rounded-xl bg-white border border-[var(--border-subtle)] shadow-sm">
          <Suspense>
            <DateRangePicker currentPreset={range.preset as RangePreset} />
          </Suspense>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Atividades Concluídas"
          value={kpis.totalLessons}
          subtitle="Total acumulado no período"
          accent="var(--accent-blue)"
          delay={0.05}
        />
        <KpiCard
          title="Alunos Ativos"
          value={kpis.activeStudents}
          subtitle="Usuários engajados na plataforma"
          accent="var(--accent-blue)"
          delay={0.10}
        />
        <KpiCard
          title="Frequência Semanal"
          value={kpis.avgLessonsPerStudent.toFixed(1)}
          subtitle="Média de aulas por aluno"
          accent="var(--accent-blue)"
          delay={0.15}
        />
        <KpiCard
          title="Consistência"
          value={kpis.medianLessonsPerStudent.toFixed(1)}
          subtitle="Ponto central da distribuição"
          accent="var(--accent-blue)"
          delay={0.20}
        />
      </div>

      {/* ── Separador ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Indicadores de Campo</p>
        </div>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="group transition-all duration-300">
          <SubscriptionBreakdownBar data={formattedSubscriptions} />
        </div>
        <div className="group transition-all duration-300">
          <ActiveStudentsArea data={formattedWeekly} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="group transition-all duration-300">
          <YearlyComparisonLine prePivotedData={formattedYearly} />
        </div>
        <div className="group transition-all duration-300">
          <AvgMedianLine data={formattedWeekly} />
        </div>
      </div>

    </div>
  )
}
