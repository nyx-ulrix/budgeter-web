import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import {
  ArtImg, Body, Chip, Choice, CloseButton, DateField, FoldWindow, KeyValue, Label, Page, PageHeader, PickerBox, PixelButton, PixelDialog,
  PixelField, PixelProgress, Rule, SearchPicker, Small, Window, Avatar } from '../ui/components'
import { useNav } from '../ui/nav'
import { store, useAppState } from '../data/store'
import { AppState, TRIP_COST_KINDS, Trip, myShare, normTrip, normTripCost, tripTarget } from '../data/state'
import { TxnRow } from './TxnsScreen'
import { currency, liveTxns, monthsToSave, periodOf, tripFund, tripFundAtStart, tripSpent } from '../data/ledger'
import { addTrip, deleteTrip, deleteTripCost, payTripCost, saveTrip, saveTripCost, setTripMonthly, topUpTrip } from '../data/actions'
import { countries, countryName, currencyOf } from '../data/countries'
import { addDays, daysBetween, isoDate, todayIso } from '../core/budget'
import { div, money, parseMoney, plain } from '../core/money'

const row = { flexDirection: 'row', alignItems: 'center', gap: 8 } as const
const bottomRow = { flexDirection: 'row', alignItems: 'flex-end', gap: 8 } as const

/** [iso] plus [n] months, clamped to the month's last day (LocalDate.plusMonths). */
function plusMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return isoDate(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last))
}

/** Trips list for the Budget tab: what each trip is saving toward, or what's left while you're on it. */
export function TripsWindow() {
  const st = useAppState()
  const nav = useNav()
  const cur = currency(st)
  const [adding, setAdding] = useState(false)
  const today = todayIso()
  return (
    <>
      <FoldWindow title="Trips">
        {st.trips.length === 0 && <Small>Plan a trip's costs and set some money aside each month. Spending on the trip then stays out of your daily budget.</Small>}
        {[...st.trips].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)).map((t) => {
          const started = today >= t.start
          const fund = tripFund(st, t.id)
          const target = tripTarget(t)
          const left = fund - tripSpent(st, t.id)
          return (
            <Pressable key={t.id} role="button" onPress={() => nav.go({ kind: 'trip', id: t.id })} style={[row, { minHeight: 48 }]}>
              <ArtImg name="icon_airplane" size={22} />
              <View style={{ flex: 1, gap: 4 }}>
                <Body>{t.name}</Body>
                <Small>{`${countryName(t.country)} · ${t.start}` + (t.monthly > 0 && !started ? ` · ${money(t.monthly, cur)}/month` : '')}</Small>
                {!started && target > 0 && <PixelProgress fraction={fund / target} color={Px.blue} blocks={12} />}
              </View>
              <Text style={[Type.small, { color: started && left < 0 ? Px.red : Px.brown }]}>
                {started ? money(left, cur) + ' left' : money(fund, cur) + (target > 0 ? ' / ' + money(target, cur) : ' saved')}
              </Text>
            </Pressable>
          )
        })}
        <PixelButton text="+ Trip" onPress={() => setAdding(true)} art="icon_suitcase" />
      </FoldWindow>
      {adding && <TripDialog st={st} existing={null} onDismiss={() => setAdding(false)} />}
    </>
  )
}

/** Create or edit a trip's basics. Costs and saving are set on the trip screen. */
function TripDialog({ st, existing, onDismiss }: { st: AppState; existing: Trip | null; onDismiss: () => void }) {
  const nav = useNav()
  const [name, setName] = useState(existing?.name ?? '')
  const [country, setCountry] = useState(existing?.country ?? st.setup?.country ?? 'US')
  const [start, setStart] = useState(existing?.start ?? plusMonths(todayIso(), 3))
  const [end, setEnd] = useState(existing?.end ?? addDays(plusMonths(todayIso(), 3), 6))
  const [picking, setPicking] = useState(false)
  return (
    <>
      <PixelDialog title={existing ? 'Edit trip' : 'New trip'} onDismiss={onDismiss}>
        <PixelField value={name} onChange={setName} label="Trip name" placeholder="Tokyo 2027" />
        <Label>Destination</Label>
        <PickerBox text={`${countryName(country)} · ${currencyOf(country)}`} onPress={() => setPicking(true)} />
        <DateField label="From" value={start} onChange={setStart} />
        <DateField label="To" value={end} onChange={setEnd} />
        <PixelButton
          text={existing ? 'Save' : 'Create and plan costs'}
          enabled={!!name.trim() && end >= start}
          onPress={() => {
            const t = { ...(existing ?? normTrip({})), name: name.trim(), country, currency: currencyOf(country), start, end }
            if (existing) store.update((s) => saveTrip(s, t))
            else { store.update((s) => addTrip(s, t)); nav.go({ kind: 'trip', id: t.id }) }
            onDismiss()
          }}
        />
      </PixelDialog>
      {picking && (
        <SearchPicker title="Destination" options={countries().map((c) => [c.code, `${c.name} (${c.code})`])}
          onDismiss={() => setPicking(false)} onPick={(c) => { setCountry(c); setPicking(false) }} />
      )}
    </>
  )
}

