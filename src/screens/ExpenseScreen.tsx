import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ai, parse } from '../ai/ai'
import { todayIso, validDate } from '../core/budget'
import { allocate, convert, money, parseMoney, plain } from '../core/money'
import { ParsedReceipt, computedTotal, itemCosts, mismatch, parsedReceipt, receiptDate, receiptItem } from '../core/receipt'
import { SPLIT_LABEL, SPLIT_METHODS, SplitMethod, itemShares, split } from '../core/split'
import { deleteTxn, saveTxn } from '../data/actions'
import { activeTrip, currency } from '../data/ledger'
import { rate as fetchRate } from '../data/rates'
import { AppState, ME, MEAL_CATEGORY, Meal, Txn, newId, normTxn, personId, personLabel } from '../data/state'
import { MealDialog } from './MacrosScreen'
import { store, useAppState } from '../data/store'
import {
  Body, Chip, Choice, CloseButton, DateField, FoldWindow, KeyValue, Label, Page, PageHeader, PixelButton, PixelField, Rule,
  SearchPicker, Small, Window, Side } from '../ui/components'
import { Screen, useNav } from '../ui/nav'
import { Glyphs, Px, Type } from '../ui/theme'
import { addTx, deleteTx, updateTx, useDate } from '../date/client'
import { overdrawn, type Tx as DateTx } from '../date/money'
const DATE = 'date' // Count toward: the shared date budget

type ExpenseRoute = Extract<Screen, { kind: 'expense' }>

interface ItemDraft { key: string; name: string; price: string; qty: number; owners: string[]; category?: string }

/** Everything the editor holds, as text where the user types, so half-typed numbers survive. */
interface Draft {
  itemised: boolean
  amount: string
  tax: string
  service: string
  discount: string
  printedTotal: string
  taxIncluded: boolean
  merchant: string
  date: string
  category: string
  note: string
  tripId: string | null
  paidCur: string
  rate: string
  people: number // P1 (me) .. P[people]
  payer: string
  method: SplitMethod
  inputs: Record<string, string>
  items: ItemDraft[]
}

const itemDraft = (name: string, price: string, qty = 1, owners: string[] = [], category?: string): ItemDraft =>
  ({ key: newId(), name, price, qty, owners, category })

const isIsoDate = (s: string | null | undefined): s is string => {
  const r = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null
  return !!r && validDate(Number(r[1]), Number(r[2]), Number(r[3]))
}

/** Kotlin String.toLongOrNull. */
const toLong = (v: string): number | null => (/^[+-]?\d+$/.test(v) ? Number(v) : null)

/** "33.33" → 3333 basis points, truncated like BigDecimal.movePointRight(2).toLong(). Blank = 0. */
function basisPoints(v: string): number {
  const t = v.trim() || '0'
  const n = Number(t)
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) || !Number.isFinite(n)) throw new Error("A percentage isn't a number")
  return Math.trunc(Number((n * 100).toFixed(6)))
}

/** Fills the draft from a read receipt (Kotlin Draft.load). */
function loadReceipt(d: Draft, r: ParsedReceipt, fallbackCur: string): Draft {
  const paidCur = r.currency ?? fallbackCur
  const p = (v: number) => (v === 0 ? '' : plain(v, paidCur))
  const itemised = r.items.length > 0
  const total = r.total != null ? plain(r.total, paidCur) : ''
  return {
    ...d,
    paidCur,
    merchant: r.merchant.trim() ? r.merchant : d.merchant,
    category: r.category ?? d.category,
    date: isIsoDate(r.date) ? receiptDate(r.date, todayIso()) : d.date,
    items: r.items.map((i) => itemDraft(i.name, plain(i.price, paidCur), i.qty)),
    itemised,
    discount: p(r.discount), service: p(r.serviceCharge), tax: p(r.tax), taxIncluded: r.taxIncluded,
    printedTotal: total,
    amount: itemised ? d.amount : total,
  }
}

