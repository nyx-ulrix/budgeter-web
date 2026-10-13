import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { addDays, Day, daysBetween, Pace, PACE_LABEL, todayIso } from '../core/budget'
import { allocate, money } from '../core/money'
import { activeTrip, currency, dailyImpact, liveTxns, snapshot, Snapshot, tripFund, tripSpent } from '../data/ledger'
import { Planned } from '../data/state'
import { useAppState } from '../data/store'
import { useScanner } from '../ocr/scanner'
import { ArtImg, Body, Chip, FoldWindow, Label, Page, PixelButton, PixelProgress, Small, Window, frame, Avatar, Side } from '../ui/components'
import { MonthBar, Swatch } from '../ui/MonthBar'
import { useNav } from '../ui/nav'
import { Glyphs, Px, Type } from '../ui/theme'
import { PlannedRow, ReserveDialog } from './BudgetScreen'
import { TxnRow } from './TxnsScreen'
import { useDate } from '../date/client'

export const paceColor = (p: Pace): string => (p === 'ON_TRACK' ? Px.green : p === 'SLIGHTLY_OVER' ? Px.orange : Px.red)

/** Brown normally, orange once today's budget is used and you're into saved-up money, red past that too. */
export const dayColor = (d: Day): string => (d.remaining < 0 ? Px.red : d.dailyLeft < 0 ? Px.orange : Px.brown)

export const paceSymbol = (p: Pace): string => (p === 'ON_TRACK' ? '●' : p === 'SLIGHTLY_OVER' ? '▲' : '✖')

