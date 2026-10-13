import { SplitMethod } from '../core/split'

/*
 * Types mirror the Android app's State.kt field for field, so both apps read each other's JSON.
 * Kotlin nullable fields are optional here (undefined = null); JSON never carries null for them.
 */

export const newId = (): string => crypto.randomUUID()

/** P1, the phone's owner. Other people in a split are "p2", "p3"... and shown as P2, P3. */
export const ME = 'me'

export const personId = (n: number): string => (n === 1 ? ME : `p${n}`)
export const personLabel = (id: string): string => (id === ME ? 'P1' : id.toUpperCase())

export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Groceries', 'Shopping', 'Bills', 'Fun', 'Health', 'Other']
export const DEFAULT_MONTHLY = ['Groceries', 'Bills']

/** Everything the app knows. New fields need defaults so old saves still load. */
export interface AppState {
  setup?: Setup // undefined until first-run setup is finished
  plans: Record<string, Plan> // by period key "2026-10"
  txns: Txn[]
  planned: Planned[]
  trips: Trip[]
  categories: string[]
  // Categories spread over the month (groceries, bills): they lower the month's money, and so every remaining
  // day's budget, but don't use up today's budget. A set.
  monthlyCategories: string[]
  sync: SyncInfo
  stamps: Record<string, number> // record key → when it last changed, for two-way sync (records.ts)
}

export interface Setup {
  country: string // ISO 3166 alpha-2, e.g. "SG"
  currency: string // ISO 4217, e.g. "SGD"
  startDay: number // budget period starts on this day of the month (1–28)
  name: string
}

/**
 * One period's plan. Everything that changes spendable money is a Line, so reservations and trip funds
 * land in the period they were made in.
 */
export interface Plan {
  income: number
  lines: Line[]
  caps: Record<string, number> // optional per-category caps
  budget?: number // what I plan to spend this month; undefined = all that's available
  savingsTarget: number // forced saving: taken off spendable money straight away
}

export type LineKind = 'EXTRA' | 'FIXED' | 'SAVINGS' | 'RESERVE' | 'TRIP_FUND'
export const LINE_KINDS: Record<LineKind, { label: string; adds: boolean }> = {
  EXTRA: { label: 'Extra money', adds: true },
  FIXED: { label: 'Fixed cost', adds: false },
  SAVINGS: { label: 'Savings', adds: false },
  RESERVE: { label: 'Reserved for planned item', adds: false },
  TRIP_FUND: { label: 'Trip fund', adds: false },
}

export interface Line {
  id: string
  kind: LineKind
  name: string
  amount: number
  plannedId?: string
  tripId?: string
  added?: string // ISO day it was added; undefined = from the period's first day (carried over, or older data)
}

export interface TxnItem {
  name: string
  price: number // printed line price
  qty: number
  cost: number // price + share of printed tax / service charge / discount
  owners: string[] // P ids sharing this item (a set); empty = everyone in the split
  category?: string
}

export interface Foreign { currency: string; amount: number; rate: number } // rate = home units per 1 foreign unit

export interface Txn {
  id: string
  date: string // ISO yyyy-MM-dd
  total: number // home currency, what the bill came to
  // tax, serviceCharge, discount and item prices are in the currency paid (foreign?.currency, else home);
  // total, item costs and shares are always home currency.
  category: string
  merchant: string
  note: string
  tax: number
  serviceCharge: number
  discount: number
  taxIncluded: boolean
  payer: string
  method: SplitMethod
  people: number // split between P1 (me) .. P[people]
  shares: Record<string, number> // P id → share in home minor units; empty = all mine
  paidBack: string[] // P ids (a set) who have settled their share with the payer
  splitInput: Record<string, number> // what the user typed per person (percent bp, weights, amounts)
  items: TxnItem[]
  tripId?: string
  foreign?: Foreign
  plannedId?: string
  fromReserve: number // already deducted earlier as a reservation
  updatedAt: number
  syncedAt?: number
  syncedTab?: string // sheet tab the row was written to
  deleted: boolean // kept until the delete reaches Sheets
}

export type PlannedStatus = 'OPEN' | 'BOUGHT'

export interface Planned {
  id: string
  name: string
  price: number
  priority: number // 1 high, 2 medium, 3 low
  targetMonth: string // "2026-12"
  status: PlannedStatus
}

/**
 * A trip you budget for: planned costs set the target, and money is set aside each month until it starts.
 * Trip spending then comes out of what was set aside, never the daily budget.
 */
export interface Trip {
  id: string
  name: string
  country: string
  currency: string
  start: string
  end: string
  costs: TripCost[]
  monthly: number // set aside each period from monthlyFrom until the trip starts
  monthlyFrom?: string // period key the current monthly amount began
}

export const TRIP_COST_KINDS = ['Flights', 'Stay', 'Food', 'Transport', 'Activities', 'Shopping', 'Other']

/** One planned cost, in home currency. [paidTxnId] links the expense recorded when it was paid. */
export interface TripCost {
  id: string
  name: string
  amount: number
  kind: string
  paidTxnId?: string
}

export interface SyncInfo {
  enabled: boolean
  account?: string
  spreadsheetId?: string
  paused?: string // reason when sync is paused, undefined when fine
  lastSync?: number
}

// Derived values (Kotlin getters).

