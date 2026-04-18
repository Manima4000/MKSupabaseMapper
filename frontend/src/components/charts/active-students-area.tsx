'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export interface FormattedWeeklyStat {
  label: string
  active_students: number
  Média: number
  Mediana: number
}

interface Props { data: FormattedWeeklyStat[] }

const COLOR = 'var(--accent-gold)'

export default function ActiveStudentsArea({ data }: Props) {
  return (
    <div
      className="instrument-card animate-fade-up animate-delay-6 flex flex-col"
      style={{ 
        '--card-accent': COLOR,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.03]">
        <p className="data-label" style={{ color: 'var(--text-primary)' }}>MOBILIZAÇÃO SEMANAL</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR, boxShadow: `0 0 8px ${COLOR}` }} />
          <span className="data-label" style={{ color: COLOR, fontSize: '9px' }}>EFETIVO ATIVO</span>
        </div>
      </div>

      <div className="chart-scope mx-4 my-4 p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="grad-gold-dark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLOR} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Alunos']}
              labelFormatter={(l) => `Semana ${l}`}
            />
            <Area type="monotone" dataKey="active_students" stroke={COLOR} strokeWidth={2.5} fill="url(#grad-gold-dark)" animationDuration={1500} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
