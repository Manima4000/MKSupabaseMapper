'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { WeeklyGlobalStat } from '@/lib/types'

interface Props {
  data: WeeklyGlobalStat[]
}

export default function WeeklyLessonsBar({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.week_start), "dd/MM", { locale: ptBR }),
  }))

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Aulas concluídas por semana</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Aulas']}
            labelFormatter={(l) => `Semana de ${l}`}
          />
          <Bar dataKey="total_lessons_completed" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
