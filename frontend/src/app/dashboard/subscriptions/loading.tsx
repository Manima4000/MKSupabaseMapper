export default function Loading() {
  return (
    <div className="space-y-10 max-w-[1400px] animate-pulse">
      
      {/* ── Header Skeleton ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <div className="h-4 w-32 rounded bg-slate-200" />
          </div>
          <div className="h-10 w-64 rounded bg-slate-200" />
          <div className="h-4 w-48 rounded bg-slate-200" />
        </div>
        
        <div className="flex gap-4">
          <div className="h-10 w-48 rounded-lg bg-slate-200" />
          <div className="h-10 w-48 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* ── KPIs Skeleton ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-200 p-6 h-32" />
        ))}
      </div>

      {/* ── Performance Charts Skeleton ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-200 p-6 h-80" />
        ))}
      </div>

      {/* ── Renovation & Table Skeleton ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white border border-slate-200 p-6 h-80" />
        <div className="hidden lg:block" />
      </div>
      
      <div className="rounded-xl bg-white border border-slate-200 h-96" />

    </div>
  )
}
