'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export interface PrePivotedYearlyData {
  years: number[]
  lessons_completed: Record<string, number>[]
  avg_lessons_per_student: Record<string, number>[]
  median_lessons_per_student: Record<string, number>[]
}

interface Props { prePivotedData: PrePivotedYearlyData }

const YEAR_COLORS: Record<number, string> = {
  2024: '#94A3B8', // Cinza azulado
  2025: '#D4AF37', // Dourado
  2026: '#FDE047', // Amarelo
}

type Metric = 'lessons_completed' | 'avg_lessons_per_student' | 'median_lessons_per_student'

const METRICS: { value: Metric; label: string; fmt: (v: number) => string }[] = [
  { value: 'lessons_completed',          label: 'Total',   fmt: (v) => v.toLocaleString('pt-BR') },
  { value: 'avg_lessons_per_student',    label: 'Média',   fmt: (v) => v.toFixed(1) },
  { value: 'median_lessons_per_student', label: 'Mediana', fmt: (v) => v.toFixed(1) },
]

export default function YearlyComparisonLine({ prePivotedData }: Props) {
  const [metric, setMetric] = useState<Metric>('lessons_completed')

  const years   = prePivotedData.years
  const pivoted = prePivotedData[metric]
  const fmt     = METRICS.find((m) => m.value === metric)!.fmt

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col h-[400px] animate-fade-up">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Histórico de Campanha</p>
          <div className="flex items-center bg-[var(--bg-base)] p-1 rounded-md border border-[var(--border-subtle)]">
            {METRICS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetric(m.value)}
                className="transition-all duration-200"
                style={{
                  fontSize: '10px',
                  fontWeight: m.value === metric ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: m.value === metric ? 'var(--accent-blue)' : 'transparent',
                  color: m.value === metric ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {years.map((year) => (
            <div key={year} className="flex items-center gap-2">
              <div className="w-4 h-[3px] rounded-full" style={{ background: YEAR_COLORS[year] ?? '#6B7280' }} />
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">{year}</span>
            </div>
          ))}
          <span className="text-[9px] text-[var(--text-muted)] ml-auto italic">
            Dados históricos completos — não afetado pelo filtro de período
          </span>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pivoted} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="iso_week"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 8, 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-surface)', 
                color: 'var(--text-primary)', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(v, name) => [fmt(Number(v)), `Ano ${name}`]}
              labelFormatter={(l) => `Semana ISO ${l}`}
            />
            {years.map((year) => (
              <Line
                key={year}
                type="monotone"
                dataKey={String(year)}
                stroke={YEAR_COLORS[year] ?? '#6B7280'}
                strokeWidth={year === 2025 ? 3 : 2}
                strokeDasharray={year < 2025 ? "4 4" : "0"}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: YEAR_COLORS[year] }}
                animationDuration={2000}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
