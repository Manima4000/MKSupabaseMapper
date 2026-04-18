'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CreditCard, Users } from 'lucide-react'
import { clsx } from 'clsx'

const NAV = [
  { href: '/dashboard/overview',      label: 'Visão Geral',  icon: LayoutGrid },
  { href: '/dashboard/subscriptions', label: 'Assinaturas',  icon: CreditCard },
  { href: '/dashboard/students',      label: 'Alunos',       icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 shrink-0 flex flex-col"
      style={{ background: 'var(--bg-nav)', borderRight: '1px solid var(--border-subtle)' }}
    >
      {/* Top gold accent line */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--accent-gold) 0%, transparent 100%)' }} />

      {/* Brand */}
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-6 h-6 rounded-sm flex items-center justify-center shrink-0"
            style={{ 
              background: 'var(--accent-gold)', 
              boxShadow: '0 0 12px var(--accent-gold-glow)' 
            }}
          >
            <span style={{ color: 'var(--bg-base)', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>TA</span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}
          >
            Tropa do Arcanjo
          </span>
        </div>
        <p className="data-label" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
          Inteligência & Analytics
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        <p className="data-label px-3 mb-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Operações</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-3 transition-all duration-200',
                active ? 'bg-white/4' : 'hover:bg-white/2',
              )}
              style={{
                borderLeft: active ? '3px solid var(--accent-gold)' : '3px solid transparent',
              }}
            >
              <Icon
                size={16}
                style={{ color: active ? 'var(--accent-gold)' : 'var(--text-secondary)', strokeWidth: 2 }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.02em',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: 'var(--accent-gold)', boxShadow: '0 0 8px var(--accent-gold)' }}
          />
          <span className="data-label" style={{ color: 'var(--text-muted)' }}>Status: Prontidão</span>
        </div>
      </div>
    </aside>
  )
}
