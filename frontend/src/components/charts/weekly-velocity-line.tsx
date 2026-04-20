'use client'

import {
  LineChart,
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
  plans: string[]
  title?: string
}

export default function WeeklyEfficiencyLine({ data, plans, title = "MÉDIA DE AULAS POR ALUNO" }: Props) {
  const colors = [
    '#D4AF37', // Gold
    '#E5E5E5', // Platinum
    '#A1A1AA', // Zinc
    '#71717A', // Muted
    '#EF4444', // Red
  ]

  return (
    <div 
      className="instrument-card p-6 flex flex-col h-[400px]"
      style={{ 
        '--card-accent': 'var(--accent-gold)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="mb-6">
        <p className="data-label text-accent-gold">{title}</p>
        <p className="text-[10px] text-muted-foreground uppercase font-mono mt-1">
          Intensidade de estudo (aulas concluidas / alunos ativos)
        </p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--bg-surface)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right"
              iconType="line"
              wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)', paddingBottom: '20px' }}
            />
            {plans.map((plan, index) => (
              <Line 
                key={plan}
                type="monotone"
                dataKey={plan} 
                name={plan}
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                dot={{ r: 3, fill: colors[index % colors.length], strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
