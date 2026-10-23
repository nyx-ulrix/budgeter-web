/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocate, convert, money, parseMoney, plain, toMinor } from './money'
import { overdrawn } from '../date/money'
import { daySpend, periodOf, periodOfKey, nextPeriod, today, pace } from './budget'
import { split, itemShares } from './split'
import { parsedReceipt, receiptItem, itemCosts, mismatch, receiptDate } from './receipt'
import { Seg, findDate, isSummary, joinRows, parse } from './receiptText'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

test('allocate sums exactly', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33])
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33])
  assert.deepEqual(allocate(0, [5, 5]), [0, 0])
  assert.deepEqual(allocate(10, [0, 0]), [5, 5])
  assert.equal(sum(allocate(1001, [333, 333, 334])), 1001)
})

test('parses money', () => {
  assert.equal(parseMoney('12.50', 'SGD'), 1250)
  assert.equal(parseMoney('12,50', 'EUR'), 1250)
  assert.equal(parseMoney('1,234.50', 'SGD'), 123450)
  assert.equal(parseMoney('1,234', 'SGD'), 123400)
  assert.equal(parseMoney('S$12', 'SGD'), 1200)
  assert.equal(parseMoney('300', 'JPY'), 300)
  assert.equal(parseMoney('1.234', 'KWD'), 1234)
  assert.equal(parseMoney('abc', 'SGD'), null)
  assert.equal(plain(1250, 'SGD'), '12.50')
  assert.ok(money(123_456_78, 'SGD').endsWith('123,456.78'))
  assert.ok(money(-500, 'JPY').startsWith('-') && money(-500, 'JPY').endsWith('500'))
  assert.equal(convert(10_000, 'JPY', 'SGD', 0.009), 9_000)
  // exact decimal rounding, no float drift
  assert.equal(parseMoney('1.0050', 'USD'), 101)
  assert.equal(parseMoney('-0.1250', 'USD'), -13)
  assert.equal(parseMoney('1.005', 'USD'), 100500) // 3 digits after the mark: thousands
  assert.equal(plain(-5, 'KWD'), '-0.005')
  assert.equal(plain(300, 'JPY'), '300')
})

test('periods with custom start day', () => {
  const p = periodOf('2026-10-03', 25)
  assert.equal(p.start, '2026-09-25')
  assert.equal(p.end, '2026-10-25')
  assert.equal(p.key, '2026-09')
  assert.equal(p.days, 30)
  assert.deepEqual(periodOfKey('2026-09', 25), p)
  assert.equal(nextPeriod(p).key, '2026-10')
  assert.equal(periodOf('2026-01-31', 1).start, '2026-01-01')
})

test('daily budget adjusts after overspend', () => {
  const p = periodOf('2026-10-01', 1) // 31 days
  const d1 = today(31_000, [], 5_000, 0, '2026-10-01', p)
  assert.equal(d1.budget, 1_000)
  assert.equal(d1.remaining, -4_000)
  const d2 = today(31_000, [daySpend(5_000)], 0, 0, '2026-10-02', p) // 30 days left
  assert.equal(d2.budget, 866)
  const broke = today(1_000, [daySpend(5_000)], 100, 0, '2026-10-02', p)
  assert.equal(broke.budget, 0)
  const last = today(31_000, Array.from({ length: 30 }, () => daySpend(1_000)), 0, 0, '2026-10-31', p)
  assert.equal(last.budget, 1_000)
  // Underspending carries forward as a bonus: 2 days × 1000 base − 500 spent = 1500 saved up.
  const saver = today(31_000, [daySpend(500), daySpend(0)], 0, 0, '2026-10-03', p)
  assert.equal(saver.budget, 1_000)
  assert.equal(saver.bonus, 1_500)
  assert.equal(saver.remaining, 2_500)
  assert.equal(today(31_000, [], 0, 0, '2026-10-01', p).bonus, 0) // nothing before day 1
  // Headline shows only today's own budget; spending past it uses the saved-up bonus first.
  const dipped = today(31_000, [daySpend(500), daySpend(0)], 1_400, 0, '2026-10-03', p)
  assert.equal(dipped.dailyLeft, -400)
  assert.equal(dipped.bonusLeft, 1_100)
  assert.equal(dipped.remaining, 1_100)
  // Regression: an overspent day doesn't stop a later unused day from carrying forward.
  const after = today(31_000, [daySpend(1_500), daySpend(790)], 0, 0, '2026-10-03', p)
  assert.equal(after.budget, 983)
  assert.equal(after.bonus, 193)
  // Groceries eat the leftovers first, then lower the remaining days.
  const groceries = today(31_000, [daySpend(0), daySpend(0, 2_500)], 0, 0, '2026-10-03', p)
  assert.equal(groceries.bonus, 0)
  assert.equal(groceries.budget, 982)
})

