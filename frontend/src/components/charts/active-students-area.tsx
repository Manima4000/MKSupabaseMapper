'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export interface FormattedWeeklyStat {
  label: string
  active_students: number
  Média: number
  Mediana: number
}

interface Props { data: FormattedWeeklyStat[] }

const COLOR = 'var(--accent-blue)'

export default function ActiveStudentsArea({ data }: Props) {
  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden animate-fade-up animate-delay-6 flex flex-col"
    >
      <div className="px-6 py-5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-slate-50/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Engajamento Semanal</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-blue)]">Alunos Ativos</span>
        </div>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="grad-blue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 8, 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-surface)', 
                color: 'var(--text-primary)', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Alunos']}
              labelFormatter={(l) => `Semana ${l}`}
            />
            <Area 
              type="monotone" 
              dataKey="active_students" 
              stroke="#3B82F6" 
              strokeWidth={3} 
              fill="url(#grad-blue)" 
              animationDuration={1500} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
