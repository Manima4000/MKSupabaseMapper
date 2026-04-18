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
    <div className="space-y-10 max-w-[1400px]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/[0.05] pb-8">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
            <p className="data-label" style={{ color: 'var(--accent-gold)' }}>
              CENTRAL DE INTELIGÊNCIA
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
            Visão Geral
          </h1>
          <p className="font-sans text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
            Monitoramento tático de engajamento: <span className="font-mono text-xs">{range.from}</span> — <span className="font-mono text-xs">{range.to}</span>
          </p>
        </div>
        <div className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <Suspense>
            <DateRangePicker currentPreset={range.preset as RangePreset} />
          </Suspense>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <KpiCard
          title="CONJUNTO DE AULAS"
          value={kpis.totalLessons}
          subtitle="Conclusões táticas no período"
          accent="var(--accent-gold)"
          delay={0.05}
        />
        <KpiCard
          title="EFETIVO ATIVO"
          value={kpis.activeStudents}
          subtitle="Alunos únicos em operação"
          accent="var(--accent-gold)"
          delay={0.10}
        />
        <KpiCard
          title="RITMO DE ESTUDO (MÉD)"
          value={kpis.avgLessonsPerStudent.toFixed(1)}
          subtitle="Aulas por aluno / semana"
          accent="var(--accent-gold)"
          delay={0.15}
        />
        <KpiCard
          title="CONSTÂNCIA (MED)"
          value={kpis.medianLessonsPerStudent.toFixed(1)}
          subtitle="Ponto central da tropa"
          accent="var(--accent-gold)"
          delay={0.20}
        />
      </div>

      {/* ── Separador ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-[1px] bg-accent-gold" />
          <p className="data-label" style={{ color: 'var(--text-primary)' }}>Relatórios de Campo</p>
        </div>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)', opacity: 0.3 }} />
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
