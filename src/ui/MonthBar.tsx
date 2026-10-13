import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { money } from '../core/money'
import { currency, Snapshot } from '../data/ledger'
import { AppState, DEFAULT_CATEGORIES } from '../data/state'
import { Body, KeyValue, PixelDialog, Rule, Small } from './components'
import { Px, Type } from './theme'

/** Java's String.hashCode, so extra categories get the same colour as in the Android app. */
const javaHash = (s: string) => [...s].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)

/** One colour per category, kept inside the pixel palette's warm family where possible. Red is reserved for "over". */
export const CategoryColors = {
  FIXED: '#7A6248',
  OVER: '#C93721',
  DIP: '#F2C230', // dipping into the savings target
  TARGET_ZONE: 'rgba(242,194,48,0.35)', // the untouched savings target, faint yellow
  defaults: ['#F4512A', '#2459A6', '#4A9A78', '#6A5ACD', '#10172F', '#9A4A8C', '#3FA7C0', '#8C7B5A'],
  extras: ['#B86B3A', '#5B6F2E', '#D46A8F', '#2F8F8F', '#8A5A2B', '#4F6D7A'],
  of(category: string): string {
    const i = DEFAULT_CATEGORIES.indexOf(category)
    const n = this.extras.length
    return i >= 0 ? this.defaults[i] : this.extras[((javaHash(category) % n) + n) % n]
  },
}

export interface Segment { label: string; amount: number; color: string }

/**
 * The month as one bar: fixed costs, then spending by category, then what's left of the budget.
 * When spending passes the budget the bar is all red.
 */
export function monthSegments(st: AppState, snap: Snapshot): Segment[] {
  const order = [...st.categories, ...Object.keys(snap.categories).filter((k) => !st.categories.includes(k))]
  return [
    { label: 'Fixed costs', amount: snap.fixed, color: CategoryColors.FIXED },
    ...order.filter((c) => (snap.categories[c] ?? 0) > 0).map((c) => ({ label: c, amount: snap.categories[c], color: CategoryColors.of(c) })),
  ]
}

/** Denominator for [monthSegments]: fixed costs plus the budget and savings target, or plus spending once it's over. */
export const barTotal = (snap: Snapshot): number => Math.max(snap.fixed + Math.max(snap.spendable + snap.target, snap.spent), 1)

/** What's left of the bar after spending: free money, then the untouched part of the savings target. */
export const freeAndTarget = (snap: Snapshot): [number, number] => [Math.max(snap.spendable - snap.spent, 0), snap.target - snap.dipped]

export const MONTH_BLOCKS = 30

/** Red when over budget, yellow when dipping into savings, else null. */
export const alertColor = (snap: Snapshot): string | null => (snap.over ? CategoryColors.OVER : snap.dipping ? CategoryColors.DIP : null)

/**
 * The month bar as blocks, like every other progress bar: each block takes the colour of whatever covers its
 * middle (fixed costs, a category, the faint savings-target zone) or null when it's still free money.
 * Filled blocks turn to the alert colour when dipping into savings or over budget.
 */
export function monthBlocks(st: AppState, snap: Snapshot, n = MONTH_BLOCKS): (string | null)[] {
  const total = barTotal(snap)
  const alert = alertColor(snap)
  const [free, target] = freeAndTarget(snap)
  const bands: [number, string | null][] = [
    ...monthSegments(st, snap).filter((s) => s.amount > 0).map((s): [number, string | null] => [s.amount, alert ?? s.color]),
    [free, null], [target, CategoryColors.TARGET_ZONE],
  ]
  return Array.from({ length: n }, (_, i) => {
    const mid = ((i + 0.5) / n) * total
    let acc = 0
    return bands.find(([amt]) => { acc += amt; return mid < acc })?.[1] ?? null
  })
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Hard on/off pulse (1 ↔ 0.35 every 900 ms) while [on]; always 1 when off or the user prefers reduced motion. */
function usePulse(on: boolean): number {
  const [dim, setDim] = useState(false)
  useEffect(() => {
    if (!on || reducedMotion()) { setDim(false); return }
    const id = setInterval(() => setDim((d) => !d), 900)
    return () => clearInterval(id)
  }, [on])
  return dim ? 0.35 : 1
}

export const Swatch = ({ color, size = 10, border = 1 }: { color: string; size?: number; border?: number }) =>
  <View aria-hidden style={{ width: size, height: size, borderWidth: border, borderColor: Px.brown, backgroundColor: color }} />

/** Colour-coded month bar with legend. Pulses yellow when dipping into savings, red when over budget, in hard steps. */
export function MonthBar({ st, snap, legend = true }: { st: AppState; snap: Snapshot; legend?: boolean }) {
  const [details, setDetails] = useState(false)
  const cur = currency(st)
  const segs = monthSegments(st, snap)
  const alert = alertColor(snap)
  const pulse = usePulse(alert != null)
  const label = (snap.over ? 'Over budget. ' : snap.dipping ? 'Dipping into savings. ' : '') +
    segs.map((s) => `${s.label} ${money(s.amount, cur)}`).join(', ') + `. ${money(Math.max(snap.left, 0), cur)} left`
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => setDetails(true)} role="button" aria-label={label} accessibilityHint="Show spending by category"
        style={{ width: '100%', height: 22, flexDirection: 'row', gap: 2, borderWidth: 3, borderColor: alert ?? Px.brown, backgroundColor: Px.creamLight }}
      >
        {monthBlocks(st, snap).map((c, i) => {
          const filled = c != null && c !== CategoryColors.TARGET_ZONE
          return <View key={i} style={{ flex: 1, height: 16, opacity: filled && alert != null ? pulse : 1, backgroundColor: c ?? Px.cream }} />
        })}
      </Pressable>
      {legend && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 4 }}>
          {segs.filter((s) => s.amount > 0).map((s) => (
            <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Swatch color={s.color} />
              <Text style={Type.small}>{`${s.label} ${money(s.amount, cur)}`}</Text>
            </View>
          ))}
        </View>
      )}
      {details && <MonthDetails st={st} snap={snap} onDismiss={() => setDetails(false)} />}
    </View>
  )
}

/** The month in numbers: fixed costs and each category, with its share and whether it counts toward each day. */
function MonthDetails({ st, snap, onDismiss }: { st: AppState; snap: Snapshot; onDismiss: () => void }) {
  const cur = currency(st)
  const total = barTotal(snap)
  return (
    <PixelDialog title="This month" onDismiss={onDismiss}>
      {monthSegments(st, snap).map((s) => (
        <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Swatch color={s.color} size={14} border={2} />
          <View style={{ flex: 1 }}>
            <Body>{s.label}</Body>
            {st.monthlyCategories.includes(s.label) && <Small>Monthly: spread over the days left</Small>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={Type.body}>{money(s.amount, cur)}</Text>
            <Small>{`${Math.trunc((s.amount * 100) / total)}%`}</Small>
          </View>
        </View>
      ))}
      <Rule />
      <KeyValue k="Spent (not counting fixed)" v={money(snap.spent, cur)} />
      <KeyValue k="Budget" v={money(snap.spendable, cur)} />
      {snap.target > 0 && <KeyValue k="Savings target" v={money(snap.target, cur) + (snap.dipped > 0 ? ` (${money(snap.dipped, cur)} spent)` : '')} />}
      <KeyValue
        k={snap.over ? 'Over by' : snap.dipping ? 'Into savings' : 'Left'}
        v={money(snap.over ? snap.spent - snap.spendable - snap.target : Math.abs(snap.left), cur)}
        color={snap.over ? Px.red : Px.brown}
      />
    </PixelDialog>
  )
}
