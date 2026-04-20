'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface Props {
  data: any[]
  title?: string
}

export default function CombinedWeeklyStatsChart({ data, title = "Performance Semanal" }: Props) {
  return (
    <div 
      className="bg-(--bg-surface) border border-(--border-subtle) rounded-xl p-6 shadow-sm flex flex-col h-100"
    >
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-muted)">{title}</p>
        <p className="text-sm font-bold text-(--text-primary)">
          Volume total vs. Média por aluno
        </p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
            />
            
            <YAxis 
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
            />

            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
            />

            <Tooltip 
              cursor={{ fill: 'var(--bg-base)', opacity: 0.4 }}
              contentStyle={{ 
                backgroundColor: 'var(--bg-surface)', 
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            />
            
            <Legend 
              verticalAlign="top" 
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '20px', color: 'var(--text-secondary)' }}
            />
            
            <Bar 
              yAxisId="left"
              dataKey="totalLessons" 
              name="Aulas Totais"
              fill="#3B82F6" 
              radius={[4, 4, 0, 0]}
            />
            
            <Line 
              yAxisId="right"
              type="monotone"
              dataKey="avgLessons" 
              name="Média por Aluno"
              stroke="#D4AF37" 
              strokeWidth={3}
              dot={{ r: 4, fill: "#D4AF37", strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
