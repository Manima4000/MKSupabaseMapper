'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { PRESETS, type RangePreset } from '@/lib/date-range'

export default function DateRangePicker({ currentPreset }: { currentPreset: RangePreset }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(preset: RangePreset) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('preset', preset)
    params.delete('from')
    params.delete('to')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div
      className="flex items-center"
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: '4px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {PRESETS.map(({ value, label }) => {
        const active = value === currentPreset
        return (
          <button
            key={value}
            onClick={() => select(value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: active ? 600 : 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: '2px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: active ? 'var(--bg-deep)' : 'transparent',
              color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
