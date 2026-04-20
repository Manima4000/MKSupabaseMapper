import { Suspense } from 'react'
import { fetchRiskScores } from '@/lib/api-client'
import StudentRiskTable from '@/components/dashboard/student-risk-table'

export default async function StudentsRiskPage() {
  const data = await fetchRiskScores()

  return (
    <div className="space-y-10 max-w-[1400px]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/[0.05] pb-8">
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <p className="data-label" style={{ color: 'var(--accent-gold)' }}>
              OPERAÇÕES DE RESGATE
            </p>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Radar de Risco
          </h1>
          <p className="font-sans text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
            Lista tática de alunos estagnados com prioridade de contato.
          </p>
        </div>
      </div>

      {/* ── Tabela ─────────────────────────────────────────────────────── */}
      <div className="pt-4">
        <Suspense fallback={<div className="text-white font-mono text-sm animate-pulse">Carregando inteligência de risco...</div>}>
          <StudentRiskTable data={data} />
        </Suspense>
      </div>
    </div>
  )
}
