import { todayIso } from '../core/budget'
import { periodOf, planFor, reserved, tripMonthly } from './ledger'
import { AppState, Line, Plan, Planned, Setup, SyncInfo, Trip, TripCost, Txn, normLine, normPlan, normTxn, normPlanned } from './state'

/** Every state change the UI can make, as pure functions. The store stamps changed records after each one. */

export function finishSetup(s: AppState, setup: Setup, income: number, startingBalance: number, today: string = todayIso()): AppState {
  const key = periodOf({ ...s, setup }, today).key
  const lines = startingBalance > 0 ? [normLine({ kind: 'EXTRA', name: 'Starting balance', amount: startingBalance })] : []
  return { ...s, setup, plans: { ...s.plans, [key]: s.plans[key] ?? normPlan({ income, lines }) } }
}

export const editSetup = (s: AppState, setup: Setup): AppState => ({ ...s, setup })

/** Edits the plan for [key], materialising the inherited plan first. */
export const editPlan = (s: AppState, key: string, f: (p: Plan) => Plan): AppState => ({ ...s, plans: { ...s.plans, [key]: f(planFor(s, key)) } })

/** Adds a line dated today, so it changes spendable money from today on, not for days already past. */
export const addLine = (s: AppState, key: string, line: Line, today: string = todayIso()): AppState =>
  editPlan(s, key, (p) => ({ ...p, lines: [...p.lines, { ...line, added: line.added ?? today }] }))
/** Removes a line. A reservation already spent by "Buy now" stays: its purchase counts on it. */
export const removeLine = (s: AppState, key: string, id: string): AppState =>
  editPlan(s, key, (p) => ({ ...p, lines: p.lines.filter((l) => l.id !== id || isSpentReserve(s, l)) }))

/** A reservation whose item was bought (or is no longer planned): spent, not set aside. */
export const isSpentReserve = (s: AppState, l: Line): boolean =>
  l.kind === 'RESERVE' && l.plannedId != null && !s.planned.some((p) => p.id === l.plannedId && p.status === 'OPEN')

export function saveTxn(s: AppState, t: Txn, now: number = Date.now()): AppState {
  const stamped = { ...t, updatedAt: now }
  return { ...s, txns: s.txns.some((x) => x.id === t.id) ? s.txns.map((x) => (x.id === t.id ? stamped : x)) : [...s.txns, stamped] }
}

/** Removes [t]: dropped outright if it never reached Sheets and sync is off, otherwise a tombstone sync can carry. */
const tombstone = (s: AppState, t: Txn, now: number): Txn | null =>
  t.syncedAt == null && !s.sync.enabled ? null : { ...t, deleted: true, updatedAt: now }

const notNull = <T>(x: T | null): x is T => x != null

/**
 * Deletes a transaction. Deleting a planned item's "Buy now" expense puts the item back on the list,
 * with its reservations, so that money isn't left neither spent nor free.
 */
/**
 * Deletes a transaction. Deleting a "Buy now" expense puts the item back on the planned list, where its
 * reservations still are, so that money is neither spent nor lost.
 */
export function deleteTxn(s: AppState, id: string, now: number = Date.now()): AppState {
  const t = s.txns.find((x) => x.id === id)
  const pid = t?.plannedId
  const back = t && pid != null && !s.planned.some((p) => p.id === pid)
    ? [normPlanned({ id: pid, name: t.merchant, price: t.total, targetMonth: periodOf(s, t.date).key })] : []
  return {
    ...s,
    txns: s.txns.map((x) => (x.id !== id ? x : tombstone(s, x, now))).filter(notNull),
    meals: s.meals.filter((m) => m.txnId !== id), // the meal logged for it goes too
    planned: [...s.planned.map((p) => (pid != null && p.id === pid ? { ...p, status: 'OPEN' as const } : p)), ...back],
  }
}

// Planned purchases

/** Saves [p]. If its price drops below what's already set aside, the extra is freed (newest first). */
export function savePlanned(s: AppState, p: Planned, today: string = todayIso()): AppState {
  const st = { ...s, planned: s.planned.some((x) => x.id === p.id) ? s.planned.map((x) => (x.id === p.id ? p : x)) : [...s.planned, p] }
  return p.status === 'OPEN' && reserved(st, p.id) > p.price ? withReserved(st, p, p.price, today) : st
}

/** Changes the total set aside for [p]: more is reserved this month; less is released from the latest reservations first. */
export function withReserved(s: AppState, p: Planned, total: number, today: string = todayIso()): AppState {
  const delta = Math.max(total, 0) - reserved(s, p.id)
  if (delta > 0) {
    const key = periodOf(s, today).key
    const plan = planFor(s, key)
    const line = normLine({ kind: 'RESERVE', name: p.name, amount: delta, plannedId: p.id, added: today })
    return { ...s, plans: { ...s.plans, [key]: { ...plan, lines: [...plan.lines, line] } } }
  }
  let cut = -delta
  const plans: Record<string, Plan> = {}
  for (const key of Object.keys(s.plans).sort().reverse()) {
    const plan = s.plans[key]
    const lines = [...plan.lines].reverse().flatMap((l) => {
      if (cut === 0 || l.plannedId !== p.id || l.kind !== 'RESERVE') return [l]
      const take = Math.min(cut, l.amount)
      cut -= take
      return take === l.amount ? [] : [{ ...l, amount: l.amount - take }]
    }).reverse()
    plans[key] = { ...plan, lines }
  }
  return { ...s, plans }
}

export const setReserved = withReserved

