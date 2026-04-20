interface KpiCardProps {
  title: string
  value: number | string
  subtitle?: string
  accent?: string
  delay?: number
}

export default function KpiCard({ title, value, subtitle, accent = 'var(--accent-blue)', delay = 0 }: KpiCardProps) {
  const formatted = typeof value === 'number' ? value.toLocaleString('pt-BR') : value

  return (
    <div
      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-up flex flex-col gap-3"
      style={{ 
        animationDelay: `${delay}s`
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</p>
        <div 
          className="w-2 h-2 rounded-full" 
          style={{ background: accent }} 
        />
      </div>

      <div className="flex flex-col">
        <p
          className="font-sans text-3xl font-extrabold tracking-tight text-[var(--text-primary)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatted}
        </p>

        {subtitle && (
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
            {subtitle}
          </p>
        )}
      </div>
      
      {/* Visual Indicator Line */}
      <div className="w-full h-1 bg-slate-50 rounded-full mt-2 overflow-hidden">
        <div 
          className="h-full rounded-full" 
          style={{ background: accent, width: '40%' }} 
        />
      </div>
    </div>
  )
}
