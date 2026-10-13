import { div } from './money'

// Dates are ISO "yyyy-MM-dd" strings; day maths runs on UTC epoch days so time zones never shift a date.

const DAY = 86_400_000
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** "2026-10-05" → days since 1970-01-01. */
export const epochDay = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}
export const fromEpochDay = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10)
export const addDays = (iso: string, n: number): string => fromEpochDay(epochDay(iso) + n)
export const daysBetween = (a: string, b: string): number => epochDay(b) - epochDay(a)
export const isoDate = (y: number, m: number, d: number): string => `${pad(y, 4)}-${pad(m)}-${pad(d)}`

/** True for a real calendar date (no 31 February). */
export const validDate = (y: number, m: number, d: number): boolean =>
  m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Today in the device's local time zone. */
export function todayIso(now: Date = new Date()): string {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** A budget period: [start] inclusive to [end] exclusive, named by the month it starts in ("2026-10"). */
export interface Period { start: string; end: string; key: string; days: number }

const period = (start: string, end: string): Period => ({ start, end, key: start.slice(0, 7), days: daysBetween(start, end) })

export const inPeriod = (p: Period, d: string): boolean => d >= p.start && d < p.end
export const nextPeriod = (p: Period): Period => periodOf(p.end, Number(p.start.slice(8)))
export const prevPeriod = (p: Period): Period => periodOf(addDays(p.start, -1), Number(p.start.slice(8)))
export const periodOfKey = (key: string, startDay: number): Period => {
  if (!/^\d{4}-\d{2}$/.test(key)) throw new Error(`Bad period key: ${key}`)
  return periodOf(`${key}-${pad(startDay)}`, startDay)
}

/** The period containing [date] when periods start on day [startDay] (1–28) of each month. */
export function periodOf(date: string, startDay: number): Period {
  if (!(Number.isInteger(startDay) && startDay >= 1 && startDay <= 28)) throw new Error('Start day must be 1 to 28')
  let [y, m, d] = date.split('-').map(Number)
  if (d < startDay) { m--; if (m < 1) { m = 12; y-- } }
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1]
  return period(isoDate(y, m, startDay), isoDate(ny, nm, startDay))
}

/**
 * Today's money: a [budget] for the day plus a soft [bonus] saved up from earlier days this month.
 * Spending into the bonus isn't overspending; only going past both is.
 */
export interface Day {
  budget: number
  spent: number
  bonus: number
  available: number
  /** Today's own budget left, the headline number. Below zero means you're into the saved-up bonus. */
  dailyLeft: number
  /** Including the saved-up bonus; below zero is a real overspend. */
  remaining: number
  /** Saved-up money still unused after today's spending. */
  bonusLeft: number
}

export const makeDay = (budget: number, spent: number, bonus = 0): Day => ({
  budget, spent, bonus,
  available: budget + bonus,
  dailyLeft: budget - spent,
  remaining: budget + bonus - spent,
  bonusLeft: Math.max(bonus - Math.max(spent - budget, 0), 0),
})

/** One earlier day's spending: what used the day's budget, and monthly-category spending (groceries, bills). */
export interface DaySpend { daily: number; monthly: number }
export const daySpend = (daily: number, monthly = 0): DaySpend => ({ daily, monthly })

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/**
 * Replays the period day by day. Each day's budget is the month's unspent money (less earlier days' leftovers) spread
 * over the days left, so an unused day keeps later budgets steady and its leftover shows as the [Day.bonus].
 * Overspending and monthly-category spending use up the leftovers first, then lower every remaining day.
 * Leftovers never cross the period end; month-end leftovers become savings.
 * ponytail: replays from today's [spendable], so changing the budget mid-month re-scores earlier days; store spendable per day if that matters.
 */
export function today(spendable: number, before: DaySpend[], spentToday: number, monthlyToday: number, date: string, p: Period): Day {
  let pool = Math.max(spendable, 0) // month's money not yet spent
  let bonus = 0 // of which: earlier days' leftovers
  let d = p.start
  for (const s of before) {
    const budget = div(Math.max(pool - bonus, 0), Math.max(daysBetween(d, p.end), 1))
    pool = Math.max(pool - s.daily - s.monthly, 0)
    bonus = clamp(bonus + budget - s.daily - s.monthly, 0, pool)
    d = addDays(d, 1)
  }
  const budget = div(Math.max(pool - bonus, 0), Math.max(daysBetween(date, p.end), 1))
  return makeDay(budget, spentToday, clamp(bonus - monthlyToday, 0, pool))
}

/** Spending speed against an even pace through the month. Being over the whole budget is separate (Snapshot.over). */
export type Pace = 'ON_TRACK' | 'SLIGHTLY_OVER' | 'OVER'
export const PACE_LABEL: Record<Pace, string> = { ON_TRACK: 'On track', SLIGHTLY_OVER: 'A bit fast', OVER: 'Too fast' }

/** Compares spending with an even burn of [spendable] through the period, counting today as elapsed. */
export function pace(spendable: number, spent: number, date: string, p: Period): Pace {
  const elapsed = clamp(daysBetween(p.start, date) + 1, 1, p.days)
  const expected = div(Math.max(spendable, 0) * elapsed, p.days)
  if (spent <= expected) return 'ON_TRACK'
  if (spent * 10 <= expected * 11) return 'SLIGHTLY_OVER'
  return 'OVER'
}
