import { todayIso } from '../core/budget'

/** Daily exchange rates from open.er-api.com (free, no key). Only currency codes are sent. Always user-editable. */
const cache = new Map<string, { day: string; rates: Record<string, number> }>()

/** Home units per 1 unit of [from], or null when offline or unknown. */
export async function rate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  const day = todayIso()
  let table = cache.get(from)?.day === day ? cache.get(from)!.rates : undefined
  if (!table) {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 8_000)
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, { signal: abort.signal })
      const rates = (await res.json())?.rates
      if (rates && typeof rates === 'object') { table = rates as Record<string, number>; cache.set(from, { day, rates: table }) }
    } catch { /* offline */ } finally { clearTimeout(timer) }
  }
  const r = table?.[to]
  return typeof r === 'number' ? r : null
}
