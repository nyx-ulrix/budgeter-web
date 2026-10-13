/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normState, normTxn } from './state'
import { encodeRecord, mergeRemote, Remote, stampedSince, toUpload, withRecord } from './records'

const setup = { country: 'SG', currency: 'SGD', startDay: 1, name: '' }

test('changes flow both ways and deletes win', () => {
  const phone0 = normState({ setup, txns: [normTxn({ id: 'a', date: '2026-10-01', total: 500, updatedAt: 1 })] })
  // First sync from an existing phone: everything uploads with stamp 1 (never stamped).
  const sheet: Record<string, Remote> = { ...toUpload(phone0, {}) }
  for (const k of ['setup', 'categories', 'txn:a']) assert.ok(k in sheet)
  // The web starts empty and takes it all.
  const web = mergeRemote(normState(), sheet)
  assert.equal(web.txns.length, 1)
  assert.equal(web.txns[0].total, 500)
  assert.deepEqual(web.setup, setup)
  assert.deepEqual(toUpload(web, sheet), {})
  // Web edits the txn and adds one; the phone deletes nothing yet.
  const web2 = stampedSince({ ...web, txns: [{ ...web.txns[0], total: 700 }, normTxn({ id: 'b', date: '2026-10-02', total: 100 })] }, web, 10)
  Object.assign(sheet, toUpload(web2, sheet))
  const phone = mergeRemote(phone0, sheet)
  assert.deepEqual([...phone.txns].sort((x, y) => x.id.localeCompare(y.id)).map((t) => t.total), [700, 100])
  // The phone removes b; the web gets the delete even though it still has b.
  const phone2 = stampedSince({ ...phone, txns: phone.txns.filter((t) => t.id !== 'b') }, phone, 20)
  Object.assign(sheet, toUpload(phone2, sheet))
  assert.equal(sheet['txn:b'].json, null)
  assert.deepEqual(mergeRemote(web2, sheet).txns.map((t) => t.id), ['a'])
  // An older remote copy never overwrites a newer local edit.
  const web3 = stampedSince({ ...web2, categories: [...web2.categories, 'Pets'] }, web2, 30)
  assert.ok(mergeRemote(web3, sheet).categories.includes('Pets'))
})

test('unchanged records keep their stamps', () => {
  const s = normState({ setup, txns: [normTxn({ id: 'a', date: '2026-10-01', total: 1, updatedAt: 1 })] })
  // Same content, fields built in another order: not a change.
  const same = { ...s, txns: [{ ...JSON.parse(JSON.stringify(s.txns[0])) }] }
  assert.equal(stampedSince(same, s, 5), same)
})

// Exactly what kotlinx.serialization (encodeDefaults = true, explicitNulls = false) writes for a Txn.
const KOTLIN_TXN = '{"id":"a","date":"2026-10-01","total":500,"category":"Food","merchant":"Cafe","note":"","tax":0,' +
  '"serviceCharge":0,"discount":0,"taxIncluded":false,"payer":"me","method":"EQUAL","people":2,"shares":{"me":250,"p2":250},' +
  '"paidBack":["p2"],"splitInput":{},"items":[{"name":"Tea","price":500,"qty":1,"cost":500,"owners":[],"category":"Food"}],' +
  '"foreign":{"currency":"JPY","amount":5000,"rate":0.009},"fromReserve":0,"updatedAt":1760000000000,"deleted":false}'

test('reads and writes the same JSON as the Android app', () => {
  const s = withRecord(normState(), 'txn:a', KOTLIN_TXN)
  assert.deepEqual(s.txns, [normTxn({
    id: 'a', date: '2026-10-01', total: 500, category: 'Food', merchant: 'Cafe', people: 2, shares: { me: 250, p2: 250 },
    paidBack: ['p2'], items: [{ name: 'Tea', price: 500, qty: 1, cost: 500, owners: [], category: 'Food' }],
    foreign: { currency: 'JPY', amount: 5000, rate: 0.009 }, updatedAt: 1760000000000,
  })])
  const out = encodeRecord(s.txns[0])
  assert.ok(!out.includes('null'))
  assert.deepEqual(JSON.parse(out), JSON.parse(KOTLIN_TXN)) // field for field, nulls omitted
  // Fields Kotlin leaves out (nulls) and older saves miss get their defaults.
  const old = withRecord(normState(), 'txn:x', '{"id":"x","date":"2026-10-01","total":5,"tripId":null}').txns[0]
  assert.equal(old.tripId, undefined)
  assert.equal(old.payer, 'me')
  assert.ok(!encodeRecord({ ...old, syncedAt: null } as object).includes('null'))
})
