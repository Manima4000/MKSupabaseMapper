'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SubscriptionSummaryRow } from '@/lib/types'

interface Props {
  subscriptions: SubscriptionSummaryRow[]
}

export default function SubscriptionSelector({ subscriptions }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()
  
  const currentId = searchParams.get('membershipLevelId')

  // Se não houver ID na URL mas houver assinaturas, selecionamos a primeira por padrão
  const effectiveId = currentId || (subscriptions.length > 0 ? String(subscriptions[0].membership_level_id) : '')

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams)
    if (id) {
      params.set('membershipLevelId', id)
      replace(`${pathname}?${params.toString()}`)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        Filtrar Plano:
      </span>
      <select
        value={effectiveId}
        onChange={(e) => handleSelect(e.target.value)}
        className="bg-white border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:border-[var(--accent-blue)] transition-all min-w-[280px] shadow-sm appearance-none"
      >
        {subscriptions.map((sub) => (
          <option key={sub.membership_level_id} value={sub.membership_level_id}>
            {sub.level_name} — {sub.active_count} ativos
          </option>
        ))}
      </select>
    </div>
  )
}