export const myShare = (t: Txn): number => (Object.keys(t.shares).length === 0 ? t.total : t.shares[ME] ?? 0)
export const isSplit = (t: Txn): boolean => t.people > 1 || Object.keys(t.shares).length > 1
/** People who owe the payer for this bill: everyone with a share except the payer. */
export const debtors = (t: Txn): string[] => {
  const rank = (id: string) => (id === ME ? 1 : /^[+-]?\d+$/.test(id.slice(1)) ? Number(id.slice(1)) : 99)
  return Object.entries(t.shares).filter(([who, amt]) => who !== t.payer && amt > 0).map(([who]) => who).sort((a, b) => rank(a) - rank(b))
}
/** What this transaction takes from my budget. */
export const budgetImpact = (t: Txn): number => Math.max(myShare(t) - t.fromReserve, 0)
/** What the trip is planned to cost: the sum of its planned costs. */
export const tripTarget = (t: Trip): number => t.costs.reduce((a, c) => a + c.amount, 0)

// Normalizers: decoded JSON (Kotlin omits nulls; old saves miss newer fields) → complete objects with every default.
// They double as constructors: normTxn({ date, total }).

/** Input to a normalizer: any field may be missing or null. */
export type Loose<T> = { [K in keyof T]?: T[K] | null }

const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v)
const set = (xs: string[] | null | undefined): string[] => [...new Set(xs ?? [])]
const rec = <T>(o: Record<string, T> | null | undefined): Record<string, T> => ({ ...(o ?? {}) })

export const normSetup = (o: Loose<Setup>): Setup => ({
  country: o.country ?? '', currency: o.currency ?? '', startDay: o.startDay ?? 1, name: o.name ?? '',
})

export const normLine = (o: Loose<Line>): Line => ({
  id: o.id ?? newId(), kind: o.kind ?? 'EXTRA', name: o.name ?? '', amount: o.amount ?? 0,
  plannedId: opt(o.plannedId), tripId: opt(o.tripId), added: opt(o.added),
})

export const normPlan = (o: Loose<Plan> = {}): Plan => ({
  income: o.income ?? 0,
  lines: (o.lines ?? []).map(normLine),
  caps: rec(o.caps),
  budget: opt(o.budget),
  savingsTarget: o.savingsTarget ?? 0,
})

export const normTxnItem = (o: Loose<TxnItem>): TxnItem => ({
  name: o.name ?? '', price: o.price ?? 0, qty: o.qty ?? 1, cost: o.cost ?? o.price ?? 0,
  owners: set(o.owners), category: opt(o.category),
})

export const normTxn = (o: Loose<Txn>): Txn => ({
  id: o.id ?? newId(),
  date: o.date ?? '',
  total: o.total ?? 0,
  category: o.category ?? 'Other',
  merchant: o.merchant ?? '',
  note: o.note ?? '',
  tax: o.tax ?? 0,
  serviceCharge: o.serviceCharge ?? 0,
  discount: o.discount ?? 0,
  taxIncluded: o.taxIncluded ?? false,
  payer: o.payer ?? ME,
  method: o.method ?? 'EQUAL',
  people: o.people ?? 1,
  shares: rec(o.shares),
  paidBack: set(o.paidBack),
  splitInput: rec(o.splitInput),
  items: (o.items ?? []).map(normTxnItem),
  tripId: opt(o.tripId),
  foreign: o.foreign ? { currency: o.foreign.currency, amount: o.foreign.amount, rate: o.foreign.rate } : undefined,
  plannedId: opt(o.plannedId),
  fromReserve: o.fromReserve ?? 0,
  updatedAt: o.updatedAt ?? Date.now(),
  syncedAt: opt(o.syncedAt),
  syncedTab: opt(o.syncedTab),
  deleted: o.deleted ?? false,
})

export const normPlanned = (o: Loose<Planned>): Planned => ({
  id: o.id ?? newId(), name: o.name ?? '', price: o.price ?? 0, priority: o.priority ?? 2,
  targetMonth: o.targetMonth ?? '', status: o.status ?? 'OPEN',
})

export const normTripCost = (o: Loose<TripCost>): TripCost => ({
  id: o.id ?? newId(), name: o.name ?? '', amount: o.amount ?? 0, kind: o.kind ?? 'Other', paidTxnId: opt(o.paidTxnId),
})

export const normTrip = (o: Loose<Trip>): Trip => ({
  id: o.id ?? newId(), name: o.name ?? '', country: o.country ?? '', currency: o.currency ?? '',
  start: o.start ?? '', end: o.end ?? '', costs: (o.costs ?? []).map(normTripCost),
  monthly: o.monthly ?? 0, monthlyFrom: opt(o.monthlyFrom),
})

export const normSync = (o: Loose<SyncInfo> = {}): SyncInfo => ({
  enabled: o.enabled ?? false, account: opt(o.account), spreadsheetId: opt(o.spreadsheetId),
  paused: opt(o.paused), lastSync: opt(o.lastSync),
})

export const normState = (o: Loose<AppState> = {}): AppState => ({
  setup: o.setup ? normSetup(o.setup) : undefined,
  plans: Object.fromEntries(Object.entries(o.plans ?? {}).map(([k, p]) => [k, normPlan(p)])),
  txns: (o.txns ?? []).map(normTxn),
  planned: (o.planned ?? []).map(normPlanned),
  trips: (o.trips ?? []).map(normTrip),
  categories: [...(o.categories ?? DEFAULT_CATEGORIES)],
  monthlyCategories: set(o.monthlyCategories ?? DEFAULT_MONTHLY),
  sync: normSync(o.sync ?? {}),
  stamps: rec(o.stamps),
})