test('pacing', () => {
  const p = periodOf('2026-10-01', 1)
  const day10 = '2026-10-10' // expected 31000*10/31 = 10000
  assert.equal(pace(31_000, 10_000, day10, p), 'ON_TRACK')
  assert.equal(pace(31_000, 11_000, day10, p), 'SLIGHTLY_OVER')
  assert.equal(pace(31_000, 11_001, day10, p), 'OVER')
  assert.equal(pace(31_000, 0, '2026-10-01', p), 'ON_TRACK')
  assert.equal(pace(-500, 1, day10, p), 'OVER')
})

test('splits', () => {
  assert.deepEqual(split(10_000, 'EQUAL', [0, 0, 0]), [3334, 3333, 3333])
  assert.deepEqual(split(10_000, 'PERCENT', [7_500, 2_500]), [7_500, 2_500])
  assert.deepEqual(split(10_000, 'SHARES', [1, 4]), [2_000, 8_000])
  assert.deepEqual(split(10_000, 'EXACT', [1, 9_999]), [1, 9_999])
  assert.throws(() => split(10_000, 'PERCENT', [5_000, 4_000]), /Percentages add up to 90.0%, not 100%/)
  assert.throws(() => split(10_000, 'EXACT', [1, 2]))
  // item 0 shared by everyone, item 1 only person 1
  assert.deepEqual(itemShares([1_000, 1_000], [[], [1]], 2), [500, 1_500])
})

test('receipt allocation uses only printed charges', () => {
  // Singapore restaurant: 10% service charge then 9% GST, both printed.
  const r = parsedReceipt({
    items: [receiptItem('Laksa', 1_000), receiptItem('Kopi', 300), receiptItem('Kaya toast', 450)],
    subtotal: 1_750, serviceCharge: 175, tax: 173, total: 2_098,
  })
  assert.equal(mismatch(r), 0)
  const costs = itemCosts(r)
  assert.equal(sum(costs), 2_098)
  assert.equal(costs[0], 1_199)
  // Prices already include GST: tax line is informational, nothing added.
  const incl = parsedReceipt({ items: [receiptItem('A', 1_090)], tax: 90, taxIncluded: true, total: 1_090 })
  assert.deepEqual(itemCosts(incl), [1_090])
  assert.equal(mismatch(incl), 0)
  // Bill-level discount spreads proportionally.
  const disc = parsedReceipt({ items: [receiptItem('A', 1_000), receiptItem('B', 3_000)], discount: 400, total: 3_600 })
  assert.deepEqual(itemCosts(disc), [900, 2_700])
  // Nothing printed, nothing added.
  assert.deepEqual(itemCosts(parsedReceipt({ items: [receiptItem('X', 500)] })), [500])
  // Wrong total is flagged, not guessed.
  assert.equal(mismatch(parsedReceipt({ items: [receiptItem('X', 500)], total: 600 })), 100)
})

test('parses receipt text', () => {
  const text = [
    'BREAD & BUTTER CAFE',
    '12 Orchard Road #01-02',
    'Date: 06/10/2026 13:45',
    '2 x Kopi              6.00',
    'Laksa                12.50',
    'Iced Lemon Tea',
    '4.50',
    'Member Disc          -1.00',
    'Subtotal             22.00',
    'Svc Chg 10%           2.20',
    'GST 9%                2.18',
    'TOTAL               26.38',
    'VISA                26.38',
    'Change                0.00',
  ].join('\n')
  const r = parse(text, 'SGD')
  assert.equal(r.merchant, 'BREAD & BUTTER CAFE')
  assert.equal(r.date, '2026-10-06')
  assert.deepEqual(r.items.map((i) => i.name), ['Kopi', 'Laksa', 'Iced Lemon Tea', 'Member Disc'])
  assert.equal(r.items[0].qty, 2)
  assert.equal(r.items[3].price, -100)
  assert.equal(r.subtotal, 2_200)
  assert.equal(r.serviceCharge, 220)
  assert.equal(r.tax, 218)
  assert.equal(r.total, 2_638)
  assert.equal(mismatch(r), 0)

  const yen = parse('RAMEN YA\nShoyu Ramen ¥1,200\nGyoza 450\nTotal ¥1,650', 'JPY')
  assert.deepEqual(yen.items.map((i) => i.price), [1_200, 450])
  assert.equal(yen.total, 1_650)
  const dinar = parse('CAFE\nTea 1.250\nTotal 1.250', 'KWD')
  assert.equal(dinar.total, 1_250)

  const inclusive = parse('SHOP\nApple 3.27\nTotal 3.27\nGST incl. 0.27', 'SGD')
  assert.ok(inclusive.taxIncluded)
  assert.equal(mismatch(inclusive), 0)

  // Header rows aren't items, even when a tilted photo puts the price on the header's row
  const body = ['1 Signature Crispy Chicken Ricebox ALC', 'More Spicy*', '1 SubTotal   7.90', 'GST (9% Incl.)   0.65', 'Net Total   7.90', 'Master   7.90']
  for (const rows of [
    ['SHIHLIN TAIWAN STREET FOOD', '*** Retail/Takeaway ***', '1 Signature Crispy Chicken Ricebox   7.90', ...body],
    ['SHIHLIN TAIWAN STREET FOOD', '*** Retail/Takeaway ***   7.90', '1 Signature Crispy Chicken Ricebox', ...body],
  ]) {
    for (const eol of ['\n', '\r\n']) {
      const r = parse(rows.join(eol), 'SGD')
      assert.deepEqual(r.items, [receiptItem('Signature Crispy Chicken Ricebox', 790, 1)])
      assert.equal(r.total, 790)
      assert.equal(r.tax, 65)
      assert.ok(r.taxIncluded)
    }
  }
  // A misread "Total" is still the total, not an item
  const misread = parse(['SHOP', 'Ricebox   7.90', '1 Subtotao   7.90', 'Net Tota1   7.90', 'Net Totai   7.90'].join('\n'), 'SGD')
  assert.deepEqual(misread.items.map((i) => i.name), ['Ricebox'])
  assert.equal(misread.total, 790)
  assert.equal(misread.subtotal, 790)
})

