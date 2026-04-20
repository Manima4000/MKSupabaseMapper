'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  data: any[]
  title?: string
}

export default function SubscriptionRetentionArea({ data, title = "Evolução de Alunos Ativos por Semana" }: Props) {
  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col h-[400px]"
    >
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
        <p className="text-sm font-bold text-[var(--text-primary)]">
          Alunos que concluíram ao menos 1 aula na semana
        </p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
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
              cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 8, 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-surface)', 
                color: 'var(--text-primary)', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Alunos']}
            />
            <Area 
              type="monotone" 
              dataKey="activeStudents" 
              name="Alunos Ativos"
              stroke="#10B981" 
              strokeWidth={3} 
              fill="url(#grad-green)" 
              animationDuration={1500} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
