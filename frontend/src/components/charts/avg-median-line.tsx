'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { FormattedWeeklyStat } from './active-students-area'

interface Props { data: FormattedWeeklyStat[] }

const C1 = 'var(--accent-gold)'
const C2 = '#F59E0B' // Amber for secondary line

export default function AvgMedianLine({ data }: Props) {
  return (
    <div
      className="instrument-card animate-fade-up animate-delay-6 flex flex-col"
      style={{ 
        '--card-accent': C1,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.03]">
        <p className="data-label" style={{ color: 'var(--text-primary)' }}>RENDIMENTO INDIVIDUAL</p>
        <div className="flex items-center gap-4">
          {[['Média', C1], ['Mediana', C2]].map(([n, c]) => (
            <div key={n} className="flex items-center gap-2">
              <div className="w-5 h-[2px] rounded-full" style={{ background: c }} />
              <span className="data-label" style={{ fontSize: '9px', color: c }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-scope mx-4 my-4 p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
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
              formatter={(v, name) => [Number(v).toFixed(1), String(name)]}
              labelFormatter={(l) => `Semana ${l}`}
            />
            <Line type="monotone" dataKey="Média"   stroke={C1} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: C1 }} />
            <Line type="monotone" dataKey="Mediana" stroke={C2} strokeWidth={2} dot={false} strokeDasharray="6 3" activeDot={{ r: 4, strokeWidth: 0, fill: C2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
