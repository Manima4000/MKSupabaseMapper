'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface StudentRiskRow {
  user_id: number
  nome: string
  email: string
  telefone: string | null
  planos_ativos: string
  last_lesson_completed_at: string | null
  dias_sem_concluir_aula: number | null
  media_aulas_por_semana: number
  aulas_semana_atual: number
  risk_level: 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
}

interface Props { data: StudentRiskRow[] }

export default function StudentRiskTable({ data }: Props) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const getWhatsAppLink = (phone: string | null | undefined, name: string) => {
    if (!phone) return '#'
    const cleanPhone = phone.replace(/\D/g, '')
    const message = encodeURIComponent(`Olá ${name.split(' ')[0]}, notei que você está um tempo sem progredir no curso. Está tudo bem? Como posso te ajudar?`)
    return `https://wa.me/55${cleanPhone}?text=${message}`
  }

  const formatLastActivity = (date: string | null) => {
    if (!date) return 'Nunca'
    if (!isMounted) return '...' // Evita erro de hidratação (SSR vs Client Timezone)
    try {
      return format(parseISO(date), 'dd/MM/yy HH:mm', { locale: ptBR })
    } catch (e) {
      return '---'
    }
  }

  return (
    <div
      className="instrument-card animate-fade-up animate-delay-4 flex flex-col overflow-hidden"
      style={{ 
        '--card-accent': 'var(--accent-gold)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.03] flex justify-between items-center">
        <div>
          <p className="data-label" style={{ color: 'var(--text-primary)' }}>RADAR DE RISCO - INDIVIDUAL</p>
          <p className="text-[10px] text-muted-foreground uppercase font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
            Acompanhamento tático de deserção por Stuck Time
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-mono text-secondary-foreground">21+ dias</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[10px] font-mono text-secondary-foreground">14-20 dias</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] font-mono text-secondary-foreground">7-13 dias</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="px-6 py-4 data-label" style={{ color: 'var(--text-secondary)' }}>Aluno / Plano</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Última Atividade</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Estagnado</th>
              <th className="px-6 py-4 data-label text-center" style={{ color: 'var(--text-secondary)' }}>Ritmo (Média/Sem)</th>
              <th className="px-6 py-4 data-label text-right" style={{ color: 'var(--text-secondary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {data.slice(0, 50).map((row) => (
              <tr key={row.user_id} className="hover:bg-white/[0.01] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-display font-bold text-sm text-white group-hover:text-accent-gold transition-colors">
                      {row.nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                      {row.planos_ativos}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="font-mono text-xs text-secondary-foreground">
                    {formatLastActivity(row.last_lesson_completed_at)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded border border-white/[0.05] bg-white/[0.02]">
                    <div 
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        row.risk_level === 'Crítico' && "bg-red-500 shadow-[0_0_8px_#ef4444]",
                        row.risk_level === 'Alto' && "bg-orange-500 shadow-[0_0_8px_#f97316]",
                        row.risk_level === 'Médio' && "bg-amber-500 shadow-[0_0_8px_#f59e0b]",
                        row.risk_level === 'Baixo' && "bg-emerald-500 shadow-[0_0_8px_#10b981]",
                      )}
                    />
                    <span className="font-mono text-xs font-bold" style={{ 
                      color: row.risk_level === 'Crítico' ? '#ef4444' : 
                             row.risk_level === 'Alto' ? '#f97316' : 
                             row.risk_level === 'Médio' ? '#f59e0b' : '#10b981'
                    }}>
                      {row.dias_sem_concluir_aula ?? '?'} dias
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <div className="flex flex-col items-center">
                    <span className="font-mono text-sm text-secondary-foreground">{row.aulas_semana_atual} aulas</span>
                    <span className="text-[10px] text-muted-foreground">Média: {row.media_aulas_por_semana}/sem</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {row.telefone ? (
                    <a 
                      href={getWhatsAppLink(row.telefone, row.nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                    >
                      Resgatar Aluno
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground uppercase font-mono px-3 py-1.5">
                      Sem Telefone
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
