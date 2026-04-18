'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

export interface FormattedSubscriptionRow {
  name: string
  active_count: number
}

interface Props { data: FormattedSubscriptionRow[] }

const STATUS = [
  { key: 'active_count',   label: 'Efetivo Ativo',    color: 'var(--accent-gold)' },
]

export default function SubscriptionBreakdownBar({ data }: Props) {
  return (
    <div
      className="instrument-card animate-fade-up animate-delay-5 flex flex-col"
      style={{ 
        '--card-accent': 'var(--accent-gold)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/3">
        <div className="flex flex-col gap-1">
          <p className="data-label" style={{ color: 'var(--text-primary)' }}>EFETIVO POR ESCALÃO</p>
          <p className="text-[10px] text-muted-foreground uppercase font-mono" style={{ color: 'var(--text-muted)' }}>Matrículas Ativas no Momento</p>
        </div>
        <div className="flex items-center gap-4">
          {STATUS.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}40` }} />
              <span className="data-label" style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-scope mx-4 my-4 p-4" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 40 }}>
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
              formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Matrículas']}
            />
            <Bar 
              dataKey="active_count" 
              name="Ativos" 
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
  
