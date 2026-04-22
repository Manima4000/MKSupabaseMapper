'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

export interface FormattedNewEnrollmentRow {
  name: string
  new_enrollments: number
}

interface Props { data: FormattedNewEnrollmentRow[] }

export default function NewEnrollmentsBar({ data }: Props) {
  return (
    <div className="bg-(--bg-surface) border border-(--border-subtle) rounded-xl p-6 shadow-sm flex flex-col h-[400px] animate-fade-up">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-muted)">Novas Matrículas</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-(--accent-gold)" />
          <span className="text-sm font-bold text-(--text-primary)">Matrículas no Período</span>
        </div>
        <p className="text-[10px] text-(--text-muted) mt-1">
          ⚠ Dados registrados a partir de 07/04/2026
        </p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={true} vertical={false} />
            <XAxis type="number" tick={false} tickLine={false} axisLine={false} />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} 
              tickLine={false} 
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: 'var(--bg-base)', opacity: 0.4 }}
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 8, 
                border: '1px solid var(--border-subtle)', 
                background: 'var(--bg-surface)', 
                color: 'var(--text-primary)', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Matrículas']}
            />
            <Bar 
              dataKey="new_enrollments" 
              name="Novas Matrículas" 
              fill="var(--accent-gold)" 
              maxBarSize={20} 
              radius={[0, 4, 4, 0]}
              animationDuration={1500}
            >
              {data.map((_, i) => <Cell key={i} fill="var(--accent-gold)" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
