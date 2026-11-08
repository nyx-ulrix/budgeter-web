/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppState, Loose, ME, Txn, budgetImpact, normLine, normPlan, normPlanned, normSetup, normState, normTrip, normTxn, normTxnItem } from './state'
import { activeTrip, available, dailyAverage, monthSaved, perDayLeft, planFor, planSpendable, bankBalance, bankSavings, bankStart, OVERSPEND, overspendsFor, reserved, savedToDate, savingsHistory, snapshot, spendable, tripFund, tripSpent } from './ledger'
import { withReserved, buyNow, chargeOverspend, deletePlanned, deleteTxn, dropOverspends, isSpentReserve, removeLine, saveTxn, togglePaid } from './actions'

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
  assert.equal(bought.planned.length, 0)
  const listed = buyNow({ ...st, planned: [p] }, p, 'Shopping', oct5)
  assert.equal(listed.planned.length, 0) // bought items leave the planned list
  const line = Object.values(listed.plans).flatMap((x) => x.lines).find((l) => l.plannedId === 'p')!
  assert.ok(isSpentReserve(listed, line))
  assert.equal(reserved(removeLine(listed, '2026-10', line.id), 'p'), 15_000) // can't take back money the purchase used
  const undone = deleteTxn(listed, listed.txns[0].id)
  assert.deepEqual(undone.planned.map((x) => [x.id, x.status]), [['p', 'OPEN']])
  assert.equal(reserved(undone, 'p'), 15_000)
  assert.equal(reserved(deletePlanned({ ...st, planned: [p] }, 'p'), 'p'), 0)
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
  assert.equal(dailyAverage(st, '2026-09'), Math.trunc(120_000 / 30)) // 120k over September's 30 days
  assert.equal(perDayLeft(st, '2026-09-21'), Math.trunc((150_000 - 120_000) / 10)) // 30k left over 21–30 Sep
  assert.deepEqual(savingsHistory(st, '2026-11-15'), [ // Oct inherits Sep's plan and spends nothing
    { key: '2026-09', saved: 80_000, total: 80_000 },
    { key: '2026-10', saved: 200_000, total: 280_000 },
  ])
  assert.deepEqual(savingsHistory(state({}), '2026-11-15'), [])
  const over = { ...st, txns: [txn({ date: '2026-09-10', total: 250_000 })] }
  assert.equal(monthSaved(over, '2026-09'), -50_000) // overspend comes out of savings
  assert.deepEqual(savingsHistory(over, '2026-11-15').map((m) => m.total), [-50_000, 150_000])
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

test('a bought item edited below its reservation frees the rest', () => {
  const p = normPlanned({ id: 'p', name: 'Shoes', price: 50_000, targetMonth: '2026-10' })
  const st = withReserved(state({ plans: { '2026-10': normPlan({ income: 300_000 }) }, planned: [p] }), p, 50_000, oct5)
  const bought = buyNow(st, p, 'Shopping', oct5)
  assert.equal(spendable(bought, '2026-10'), 250_000)
  const t = bought.txns[bought.txns.length - 1]
  const edited = saveTxn(bought, { ...t, total: 30_000 }, 1)
  assert.equal(edited.txns.find((x) => x.id === t.id)!.fromReserve, 30_000)
  assert.equal(reserved(edited, 'p'), 30_000)
  assert.equal(spendable(edited, '2026-10'), 270_000)
  assert.equal(saveTxn(bought, { ...t, total: 60_000 }, 1).txns.find((x) => x.id === t.id)!.fromReserve, 50_000) // dearer: unchanged
})