function draftFrom(st: AppState, s: ExpenseRoute, dateTx?: DateTx): Draft {
  const home = currency(st)
  let d: Draft = {
    itemised: false, amount: '', tax: '', service: '', discount: '', printedTotal: '', taxIncluded: false, merchant: '',
    date: todayIso(), category: 'Other', note: '', tripId: null, paidCur: home, rate: '1',
    people: 1, payer: ME, method: 'EQUAL', inputs: {}, items: [],
  }
  // A date budget expense (shared fund): only amount, name and date live there.
  if (dateTx) return { ...d, amount: plain(dateTx.amount, home), merchant: dateTx.note, date: dateTx.date, tripId: DATE }
  const t = s.id != null ? st.txns.find((x) => x.id === s.id) : undefined
  if (t) {
    const cur = t.foreign?.currency ?? home
    const paid = t.foreign?.amount ?? t.total
    const itemised = t.items.length > 0
    const inputs: Record<string, string> = {}
    for (const [who, v] of Object.entries(t.splitInput)) {
      inputs[who] = t.method === 'PERCENT' ? String(v / 100) : t.method === 'EXACT' ? plain(v, cur) : String(v)
    }
    return {
      ...d,
      paidCur: cur, rate: String(t.foreign?.rate ?? 1), itemised,
      // Items + charges were stored as the paid total; the editable amount is before charges, so add the discount back.
      amount: plain(!itemised ? paid : paid - t.serviceCharge - (t.taxIncluded ? 0 : t.tax) + t.discount, cur),
      tax: t.tax !== 0 ? plain(t.tax, cur) : '',
      service: t.serviceCharge !== 0 ? plain(t.serviceCharge, cur) : '',
      discount: t.discount !== 0 ? plain(t.discount, cur) : '',
      taxIncluded: t.taxIncluded,
      printedTotal: itemised ? plain(paid, cur) : '',
      items: t.items.map((i) => itemDraft(i.name, plain(i.price, cur), i.qty, i.owners, i.category)),
      merchant: t.merchant, date: t.date, category: t.category, note: t.note,
      tripId: t.tripId ?? null, payer: t.payer, method: t.method,
      people: Math.max(t.people, Object.keys(t.shares).length, 1),
      inputs,
    }
  }
  const trip = (s.tripId != null ? st.trips.find((x) => x.id === s.tripId) : undefined) ?? activeTrip(st)
  d = { ...d, tripId: trip?.id ?? null, paidCur: trip?.currency ?? home }
  return s.receipt ? loadReceipt(d, s.receipt, d.paidCur) : d
}

