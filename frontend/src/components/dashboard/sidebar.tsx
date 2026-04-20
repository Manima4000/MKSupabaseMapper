'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CreditCard, Users, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard/overview',      label: 'Visão Geral',  icon: LayoutGrid },
  { href: '/dashboard/subscriptions', label: 'Assinaturas',  icon: CreditCard },
  { href: '/dashboard/students',      label: 'Radar de Risco', icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        "h-full shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-nav)] transition-all duration-300 ease-in-out z-50 shadow-sm",
        isHovered ? "w-64" : "w-20"
      )}
    >
      {/* Brand / Logo */}
      <div className={clsx(
        "px-6 pt-8 pb-6 border-b border-[var(--border-subtle)] flex items-center gap-3 overflow-hidden whitespace-nowrap",
        !isHovered && "justify-center px-0"
      )}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--accent-blue)] shadow-lg shadow-blue-500/20"
        >
          <span className="text-white text-xs font-black font-mono tracking-tighter">AS</span>
        </div>
        {isHovered && (
          <div className="flex flex-col">
            <span className="font-display text-sm font-bold tracking-tight uppercase text-[var(--text-primary)]">
              Arcanjo Sync
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-wider">PREMIUM ANALYTICS</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-4 rounded-xl px-3.5 py-3 transition-all duration-200 group relative',
                active ? 'bg-[var(--accent-blue-glow)] text-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)]',
                !isHovered && "justify-center"
              )}
            >
              <Icon
                size={22}
                className={clsx(
                  'transition-colors duration-200 shrink-0',
                  active ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              
              {isHovered && (
                <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
              )}
              
              {active && !isHovered && (
                <div className="absolute left-0 w-1 h-6 bg-[var(--accent-blue)] rounded-r-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer / Status */}
      <div className={clsx(
        "px-6 py-6 border-t border-[var(--border-subtle)] flex items-center transition-all duration-300",
        !isHovered ? "justify-center px-0" : "gap-3"
      )}>
        <div className="relative flex items-center justify-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-emerald)] shadow-[0_0_12px_var(--accent-emerald)]" />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-[var(--accent-emerald)] animate-ping opacity-40" />
        </div>
        {isHovered && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
            Sistema Online
          </span>
        )}
      </div>
    </aside>
  )
}