export function HomeScreen() {
  const ds = useDate()
  const st = useAppState()
  const nav = useNav()
  const scanner = useScanner()
  const cur = currency(st)
  const snap = snapshot(st)
  const now = todayIso()
  const [reserving, setReserving] = useState<Planned | null>(null)
  const trip = activeTrip(st, now)
  const tripLeft = trip ? tripFund(st, trip.id) - tripSpent(st, trip.id) : 0
  const daysLeft = daysBetween(now, snap.period.end)
  const top = st.planned.filter((p) => p.status === 'OPEN')
    .sort((a, b) => a.priority - b.priority || (a.targetMonth < b.targetMonth ? -1 : a.targetMonth > b.targetMonth ? 1 : 0)).slice(0, 2)
  const recentKey = (t: { date: string; updatedAt: number }) => t.date + String(t.updatedAt).padStart(15, '0')
  const recent = [...liveTxns(st)].sort((a, b) => (recentKey(a) < recentKey(b) ? 1 : recentKey(a) > recentKey(b) ? -1 : 0)).slice(0, 3)

  return (
    <Page>
      {/* Above the fold: today, this month, quick actions. */}
      <Window title="Today.exe">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label>Left to spend today</Label>
            <Text style={[Type.hero, { color: dayColor(snap.day) }]}>{money(snap.day.dailyLeft, cur)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Small>Today's budget {money(snap.day.budget, cur)}</Small>
          <Small>Spent {money(snap.day.spent, cur)}</Small>
        </View>
        <PixelProgress
          fraction={snap.day.budget > 0 ? snap.day.spent / snap.day.budget : snap.day.spent > 0 ? 1 : 0}
          color={snap.day.remaining < 0 ? Px.red : snap.day.dailyLeft < 0 ? Px.yellow : Px.orange}
        />
        <SavedUp snap={snap} cur={cur} />
        <Sparkline today={now} />
      </Window>

      <Window title="This month" header={snap.over ? Px.red : Px.orange}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[Type.body, { flex: 1 }]}>{`${money(snap.spent, cur)} / ${money(snap.spendable, cur)}`}</Text>
          {snap.over ? <Chip text="✖ Over budget" color={Px.red} />
            : snap.dipping ? <Chip text="▲ Dipping into savings" color={Px.yellow} />
              : <Chip text={`${paceSymbol(snap.pace)} ${PACE_LABEL[snap.pace]}`} color={paceColor(snap.pace)} />}
        </View>
        <MonthBar st={st} snap={snap} />
        <Small>{(
          snap.over ? `${money(snap.spent - snap.spendable - snap.target, cur)} over`
            : snap.dipping ? `${money(snap.dipped, cur)} of your ${money(snap.target, cur)} savings target spent`
              : `${money(snap.left, cur)} left` + (snap.target > 0 ? ` · ${money(snap.target, cur)} kept for savings` : '')
        ) + ` · ${daysLeft} days to go · resets ${snap.period.end}`}</Small>
      </Window>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PixelButton text="Expense" onPress={() => nav.go({ kind: 'expense' })} glyph={Glyphs.plus} style={{ flex: 1 }} />
        <PixelButton text="Scan" onPress={scanner.camera} glyph={Glyphs.camera} style={{ flex: 1 }} />
      </View>

      {/* Secondary, folded (a side column on wide screens). */}
      <Side>
      {trip && (
        <FoldWindow title={`Trip: ${trip.name}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ArtImg name="icon_airplane" size={24} />
            <Body style={{ flex: 1 }} color={tripLeft < 0 ? Px.red : Px.brown}>{money(tripLeft, cur)} left in trip fund</Body>
          </View>
          <Small>Trip spending doesn't touch your daily budget.</Small>
          <PixelButton text="Open trip" onPress={() => nav.go({ kind: 'trip', id: trip.id })} kind="secondary" style={{ alignSelf: 'flex-start' }} />
        </FoldWindow>
      )}

      {ds.phase === 'ready' && (
        <FoldWindow title="Date budget">
          <Body color={ds.left < 0 ? Px.red : Px.brown}>{money(ds.left, cur)} left to spend on dates</Body>
          <PixelButton text="Open date budget" onPress={() => nav.go({ kind: 'date' })} kind="secondary" style={{ alignSelf: 'flex-start' }} />
        </FoldWindow>
      )}

      <FoldWindow title="Planned purchases">
        {top.length === 0 && <Small>Nothing planned yet. Add something you're saving for.</Small>}
        {top.map((p) => <PlannedRow key={p.id} p={p} onReserve={() => setReserving(p)} />)}
        <PixelButton text="+ Planned item" onPress={() => nav.go({ kind: 'planned' })} kind="secondary" art="icon_star" style={{ alignSelf: 'flex-start' }} />
      </FoldWindow>

      <FoldWindow title="Recent">
        {recent.length === 0 && <Small>No spending yet.</Small>}
        {recent.map((t) => <TxnRow key={t.id} txn={t} />)}
      </FoldWindow>

      <Small>Savings totals are kept off this screen. See Budget → Savings.</Small>
      </Side>

      {reserving && <ReserveDialog p={reserving} onDismiss={() => setReserving(null)} />}
    </Page>
  )
}

/**
 * Money saved up this month: what's set aside as savings (savings target and savings lines, less anything dipped into),
 * plus what earlier days left unspent. The unspent part can be used any day this month; at month end it all becomes savings.
 */
function SavedUp({ snap, cur }: { snap: Snapshot; cur: string }) {
  const day = snap.day
  const aside = Math.max(snap.keptAside, 0)
  const unused = day.bonusLeft
  // Block bar split by where the savings came from: set aside at the start of the month vs unused from earlier days.
  const blocks = 20
  const [a, u] = aside + unused > 0 ? allocate(blocks, [aside, unused]) : [0, 0]
  const colors = Array.from({ length: blocks }, (_, i) => (i < a ? Px.blue : i < a + u ? Px.green : Px.creamLight))
  return (
    <View style={[frame(Px.cream, Px.brown, 2), { width: '100%', paddingHorizontal: 10, paddingVertical: 8, gap: 6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ArtImg name="icon_coin" size={22} />
        <Label style={{ flex: 1 }}>Saved up this month</Label>
        <Text style={[Type.number, { color: snap.savedUp > 0 ? Px.green : Px.muted }]}>{money(snap.savedUp, cur)}</Text>
      </View>
      <View role="img" aria-label={`${money(aside, cur)} set aside, ${money(unused, cur)} unused from earlier days`}>
        <View aria-hidden><PixelProgress fraction={(a + u) / blocks} colors={colors} blocks={blocks} /></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Swatch color={Px.blue} /><Small>Set aside {money(aside, cur)}</Small>
        <Swatch color={Px.green} /><Small>Unused {money(unused, cur)}</Small>
      </View>
      {day.bonus > 0 && day.dailyLeft < 0 ? <Small>Using unused money today: {money(day.bonus - day.bonusLeft, cur)} of {money(day.bonus, cur)}.</Small>
        : day.bonus <= 0 ? <Small>Spend less than today's budget and the rest builds up here.</Small> : null}
    </View>
  )
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Spent per day for the last 3 days as small bars. */
function Sparkline({ today }: { today: string }) {
  const st = useAppState()
  const days = [2, 1, 0].map((n) => addDays(today, -n))
  const spent = days.map((d) => liveTxns(st).filter((t) => t.tripId == null && t.date === d).reduce((s, t) => s + dailyImpact(st, t), 0))
  const max = Math.max(...spent, 1)
  return (
    <View role="img" aria-label={'Last three days: ' + spent.map((v) => money(v, currency(st))).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      <Label>Last 3 days</Label>
      {days.map((d, i) => (
        <View key={d} style={{ alignItems: 'center' }} aria-hidden>
          <View style={{ width: 18, height: 4 + Math.trunc((24 * spent[i]) / max), backgroundColor: i === 2 ? Px.orange : Px.blue }} />
          <Text style={Type.label}>{WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}</Text>
        </View>
      ))}
    </View>
  )
}
