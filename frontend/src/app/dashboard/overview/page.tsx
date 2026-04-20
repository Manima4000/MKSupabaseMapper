import { Suspense } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchOverview } from '@/lib/api-client'
import { resolveRange, type RangePreset } from '@/lib/date-range'
import KpiCard from '@/components/dashboard/kpi-card'
import DateRangePicker from '@/components/dashboard/date-range-picker'
import NewEnrollmentsBar from '@/components/charts/new-enrollments-bar'
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
  const { kpis, weekly, yearlyComparison, newEnrollments } = data

  // Formatação de dados no Servidor (Thin-Client pattern)
  
  // 1. Novas Matrículas (Truncate nome)
  const formattedNewEnrollments = newEnrollments.map(d => ({
    name: d.level_name.length > 20 ? d.level_name.slice(0, 18) + '…' : d.level_name,
    new_enrollments: d.new_enrollments
  }))

  // 2. Gráficos Semanais (Parse da Data e mapeamento de chaves)
  const formattedWeekly = weekly.map(d => ({
    label: format(parseISO(d.week_start), 'dd/MM', { locale: ptBR }),
    active_students: d.active_students,
    media: d.avg_lessons_per_active_student,
    mediana: d.median_lessons_per_active_student
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
    <div className="space-y-12 max-w-[1400px]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-8 border-b border-white/[0.05] pb-10">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" style={{ boxShadow: '0 0 8px var(--accent-blue)' }} />
            <p className="data-label" style={{ color: 'var(--accent-blue)' }}>
              RELATÓRIO GERAL
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
          <p className="font-sans text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
            Análise detalhada de engajamento e métricas de retenção.
          </p>
        </div>
        <div className="p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] shadow-sm">
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
          subtitle="Média ponderada semanal (lições/aluno ativo)"
          accent="var(--accent-blue)"
          delay={0.15}
        />
        <KpiCard
          title="Consistência"
          value={kpis.medianLessonsPerStudent.toFixed(1)}
          subtitle="Mediana semanal de engajamento"
          accent="var(--accent-blue)"
          delay={0.20}
        />
      </div>

      {/* ── Separador ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <p className="data-label" style={{ color: 'var(--text-muted)' }}>INDICADORES DE CAMPO</p>
        </div>
        <div className="flex-1 h-px bg-white/[0.03]" />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="group transition-all duration-300">
          <NewEnrollmentsBar data={formattedNewEnrollments} />
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
