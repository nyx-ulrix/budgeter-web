import {
  Day, DaySpend, Pace, Period, addDays, daySpend, daysBetween, inPeriod, nextPeriod, pace, periodOf as periodAt,
  periodOfKey, today, todayIso,
} from '../core/budget'
import { allocate } from '../core/money'
import { AppState, LINE_KINDS, LineKind, MEAL_CATEGORY, Meal, Plan, Trip, Txn, budgetImpact, myShare, normPlan, tripTarget } from './state'
import { macro, sumMacros } from '../core/macros'

/** Derived numbers. Pure functions of AppState, so screens and widgets agree. */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const currency = (s: AppState): string => s.setup?.currency ?? 'USD'
export const startDay = (s: AppState): number => s.setup?.startDay ?? 1

export const periodOf = (s: AppState, date: string = todayIso()): Period => periodAt(date, startDay(s))
export const periodFromKey = (s: AppState, key: string): Period => periodOfKey(key, startDay(s))

export const liveTxns = (s: AppState): Txn[] => s.txns.filter((t) => !t.deleted)

/**
 * The plan for a period. A period nobody has edited yet inherits the latest earlier plan's income, fixed costs,
 * savings, caps and monthly budget (not extras, reservations or trip funds, which are one-offs).
 */
export function planFor(s: AppState, key: string): Plan {
  const own = s.plans[key]
  if (own) return own
  const prev = Object.keys(s.plans).filter((k) => k < key).sort().pop()
  if (prev == null) return normPlan()
  const p = s.plans[prev]
  return { income: p.income, lines: p.lines.filter((l) => l.kind === 'FIXED' || l.kind === 'SAVINGS').map((l) => ({ ...l, added: undefined })), caps: p.caps, budget: p.budget, savingsTarget: p.savingsTarget }
}

/**
 * What a finished month saved: everything earned that wasn't spent. Unspent budget and money never budgeted both
 * count; an overspent month counts negative. Trip funds and reservations aren't savings, they're already earmarked.
 */
export const monthSaved = (s: AppState, key: string): number =>
  planTotal(planFor(s, key), 'SAVINGS') + available(s, key) - spent(s, periodFromKey(s, key))

/** A finished month: what it saved and the savings total from the first month through it. */
export interface MonthSaving { key: string; saved: number; total: number }

/** Every month from the first plan that has ended by [date], oldest first. */
export function savingsHistory(s: AppState, date: string = todayIso()): MonthSaving[] {
  const keys = Object.keys(s.plans).sort()
  if (keys.length === 0) return []
  const out: MonthSaving[] = []
  let total = 0
  for (let p = periodFromKey(s, keys[0]); p.end <= date; p = nextPeriod(p)) {
    const saved = monthSaved(s, p.key)
    total += saved
    out.push({ key: p.key, saved, total })
  }
  return out
}

/** Savings from the first month through [key], counting only months that have ended by [date]. */
export const savedToDate = (s: AppState, key: string, date: string = todayIso()): number =>
  savingsHistory(s, date).filter((m) => m.key <= key).at(-1)?.total ?? 0

export const planTotal = (p: Plan, kind: LineKind): number => sum(p.lines.filter((l) => l.kind === kind).map((l) => l.amount))

/** Income + extra − fixed − savings − reservations − one-off trip set-asides (not monthly trip savings). */
export const planSpendable = (p: Plan): number => p.income + sum(p.lines.map((l) => (LINE_KINDS[l.kind].adds ? l.amount : -l.amount)))

/** Money left after fixed costs and everything set aside, including monthly trip savings. */
export const available = (s: AppState, key: string): number => planSpendable(planFor(s, key)) - tripMonthlyTotal(s, key)

/**
 * What I can spend this month: my chosen monthly budget less what I reserve for planned purchases this month
 * (or everything available if I haven't set one), minus the savings target, which is taken off straight away.
 */
