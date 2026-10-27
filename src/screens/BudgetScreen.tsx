import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { addDays, daysBetween, nextPeriod, prevPeriod, todayIso } from '../core/budget'
import { digits, div, money, parseMoney, plain } from '../core/money'
import { addLine, editPlan, removeLine, setReserved, isSpentReserve } from '../data/actions'
import {
  available, currency, monthSaved, periodFromKey, periodOf, planFor, planTotal, reserved, savedToDate, savingsHistory, snapshot, spendable, spent,
} from '../data/ledger'
import { AppState, LINE_KINDS, LineKind, Plan, Planned, normLine } from '../data/state'
import { store, useAppState } from '../data/store'
import {
  ArtImg, Body, CloseButton, FoldWindow, KeyValue, Label, Page, PixelButton, PixelDialog, PixelField, PixelProgress, PixelSlider, Rule, Small, Window, Side } from '../ui/components'
import { useNav } from '../ui/nav'
import { Px, Type } from '../ui/theme'
import { TripsWindow } from './TripScreen'
import { DateBudgetFold } from './DateScreen'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthName = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`

/**
 * The last 12 finished months up to [upTo]: a bar each (green saved, red went over) around a zero line,
 * then the same months newest first with the running total.
 */
function PastMonths({ st, upTo, cur }: { st: AppState; upTo: string; cur: string }) {
  const months = savingsHistory(st).filter((m) => m.key <= upTo).slice(-12)
  if (months.length === 0) return <Small>Past months show here once your first month ends.</Small>
  const up = Math.max(...months.map((m) => m.saved), 0)
  const down = Math.max(...months.map((m) => -m.saved), 0)
  const height = 72
  const scale = height / Math.max(up + down, 1)
  return (
    <View style={{ gap: 8 }}>
      <Label>Past months</Label>
      <View role="img" aria-label={'Saved per month: ' + months.map((m) => `${monthName(m.key)} ${money(m.saved, cur)}`).join(', ')}
        style={{ flexDirection: 'row', gap: 4 }}>
        {months.map((m) => (
          <View key={m.key} style={{ flex: 1, maxWidth: 44, alignItems: 'stretch' }} aria-hidden>
            <View style={{ height: up * scale, justifyContent: 'flex-end' }}>
              {m.saved > 0 && <View style={{ height: Math.max(m.saved * scale, 2), backgroundColor: Px.green }} />}
            </View>
            <View style={{ height: 2, backgroundColor: Px.brown }} />
            <View style={{ height: down * scale }}>
              {m.saved < 0 && <View style={{ height: Math.max(-m.saved * scale, 2), backgroundColor: Px.red }} />}
            </View>
            <Text style={[Type.label, { textAlign: 'center' }]}>{MONTHS[Number(m.key.slice(5)) - 1][0]}</Text>
          </View>
        ))}
      </View>
      {months.toReversed().map((m) => (
        <View key={m.key} style={{ ...row, gap: 8 }}>
          <Body style={{ flex: 1 }}>{monthName(m.key)}</Body>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[Type.body, { color: m.saved < 0 ? Px.red : Px.green }]}>{(m.saved > 0 ? '+' : '') + money(m.saved, cur)}</Text>
            <Small>{'Total ' + money(m.total, cur)}</Small>
          </View>
        </View>
      ))}
    </View>
  )
}

/** Compose's remember(keys) { init }: state that resets to [init] whenever any of [deps] changes. */
function useKeyed<T>(init: () => T, deps: unknown[]): [T, (v: T) => void] {
  const [s, set] = useState(() => ({ deps, v: init() }))
  if (deps.some((d, i) => !Object.is(d, s.deps[i]))) {
    const next = { deps, v: init() }
    set(next)
    return [next.v, (v) => set({ deps, v })]
  }
  return [s.v, (v) => set({ deps, v })]
}

const row = { flexDirection: 'row', alignItems: 'center' } as const
const fieldRow = { flexDirection: 'row', alignItems: 'flex-end', gap: 8 } as const
const wrap = { alignSelf: 'flex-start' } as const

export function BudgetScreen() {
  const st = useAppState()
  const nav = useNav()
  const cur = currency(st)
  const [key, setKey] = useState(() => periodOf(st).key)
  const p = periodFromKey(st, key)
  const plan = planFor(st, key)
  const [reserving, setReserving] = useState<Planned | null>(null)
  const setAside = plan.lines.filter((l) => (l.kind === 'RESERVE' && !isSpentReserve(st, l)) || l.kind === 'TRIP_FUND')
  const open = st.planned.filter((x) => x.status === 'OPEN')
    .sort((a, b) => a.priority - b.priority || (a.targetMonth < b.targetMonth ? -1 : a.targetMonth > b.targetMonth ? 1 : 0))
  const ended = p.end <= todayIso()
  const wholeBudget = monthSaved(st, key) + spent(st, p) - Math.max(spent(st, p), spendable(st, key))

  return (
    <Page>
      <View style={{ ...row, gap: 8 }}>
        <PixelButton text="<" onPress={() => setKey(prevPeriod(p).key)} kind="secondary" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={Type.hero}>{key}</Text>
          <Small>{`${p.start} to ${addDays(p.end, -1)}`}</Small>
        </View>
        <PixelButton text=">" onPress={() => setKey(nextPeriod(p).key)} kind="secondary" />
      </View>

      <BudgetWindow st={st} pkey={key} plan={plan} cur={cur} />

      <IncomeWindow pkey={key} plan={plan} cur={cur} />
      <LinesWindow title="Extra money" kind="EXTRA" pkey={key} plan={plan} cur={cur} hint="Added mid-month: gifts, side jobs, refunds." />
      <LinesWindow title="Fixed costs" kind="FIXED" pkey={key} plan={plan} cur={cur} hint="Taken off first: rent, phone, subscriptions. Copied to next month." />

      {/* The only place savings totals are shown. */}
      <FoldWindow title="Savings">
        <View style={{ ...row, gap: 10 }}>
          <ArtImg name="icon_money_bag" size={28} />
          <View style={{ flex: 1, gap: 4 }}>
            <KeyValue k="Saved to date" v={money(savedToDate(st, key), cur)} />
            {plan.savingsTarget > 0 && <KeyValue k="Target this month" v={money(plan.savingsTarget, cur)} />}
            {ended ? <KeyValue k="Saved this month" v={money(monthSaved(st, key), cur)} /> : <>
              <KeyValue k="If you stop spending now" v={money(monthSaved(st, key), cur)} />
              <KeyValue k="If you spend your budget" v={money(wholeBudget, cur)} color={wholeBudget < 0 ? Px.red : Px.brown} />
            </>}
          </View>
        </View>
        <Small>Whatever you don't spend becomes savings when the month ends, including money you never budgeted. A month that goes over takes it back out.</Small>
        <PastMonths st={st} upTo={key} cur={cur} />
      </FoldWindow>

      <Side>
      {setAside.length > 0 && (
        <FoldWindow title="Set aside this month">
          {/* One row per item or trip: each Reserve press is its own dated line, shown here as one total. */}
          {Object.values(Object.groupBy(setAside, (l) => l.plannedId ?? l.tripId ?? l.id)).map((group) => {
            const l = group![0]
            return (
              <View key={l.id} style={row}>
                <Body style={{ flex: 1 }}>{`${LINE_KINDS[l.kind].label}: ${l.name}`}</Body>
                <Text style={Type.body}>{money(group!.reduce((a, x) => a + x.amount, 0), cur)}</Text>
                <CloseButton onPress={() => store.update((s) => group!.reduce((acc, x) => removeLine(acc, key, x.id), s))} />
              </View>
            )
          })}
          <Small>Removing one gives the money back to this month.</Small>
        </FoldWindow>
      )}

      <TripsWindow />
      <DateBudgetFold period={p} />

      <FoldWindow title="Planned purchases">
        {open.length === 0 && <Small>Add things you want to buy later. Reserve money bit by bit, or buy now.</Small>}
        {open.map((pl) => (
          <React.Fragment key={pl.id}>
            <PlannedRow p={pl} onReserve={() => setReserving(pl)} />
            <Rule />
          </React.Fragment>
        ))}
        <PixelButton text="+ Planned item" onPress={() => nav.go({ kind: 'planned' })} art="icon_star" style={wrap} />
        <Small>Bought items move to Txns as an expense.</Small>
      </FoldWindow>
      </Side>

      {reserving && <ReserveDialog p={reserving} onDismiss={() => setReserving(null)} />}
    </Page>
  )
}

/** The monthly budget setting. Shows only what's spendable; the earnings behind it are in the windows below. */
function BudgetWindow({ st, pkey, plan, cur }: { st: AppState; pkey: string; plan: Plan; cur: string }) {
  const p = periodFromKey(st, pkey)
  const avail = available(st, pkey)
  const spend = spendable(st, pkey)
  const sp = spent(st, p)
  const [text, setText] = useKeyed(() => (plan.budget != null ? plain(plan.budget, cur) : ''), [pkey, plan.budget])
  const v = text.trim() === '' ? null : parseMoney(text, cur)
  const room = avail + planTotal(plan, 'RESERVE') // reservations come off the budget, so they don't count against it here
  const [targetText, setTargetText] = useKeyed(() => (plan.savingsTarget > 0 ? plain(plan.savingsTarget, cur) : ''), [pkey, plan.savingsTarget])
  const tv = targetText.trim() === '' ? 0 : parseMoney(targetText, cur)
  const reserves = plan.budget != null ? planTotal(plan, 'RESERVE') : 0
  const edit = (f: (x: Plan) => Plan) => store.update((s) => editPlan(s, pkey, f))
  return (
    <Window title="Spendable.exe" header={sp > spend + plan.savingsTarget ? Px.red : sp > spend ? Px.yellow : Px.orange}>
      <Label>Spendable this month</Label>
      <Text style={[Type.hero, { color: spend < 0 || sp > spend ? Px.red : Px.brown }]}>{money(spend, cur)}</Text>
      <Small>{`Spent so far ${money(sp, cur)}` + (
        sp > spend + plan.savingsTarget ? ` · over by ${money(sp - spend - plan.savingsTarget, cur)}`
          : sp > spend ? ` · ${money(sp - spend, cur)} into savings` : ''
      )}</Small>
      <View style={fieldRow}>
        <PixelField value={text} onChange={setText} label="Monthly budget (what you plan to spend)" style={{ flex: 1 }} keyboard="decimal-pad"
          placeholder={plain(Math.max(avail, 0), cur)} error={text.trim() !== '' && v == null ? 'Not a number' : null} />
        <PixelButton text="Set" onPress={() => edit((x) => ({ ...x, budget: v! }))} enabled={v != null && v >= 0 && v !== plan.budget} />
      </View>
      {v != null && v > room && <Small color={Px.red}>That's more than the {money(room, cur)} left after fixed costs and set-asides.</Small>}
      {plan.budget != null && <PixelButton text="Use everything available" onPress={() => edit((x) => ({ ...x, budget: undefined }))} kind="secondary" style={wrap} />}
      <Rule />
      <View style={fieldRow}>
        <PixelField value={targetText} onChange={setTargetText} label="Savings target (kept aside first)" style={{ flex: 1 }} keyboard="decimal-pad"
          placeholder="0.00" error={tv == null ? 'Not a number' : null} />
        <PixelButton text="Set" onPress={() => edit((x) => ({ ...x, savingsTarget: tv! }))} enabled={tv != null && tv >= 0 && tv !== plan.savingsTarget} />
      </View>
      <Small color={Px.brown}>{`${money(plan.budget ?? avail, cur)} budget` + (reserves > 0 ? ` − ${money(reserves, cur)} reserved` : '') +
        ` − ${money(plan.savingsTarget, cur)} savings target = ${money(spend, cur)} to spend.`}</Small>
      <Small>The target comes off what you can spend straight away. Spending past that dips into it (the bar pulses yellow); past the target too is over budget (red). Both carry over to the next months. Anything else unspent also becomes savings.</Small>
    </Window>
  )
}

function IncomeWindow({ pkey, plan, cur }: { pkey: string; plan: Plan; cur: string }) {
  const [text, setText] = useKeyed(() => plain(plan.income, cur), [pkey, plan.income])
  const v = parseMoney(text, cur)
  return (
    <FoldWindow title="Money in">
      <View style={fieldRow}>
        <PixelField value={text} onChange={setText} label="Money in each month (pay, allowance)" style={{ flex: 1 }} keyboard="decimal-pad"
          error={v == null ? 'Not a number' : null} />
        <PixelButton text="Set" onPress={() => store.update((s) => editPlan(s, pkey, (x) => ({ ...x, income: v! })))} enabled={v != null && v !== plan.income} />
      </View>
      <Small>Carries over to following months until you change it.</Small>
    </FoldWindow>
  )
}

function LinesWindow({ title, kind, pkey, plan, cur, hint }: { title: string; kind: LineKind; pkey: string; plan: Plan; cur: string; hint: string }) {
  return (
    <FoldWindow title={title}>
      <LineEditor kind={kind} pkey={pkey} plan={plan} cur={cur} />
      <Small>{hint}</Small>
    </FoldWindow>
  )
}

/** List of lines of one kind with remove buttons, plus an add row. */
function LineEditor({ kind, pkey, plan, cur }: { kind: LineKind; pkey: string; plan: Plan; cur: string }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const v = parseMoney(amount, cur)
  return <>
    {plan.lines.filter((l) => l.kind === kind).map((l) => (
      <View key={l.id} style={row}>
        <Body style={{ flex: 1 }}>{l.name}</Body>
        <Text style={Type.body}>{money(l.amount, cur)}</Text>
        <CloseButton onPress={() => store.update((s) => removeLine(s, pkey, l.id))} />
      </View>
    ))}
    <View style={{ ...fieldRow, gap: 6 }}>
      <PixelField value={name} onChange={setName} label="Name" style={{ flex: 1.4 }} />
      <PixelField value={amount} onChange={setAmount} label="Amount" style={{ flex: 1 }} keyboard="decimal-pad" />
      <PixelButton text="+" onPress={() => {
        store.update((s) => addLine(s, pkey, normLine({ kind, name: name.trim(), amount: v! })))
        setName(''); setAmount('')
      }} enabled={name.trim() !== '' && v != null && v > 0} />
    </View>
  </>
}

/** One planned purchase with its reserved progress and actions. */
export function PlannedRow({ p, onReserve }: { p: Planned; onReserve: () => void }) {
  const st = useAppState()
  const nav = useNav()
  const cur = currency(st)
  const res = reserved(st, p.id)
  return (
    <View style={{ gap: 6 }}>
      <View style={row}>
        <Body style={{ flex: 1 }}>{p.name}</Body>
        <Text style={Type.body}>{money(p.price, cur)}</Text>
      </View>
      <PixelProgress fraction={p.price > 0 ? res / p.price : 1} color={Px.blue} blocks={12} />
      <Small>{`Reserved ${money(res, cur)} · ${money(Math.max(p.price - res, 0), cur)} to go · for ${p.targetMonth}`}</Small>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <PixelButton text="Reserve" onPress={onReserve} kind="secondary" />
        <PixelButton text="Edit" onPress={() => nav.go({ kind: 'planned', id: p.id })} kind="secondary" />
        <PixelButton text="Buy now" onPress={() => nav.go({ kind: 'planned', id: p.id })} />
      </View>
    </View>
  )
}

/** Set the total put aside for a planned item, by slider or typed. Shows the change to today's budget first. */
export function ReserveDialog({ p, onDismiss }: { p: Planned; onDismiss: () => void }) {
  const st = useAppState()
  const cur = currency(st)
  const res = reserved(st, p.id)
  const max = Math.max(p.price, res)
  const unit = 10 ** digits(cur)
  const [text, setText] = useState(() => plain(res === 0 ? max : res, cur))
  const parsed = parseMoney(text, cur)
  const v = parsed != null && parsed >= 0 && parsed <= max ? parsed : null
  const snap = snapshot(st)
  const daysLeft = Math.max(daysBetween(todayIso(), snap.period.end), 1)
  const thisMonth = planFor(st, snap.period.key).lines.filter((l) => l.plannedId === p.id && l.kind === 'RESERVE').reduce((a, l) => a + l.amount, 0)
  let change = ''
  if (v != null && v !== res) {
    if (v > res) change = `Sets aside ${money(v - res, cur)} more this month. Daily budget down about ${money(div(v - res, daysLeft), cur)}.`
    else {
      const free = res - v
      const back = Math.min(free, thisMonth)
      change = `Frees ${money(free, cur)}.` + (back > 0 ? ` Daily budget up about ${money(div(back, daysLeft), cur)}.` : '') +
        (free > back ? ` ${money(free - back, cur)} goes back to earlier months' savings.` : '')
    }
  }
  return (
    <PixelDialog title={`Reserve: ${p.name}`} onDismiss={onDismiss}>
      <Body>{`Price ${money(p.price, cur)} · set aside ${money(res, cur)}`}</Body>
      <PixelSlider value={v ?? res} onChange={(x) => setText(plain(x, cur))} max={max} step={unit} />
      <PixelField value={text} onChange={setText} label={`Total set aside (${cur})`} keyboard="decimal-pad"
        error={v == null ? `Enter 0 to ${money(max, cur)}` : null} />
      {!!change && <Small color={Px.brown}>{change}</Small>}
      <PixelButton text="Set" onPress={() => { store.update((s) => setReserved(s, p, v!)); onDismiss() }} enabled={v != null && v !== res} />
    </PixelDialog>
  )
}
