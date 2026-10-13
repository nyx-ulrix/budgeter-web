// Date budget maths, copied from DateBudget (github.com/nyx-ulrix/DateBudget, src/money.ts) so both apps work out
// the same top-ups and totals from the same shared data. Keep in step with that file. Amounts are cents (SGD).
export type Tx = {
  id: string
  kind: 'expense' | 'topup'
  amount: number // cents, always positive
  note: string
  date: string // YYYY-MM-DD
  by: string // uid of whoever added it
  auto?: true // a budget top-up worked out from the plan, not a stored document
}

// The budget: `amount` cents is added every week, 2 weeks or month, starting with the period that begins on `from`.
// Weeks begin on Monday and months on the 1st, so `from` is always the first day of a period. A monthly top-up lands on
// `day` of the month (1-31, the last day in shorter months); weekly ones land on the Monday.
// Stored as a list of changes, so periods already gone keep the amount they had.
export type Every = 'week' | 'fortnight' | 'month'
export type Step = { from: string; amount: number; every: Every; day?: number } // from = "YYYY-MM-DD"; day only for months
export type Plan = Step[]
export const EVERY: Record<Every, string> = { week: 'week', fortnight: '2 weeks', month: 'month' }


// Calendar dates are handled as UTC midnights, so daylight saving can never shift a day.
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
const addDays = (d: string, n: number) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10)
const isDate = (d: unknown): d is string => typeof d === 'string' && /^20\d\d-\d\d-\d\d$/.test(d) && Number.isFinite(ms(d)) && addDays(d, 0) === d

const advance = (d: string, every: Every) => {
  if (every === 'month') {
    const [y, m] = d.split('-').map(Number)
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  }
  return addDays(d, every === 'week' ? 7 : 14)
}

// The plan is written by a partner's browser (and an earlier version wrote { from: "YYYY-MM", amount } for months only),
// so ignore anything malformed instead of trusting it.
const steps = (plan: unknown): Plan =>
  (Array.isArray(plan) ? plan : [])
    .map((s) => (/^\d{4}-\d\d$/.test(s?.from) && !s.every ? { ...s, from: `${s.from}-01`, every: 'month' } : s))
    .filter(
      (s) =>
        isDate(s?.from) &&
        Object.hasOwn(EVERY, s.every) &&
        (s.every !== 'month' || s.from.endsWith('-01')) &&
        (s.day === undefined || (Number.isInteger(s.day) && s.day >= 1 && s.day <= 31)) &&
        Number.isSafeInteger(s.amount) &&
        s.amount >= 0,
    )
    .sort((a, b) => a.from.localeCompare(b.from))

// First day of the period (Monday, or the 1st) that contains `today`.
export const periodStart = (today: string, every: Every) =>
  every === 'month' ? `${today.slice(0, 7)}-01` : addDays(today, -((new Date(ms(today)).getUTCDay() + 6) % 7))

// The day a period's top-up lands: its first day, or for months the chosen day (the last day if the month is shorter).
const creditDate = (period: string, s: Step) => {
  if (s.every !== 'month') return period
  const [y, m] = period.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate() // days in this month
  return `${period.slice(0, 7)}-${String(Math.min(s.day ?? 1, last)).padStart(2, '0')}`
}

// One top-up per period, from each step's start up to and including `today`, until the next step takes over.
export function budgetRows(plan: unknown, today: string): Tx[] {
  const list = steps(plan)
  const rows: Tx[] = []
  list.forEach((s, i) => {
    const end = list[i + 1]?.from ?? '9999'
    for (let p = s.from; s.amount > 0; p = advance(p, s.every)) {
      const d = creditDate(p, s)
      if (d > today || d >= end) break // dates only go up, so nothing later can count either
      rows.push({ id: `budget-${d}`, kind: 'topup', amount: s.amount, note: `Budget · every ${EVERY[s.every]}`, date: d, by: '', auto: true })
    }
  })
  return rows
}

// The step in force today (amount 0 = off), or undefined if a budget was never set.
export const currentStep = (plan: unknown, today: string) => steps(plan).findLast((s) => s.from <= today)

// New plan with `amount` every `every` (on `day` for months), starting with the current period. Earlier periods keep
// what they had; setting it again in the same period replaces it, which also moves this period's top-up to the new day.
export function withBudget(plan: unknown, today: string, amount: number, every: Every, day = 1): Plan {
  const from = periodStart(today, every)
  return [...steps(plan).filter((s) => s.from < from), every === 'month' ? { from, amount, every, day } : { from, amount, every }]
}

// Left to spend = top-ups - expenses. Derived, never stored, so it can't drift.
export function totals(txs: Tx[]) {
  const sum = (kind: Tx['kind']) => txs.filter((t) => t.kind === kind).reduce((n, t) => n + t.amount, 0)
  const topped = sum('topup')
  const spent = sum('expense')
  return { topped, spent, left: topped - spent }
}
