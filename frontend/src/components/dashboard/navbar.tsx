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
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-6">
      <header className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-2xl border border-[var(--border-subtle)] bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
        
        {/* Brand/Logo Icon */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--border-subtle)]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-blue)] shadow-lg shadow-blue-500/20">
            <span className="text-white text-[10px] font-black font-mono tracking-tighter">AS</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-4 py-2 transition-all duration-300 group relative',
                  active 
                    ? 'text-[var(--accent-blue)] bg-[var(--accent-blue-glow)]' 
                    : 'text-[var(--text-secondary)] hover:bg-slate-100/50 hover:text-[var(--text-primary)]'
                )}
              >
                <Icon
                  size={16}
                  className={clsx(
                    'transition-colors duration-300',
                    active ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Status Indicator */}
        <div className="flex items-center pl-3 border-l border-[var(--border-subtle)] mr-2">
          <div className="relative flex items-center justify-center group/status">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] shadow-[0_0_8px_var(--accent-emerald)]" />
            <div className="absolute w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-ping opacity-30" />
            
            {/* Tooltip on Hover */}
            <div className="absolute top-full mt-2 hidden group-hover/status:block px-2 py-1 rounded bg-slate-900 text-[8px] text-white font-bold uppercase tracking-widest whitespace-nowrap">
              Sistema Online
            </div>
          </div>
        </div>

      </header>
    </div>
  )
}
