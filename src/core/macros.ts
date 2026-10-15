/** A nutrient you can track. [more] = more is better (protein, fibre); otherwise the target is a limit. */
export interface Macro { key: string; label: string; unit: string; default: number; more: boolean }

/** Same list, keys and defaults as the Android app (core/Macros.kt). */
export const MACROS: Macro[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', default: 2000, more: false },
  { key: 'protein', label: 'Protein', unit: 'g', default: 100, more: true },
  { key: 'carbs', label: 'Carbs', unit: 'g', default: 250, more: false },
  { key: 'fat', label: 'Fat', unit: 'g', default: 70, more: false },
  { key: 'fibre', label: 'Fibre', unit: 'g', default: 30, more: true },
  { key: 'sugar', label: 'Sugar', unit: 'g', default: 50, more: false },
  { key: 'sodium', label: 'Sodium', unit: 'mg', default: 2300, more: false },
]
export const DEFAULT_TRACKED = ['calories', 'protein']

export const macro = (key: string): Macro => MACROS.find((m) => m.key === key)!

/** 12.5 → "12.5", 1820 → "1,820". */
export const fmtMacro = (v: number): string =>
  Number.isInteger(v) || v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)

export const onTarget = (key: string, value: number, target: number): boolean => (macro(key).more ? value >= target : value <= target)

/** Adds up [meals] (each a map of macro → amount) for one day. */
export function sumMacros(meals: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of meals) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v
  return out
}

/** One macro over a report: the average per logged day and how many logged days hit the target. */
export interface MacroStat { key: string; average: number; onTargetDays: number }

const minusDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') - n * 86_400_000).toISOString().slice(0, 10)

/**
 * Report over the [days] days ending [end]: totals per day (days with nothing logged left out) and per macro
 * the average over logged days and the days on target. [byDay] maps an ISO day to that day's meals' macros.
 */
export function macroReport(byDay: Record<string, Record<string, number>[]>, keys: string[], targets: Record<string, number>, end: string, days: number) {
  const logged: [string, Record<string, number>][] = []
  for (let i = 0; i < days; i++) {
    const d = minusDays(end, i)
    if (byDay[d]?.length) logged.push([d, sumMacros(byDay[d])])
  }
  const stats: MacroStat[] = keys.map((k) => {
    const t = targets[k] ?? macro(k).default
    return {
      key: k,
      average: logged.length ? logged.reduce((a, [, m]) => a + (m[k] ?? 0), 0) / logged.length : 0,
      onTargetDays: logged.filter(([, m]) => onTarget(k, m[k] ?? 0, t)).length,
    }
  })
  return { logged, stats }
}