export function TripScreen({ id }: { id: string }) {
  const st = useAppState()
  const nav = useNav()
  const t = st.trips.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!t) nav.back() }, [t == null]) // also leaves after "Delete trip"
  if (!t) return null
  const cur = currency(st)
  const today = todayIso()
  const started = today >= t.start
  const fund = tripFund(st, id)
  const spent = tripSpent(st, id)
  const left = fund - spent
  const daysLeft = Math.max(daysBetween(today > t.start ? today : t.start, t.end) + 1, 0)
  const list = liveTxns(st).filter((x) => x.tripId === id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <Page>
      <PageHeader title={t.name} />
      <Small>{`${countryName(t.country)} · pays in ${t.currency} · ${t.start} to ${t.end}`}</Small>

      <CostsWindow st={st} t={t} />
      {!started && <SavingWindow key={t.monthly} st={st} t={t} />}

      <Window title={started ? 'Trip fund' : 'Fund so far'}>
        <View style={[row, { gap: 10 }]}>
          <Avatar size={48} />
          <View style={{ flex: 1 }}>
            <Label>Left in fund</Label>
            <Text style={[Type.hero, { color: left < 0 ? Px.red : Px.brown }]}>{money(left, cur)}</Text>
          </View>
        </View>
        <PixelProgress fraction={fund > 0 ? spent / fund : spent > 0 ? 1 : 0} color={left < 0 ? Px.red : Px.orange} />
        <KeyValue k="Set aside" v={money(fund, cur)} />
        <KeyValue k="Spent" v={money(spent, cur)} />
        {started && daysLeft > 0 && <KeyValue k={`Per day left (${daysLeft} days)`} v={money(div(Math.max(left, 0), daysLeft), cur)} />}
        {left < 0 && <Chip text="✖ Over fund" color={Px.red} />}
        <TopUp t={t} cur={cur} />
      </Window>

      <Window title="Expenses">
        {list.length === 0 && <Small>No trip spending yet.</Small>}
        {list.map((x) => <TxnRow key={x.id} txn={x} />)}
        <PixelButton text="Trip expense" onPress={() => nav.go({ kind: 'expense', tripId: id })} glyph={Glyphs.plus} />
      </Window>
      <PixelButton text="Edit trip" onPress={() => setEditing(true)} kind="secondary" />
      <PixelButton text="Delete trip and its expenses" onPress={() => store.update((s) => deleteTrip(s, id))} kind="danger" />
      {editing && <TripDialog st={st} existing={t} onDismiss={() => setEditing(false)} />}
    </Page>
  )
}