/** [asOf]: spendable money as that day saw it, counting only lines added by then. */
export function spendable(s: AppState, key: string, asOf?: string): number {
  const all = planFor(s, key)
  const p = asOf == null ? all : { ...all, lines: all.lines.filter((l) => l.added == null || l.added <= asOf) }
  return (p.budget != null ? p.budget - planTotal(p, 'RESERVE') : planSpendable(p) - tripMonthlyTotal(s, key)) - p.savingsTarget
}

const inBudget = (t: Txn, p: Period) => !t.deleted && t.tripId == null && inPeriod(p, t.date)

export const spent = (s: AppState, p: Period): number => sum(s.txns.filter((t) => inBudget(t, p)).map(budgetImpact))

export interface Snapshot {
  period: Period
  spendable: number
  spent: number
  day: Day
  pace: Pace
  fixed: number
  categories: Record<string, number>
  target: number // savings target, a buffer past spendable
  saving: number // this month's savings lines (money moved to savings)
  left: number
  /** Spent past the spendable money and into the savings target. */
  dipping: boolean
  /** Spent past the savings target too: over the whole budget. */
  over: boolean
  /** How much of the savings target has been spent. */
  dipped: number
  /** Set aside as savings this month and not spent: savings lines plus whatever of the target is left. */
  keptAside: number
  /** The "Saved up this month" number: what's kept aside plus what earlier days left unspent. */
  savedUp: number
  fraction: number
}

type SnapshotBase = Pick<Snapshot, 'period' | 'spendable' | 'spent' | 'day' | 'pace'> & Partial<Pick<Snapshot, 'fixed' | 'categories' | 'target' | 'saving'>>

export function makeSnapshot(b: SnapshotBase): Snapshot {
  const { spendable, spent, day, fixed = 0, categories = {}, target = 0, saving = 0 } = b
  const over = spent > spendable + target
  const dipped = Math.min(Math.max(spent - spendable, 0), target)
  const keptAside = saving + target - dipped
  return {
    ...b, fixed, categories, target, saving,
    left: spendable - spent,
    dipping: spent > spendable && !over,
    over,
    dipped,
    keptAside,
    savedUp: keptAside + day.bonusLeft,
    fraction: spendable <= 0 ? 1 : Math.min(Math.max(spent / spendable, 0), 1),
  }
}

/**
 * The part of a transaction that uses up the day's budget: everything except monthly categories.
 * Itemised bills with per-item categories are split across them.
 */
export function dailyImpact(s: AppState, t: Txn): number {
  if (t.items.some((i) => i.category != null)) {
    return sum(allocate(budgetImpact(t), t.items.map((i) => Math.max(i.cost, 0)))
      .filter((_, i) => !s.monthlyCategories.includes(t.items[i].category ?? t.category)))
  }
  return s.monthlyCategories.includes(t.category) ? 0 : budgetImpact(t)
}

/**
 * Home-screen numbers for [date]. Monthly-category spending (groceries…) made today lowers today's budget
 * through the month's remaining money, like any earlier day's spending, but isn't counted as spent today.
 */
export function snapshot(s: AppState, date: string = todayIso()): Snapshot {
  const p = periodOf(s, date)
  const sp = spendable(s, p.key)
  const inP = s.txns.filter((t) => inBudget(t, p))
  const spend = (d: string): DaySpend => {
    const ts = inP.filter((t) => t.date === d)
    const daily = sum(ts.map((t) => dailyImpact(s, t)))
    return daySpend(daily, sum(ts.map(budgetImpact)) - daily)
  }
  const before = Array.from({ length: Math.max(daysBetween(p.start, date), 0) }, (_, i) => spend(addDays(p.start, i)))
  const now = spend(date)
  const total = sum(inP.map(budgetImpact))
  const plan = planFor(s, p.key)
  return makeSnapshot({
    period: p, spendable: sp, spent: total, day: today(sp, before, now.daily, now.monthly, date, p, before.map((_, i) => spendable(s, p.key, addDays(p.start, i)))), pace: pace(sp, total, date, p),
    fixed: planTotal(plan, 'FIXED'), categories: byCategory(s, p), target: plan.savingsTarget, saving: planTotal(plan, 'SAVINGS'),
  })
}

