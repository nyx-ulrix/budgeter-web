/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'

/*
 * The web sync against a fake Google Sheets that starts with what the Android app writes (Kotlin JSON, with nulls
 * left out). Checks pull, push, an edit and a delete coming from the phone, and that nothing blank is uploaded.
 */

// Browser globals the store needs.
const mem = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) },
  window: { addEventListener() {} },
})

// A tiny Sheets + Drive: tab → rows (row 1 = index 0).
const tabs = new Map<string, string[][]>()
const writes: string[] = []
function parseRange(r: string) {
  const m = /^'([^']+)'!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(decodeURIComponent(r))!
  return { tab: m[1], row: m[3] ? Number(m[3]) : 1 }
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const u = new URL(url)
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  if (u.hostname === 'www.googleapis.com') return ok({ files: [{ id: 'sheet1' }] })
  const path = decodeURIComponent(u.pathname.replace('/v4/spreadsheets/', ''))
  if (path === 'sheet1' && init?.method === 'GET') return ok({ sheets: [...tabs.keys()].map((title) => ({ properties: { title } })) })
  if (path === 'sheet1:batchUpdate') {
    writes.push('addSheet')
    for (const r of body.requests) tabs.set(r.addSheet.properties.title, [])
    return ok({})
  }
  if (path === 'sheet1/values:batchUpdate') {
    for (const d of body.data) {
      const { tab, row } = parseRange(d.range)
      writes.push(`update ${tab}!${row}`)
      const rows = tabs.get(tab)!
      while (rows.length < row) rows.push([])
      rows[row - 1] = d.values[0].map(String)
    }
    return ok({})
  }
  const [, range, action] = /^sheet1\/values\/([^:]+)(?::(\w+))?$/.exec(path)!
  const { tab, row } = parseRange(range)
  const rows = tabs.get(tab) ?? []
  if (action === 'append') { writes.push(`append ${tab}`); body.values.forEach((v: unknown[]) => rows.push(v.map(String))); return ok({}) }
  if (action === 'clear') { rows[row - 1] = []; return ok({}) }
  return ok({ values: rows.slice(row - 1) })
}) as typeof fetch

// What the phone (Kotlin, encodeDefaults, explicitNulls=false) puts in the sheet.
const phoneTxn = (total: number, updatedAt: number) => JSON.stringify({
  id: 'a', date: '2026-10-02', total, category: 'Food', merchant: 'Chicken rice', note: '', tax: 0, serviceCharge: 0, discount: 0,
  taxIncluded: false, payer: 'me', method: 'EQUAL', people: 1, shares: {}, paidBack: [], splitInput: {}, items: [],
  fromReserve: 0, updatedAt, syncedAt: updatedAt, syncedTab: '2026-10', deleted: false,
})
tabs.set('_sync', [
  ['Key', 'Stamp', 'Data'],
  ['setup', '1', JSON.stringify({ country: 'SG', currency: 'SGD', startDay: 1, name: '' })],
  ['categories', '1', JSON.stringify({ categories: ['Food', 'Bills'], monthlyCategories: ['Bills'] })],
  ['plan:2026-10', '1', JSON.stringify({ income: 310000, lines: [], caps: {}, savingsTarget: 0 })],
  ['txn:a', '1', phoneTxn(790, 100)],
])
tabs.set('2026-10', [['ID'], ['a', '2026-10-02']])

test('web sync pulls, pushes and follows the phone', async () => {
  const { store } = await import('../data/store')
  const { runOnce } = await import('./sheets')
  const { saveTxn } = await import('../data/actions')
  const { normTxn } = await import('../data/state')

  // First run on the web: blank browser, sync on. It takes the phone's data and writes nothing.
  store.update((s) => ({ ...s, sync: { ...s.sync, enabled: true } }), { notify: false })
  await runOnce('token')
  const st = store.get()
  assert.equal(st.setup?.currency, 'SGD')
  assert.deepEqual(st.categories, ['Food', 'Bills'])
  assert.equal(st.txns.length, 1)
  assert.deepEqual(writes, [])

  // A web expense goes to its month tab and to _sync, already marked as written (so the phone won't re-add it).
  store.update((s) => saveTxn(s, normTxn({ id: 'b', date: '2026-10-03', total: 500, merchant: 'Kopi' })))
  await runOnce('token')
  assert.ok(tabs.get('2026-10')!.some((r) => r[0] === 'b'))
  const rowB = tabs.get('_sync')!.find((r) => r[0] === 'txn:b')!
  assert.ok(Number(rowB[1]) > 1)
  assert.ok(JSON.parse(rowB[2]).syncedTab === '2026-10')
  assert.ok(!rowB[2].includes('null'))
  const before = writes.length
  await runOnce('token')
  assert.equal(writes.length, before) // nothing changed, nothing written

  // The phone edits a and deletes b: the web follows.
  const sync = tabs.get('_sync')!
  sync[sync.findIndex((r) => r[0] === 'txn:a')] = ['txn:a', String(Date.now() + 5000), phoneTxn(999, Date.now() + 5000)]
  sync[sync.findIndex((r) => r[0] === 'txn:b')] = ['txn:b', String(Date.now() + 5000), '']
  await runOnce('token')
  assert.deepEqual(store.get().txns.map((t) => [t.id, t.total]), [['a', 999]])
})
