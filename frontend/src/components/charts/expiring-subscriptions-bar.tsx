'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { ExpiringSubscriptionSummaryRow } from '@/lib/types'

interface Props { data: ExpiringSubscriptionSummaryRow[] }

const shortName = (name: string) => name.length > 22 ? name.slice(0, 20) + '…' : name

export default function ExpiringSubscriptionsBar({ data }: Props) {
  const chartData = data.map(row => ({
    name: shortName(row.level_name),
    'Total': row.expira_7d + row.expira_8_14d + row.expira_15_30d,
    'Recuperáveis': row.recuperavel_7d + row.recuperavel_8_14d + row.recuperavel_15_30d,
  }))

  const total       = data.reduce((s, r) => s + r.expira_7d + r.expira_8_14d + r.expira_15_30d, 0)
  const recuperavel = data.reduce((s, r) => s + r.recuperavel_7d + r.recuperavel_8_14d + r.recuperavel_15_30d, 0)

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm flex flex-col h-[400px] animate-fade-up">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Alerta de Expiração</p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-[var(--text-primary)]">Assinaturas Expirando em 30 dias</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--text-muted)]">{total} total</span>
            <span className="text-xs font-mono text-emerald-400 font-bold">{recuperavel} recuperáveis</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} vertical={true} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={110}
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
              formatter={(v, name) => [Number(v).toLocaleString('pt-BR'), name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{value}</span>}
            />
            <Bar dataKey="Total"       fill="#D4AF37" maxBarSize={10} radius={[0, 3, 3, 0]} animationDuration={1200} />
            <Bar dataKey="Recuperáveis" fill="#10B981" maxBarSize={10} radius={[0, 3, 3, 0]} animationDuration={1400} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
