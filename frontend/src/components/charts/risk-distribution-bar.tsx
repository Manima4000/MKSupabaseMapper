'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { SubscriptionRiskRow } from '@/lib/types'

interface FormattedRiskRow {
  name: string
  'Risco Crítico': number
  'Risco Alto': number
  'Risco Médio': number
  'Saudável': number
}

interface Props { data: FormattedRiskRow[] }

const STATUS = [
  { key: 'Risco Crítico', color: '#EF4444' }, // Vermelho
  { key: 'Risco Alto',    color: '#F97316' }, // Laranja
  { key: 'Risco Médio',   color: '#F59E0B' }, // Âmbar
  { key: 'Saudável',      color: 'var(--accent-gold)' }, // Dourado
]

export default function RiskDistributionBar({ data }: Props) {
  return (
    <div
      className="instrument-card animate-fade-up animate-delay-2 flex flex-col h-full"
      style={{ 
        '--card-accent': 'var(--accent-gold)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.03]">
        <div className="flex flex-col gap-1">
          <p className="data-label" style={{ color: 'var(--text-primary)' }}>RADAR DE DESERÇÃO</p>
          <p className="text-[10px] text-muted-foreground uppercase font-mono" style={{ color: 'var(--text-muted)' }}>Distribuição de Risco por Escalão</p>
        </div>
      </div>

      <div className="chart-scope mx-4 my-4 p-4 flex-1" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ top: 10, right: 30, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" horizontal={true} vertical={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }} 
              tickLine={false} 
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ 
                fontSize: 12, 
                borderRadius: 4, 
                border: '1px solid var(--accent-gold-dim)', 
                background: 'var(--bg-deep)', 
                color: 'var(--text-primary)', 
                fontFamily: 'var(--font-mono)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              formatter={(v: any) => [`${(v * 100).toFixed(1)}%`, 'Percentual']}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              content={(props) => {
                const { payload } = props;
                return (
                  <ul className="flex gap-4 mb-4 justify-end">
                    {payload?.map((entry: any, index: number) => (
                      <li key={`item-${index}`} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: entry.color }} />
                        <span className="data-label" style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                );
              }}
            />
            {STATUS.map(({ key, color }) => (
              <Bar 
                key={key} 
                dataKey={key} 
                stackId="a" 
                fill={color} 
                maxBarSize={30}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
