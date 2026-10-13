/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppState, Loose, ME, Txn, budgetImpact, normLine, normPlan, normPlanned, normSetup, normState, normTrip, normTxn, normTxnItem } from './state'
import { activeTrip, available, monthSaved, planFor, planSpendable, reserved, savedToDate, snapshot, spendable, tripFund, tripSpent } from './ledger'
import { withReserved, buyNow, deletePlanned, deleteTxn } from './actions'

const setup = { country: 'SG', currency: 'SGD', startDay: 1, name: '' }
const oct5 = '2026-10-05'
const state = (o: Loose<AppState>) => normState({ setup, ...o })
const txn = (o: Loose<Txn>) => normTxn(o)

test('plan carries over recurring lines only', () => {
  const st = state({ plans: { '2026-09': normPlan({ income: 300_000, lines: [
    normLine({ kind: 'FIXED', name: 'Rent', amount: 100_000 }),
    normLine({ kind: 'SAVINGS', name: 'Save', amount: 50_000 }),
    normLine({ kind: 'EXTRA', name: 'Gift', amount: 9_999 }),
    normLine({ kind: 'RESERVE', name: 'Shoes', amount: 1_000, plannedId: 'p' }),
  ] }) } })
  const oct = planFor(st, '2026-10')
  assert.equal(oct.income, 300_000)
  assert.deepEqual(oct.lines.map((l) => l.kind), ['FIXED', 'SAVINGS'])
  assert.equal(planSpendable(oct), 150_000)
  assert.deepEqual(planFor(state({}), '2026-10'), normPlan())
})

test('snapshot counts my share and skips trips', () => {
  const st = state({
    plans: { '2026-10': normPlan({ income: 310_000 }) },
    txns: [
      txn({ date: '2026-10-01', total: 10_000 }), // mine
      txn({ date: '2026-10-02', total: 8_000, shares: { [ME]: 2_000, a: 6_000 } }), // my share 20
      txn({ date: '2026-10-03', total: 50_000, tripId: 't' }), // trip: not counted
      txn({ date: '2026-10-05', total: 3_000 }), // today
      txn({ date: '2026-10-04', total: 99_999, deleted: true }), // deleted
    ],
  })
  const s = snapshot(st, oct5)
  assert.equal(s.spent, 15_000)
  // base 310000/31 = 10000 a day; 4 days before today = 40000, 12000 spent → 28000 saved up
  assert.equal(s.day.budget, 10_000)
  assert.equal(s.day.bonus, 28_000)
  assert.equal(s.day.spent, 3_000)
})

test('editing reserved adds now and releases latest first', () => {
  const p = { id: 'p', name: 'Shoes', price: 50_000, priority: 2, targetMonth: '2026-12', status: 'OPEN' as const }
  const st = state({ plans: {
    '2026-09': normPlan({ income: 100_000, lines: [normLine({ kind: 'RESERVE', name: 'Shoes', amount: 10_000, plannedId: 'p' })] }),
    '2026-10': normPlan({ income: 100_000, lines: [normLine({ kind: 'RESERVE', name: 'Shoes', amount: 5_000, plannedId: 'p' })] }),
  } })
  const up = withReserved(st, p, 20_000, oct5)
  assert.equal(reserved(up, 'p'), 20_000)
  assert.equal(spendable(up, '2026-10'), spendable(st, '2026-10') - 5_000)
  const down = withReserved(st, p, 8_000, oct5)
  assert.equal(reserved(down, 'p'), 8_000)
  assert.equal(spendable(down, '2026-10'), spendable(st, '2026-10') + 5_000) // October's fully released first
  assert.equal(down.plans['2026-09'].lines.length, 1)
  assert.equal(down.plans['2026-09'].lines[0].amount, 8_000)
  assert.equal(reserved(withReserved(st, p, 0, oct5), 'p'), 0)
  // With a monthly budget set, reserving still comes off what I can spend
  const budgeted = { ...st, plans: { ...st.plans, '2026-10': { ...st.plans['2026-10'], budget: 60_000 } } }
  assert.equal(spendable(budgeted, '2026-10'), 55_000)
  assert.equal(spendable(withReserved(budgeted, p, 30_000, oct5), '2026-10'), 40_000)

  // Buy now uses what's reserved; deleting that expense reopens the item with its reservations.
  const bought = buyNow(st, p, 'Shopping', oct5)
  const t = bought.txns[bought.txns.length - 1]
  assert.equal(t.fromReserve, 15_000)
  assert.equal(bought.planned.length, 0) // p wasn't in the list; status only flips for listed items
  const listed = buyNow({ ...st, planned: [p] }, p, 'Shopping', oct5)
  assert.equal(listed.planned[0].status, 'BOUGHT')
  assert.equal(deleteTxn(listed, listed.txns[0].id).planned[0].status, 'OPEN')
  assert.equal(reserved(deletePlanned({ ...st, planned: [p] }, 'p'), 'p'), 0)
  assert.equal(reserved(deletePlanned(listed, 'p'), 'p'), 15_000) // bought keeps its reservations
})

