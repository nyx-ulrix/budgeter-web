import { AppState, normMacros, normMeal, normPreset, normPlan, normPlanned, normSetup, normTrip, normTxn } from './state'

/*
 * Two-way sync between the Android and web apps, through a hidden "_sync" tab in the shared Google Sheet.
 * The state is split into records, each with the time it last changed ("stamp"). On each sync both sides keep
 * whichever copy of a record is newer. A deleted record keeps its stamp with no data, so the delete wins too.
 * Keys: setup, categories, macros, plan:<period>, txn:<id>, planned:<id>, trip:<id>, meal:<id>, preset:<id>. The Android app (Records.kt) uses
 * exactly the same keys and JSON.
 * ponytail: last writer wins per record by wall clock; two devices editing the same record within one sync
 * interval keep only the later edit.
 */

export interface Categories { categories: string[]; monthlyCategories: string[] }

/** One record as stored in the sheet: [json] null means deleted. */
export interface Remote { stamp: number; json: string | null }

/** Every synced record by key, as objects. Sync settings stay local. */
export function recordObjects(s: AppState): Record<string, object> {
  const out: Record<string, object> = {}
  if (s.setup) out.setup = s.setup
  out.categories = { categories: s.categories, monthlyCategories: s.monthlyCategories } satisfies Categories
  for (const [k, p] of Object.entries(s.plans)) out[`plan:${k}`] = p
  for (const t of s.txns) out[`txn:${t.id}`] = t
  for (const p of s.planned) out[`planned:${p.id}`] = p
  for (const t of s.trips) out[`trip:${t.id}`] = t
  out.macros = s.macros
  for (const m of s.meals) out[`meal:${m.id}`] = m
  for (const p of s.presets) out[`preset:${p.id}`] = p
  return out
}

/** Record JSON as kotlinx.serialization writes it: every field, nulls left out. */
export const encodeRecord = (o: object): string => JSON.stringify(o, (_, v) => (v === null ? undefined : v))

/** Key-sorted JSON without nulls, so equal records compare equal whatever order their fields were built in. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] != null).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/**
 * Records that differ between [old] and [s] get [now] as their stamp (added, changed or removed).
 * ponytail: set-like arrays (paidBack, owners) compare in order, so a reorder alone re-uploads that record.
 */
export function stampedSince(s: AppState, old: AppState, now: number): AppState {
  const a = recordObjects(old)
  const b = recordObjects(s)
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => (a[k] === undefined) !== (b[k] === undefined) || (a[k] !== b[k] && canon(a[k]) !== canon(b[k])))
  if (changed.length === 0) return s
  return { ...s, stamps: { ...s.stamps, ...Object.fromEntries(changed.map((k) => [k, now])) } }
}

/** This state with one record set from its JSON, or removed when [json] is null. Unknown keys are ignored. */
export function withRecord(s: AppState, key: string, json: string | null): AppState {
  const i = key.indexOf(':')
  const id = i < 0 ? key : key.slice(i + 1)
  const kind = i < 0 ? key : key.slice(0, i)
  const put = <T extends { id: string }>(list: T[], v: T | null) => [...list.filter((x) => x.id !== id), ...(v ? [v] : [])]
  const o = json == null ? null : JSON.parse(json)
  switch (kind) {
    case 'setup': return { ...s, setup: o ? normSetup(o) : s.setup }
    case 'categories': return o ? { ...s, categories: [...(o.categories ?? [])], monthlyCategories: [...new Set<string>(o.monthlyCategories ?? [])] } : s
    case 'plan': {
      const plans = { ...s.plans }
      if (o) plans[id] = normPlan(o)
      else delete plans[id]
      return { ...s, plans }
    }
    case 'txn': return { ...s, txns: put(s.txns, o && normTxn(o)) }
    case 'planned': return { ...s, planned: put(s.planned, o && normPlanned(o)) }
    case 'trip': return { ...s, trips: put(s.trips, o && normTrip(o)) }
    case 'macros': return o ? { ...s, macros: normMacros(o) } : s
    case 'meal': return { ...s, meals: put(s.meals, o && normMeal(o)) }
    case 'preset': return { ...s, presets: put(s.presets, o && normPreset(o)) }
    default: return s
  }
}

/** Applies every remote record newer than ours. Records we have but never stamped count as stamp 1. */
export function mergeRemote(s: AppState, remote: Record<string, Remote>): AppState {
  let out = s
  const stamps = { ...s.stamps }
  for (const [k, r] of Object.entries(remote)) {
    if (r.stamp > (s.stamps[k] ?? 0)) { out = withRecord(out, k, r.json); stamps[k] = r.stamp }
  }
  return { ...out, stamps }
}

/** Our records (and deletions) newer than the sheet's copy, ready to write. */
export function toUpload(s: AppState, remote: Record<string, Remote>): Record<string, Remote> {
  const objs = recordObjects(s)
  const out: Record<string, Remote> = {}
  for (const k of new Set([...Object.keys(s.stamps), ...Object.keys(objs)])) {
    const stamp = s.stamps[k] ?? 1
    if (stamp > (remote[k]?.stamp ?? 0)) out[k] = { stamp, json: objs[k] ? encodeRecord(objs[k]) : null }
  }
  return out
}