/** Buys now: one expense for the full price; the part already reserved isn't counted twice. */
export function buyNow(s: AppState, p: Planned, category: string, today: string = todayIso()): AppState {
  const st = reserved(s, p.id) > p.price ? withReserved(s, p, p.price, today) : s // free any excess first
  const txn = normTxn({ date: today, total: p.price, category, merchant: p.name, note: 'Planned purchase', plannedId: p.id, fromReserve: reserved(st, p.id) })
  // The item leaves the planned list; its reservations become part of the purchase (see isSpentReserve).
  return { ...st, txns: [...st.txns, txn], planned: st.planned.filter((x) => x.id !== p.id) }
}

/** Deleting an unbought item releases its reservations; a bought one keeps them (its expense relies on them). */
export function deletePlanned(s: AppState, id: string): AppState {
  const open = s.planned.some((p) => p.id === id && p.status === 'OPEN')
  return {
    ...s,
    planned: s.planned.filter((p) => p.id !== id),
    plans: !open ? s.plans : mapPlans(s.plans, (p) => ({ ...p, lines: p.lines.filter((l) => !(l.plannedId === id && l.kind === 'RESERVE')) })),
  }
}

const mapPlans = (plans: Record<string, Plan>, f: (p: Plan) => Plan) =>
  Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, f(p)]))

// Trips

export const addTrip = (s: AppState, t: Trip): AppState => ({ ...s, trips: [...s.trips, t] })

/**
 * Changes the monthly set-aside. Months already past keep what they set aside: their amounts become
 * fixed trip-fund lines, and the new amount runs from the current period.
 */
export function setTripMonthly(s: AppState, t: Trip, amount: number, today: string = todayIso()): AppState {
  const now = periodOf(s, today).key
  let plans = s.plans
  for (const [key, amt] of Object.entries(tripMonthly(s, t)).filter(([k]) => k < now)) {
    const p = planFor({ ...s, plans }, key)
    plans = { ...plans, [key]: { ...p, lines: [...p.lines, normLine({ kind: 'TRIP_FUND', name: `Trip: ${t.name} (monthly)`, amount: amt, tripId: t.id })] } }
  }
  return {
    ...s, plans,
    trips: s.trips.map((x) => (x.id === t.id ? { ...x, monthly: amount, monthlyFrom: amount > 0 ? now : undefined } : x)),
  }
}

export const saveTripCost = (s: AppState, tripId: string, c: TripCost): AppState => ({
  ...s,
  trips: s.trips.map((t) => t.id !== tripId ? t
    : { ...t, costs: t.costs.some((x) => x.id === c.id) ? t.costs.map((x) => (x.id === c.id ? c : x)) : [...t.costs, c] }),
})

export const deleteTripCost = (s: AppState, tripId: string, costId: string): AppState => ({
  ...s, trips: s.trips.map((t) => (t.id !== tripId ? t : { ...t, costs: t.costs.filter((c) => c.id !== costId) })),
})

/** Records a planned cost as paid today: a trip expense for its amount, linked back to the cost. */
export function payTripCost(s: AppState, t: Trip, c: TripCost, today: string = todayIso()): AppState {
  const txn = normTxn({ date: today, total: c.amount, category: c.kind, merchant: c.name, tripId: t.id, note: 'Planned trip cost' })
  return {
    ...s,
    txns: [...s.txns, txn],
    trips: s.trips.map((tr) => tr.id !== t.id ? tr : { ...tr, costs: tr.costs.map((x) => (x.id === c.id ? { ...x, paidTxnId: txn.id } : x)) }),
  }
}

export const topUpTrip = (s: AppState, t: Trip, amount: number, today: string = todayIso()): AppState =>
  addLine(s, periodOf(s, today).key, normLine({ kind: 'TRIP_FUND', name: `Trip: ${t.name}`, amount, tripId: t.id }))

export const saveTrip = (s: AppState, t: Trip): AppState => ({ ...s, trips: s.trips.map((x) => (x.id === t.id ? t : x)) })

/** Deletes the trip with its set-asides (one-off and monthly) and its expenses, as if it never happened. */
export const deleteTrip = (s: AppState, id: string, now: number = Date.now()): AppState => ({
  ...s,
  trips: s.trips.filter((t) => t.id !== id),
  txns: s.txns.map((t) => (t.tripId === id ? tombstone(s, t, now) : t)).filter(notNull),
  plans: mapPlans(s.plans, (p) => ({ ...p, lines: p.lines.filter((l) => l.tripId !== id) })),
})

/** Ticks or unticks that [who] has paid their share of a split bill. */
export const togglePaidBack = (s: AppState, txnId: string, who: string, now: number = Date.now()): AppState => ({
  ...s,
  txns: s.txns.map((t) => t.id !== txnId ? t
    : { ...t, paidBack: t.paidBack.includes(who) ? t.paidBack.filter((x) => x !== who) : [...t.paidBack, who], updatedAt: now }),
})

export const setCategories = (s: AppState, list: string[]): AppState => ({ ...s, categories: list })

/** Daily categories use up the day's budget; monthly ones only lower the month (and so the days left). */
export const setDaily = (s: AppState, category: string, daily: boolean): AppState => ({
  ...s,
  monthlyCategories: daily ? s.monthlyCategories.filter((c) => c !== category)
    : s.monthlyCategories.includes(category) ? s.monthlyCategories : [...s.monthlyCategories, category],
})

export const setSync = (s: AppState, f: (x: SyncInfo) => SyncInfo): AppState => ({ ...s, sync: f(s.sync) })