test('saved up is kept aside plus unspent days', () => {
  const plan = normPlan({ income: 310_000, lines: [normLine({ kind: 'SAVINGS', name: 'Save', amount: 20_000 })], savingsTarget: 31_000 })
  // spendable 310000 - 20000 - 31000 = 259000 → 8354 a day; 4 days before Oct 5 = 33416, 10000 spent → 23416 unspent
  const s = snapshot(state({ plans: { '2026-10': plan }, txns: [txn({ date: '2026-10-02', total: 10_000 })] }), oct5)
  assert.equal(s.keptAside, 51_000)
  assert.equal(s.savedUp, 51_000 + s.day.bonusLeft)
  assert.equal(s.day.bonusLeft, 23_416)
})

test('buy now does not double count reservation', () => {
  assert.equal(budgetImpact(txn({ date: '2026-10-05', total: 20_000, plannedId: 'p', fromReserve: 5_000 })), 15_000)
  assert.equal(budgetImpact(txn({ date: '2026-10-05', total: 20_000, plannedId: 'p', fromReserve: 30_000 })), 0)
})

test('trip fund and spend', () => {
  const st = state({
    plans: {
      '2026-09': normPlan({ lines: [normLine({ kind: 'TRIP_FUND', name: 'Trip', amount: 100_000, tripId: 't' })] }),
      '2026-10': normPlan({ lines: [normLine({ kind: 'TRIP_FUND', name: 'Top up', amount: 20_000, tripId: 't' })] }),
    },
    trips: [normTrip({ id: 't', name: 'Tokyo', country: 'JP', currency: 'JPY', start: '2026-10-01', end: '2026-10-07' })],
    txns: [txn({ date: '2026-10-02', total: 30_000, tripId: 't' })],
  })
  assert.equal(tripFund(st, 't'), 120_000)
  assert.equal(tripSpent(st, 't'), 30_000)
  assert.equal(activeTrip(st, oct5)?.id, 't')
})

test('state round trips through JSON', () => {
  const st = state({ txns: [txn({ date: '2026-10-01', total: 1, items: [normTxnItem({ name: 'a', price: 1 })] })] })
  assert.deepEqual(normState(JSON.parse(JSON.stringify(st))), st)
  // Older files missing newer fields still load.
  assert.deepEqual(normState(JSON.parse('{}')), normState())
})

