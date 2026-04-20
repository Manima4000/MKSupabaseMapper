'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { FormattedWeeklyStat } from './active-students-area'

interface Props { data: FormattedWeeklyStat[] }

const C1 = 'var(--accent-blue)'
const C2 = '#F59E0B'

export default function AvgMedianLine({ data }: Props) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col h-[400px] animate-fade-up">
      <div className="mb-6 flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Rendimento Individual</p>
        <div className="flex items-center gap-4">
          {[['Média', C1], ['Mediana', C2]].map(([n, c]) => (
            <div key={n} className="flex items-center gap-2">
              <div className="w-4 h-[3px] rounded-full" style={{ background: c }} />
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} tickLine={false} axisLine={false} />
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
              formatter={(v, name) => [Number(v).toFixed(1), String(name)]}
              labelFormatter={(l) => `Semana ${l}`}
            />
            <Line type="monotone" dataKey="media" name="Média" stroke={C1} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: C1 }} />
            <Line type="monotone" dataKey="mediana" name="Mediana" stroke={C2} strokeWidth={2} dot={false} strokeDasharray="6 3" activeDot={{ r: 4, strokeWidth: 0, fill: C2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