/** Deterministic shuffle (mulberry32) standing in for Kotlin's shuffled(Random(1)). */
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs]
  let a = seed
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

test('joins tilted rows by slant', () => {
  // Rows 36 px apart, text tilted so the right column drops 30 px: plain height grouping would pair each
  // price with the label below it. Labels are wide (their own slant counts); "GST 9%" is short (uses the median).
  const tilt = Math.atan(0.1)
  const label = (t: string, y: number, w = 150): Seg => ({ text: t, cx: 100, cy: y, w, h: 30, angle: tilt })
  const price = (t: string, y: number): Seg => ({ text: t, cx: 400, cy: y + 30, w: 60, h: 30, angle: tilt })
  const segs = [
    label('Dumpling Party of 15', 64), price('28.00', 64),
    label('XO Prawn Noodles', 100), price('13.00', 100),
    label('Sub Teta )', 136), price('41.00', 136),
    label('Svc Chg 10%', 172), price('4.10', 172),
    label('GST 9%', 208, 60), price('4.06', 208),
    label('Grand Tota]', 244), price('49.16', 244),
    label('Balance', 280, 100), price('49.16', 280),
  ]
  for (const seed of [1, 2, 3]) {
    const rows = joinRows(shuffled(segs, seed))
    assert.equal(rows.split('\n')[3], 'Svc Chg 10%   4.10')
    const r = parse(`SHOP\n${rows}`, 'SGD')
    assert.deepEqual(r.items.map((i) => i.name), ['Dumpling Party of 15', 'XO Prawn Noodles'])
    assert.equal(r.subtotal, 4_100)
    assert.equal(r.serviceCharge, 410)
    assert.equal(r.tax, 406)
    assert.equal(r.total, 4_916)
    assert.equal(mismatch(r), 0)
  }
  assert.ok(isSummary('Grand Tota]'))
})

test('finds dates', () => {
  assert.equal(findDate('2026-10-06 10:00'), '2026-10-06')
  assert.equal(findDate('6 Oct 2026'), '2026-10-06')
  assert.equal(findDate('12/31/26'), '2026-12-31') // impossible day-first, read month-first
  assert.equal(findDate('Table 12'), null)
})

test('scanned receipt year is kept recent', () => {
  assert.equal(receiptDate('2023-10-16', '2026-10-17'), '2026-10-16') // misread year
  assert.equal(receiptDate('2026-10-16', '2026-10-17'), '2026-10-16') // fine as is
  assert.equal(receiptDate('2026-12-30', '2026-01-05'), '2025-12-30') // future: last year
  assert.equal(receiptDate('2026-03-01', '2026-10-17'), '2026-10-17') // just old: today
})

test('29 Feb from an old year lands on 28 Feb, as on Android', () => {
  assert.equal(receiptDate('2024-02-29', '2026-03-15'), '2026-02-28')
  assert.equal(receiptDate('2024-02-29', '2028-03-10'), '2028-02-29') // a leap year keeps it
})

test('AI numbers become exact minor units, no thousands guessing', () => {
  assert.equal(toMinor(0.675, 'SGD'), 68)
  assert.equal(toMinor(12.345, 'USD'), 1235)
  assert.equal(toMinor(1234.5, 'JPY'), 1235)
  assert.equal(toMinor(1.2345, 'KWD'), 1235)
  assert.equal(toMinor(Infinity, 'SGD'), null)
})

test('date overspend: only what this expense overdraws', () => {
  assert.equal(overdrawn(5_000, 12_000), 7_000)        // 50 left, 120 dinner: 70 short
  assert.equal(overdrawn(20_000, 5_000), 0)            // fits
  assert.equal(overdrawn(-7_000, 1_000), 1_000)        // already short: only this one
  assert.equal(overdrawn(-7_000, 10_000, 10_000), 7_000) // re-saving the expense that went 70 over
  assert.equal(overdrawn(0, 10_000, 10_000), 0)        // already covered: nothing twice
})