test('unspent money becomes savings', () => {
  const st = state({
    plans: { '2026-09': normPlan({ income: 300_000, lines: [normLine({ kind: 'FIXED', name: 'Rent', amount: 100_000 })], budget: 150_000 }) },
    txns: [txn({ date: '2026-09-10', total: 120_000 })],
  })
  assert.equal(available(st, '2026-09'), 200_000) // income − fixed
  assert.equal(spendable(st, '2026-09'), 150_000) // the budget I chose
  assert.equal(monthSaved(st, '2026-09'), 80_000) // 200k available − 120k spent
  assert.equal(spendable(st, '2026-10'), 150_000) // budget carries over
  assert.equal(savedToDate(st, '2026-10', '2026-10-15'), 80_000) // only finished months
  assert.equal(savedToDate(st, '2026-09', '2026-09-20'), 0)
  const over = { ...st, txns: [txn({ date: '2026-09-10', total: 250_000 })] }
  assert.equal(monthSaved(over, '2026-09'), -50_000) // overspend comes out of savings
  assert.equal(snapshot(over, '2026-09-20').over, true)
  const noBudget = { ...st, plans: { '2026-09': normPlan({ income: 300_000 }) } }
  assert.equal(spendable(noBudget, '2026-09'), 300_000) // no budget set: everything available
})

test('monthly categories lower the month, not today', () => {
  const base = state({ plans: { '2026-10': normPlan({ income: 310_000 }) } })
  const groceries = { ...base, txns: [txn({ date: '2026-10-05', total: 27_000, category: 'Groceries' })] }
  const s = snapshot(groceries, oct5)
  assert.equal(s.day.spent, 0) // not counted against today
  assert.equal(s.day.budget, 10_000)
  assert.equal(s.day.bonus, 40_000 - 27_000) // but today's money already reflects it
  assert.equal(s.spent, 27_000) // and the month counts it
  const food = { ...base, txns: [txn({ date: '2026-10-05', total: 2_000, category: 'Food' })] }
  assert.equal(snapshot(food, oct5).day.spent, 2_000)
  assert.equal(snapshot(food, oct5).day.bonus, 40_000)
  const allDaily = { ...groceries, monthlyCategories: [] }
  assert.equal(snapshot(allDaily, oct5).day.spent, 27_000)
})

test('savings target comes off first and buffers overspend', () => {
  const st = state({ plans: { '2026-10': normPlan({ income: 300_000, budget: 150_000, savingsTarget: 30_000 }) } })
  assert.equal(spendable(st, '2026-10'), 120_000) // 1500 budget − 300 target
  assert.equal(spendable(st, '2026-11'), 120_000) // carries over
  const at = (spent: number) => snapshot({ ...st, txns: [txn({ date: '2026-10-02', total: spent })] }, oct5)
  let s = at(100_000); assert.equal(s.dipping, false); assert.equal(s.over, false)
  s = at(130_000); assert.equal(s.dipping, true); assert.equal(s.over, false); assert.equal(s.dipped, 10_000)
  s = at(150_000); assert.equal(s.dipping, true); assert.equal(s.dipped, 30_000) // exactly the whole target
  s = at(150_001); assert.equal(s.dipping, false); assert.equal(s.over, true)
  const noBudget = state({ plans: { '2026-10': normPlan({ income: 300_000, savingsTarget: 50_000 }) } })
  assert.equal(spendable(noBudget, '2026-10'), 250_000) // everything available − target
})

test('reserving today leaves earlier days alone', () => {
  const base = normState({ setup: normSetup({ country: 'SG', currency: 'SGD', startDay: 1 }), plans: { '2026-10': normPlan({ income: 310_000 }) } })
  assert.equal(snapshot(base, '2026-10-05').day.bonus, 40_000)
  const p = normPlanned({ id: 'p', name: 'Phone', price: 81_000, targetMonth: '2026-12' })
  const day = snapshot(withReserved(base, p, 27_000, '2026-10-05'), '2026-10-05').day
  assert.equal(day.bonus, 40_000)
  assert.equal(day.budget, 10_000 - 1_000)
  const sep = normState({ plans: { '2026-09': normPlan({ income: 1, lines: [normLine({ kind: 'FIXED', name: 'Rent', amount: 1, added: '2026-09-20' })] }) } })
  assert.equal(planFor(sep, '2026-10').lines[0].added, undefined)
})

