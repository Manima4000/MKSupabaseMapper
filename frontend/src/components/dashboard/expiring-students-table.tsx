'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ExpiringStudentRow } from '@/lib/types'

interface Props { data: ExpiringStudentRow[] }

const PAGE_SIZE = 25

function urgencyColor(dias: number): string {
  if (dias <= 7)  return '#EF4444'
  if (dias <= 14) return '#F97316'
  return '#D4AF37'
}

function urgencyGlow(dias: number): string {
  if (dias <= 7)  return '0 0 8px #ef4444'
  if (dias <= 14) return '0 0 8px #f97316'
  return '0 0 8px #d4af37'
}

function getWhatsAppLink(phone: string | null, name: string, dias: number): string {
  if (!phone) return '#'
  const clean = phone.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Olá ${name.split(' ')[0]}, sua assinatura expira em ${dias} dia${dias === 1 ? '' : 's'}. Quer renovar e continuar sua preparação? Estamos aqui para ajudar!`
  )
  return `https://wa.me/55${clean}?text=${msg}`
}

export default function ExpiringStudentsTable({ data }: Props) {
  const [isMounted, setIsMounted]         = useState(false)
  const [page, setPage]                   = useState(0)
  const [onlyRecuperavel, setOnly]        = useState(true)
  useEffect(() => { setIsMounted(true) }, [])

  const filtered    = onlyRecuperavel ? data.filter(r => r.recuperavel) : data
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const formatDate = (iso: string | null) => {
    if (!isMounted || !iso) return '—'
    try { return format(parseISO(iso), 'dd/MM/yy', { locale: ptBR }) } catch { return '—' }
  }

  const recuperavelCount = data.filter(r => r.recuperavel).length

  const handleToggle = (next: boolean) => {
    setOnly(next)
    setPage(0)
  }

  return (
    <div
      className="instrument-card animate-fade-up animate-delay-4 flex flex-col overflow-hidden"
      style={{
        '--card-accent': '#EF4444',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.03] flex justify-between items-start flex-wrap gap-4">
        <div>
          <p className="data-label" style={{ color: 'var(--text-primary)' }}>ALERTA DE RENOVAÇÃO — CONTATO IMEDIATO</p>
          <p className="text-[10px] uppercase font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
            {onlyRecuperavel
              ? `Alunos recuperáveis expirando nos próximos 30 dias · ${recuperavelCount} alunos`
              : `Todas assinaturas expirando nos próximos 30 dias · ${data.length} alunos`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggle recuperável / todos */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            <button
              onClick={() => handleToggle(true)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: onlyRecuperavel ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: onlyRecuperavel ? '#10B981' : 'var(--text-muted)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              Recuperáveis ({recuperavelCount})
            </button>
            <button
              onClick={() => handleToggle(false)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: !onlyRecuperavel ? 'rgba(212,175,55,0.15)' : 'transparent',
                color: !onlyRecuperavel ? '#D4AF37' : 'var(--text-muted)',
              }}
            >
              Todos ({data.length})
            </button>
          </div>
          {/* Legenda urgência */}
          <div className="flex gap-3">
            {[
              { label: '1-7d',   color: '#EF4444' },
              { label: '8-14d',  color: '#F97316' },
              { label: '15-30d', color: '#D4AF37' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="px-6 py-4 data-label" style={{ color: 'var(--text-secondary)' }}>Aluno</th>
              <th className="px-6 py-4 data-label" style={{ color: 'var(--text-secondary)' }}>Plano</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Expira em</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Dias Rest.</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Últ. Avaliação</th>
              <th className="px-6 py-4 data-label text-right" style={{ color: 'var(--text-secondary)' }}>Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {pageData.map((row) => {
              const color = urgencyColor(row.dias_restantes)
              const glow  = urgencyGlow(row.dias_restantes)
              return (
                <tr key={row.membership_id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-gold)] transition-colors">
                          {row.nome}
                        </span>
                        {row.recuperavel && (
                          <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                          >
                            ativo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                        {row.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.plano.length > 30 ? row.plano.slice(0, 28) + '…' : row.plano}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(row.expire_date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded border border-white/[0.05] bg-white/[0.02]">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: glow }} />
                      <span className="font-mono text-xs font-bold" style={{ color }}>
                        {row.dias_restantes} dia{row.dias_restantes === 1 ? '' : 's'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-xs" style={{ color: row.ultima_avaliacao ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {formatDate(row.ultima_avaliacao)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.telefone ? (
                      <a
                        href={getWhatsAppLink(row.telefone, row.nome, row.dias_restantes)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-80"
                        style={{ background: 'rgba(37,211,102,0.1)', borderColor: 'rgba(37,211,102,0.2)', color: '#25D366' }}
                      >
                        Renovar
                      </a>
                    ) : (
                      <span className="text-[10px] uppercase font-mono px-3 py-1.5" style={{ color: 'var(--text-muted)' }}>
                        Sem Telefone
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-white/[0.03] flex items-center justify-between">
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} alunos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              ← Anterior
            </button>
            <span className="text-[10px] font-mono px-2" style={{ color: 'var(--text-muted)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              Próximo →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