export function ExpenseScreen({ screen: s }: { screen: ExpenseRoute }) {
  const ds = useDate()
  const dateReady = ds.phase === 'ready'
  const dateTx = s.dateId != null ? ds.txs.find((x) => x.id === s.dateId) : undefined
  const st = useAppState()
  const nav = useNav()
  const home = currency(st)
  const [d, setD] = useState<Draft>(() => draftFrom(st, s, dateTx))
  const existing = s.id != null ? st.txns.find((x) => x.id === s.id) : undefined
  const editing = !!existing || !!dateTx
  const [catFor, setCatFor] = useState<string | null>(null) // item key
  const [rereading, setRereading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const providers = useMemo(() => Ai.providers(), [])
  const cur = d.paidCur
  const splitting = d.people > 1 && d.tripId !== DATE // the date budget has no split (its window is hidden)
  const members = Array.from({ length: d.people }, (_, i) => personId(i + 1))
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const setItem = (key: string, patch: Partial<ItemDraft>) =>
    setD((x) => ({ ...x, items: x.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }))

  // Fetch a rate when paying in another currency; the user can overwrite it.
  useEffect(() => {
    if (cur === home) { setD((x) => (x.rate === '1' ? x : { ...x, rate: '1' })); return }
    if (existing?.foreign?.currency === cur) return
    let live = true
    setD((x) => ({ ...x, rate: '' }))
    fetchRate(cur, home).then((r) => { if (live && r != null) setD((x) => (x.rate.trim() ? x : { ...x, rate: String(r) })) })
    return () => { live = false }
  }, [cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derived numbers.
  const m = (text: string) => (text.trim() === '' ? 0 : parseMoney(text, cur))
  const errors: string[] = []
  const taxV = m(d.tax), svcV = m(d.service), discV = m(d.discount)
  if (taxV == null || svcV == null || discV == null) errors.push("A charge isn't a number")
  const receipt = d.itemised ? parsedReceipt({
    items: d.items.map((i) => receiptItem(i.name, parseMoney(i.price, cur) ?? 0, i.qty)),
    discount: discV ?? 0, serviceCharge: svcV ?? 0, tax: taxV ?? 0, taxIncluded: d.taxIncluded,
    total: d.printedTotal.trim() === '' ? null : parseMoney(d.printedTotal, cur),
  }) : null
  if (receipt) {
    if (d.items.length === 0) errors.push('Add at least one item')
    if (d.items.some((i) => parseMoney(i.price, cur) == null)) errors.push("An item price isn't a number")
    if (mismatch(receipt) !== 0) {
      errors.push(`Items and charges come to ${money(computedTotal(receipt), cur)} but the receipt total is ${money(receipt.total!, cur)}. Fix an item or clear the total.`)
    }
  }
  const amountV = m(d.amount)
  if (!d.itemised && (amountV == null || d.amount.trim() === '')) errors.push('Enter an amount')
  const totalPaid = receipt ? computedTotal(receipt) : amountV ?? 0
  if (totalPaid <= 0) errors.push('The total must be more than zero')
  const typedRate = d.rate.trim() === '' ? NaN : Number(d.rate.trim())
  const rate = cur === home ? 1 : Number.isFinite(typedRate) && typedRate > 0 ? typedRate : null
  if (rate == null) errors.push('Enter the exchange rate')
  const totalHome = convert(totalPaid, cur, home, rate ?? 1)
  const costsPaid = receipt ? itemCosts(receipt) : []
  const costsHome = costsPaid.map((c) => convert(c, cur, home, rate ?? 1))
  if (costsHome.length) {
    const top = costsHome.reduce((best, v, i) => (v > costsHome[best] ? i : best), 0)
    costsHome[top] += totalHome - costsHome.reduce((a, b) => a + b, 0)
  }
  let shares: Record<string, number> = {}
  if (splitting) {
    try {
      let parts: number[]
      switch (d.method) {
        case 'ITEMS':
          parts = itemShares(costsHome, d.items.map((i) => i.owners.map((o) => members.indexOf(o)).filter((x) => x >= 0)), members.length)
          break
        case 'EQUAL': parts = split(totalHome, 'EQUAL', members.map(() => 1)); break
        case 'SHARES': parts = split(totalHome, 'SHARES', members.map((w) => toLong(d.inputs[w] ?? '') ?? 1)); break
        case 'PERCENT': parts = split(totalHome, 'PERCENT', members.map((w) => basisPoints(d.inputs[w] ?? ''))); break
        case 'EXACT': {
          const paid = members.map((w) => parseMoney(d.inputs[w] ?? '', cur) ?? 0)
          const sum = paid.reduce((a, b) => a + b, 0)
          if (sum !== totalPaid) throw new Error(`Amounts add up to ${money(sum, cur)}, not ${money(totalPaid, cur)}`)
          parts = allocate(totalHome, paid)
        }
      }
      if (parts.reduce((a, b) => a + b, 0) !== totalHome) throw new Error("Split doesn't add up to the total")
      shares = Object.fromEntries(members.map((w, i) => [w, parts[i]]))
    } catch (e) {
      errors.push((e as Error).message || "Split doesn't add up")
    }
  }

  const [mealFor, setMealFor] = useState<Meal | null>(null) // "Save & add to macros": the meal to fill in after saving

  /** Saves; then [then] gets the saved expense's id (by default, go back). */
  function save(then: (id: string) => void = () => nav.back()) {
    if (d.tripId === DATE) { // the shared date fund, not my budget; moving a normal expense there takes it out of my budget
      const draft = { kind: 'expense' as const, amount: totalHome, note: (d.merchant.trim() || d.note.trim() || 'Date').slice(0, 100), date: d.date }
      // What this expense takes the fund below zero by, I paid: it tops the fund back up from my own budget.
      const cover = overdrawn(ds.left, totalHome, dateTx?.amount ?? 0)
      ;(async () => {
        await (dateTx ? updateTx(dateTx.id, draft) : addTx(draft))
        if (cover > 0) await addTx({ kind: 'topup', amount: cover, note: `Over budget: ${draft.note}`.slice(0, 100), date: draft.date })
      })().then(() => {
        if (existing) store.update((x) => deleteTxn(x, existing.id))
        if (cover > 0) store.update((x) => saveTxn(x, normTxn({ date: draft.date, total: cover, category: d.category, merchant: draft.note, note: 'Date budget overspend' })))
        nav.back()
      }).catch((e) => alert(e.message))
      return
    }
    if (dateTx) deleteTx(dateTx.id).catch((e) => alert(e.message)) // moved out of the date budget into my own
    const t: Txn = {
      id: existing?.id ?? newId(),
      date: d.date,
      total: totalHome,
      category: d.category,
      merchant: d.merchant.trim(),
      note: d.note.trim(),
      tax: d.itemised ? taxV ?? 0 : 0, serviceCharge: d.itemised ? svcV ?? 0 : 0, discount: d.itemised ? discV ?? 0 : 0,
      taxIncluded: d.taxIncluded,
      payer: splitting && members.includes(d.payer) ? d.payer : ME,
      method: d.method,
      people: d.people,
      shares,
      paidBack: (existing?.paidBack ?? []).filter((w) => (shares[w] ?? 0) > 0), // keep ticks for people still sharing the bill
      splitInput: !splitting ? {} : Object.fromEntries(members.map((who) => {
        const v = d.inputs[who] ?? ''
        let n = 0
        if (d.method === 'PERCENT') { try { n = basisPoints(v) } catch { n = 0 } }
        else if (d.method === 'EXACT') n = parseMoney(v, cur) ?? 0
        else if (d.method === 'SHARES') n = toLong(v) ?? 1
        return [who, n]
      })),
      items: d.itemised ? d.items.map((i, k) => ({
        name: i.name.trim(), price: parseMoney(i.price, cur) ?? 0, qty: i.qty, cost: costsHome[k] ?? 0, owners: i.owners, category: i.category,
      })) : [],
      tripId: d.tripId ?? undefined,
      foreign: cur !== home ? { currency: cur, amount: totalPaid, rate: rate! } : undefined,
      plannedId: existing?.plannedId,
      fromReserve: existing?.fromReserve ?? 0,
      updatedAt: Date.now(),
      syncedAt: existing?.syncedAt,
      syncedTab: existing?.syncedTab,
      deleted: false,
    }
    store.update((x) => saveTxn(x, t))
    then(t.id)
  }

  function reread(id: string | null) {
    if (rereading || s.ocrText == null) return
    setRereading(true)
    setReadError(null)
    parse(providers.find((p) => p.id === id) ?? null, s.ocrText, d.paidCur, st.categories)
      .then((r) => setD((x) => loadReceipt(x, r, x.paidCur)))
      .catch((e) => setReadError((e as Error).message))
      .finally(() => setRereading(false))
  }

  const trips = [...st.trips].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
  const pickingFor = d.items.find((i) => i.key === catFor)

  return (
    <>
      <Page>
        <PageHeader title={editing ? 'Edit' : s.receipt ? 'Check receipt' : 'New expense'} />

        <Window title={d.itemised ? 'Receipt items' : 'Expense'}>
          <Choice options={[false, true]} selected={d.itemised} label={(it) => (it ? 'Itemised' : 'Simple')}
            onSelect={(it) => set({ itemised: it, ...(!it && d.method === 'ITEMS' ? { method: 'EQUAL' as SplitMethod } : {}) })} />
          {!d.itemised ? (
            <PixelField value={d.amount} onChange={(v) => set({ amount: v })} label={`Amount (${cur})`} keyboard="decimal-pad" placeholder="0.00" />
          ) : (
            <>
              {d.items.map((item, i) => (
                <View key={item.key} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
                    <PixelField value={item.name} onChange={(v) => setItem(item.key, { name: v })} label={`Item ${i + 1}`} style={{ flex: 1.6 }} />
                    <PixelField value={item.price} onChange={(v) => setItem(item.key, { price: v })} label="Price" keyboard="decimal-pad" style={{ flex: 1 }} />
                    <CloseButton onPress={() => setD((x) => ({ ...x, items: x.items.filter((o) => o.key !== item.key) }))} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {item.qty > 1 && <Small>×{item.qty}</Small>}
                    {costsPaid[i] != null && <Small color={Px.brown}>Incl. charges {money(costsPaid[i], cur)}</Small>}
                    <Pressable role="button" aria-label="Change item category" onPress={() => setCatFor(item.key)}
                      style={{ minHeight: 32, padding: 4, justifyContent: 'center' }}>
                      <Text style={Type.label}>[{item.category ?? d.category}]</Text>
                    </Pressable>
                  </View>
                  {splitting && d.method === 'ITEMS' && (
                    <Toggles options={members.map((w) => [w, personLabel(w)])} selected={item.owners}
                      onToggle={(who) => setItem(item.key, { owners: item.owners.includes(who) ? item.owners.filter((o) => o !== who) : [...item.owners, who] })} />
                  )}
                </View>
              ))}
              <PixelButton text="+ Item" kind="secondary" onPress={() => setD((x) => ({ ...x, items: [...x.items, itemDraft('', '')] }))} />
              <Rule />
              <PixelField value={d.discount} onChange={(v) => set({ discount: v })} label="Bill discount" keyboard="decimal-pad" />
              <PixelField value={d.service} onChange={(v) => set({ service: v })} label="Service charge (printed)" keyboard="decimal-pad" />
              <PixelField value={d.tax} onChange={(v) => set({ tax: v })} label="Tax / GST (printed)" keyboard="decimal-pad" />
              <Choice options={[false, true]} selected={d.taxIncluded} label={(it) => (it ? 'Prices include tax' : 'Tax on top')} onSelect={(it) => set({ taxIncluded: it })} />
              <PixelField value={d.printedTotal} onChange={(v) => set({ printedTotal: v })} label="Receipt total (to check)" keyboard="decimal-pad" />
            </>
          )}
          <Rule />
          <KeyValue k="Total" v={money(totalPaid, cur)} />
          {cur !== home && <KeyValue k={`In ${home}`} v={money(totalHome, home)} />}
          {splitting && <KeyValue k="My share (P1)" v={money(shares[ME] ?? 0, home)} />}
        </Window>

        <Window title="Details">
          <PixelField value={d.merchant} onChange={(v) => set({ merchant: v })} label="Name" placeholder="What was it?" />
          <DateField label="Date" value={d.date} onChange={(v) => set({ date: v })} />
          {d.tripId !== DATE && <>
            <Label>Category</Label>
            <Choice options={st.categories} selected={d.category} label={(c) => c} onSelect={(c) => set({ category: c })} />
            <PixelField value={d.note} onChange={(v) => set({ note: v })} label="Note" multiline />
          </>}
          {cur !== home && (
            <PixelField value={d.rate} onChange={(v) => set({ rate: v })} label={`Paid in ${cur} · 1 ${cur} = ? ${home}`} keyboard="decimal-pad" />
          )}
        </Window>

        <Side>
        {(st.trips.length > 0 || dateReady || dateTx) && (
          <Window title="Count toward">
            <Choice<string | null> options={[null, ...trips.map((t) => t.id), ...(dateReady ? [DATE] : [])]} selected={d.tripId}
              label={(id) => (id == null ? 'Monthly budget' : id === DATE ? 'Date budget' : 'Trip: ' + (trips.find((t) => t.id === id)?.name ?? ''))}
              onSelect={(id) => {
                const t = trips.find((x) => x.id === id)
                set({ tripId: id, ...(t ? { paidCur: t.currency } : {}) })
              }} />
            {d.tripId === DATE ? <>
              <Small>Goes to the shared date budget (your partner sees it), not your daily budget.</Small>
              {overdrawn(ds.left, totalHome, dateTx?.amount ?? 0) > 0 && <Small color={Px.brown}>
                The date budget is {money(overdrawn(ds.left, totalHome, dateTx?.amount ?? 0), home)} short, so that much comes out of your monthly budget.
              </Small>}
            </>
              : d.tripId != null && <Small>Comes out of the trip fund, not your daily budget.</Small>}
          </Window>
        )}

        {d.tripId !== DATE && <Window title="Split">
          <Label>Split between</Label>
          <Choice options={[1, 2, 3, 4, 5, 6, 7, 8]} selected={d.people} label={(n) => (n === 1 ? 'Just me' : `${n} people`)}
            onSelect={(n) => set({ people: n, ...(Array.from({ length: n }, (_, i) => personId(i + 1)).includes(d.payer) ? {} : { payer: ME }) })} />
          {splitting && (
            <>
              <Small>You are P1. Everyone else is P2, P3 and so on. No names needed.</Small>
              <Label>Who paid</Label>
              <Choice options={members} selected={d.payer} label={personLabel} onSelect={(w) => set({ payer: w })} />
              <Label>How to split</Label>
              <Choice options={SPLIT_METHODS.filter((x) => x !== 'ITEMS' || d.itemised)} selected={d.method} label={(x) => SPLIT_LABEL[x]}
                onSelect={(x) => set({ method: x })} />
              {d.method !== 'EQUAL' && d.method !== 'ITEMS' && members.map((who) => (
                <PixelField key={who} value={d.inputs[who] ?? ''} onChange={(v) => setD((x) => ({ ...x, inputs: { ...x.inputs, [who]: v } }))}
                  label={personLabel(who) + (d.method === 'PERCENT' ? ' (%)' : d.method === 'SHARES' ? ' (shares)' : ` (${cur})`)}
                  keyboard="decimal-pad" placeholder={d.method === 'SHARES' ? '1' : '0'} />
              ))}
              {d.method === 'ITEMS' && <Small>Tap P numbers under each item. None picked = shared by everyone.</Small>}
              {Object.keys(shares).length > 0 && (
                <>
                  <Rule />
                  {members.map((who) => {
                    const mine = d.itemised ? d.items.filter((i) => i.owners.length === 0 || i.owners.includes(who)).map((i) => i.name.trim() || 'item') : []
                    return (
                      <View key={who} style={{ gap: 4 }}>
                        <KeyValue k={personLabel(who) + (who === ME ? ' (you)' : '')} v={money(shares[who] ?? 0, home)} />
                        {mine.length > 0 && <Small>{mine.join(' · ')}</Small>}
                      </View>
                    )
                  })}
                  <Rule />
                  {d.payer === ME
                    ? members.filter((w) => w !== ME && (shares[w] ?? 0) > 0).map((w) => <Body key={w}>{personLabel(w)} owes you {money(shares[w] ?? 0, home)}</Body>)
                    : (shares[ME] ?? 0) > 0 && <Body>You owe {personLabel(d.payer)} {money(shares[ME] ?? 0, home)}</Body>}
                </>
              )}
            </>
          )}
        </Window>}

        {s.ocrText != null && (
          <FoldWindow title="Scanned text">
            <Small>Read again with:</Small>
            <Choice<string | null> options={[null, ...providers.map((p) => p.id)]} selected={null}
              label={(id) => providers.find((p) => p.id === id)?.label ?? 'Built-in reader'} onSelect={reread} />
            {rereading && <Small>Reading…</Small>}
            {readError != null && <Small color={Px.red}>! {readError}</Small>}
            <Small>{s.ocrText}</Small>
          </FoldWindow>
        )}
        </Side>

        {errors.map((e, i) => <Text key={i} style={[Type.small, { color: Px.red }]}>! {e}</Text>)}
        <PixelButton text={editing ? 'Save changes' : 'Save expense'} onPress={() => save()} enabled={errors.length === 0} />
        {/* A meal (Food, not groceries) can go straight to Macros: save, then fill in what was eaten. */}
        {d.tripId !== DATE && (d.category === MEAL_CATEGORY || d.items.some((i) => i.category === MEAL_CATEGORY))
          && !(existing && st.meals.some((m) => m.txnId === existing.id)) && (
          <PixelButton text="Save & add to macros" kind="secondary" glyph={Glyphs.food} enabled={errors.length === 0} onPress={() => save((id) => {
            const eaten = d.itemised ? d.items.filter((i) => !i.category || i.category === MEAL_CATEGORY).map((i) => i.name.trim()).filter(Boolean).join(', ') : ''
            setMealFor({ id: newId(), date: d.date, name: eaten || d.merchant.trim(), txnId: id, macros: {} })
          })} />
        )}
        {existing && (
          <PixelButton text="Delete" kind="danger" onPress={() => { store.update((x) => deleteTxn(x, existing.id)); nav.back() }} />
        )}
        {dateTx && <PixelButton text="Delete" kind="danger" onPress={() => { deleteTx(dateTx.id).catch((e) => alert(e.message)); nav.back() }} />}
      </Page>

      {mealFor && <MealDialog st={st} meal={mealFor} onDone={() => { setMealFor(null); nav.back() }} />}
      {pickingFor && (
        <SearchPicker title="Item category" options={st.categories.map((c) => [c, c])} onDismiss={() => setCatFor(null)}
          onPick={(c) => { setItem(pickingFor.key, { category: c }); setCatFor(null) }} />
      )}
    </>
  )
}

/** Multi-select name chips. [options] are (id, label). */
export function Toggles({ options, selected, onToggle }: { options: [string, string][]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([id, label]) => {
        const on = selected.includes(id)
        return (
          <Pressable key={id} role="checkbox" aria-checked={on} aria-label={label} onPress={() => onToggle(id)} style={{ minHeight: 40, justifyContent: 'center' }}>
            <Chip text={(on ? '✓ ' : '') + label} color={on ? Px.blue : Px.creamLight} />
          </Pressable>
        )
      })}
    </View>
  )
}
