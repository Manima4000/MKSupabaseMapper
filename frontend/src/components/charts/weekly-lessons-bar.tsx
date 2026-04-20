'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface Props {
  data: any[]
  plans: string[]
  title?: string
}

export default function WeeklyLessonsChart({ data, plans, title = "Conclusão de Aulas" }: Props) {
  // Cores Modernas (SaaS Palette)
  const colors = [
    '#3B82F6', // Blue 500
    '#6366F1', // Indigo 500
    '#8B5CF6', // Violet 500
    '#0EA5E9', // Sky 500
    '#10B981', // Emerald 500
  ]

  return (
    <div 
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col h-[400px]"
    >
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
        <p className="text-sm font-bold text-[var(--text-primary)]">
          Volume semanal de atividades concluídas
        </p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
            />
            <YAxis 
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
            {plans.map((plan, index) => (
              <Bar 
                key={plan}
                dataKey={plan} 
                name={plan}
                stackId="a"
                fill={colors[index % colors.length]} 
                radius={index === plans.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
