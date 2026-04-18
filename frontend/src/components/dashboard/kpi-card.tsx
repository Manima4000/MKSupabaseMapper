interface KpiCardProps {
  title: string
  value: number | string
  subtitle?: string
  accent?: string
  delay?: number
}

export default function KpiCard({ title, value, subtitle, accent = 'var(--accent-gold)', delay = 0 }: KpiCardProps) {
  const formatted = typeof value === 'number' ? value.toLocaleString('pt-BR') : value

  return (
    <div
      className="instrument-card animate-fade-up p-6 flex flex-col gap-4"
      style={{ 
        '--card-accent': accent, 
        animationDelay: `${delay}s`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-base) 100%)'
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="data-label" style={{ color: 'var(--text-secondary)' }}>{title}</p>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '2.5rem',
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-primary)',
          textShadow: '0 0 20px rgba(255,255,255,0.05)'
        }}
      >
        {formatted}
      </p>

      {subtitle && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--text-muted)',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