/** Planned costs: the trip's target. Each can be marked paid, which records it as a trip expense. */
function CostsWindow({ st, t }: { st: AppState; t: Trip }) {
  const cur = currency(st)
  const live = liveTxns(st)
  const spentByKind: Record<string, number> = {}
  for (const x of live.filter((x) => x.tripId === t.id)) spentByKind[x.category] = (spentByKind[x.category] ?? 0) + myShare(x)
  const kinds = [...new Set(t.costs.map((c) => c.kind))].filter((k) => (spentByKind[k] ?? 0) > 0)
  return (
    <Window title="Planned costs">
      {t.costs.length === 0 && <Small>List what the trip will cost: flights, stay, food, activities. Together they set the savings target.</Small>}
      {t.costs.map((c) => {
        const paid = c.paidTxnId != null && live.some((x) => x.id === c.paidTxnId)
        return (
          <View key={c.id} style={[row, { gap: 6 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body>{c.name}</Body>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip text={c.kind} color={Px.cream} />
                {paid && <Chip text="✓ Paid" color={Px.green} />}
              </View>
            </View>
            <Body>{money(c.amount, cur)}</Body>
            {!paid && <PixelButton text="Pay" onPress={() => store.update((s) => payTripCost(s, t, c))} kind="secondary" />}
            <CloseButton onPress={() => store.update((s) => deleteTripCost(s, t.id, c.id))} />
          </View>
        )
      })}
      {t.costs.length > 0 && <>
        <Rule />
        <KeyValue k="Planned total" v={money(tripTarget(t), cur)} />
        {kinds.length > 0 && <Label>Planned vs spent</Label>}
        {kinds.map((k) => {
          const planned = t.costs.filter((c) => c.kind === k).reduce((a, c) => a + c.amount, 0)
          const s = spentByKind[k] ?? 0
          return <KeyValue key={k} k={k} v={`${money(s, cur)} / ${money(planned, cur)}`} color={s > planned ? Px.red : Px.brown} />
        })}
      </>}
      <AddCost t={t} cur={cur} />
      <Small>"Pay" records the cost as a trip expense today, for things like flights booked early.</Small>
    </Window>
  )
}

function AddCost({ t, cur }: { t: Trip; cur: string }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState('Flights')
  const v = parseMoney(amount, cur)
  return (
    <>
      <Choice options={TRIP_COST_KINDS} selected={kind} label={(k) => k} onSelect={setKind} />
      <View style={[bottomRow, { gap: 6 }]}>
        <PixelField value={name} onChange={setName} label="Cost" placeholder={kind} style={{ flex: 1.4 }} />
        <PixelField value={amount} onChange={setAmount} label={`Amount (${cur})`} keyboard="decimal-pad" style={{ flex: 1 }} />
        <PixelButton text="+" enabled={v != null && v > 0} onPress={() => {
          store.update((s) => saveTripCost(s, t.id, normTripCost({ name: name.trim() || kind, amount: v!, kind })))
          setName(''); setAmount('')
        }} />
      </View>
    </>
  )
}

/** Monthly set-aside until the trip, with a suggested amount that covers the planned costs in time. */
function SavingWindow({ st, t }: { st: AppState; t: Trip }) {
  const cur = currency(st)
  const fund = tripFund(st, t.id)
  const target = tripTarget(t)
  const months = monthsToSave(st, t)
  const stillNeeded = Math.max(target - fund, 0)
  const suggested = months > 0 ? div(stillNeeded + months - 1, months) : stillNeeded
  const [text, setText] = useState(t.monthly > 0 ? plain(t.monthly, cur) : '')
  const v = text.trim() ? parseMoney(text, cur) : 0
  const lastMonth = periodOf(st, t.start).key
  const atStart = tripFundAtStart(st, t)
  return (
    <Window title="Saving for it">
      {target > 0 ? <>
        <PixelProgress fraction={fund / target} color={Px.blue} />
        <KeyValue k="Saved so far" v={`${money(fund, cur)} / ${money(target, cur)}`} />
        <KeyValue k="Still needed" v={money(stillNeeded, cur)} />
      </> : <KeyValue k="Saved so far" v={money(fund, cur)} />}
      <KeyValue k="Months to save" v={`${months} (until ${lastMonth})`} />
      {target > 0 && months > 0 && <Body>Set aside {money(suggested, cur)} a month to cover it.</Body>}
      <View style={bottomRow}>
        <PixelField value={text} onChange={setText} label={`Set aside per month (${cur})`} keyboard="decimal-pad" placeholder="0.00"
          error={v == null ? 'Not a number' : null} style={{ flex: 1 }} />
        <PixelButton text="Set" enabled={v != null && v >= 0 && v !== t.monthly} onPress={() => store.update((s) => setTripMonthly(s, t, v!))} />
      </View>
      {target > 0 && months > 0 && suggested !== t.monthly && (
        <PixelButton text={`Use ${money(suggested, cur)}`} kind="secondary" onPress={() => store.update((s) => setTripMonthly(s, t, suggested))} />
      )}
      {t.monthly > 0 && <>
        <Small>Comes off each month's spendable money until {lastMonth}, and stops once the costs are covered.</Small>
        {target > 0 && atStart < target
          ? <Small color={Px.red}>At this rate you'll have {money(atStart, cur)} by the trip, {money(target - atStart, cur)} short.</Small>
          : target > 0 ? <Small color={Px.green}>On track to have it all by the trip.</Small> : null}
      </>}
    </Window>
  )
}

/** One-off top-up from this month. */
function TopUp({ t, cur }: { t: Trip; cur: string }) {
  const [amount, setAmount] = useState('')
  const v = parseMoney(amount, cur)
  return (
    <View style={bottomRow}>
      <PixelField value={amount} onChange={setAmount} label={`Add a one-off amount now (${cur})`} keyboard="decimal-pad" style={{ flex: 1 }} />
      <PixelButton text="Add" enabled={v != null && v > 0} onPress={() => { store.update((s) => topUpTrip(s, t, v!)); setAmount('') }} />
    </View>
  )
}