/** Budget-impact per category in a period. Itemised bills with per-item categories are split across them. */
export function byCategory(s: AppState, p: Period): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of s.txns.filter((t) => inBudget(t, p))) {
    if (t.items.some((i) => i.category != null)) {
      allocate(budgetImpact(t), t.items.map((i) => Math.max(i.cost, 0))).forEach((part, i) => {
        const c = t.items[i].category ?? t.category
        out[c] = (out[c] ?? 0) + part
      })
    } else out[t.category] = (out[t.category] ?? 0) + budgetImpact(t)
  }
  return out
}

// Planned purchases

export const reserved = (s: AppState, plannedId: string): number =>
  sum(Object.values(s.plans).flatMap((p) => p.lines.filter((l) => l.plannedId === plannedId && l.kind === 'RESERVE').map((l) => l.amount)))

// Trips

/** One-off set-asides for a trip (top-ups and money already moved in past months). */
export const tripLines = (s: AppState, tripId: string): number =>
  sum(Object.values(s.plans).flatMap((p) => p.lines.filter((l) => l.tripId === tripId && l.kind === 'TRIP_FUND').map((l) => l.amount)))

/**
 * Monthly set-aside per period for a trip: from monthlyFrom through the period the trip starts in,
 * stopping once the planned costs are covered. Future periods are included so their budgets show it ahead.
 */
export function tripMonthly(s: AppState, t: Trip): Record<string, number> {
  const from = t.monthlyFrom
  if (from == null || t.monthly <= 0) return {}
  const last = periodOf(s, t.start).key
  const target = tripTarget(t)
  let saved = tripLines(s, t.id)
  const out: Record<string, number> = {}
  for (let p = periodFromKey(s, from); p.key <= last; p = nextPeriod(p)) {
    const amt = target > 0 ? Math.min(t.monthly, Math.max(target - saved, 0)) : t.monthly
    if (amt > 0) out[p.key] = amt
    saved += amt
  }
  return out
}

export const tripMonthlyTotal = (s: AppState, key: string): number => sum(s.trips.map((t) => tripMonthly(s, t)[key] ?? 0))

/** Money set aside for the trip so far (up to and including the current period). */
export function tripFund(s: AppState, tripId: string, date: string = todayIso()): number {
  const t = s.trips.find((x) => x.id === tripId)
  if (!t) return tripLines(s, tripId)
  const now = periodOf(s, date).key
  return tripLines(s, tripId) + sum(Object.entries(tripMonthly(s, t)).filter(([k]) => k <= now).map(([, v]) => v))
}

/** Money that will have been set aside by the time the trip starts, if the plan holds. */
export const tripFundAtStart = (s: AppState, t: Trip): number => tripLines(s, t.id) + sum(Object.values(tripMonthly(s, t)))

/** Periods left to save in, counting the current one, until the trip's start period. 0 once it has started. */
export function monthsToSave(s: AppState, t: Trip, date: string = todayIso()): number {
  if (t.start < date) return 0
  const last = periodOf(s, t.start).key
  let n = 0
  for (let p = periodOf(s, date); p.key <= last; p = nextPeriod(p)) n++
  return n
}

export const tripSpent = (s: AppState, tripId: string): number => sum(liveTxns(s).filter((t) => t.tripId === tripId).map(myShare))

export const activeTrip = (s: AppState, date: string = todayIso()): Trip | undefined =>
  s.trips.find((t) => date >= t.start && date <= t.end)

// Macros

export const macroTarget = (s: AppState, key: string): number => s.macros.targets[key] ?? macro(key).default
export const mealsOn = (s: AppState, day: string): Meal[] => s.meals.filter((m) => m.date === day)
export const macrosOn = (s: AppState, day: string): Record<string, number> => sumMacros(mealsOn(s, day).map((m) => m.macros))
/** Food expenses (meals out, not groceries) on [day] that don't have a meal logged yet. */
export const unloggedFood = (s: AppState, day: string): Txn[] =>
  liveTxns(s).filter((t) => t.date === day && t.category === MEAL_CATEGORY && !s.meals.some((m) => m.txnId === t.id))
