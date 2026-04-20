'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CreditCard } from 'lucide-react'
import { clsx } from 'clsx'

const NAV = [
  { href: '/dashboard/overview',      label: 'Visão Geral',  icon: LayoutGrid },
  { href: '/dashboard/subscriptions', label: 'Assinaturas',  icon: CreditCard },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-nav)]/80 backdrop-blur-md shadow-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link href="/dashboard/overview" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent-blue)] shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-105">
            <span className="text-white text-[10px] font-black font-mono tracking-tighter">AS</span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-tight uppercase text-[var(--text-primary)]">
              Arcanjo Sync
            </span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-wider">PREMIUM ANALYTICS</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200 group relative',
                  active 
                    ? 'text-[var(--accent-blue)] bg-[var(--accent-blue-glow)]' 
                    : 'text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)]'
                )}
              >
                <Icon
                  size={18}
                  className={clsx(
                    'transition-colors duration-200',
                    active ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                
                {active && (
                  <div className="absolute -bottom-[13px] left-0 right-0 h-[2px] bg-[var(--accent-blue)] rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer / Status */}
        <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-subtle)]">
          <div className="relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] shadow-[0_0_8px_var(--accent-emerald)]" />
            <div className="absolute w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-ping opacity-40" />
          </div>
          <span className="hidden md:inline text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">
            Online
          </span>
        </div>

      </div>
    </header>
  )
}
