import React, { useState } from 'react'
import { daysBetween, todayIso } from '../core/budget'
import { div, money, parseMoney, plain } from '../core/money'
import { buyNow, deletePlanned, savePlanned } from '../data/actions'
import { currency, periodOf, reserved, snapshot } from '../data/ledger'
import { normPlanned } from '../data/state'
import { store, useAppState } from '../data/store'
import { Body, Choice, KeyValue, Label, Page, PageHeader, PixelButton, PixelField, PixelProgress, Small, Window } from '../ui/components'
import { useNav } from '../ui/nav'
import { Px } from '../ui/theme'
import { ReserveDialog } from './BudgetScreen'

const PRIORITY: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

/** This calendar month and the next 12, as "2026-10". */
function nextMonths(): string[] {
  const now = new Date()
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export function PlannedScreen({ id }: { id?: string }) {
  const st = useAppState()
  const nav = useNav()
  const cur = currency(st)
  const existing = id == null ? undefined : st.planned.find((p) => p.id === id)
  const [name, setName] = useState(existing?.name ?? '')
  const [price, setPrice] = useState(existing ? plain(existing.price, cur) : '')
  const [priority, setPriority] = useState(existing?.priority ?? 2)
  const [target, setTarget] = useState(existing?.targetMonth ?? periodOf(st).key)
  const [category, setCategory] = useState('Shopping')
  const [reserving, setReserving] = useState(false)
  const priceV = parseMoney(price, cur)
  const ok = name.trim() !== '' && priceV != null && priceV > 0
  const months = [...new Set([...nextMonths(), target])].sort()
  const res = existing ? reserved(st, existing.id) : 0
  const full = { alignSelf: 'stretch' } as const

  return (
    <Page>
      <PageHeader title={existing == null ? 'Plan to buy' : existing.name} />
      <Window title="Item">
        <PixelField value={name} onChange={setName} label="What" />
        <PixelField value={price} onChange={setPrice} label={`Price (${cur})`} keyboard="decimal-pad" />
        <Label>Priority</Label>
        <Choice options={[1, 2, 3]} selected={priority} label={(n) => PRIORITY[n]} onSelect={setPriority} />
        <Label>Target month</Label>
        <Choice options={months} selected={target} label={(m) => m} onSelect={setTarget} />
        {existing != null && priceV != null && priceV < res && (
          <Small color={Px.brown}>You've set aside {money(res, cur)}. Saving frees the {money(res - priceV, cur)} above the new price.</Small>
        )}
        <PixelButton text={existing == null ? 'Save' : 'Save changes'} style={full} enabled={ok} onPress={() => {
          const base = existing ?? normPlanned({ name: '', price: 0, targetMonth: target })
          store.update((s) => savePlanned(s, { ...base, name: name.trim(), price: priceV!, priority, targetMonth: target }))
          nav.back()
        }} />
      </Window>

      {existing != null && existing.status === 'OPEN' && (() => {
        const left = Math.max(existing.price - res, 0)
        const daysLeft = Math.max(daysBetween(todayIso(), snapshot(st).period.end), 1)
        return <>
          <Window title="Progress">
            <PixelProgress fraction={res / existing.price} color={Px.blue} />
            <KeyValue k="Reserved" v={money(res, cur)} />
            <KeyValue k="Still to reserve" v={money(left, cur)} />
            <Small>Reserving the rest now would lower your daily budget by about {money(div(left, daysLeft), cur)}.</Small>
            <PixelButton text="Reserve / change amount" onPress={() => setReserving(true)} kind="secondary" style={full} />
          </Window>
          <Window title="Buy now">
            <Body>Records {money(existing.price, cur)} as spent today. The {money(res, cur)} already reserved isn't counted twice.</Body>
            <Label>Category</Label>
            <Choice options={st.categories} selected={category} label={(c) => c} onSelect={setCategory} />
            <PixelButton text="Buy now" style={full} onPress={() => { store.update((s) => buyNow(s, existing, category)); nav.back() }} />
          </Window>
        </>
      })()}

      {existing != null && (
        <PixelButton text={existing.status === 'OPEN' ? 'Delete (frees reserved money)' : 'Delete'} kind="danger" style={full}
          onPress={() => { store.update((s) => deletePlanned(s, existing.id)); nav.back() }} />
      )}

      {reserving && existing != null && <ReserveDialog p={existing} onDismiss={() => setReserving(false)} />}
    </Page>
  )
}