test('bank balance: entered balance plus what moved after its day', () => {
  const st = state({
    setup: { ...setup, bank: { amount: 500_000, date: '2026-10-15' } },
    plans: {
      '2026-10': normPlan({ income: 300_000, lines: [
        normLine({ kind: 'FIXED', name: 'Rent', amount: 100_000 }), // undated: on 1 Oct, already in the balance
        normLine({ kind: 'EXTRA', name: 'Gift', amount: 5_000, added: '2026-10-20' }),
        normLine({ kind: 'RESERVE', name: 'Shoes', amount: 9_000, plannedId: 'p', added: '2026-10-20' }), // still in the bank
      ] }),
    },
    txns: [
      txn({ date: '2026-10-10', total: 7_000 }), // before the balance: already in it
      txn({ date: '2026-10-16', total: 2_000 }),
      txn({ date: '2026-10-17', total: 9_000, people: 3, shares: { [ME]: 3_000, P2: 3_000, P3: 3_000 }, paidBack: ['P2'] }), // I paid; P2 paid me back
      txn({ date: '2026-10-18', total: 4_000, people: 2, payer: 'P2', shares: { [ME]: 2_000, P2: 2_000 } }), // P2 paid; I haven't paid back
      txn({ date: '2026-10-19', total: 6_000, tripId: 't' }), // trips still come out of the bank
    ],
  })
  assert.equal(bankBalance(state({}), '2026-10-31'), undefined)
  assert.equal(bankStart(st), '2026-09-30') // the day before the first budget month
  assert.equal(bankSavings(state({}), '2026-11-15'), undefined)
  const started = { ...st, setup: { ...st.setup!, bank: { amount: 100_000, date: '2026-09-30' } } }
  // Starting balance plus what October saved: 300k income + 5k gift − 100k rent − 9k reserved − 23k spent (my share, trips excluded).
  assert.equal(bankSavings(started, '2026-11-15'), 100_000 + monthSaved(started, '2026-10'))
  assert.equal(bankSavings(started, '2026-10-20'), 100_000) // October hasn't ended: none of it counts yet
  assert.equal(bankBalance(st, '2026-10-15'), 500_000)
  assert.equal(bankBalance(st, '2026-10-31'), 500_000 + 5_000 - 2_000 - 6_000 - 6_000)
  // November's plan (carried over): income lands on 1 Nov; rent comes off only once ticked as deducted.
  assert.equal(bankBalance(st, '2026-11-01'), 491_000 + 300_000)
  const rent = planFor(st, '2026-11').lines[0].id
  assert.equal(bankBalance(togglePaid(st, '2026-11', rent, '2026-11-03'), '2026-11-05'), 491_000 + 300_000 - 100_000)
  assert.equal(bankBalance(togglePaid(st, '2026-11', rent, '2026-11-03'), '2026-11-02'), 491_000 + 300_000) // ticked after that day
  assert.equal(bankBalance(st, '2026-12-01'), 491_000 + 300_000 - 100_000 + 300_000) // November ended: its rent counts, December's not yet
  const paidBack = { ...st, txns: st.txns.map((t) => (t.payer === 'P2' ? { ...t, paidBack: [ME] } : t)) }
  assert.equal(bankBalance(paidBack, '2026-10-31'), 491_000 - 2_000) // my share leaves once I pay P2 back
})

test('a date expense has at most one overspend charge, replaced on every save', () => {
  const dinner = { id: 'd1', date: '2026-10-31', note: 'sweet cheeks' }
  const old = txn({ date: '2026-10-31', total: 1_300, merchant: 'sweet cheeks', note: OVERSPEND }) // saved before charges were linked
  let st = state({ txns: [old, txn({ date: '2026-10-31', total: 500, merchant: 'sweet cheeks' })] })
  assert.deepEqual(overspendsFor(st, dinner).map((t) => t.id), [old.id]) // found by day and name; the normal expense isn't one
  const twin = { id: 'd2', date: '2026-10-31', note: 'sweet cheeks' }
  assert.deepEqual(overspendsFor(st, dinner, [dinner, twin]), []) // two expenses with that day and name: an unlinked charge is neither's
  st = chargeOverspend(st, dinner, 700, 'Food')
  assert.deepEqual(overspendsFor(st, dinner).map((t) => [t.total, t.dateId]), [[700, 'd1']]) // replaced, now linked
  const moved = { id: 'd1', date: '2026-11-02', note: 'sweet cheeks' }
  st = chargeOverspend(st, moved, 0, 'Food', dinner) // moved to a month whose fund covers it
  assert.deepEqual([...overspendsFor(st, dinner), ...overspendsFor(st, moved)], [])
  const fresh = chargeOverspend(state({}), dinner, 1_300, 'Food')
  assert.deepEqual(overspendsFor(fresh, dinner).map((t) => [t.total, t.note, t.dateId]), [[1_300, OVERSPEND, 'd1']])
  assert.deepEqual(overspendsFor(dropOverspends(fresh, dinner), dinner), [])
})

test('bank balance counts the date expenses I paid', () => {
  const st = state({
    setup: { ...setup, bank: { amount: 50_000, date: '2026-09-30' } },
    plans: { '2026-10': normPlan({ income: 75_000, lines: [normLine({ kind: 'FIXED', name: 'Date budget (my share)', amount: 15_000, tag: 'date' })] }) },
    txns: [txn({ date: '2026-10-31', total: 1_300, merchant: 'sweet cheeks', note: OVERSPEND }), txn({ date: '2026-10-20', total: 2_000 })],
  })
  const paid = [{ date: '2026-10-31', amount: 7_000 }, { date: '2026-11-02', amount: 650 }]
  // Without the date budget loaded, the overspend charge stands in for date spending (my share isn't ticked yet).
  assert.equal(bankBalance(st, '2026-10-31'), 50_000 + 75_000 - 1_300 - 2_000)
  // With it, the 70 dinner I paid comes off instead; the 6.50 after the day asked isn't counted yet.
  assert.equal(bankBalance(st, '2026-10-31', paid), 50_000 + 75_000 - 2_000 - 7_000)
  // Once October has ended its fixed costs count, but my date share never does when the date expenses are known.
  assert.equal(bankBalance(st, '2026-11-01', paid) , 50_000 + 75_000 - 2_000 - 7_000 + 75_000)
  assert.equal(bankBalance(st, '2026-11-01'), 50_000 + 75_000 - 1_300 - 2_000 - 15_000 + 75_000)
})
