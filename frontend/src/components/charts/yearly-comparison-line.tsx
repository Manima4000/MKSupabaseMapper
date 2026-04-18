'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { clsx } from 'clsx'

export interface PrePivotedYearlyData {
  years: number[]
  lessons_completed: Record<string, number>[]
  avg_lessons_per_student: Record<string, number>[]
  median_lessons_per_student: Record<string, number>[]
}

interface Props { prePivotedData: PrePivotedYearlyData }

const YEAR_COLORS: Record<number, string> = {
  2024: '#94A3B8', // Cinza azulado para o passado
  2025: '#D4AF37', // Dourado Arcanjo (Principal)
  2026: '#FDE047', // Amarelo brilhante para contraste nítido com o dourado
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
    <div
      className="instrument-card animate-fade-up animate-delay-5 flex flex-col"
      style={{ 
        '--card-accent': 'var(--accent-gold)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-3 border-b border-white/[0.03]">
        <p className="data-label" style={{ color: 'var(--text-primary)' }}>HISTÓRICO DE CAMPANHA</p>
        <div className="flex items-center bg-white/[0.03] p-1 rounded-md border border-white/[0.05]">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className="transition-all duration-200"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: m.value === metric ? 700 : 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                background: m.value === metric ? 'var(--accent-gold)' : 'transparent',
                color: m.value === metric ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Year legend */}
      <div className="px-6 py-4 flex items-center gap-6">
        {years.map((year) => (
          <div key={year} className="flex items-center gap-2">
            <div className="w-6 h-[2px] rounded-full" style={{ background: YEAR_COLORS[year] ?? '#6B7280' }} />
            <span className="data-label" style={{ fontSize: '10px', color: YEAR_COLORS[year] ?? '#6B7280' }}>{year}</span>
          </div>
        ))}
      </div>

      <div className="chart-scope mx-4 mb-4 p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={pivoted} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="iso_week"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 4, 
                border: '1px solid var(--accent-gold-dim)', 
                background: 'var(--bg-deep)', 
                color: 'var(--text-primary)', 
                fontFamily: 'var(--font-mono)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
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
