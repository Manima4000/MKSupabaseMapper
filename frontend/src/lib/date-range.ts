export type RangePreset = '4w' | '12w' | '26w' | '52w'

export interface DateRange {
  from: string
  to: string
  preset: RangePreset
}

export const PRESETS: { value: RangePreset; label: string; weeks: number }[] = [
  { value: '4w', label: '4 semanas', weeks: 4 },
  { value: '12w', label: '3 meses', weeks: 12 },
  { value: '26w', label: '6 meses', weeks: 26 },
  { value: '52w', label: '1 ano', weeks: 52 },
]

export function resolveRange(
  from?: string | null,
  to?: string | null,
  preset?: string | null,
): DateRange {
  const resolvedPreset = isValidPreset(preset) ? preset : '12w'
  const weeks = PRESETS.find((p) => p.value === resolvedPreset)!.weeks

  if (from && to && isValidDate(from) && isValidDate(to)) {
    return { from, to, preset: resolvedPreset }
  }

  const toDate = new Date()
  const fromDate = new Date(toDate)
  fromDate.setDate(fromDate.getDate() - 7 * weeks)

  return {
    from: toISODate(fromDate),
    to: toISODate(toDate),
    preset: resolvedPreset,
  }
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

function isValidPreset(s: string | null | undefined): s is RangePreset {
  return !!s && PRESETS.some((p) => p.value === s)
}
