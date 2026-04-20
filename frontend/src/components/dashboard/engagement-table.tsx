'use client'

import { clsx } from 'clsx'

interface EngagementRow {
  name: string
  students: number
  progress: number
  hours: number
  risk: 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
}

interface Props { data: EngagementRow[] }

export default function EngagementTable({ data }: Props) {
  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden animate-fade-up animate-delay-4 flex flex-col"
    >
      <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-slate-50/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Relatório de Engajamento por Categoria</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Alunos</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Horas/Média</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Progresso Médio</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Status Geral</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <span className="font-sans font-bold text-sm text-[var(--text-primary)]">
                    {row.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-sans text-sm text-[var(--text-secondary)]">{row.students.toLocaleString('pt-BR')}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-sans text-sm text-[var(--text-secondary)]">{row.hours.toFixed(1)}h</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 justify-center">
                    <div className="flex-1 max-w-[100px] h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent-blue)] rounded-full"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                    <span className="font-sans text-[10px] font-bold text-[var(--text-muted)] w-8">{row.progress.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-white shadow-sm">
                    <div 
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        row.risk === 'Crítico' && "bg-red-500",
                        row.risk === 'Alto' && "bg-orange-500",
                        row.risk === 'Médio' && "bg-amber-500",
                        row.risk === 'Baixo' && "bg-emerald-500",
                      )}
                    />
                    <span className="text-[9px] font-bold uppercase tracking-tight text-[var(--text-secondary)]">{row.risk}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
