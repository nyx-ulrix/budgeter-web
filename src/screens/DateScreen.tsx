import React, { createElement, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import { useNav } from '../ui/nav'
import { Body, Choice, DateField, FoldWindow, Glyph, KeyValue, Label, PixelButton, PixelDialog, PixelField, Rule, Small } from '../ui/components'
import { store, useAppState } from '../data/store'
import { AppState, Line, newId, normTxn } from '../data/state'
import { DATE_TRANSFER, currency, dateContributions, overspendsFor, periodOf, planFor } from '../data/ledger'
import { editPlan, saveTxn } from '../data/actions'
import { money, parseMoney, plain } from '../core/money'
import { inPeriod, Period, todayIso } from '../core/budget'
import { CLIENT_ID, loadGis } from '../sync/google'
import { addTx, create, deleteTx, Draft, join, refresh, setPlan, signIn, updateTx, useDate } from '../date/client'
import { currentStep, EVERY, Every, overdrawn, totals, Tx, withBudget } from '../date/money'

declare const google: any

/** The personal budget line that sets money aside for dates each month (a set-aside, carried over; tag 'date'). */
export const dateLine = (st: AppState, key = periodOf(st).key): Line | undefined => planFor(st, key).lines.find((l) => l.tag === 'date')

/** What the shared budget adds per month on average: weekly ×52/12, fortnightly ×26/12. */
const monthly = (amount: number, every: Every) => Math.round(every === 'week' ? (amount * 52) / 12 : every === 'fortnight' ? (amount * 26) / 12 : amount)

/** Half the pool, rounded up: what's set aside in my budget until I choose another amount. */
const half = (amount: number) => Math.ceil(amount / 2)

/** Sets [amount] aside for dates in my budget from this month on (replacing any earlier amount this month). Not a bank movement. */
function setPoolAside(amount: number) {
  store.update((st) => {
    const key = periodOf(st).key
    return editPlan(st, key, (p) => ({
      ...p,
      lines: [...p.lines.filter((l) => l.tag !== 'date'), ...(amount > 0 ? [{ id: newId(), kind: 'RESERVE' as const, name: 'Date budget', amount, tag: 'date', added: todayIso() }] : [])],
    }))
  })
}

/** Google's own "Sign in with Google" button; hands back an ID token for the date budget's sign-in. */
function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const box = useRef<HTMLDivElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    loadGis().then(() => {
      google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r: any) => onToken(r.credential) })
      if (box.current) google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' })
    }).catch((e) => setErr(e.message))
  }, [])
  return <View style={{ gap: 6 }}>{createElement('div', { ref: box, style: { minHeight: 44 } })}{err && <Small color={Px.red}>! {err}</Small>}</View>
}

/** Keeps the shared budget fresh while a screen showing it is open: your partner's changes show within seconds. */
export function useDateRefresh() {
  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, 10_000)
    return () => clearInterval(t)
  }, [])
}

/** A titled part of the Date budget dropdown. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 10 }}><Rule /><Label>{title}</Label>{children}</View>
)

/**
 * Budget tab: everything to set up the shared date budget (same data as the DateBudget app). Its expenses and top-ups
 * are in Txns with everything else; date expenses are added like any expense, with Count toward → Date budget.
 */
export function DateBudgetFold({ period }: { period: Period }) {
  const st = useAppState()
  const ds = useDate()
  const cur = currency(st)
  useDateRefresh()
  useEffect(() => {
    if (ds.phase !== 'ready' || !ds.uid) return
    // A set-aside for dates in my budget: half the pool to start with (it used to be my share, as a fixed cost).
    // Once there is one, its amount is mine to set (Pool → Set aside), so the pool changing doesn't touch it.
    const step = currentStep(ds.budget!.plan, todayIso())
    const line = dateLine(store.get())
    if (step && step.amount > 0 && (!line || line.kind !== 'RESERVE')) setPoolAside(half(monthly(step.amount, step.every)))
  }, [ds.budget])
  return (
    <FoldWindow title={ds.phase === 'ready' ? `Date budget · ${money(monthLeft(ds.all, period), cur)} left` : 'Date budget'}>
      {ds.error && <Small color={Px.red}>! {ds.error}</Small>}
      {ds.phase === 'signedOut' && <SignIn />}
      {ds.phase === 'loading' && <ActivityIndicator color={Px.orange} />}
      {ds.phase === 'noBudget' && <Connect />}
      {ds.phase === 'ready' && <>
        <Fund cur={cur} period={period} />
        <PlanWindow cur={cur} />
        <AddWindow cur={cur} />
      </>}
    </FoldWindow>
  )
}

/** Who paid, as a colour: the budget's first member is blue, the second pink (the same on both partners' phones). */
export const payerColor = (members: string[] | undefined, by: string) =>
  by && members?.[0] === by ? Px.blue : by && members?.[1] === by ? Px.pink : Px.orange

/** A date budget entry in the Txns list, marked with a heart in the payer's colour. Expenses open the expense editor; top-ups edit here. */
export function DateTxnRow({ tx }: { tx: Tx }) {
  const st = useAppState()
  const ds = useDate()
  const nav = useNav()
  const cur = currency(st)
  const [editing, setEditing] = useState(false)
  const expense = tx.kind === 'expense'
  const who = ds.budget?.names[tx.by] ?? (tx.by ? 'Partner' : 'Shared')
  const charged = expense ? overspendsFor(st, tx, ds.txs.filter((x) => x.kind === 'expense')).reduce((a, t) => a + t.total, 0) : 0
  return (
    <>
      <Pressable role="button" aria-label={`Edit ${tx.note || 'date budget entry'}`} onPress={() => expense ? nav.go({ kind: 'expense', dateId: tx.id }) : setEditing(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 4 }}>
        <Glyph rows={Glyphs.heart} color={payerColor(ds.budget?.members, tx.by)} size={18} />
        <View style={{ flex: 1, gap: 4 }}>
          <Body>{tx.note || (expense ? 'Date' : 'Top up')}</Body>
          <Small>{`${expense ? 'Date budget' : 'Top up'} · ${who}` + (charged > 0 ? ` · ${money(charged, cur)} over, from your budget` : '')}</Small>
        </View>
        <Text style={[Type.body, { color: expense ? Px.brown : Px.green }]}>{(expense ? '' : '+') + money(tx.amount, cur)}</Text>
      </Pressable>
      {editing && (
        <PixelDialog title="Top up" onDismiss={() => setEditing(false)}>
          <TxForm cur={cur} tx={tx} onSave={(d) => updateTx(tx.id, d)} onDone={() => setEditing(false)} />
          <PixelButton text="Delete" kind="danger" onPress={() => { deleteTx(tx.id); setEditing(false) }} />
        </PixelDialog>
      )}
    </>
  )
}

function SignIn() {
  return (
    <Section title="Sign in">
      <Body>One shared fund for your dates, with your partner. It's the same budget as the DateBudget app, so either of you can use either app.</Body>
      <Small>This uses your Budgeter Google account: connecting Google sync signs you in here too. Or sign in just for this:</Small>
      <GoogleButton onToken={signIn} />
    </Section>
  )
}

function Connect() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const run = (f: () => Promise<void>) => { setErr(null); f().catch((e) => setErr(e.message)) }
  return <>
    <Section title="Start a budget">
      <Small>You'll get a code to give your partner.</Small>
      <PixelButton text="Start a budget" onPress={() => run(create)} />
    </Section>
    <Section title="Join your partner">
      <PixelField value={code} onChange={(s) => setCode(s.toUpperCase().slice(0, 8))} label="Code" placeholder="ABCD2345" />
      <PixelButton text="Join" enabled={code.trim().length === 8} onPress={() => run(() => join(code))} />
      {err && <Small color={Px.red}>! {err}</Small>}
    </Section>
  </>
}

/** What's left in the shared fund at the end of [p] (today, for the month we're in): everything up to then carries over. */
/** Each month stands alone: what was added in [p] minus what was spent in it. Nothing carries over between months. */
export const monthLeft = (all: Tx[], p: Period) => totals(all.filter((t) => inPeriod(p, t.date))).left

/** The fund top-ups that covered expense [e]'s overspend ("Over budget: <note>", same day). */
export const coverTopups = (all: Tx[], e: Tx): Tx[] =>
  all.filter((t) => t.kind === 'topup' && t.date === e.date && t.note === `Over budget: ${e.note}`.slice(0, 100))

/**
 * The cover top-up a date expense of [amount] on [date] needs: how far it takes that month's fund below zero. Months
 * don't carry over, so only its own month counts, as the fund shows it. When editing [old], its earlier cover top-ups
 * are left out, since saving replaces them: an edit that lowers, moves or renames it gets the right cover too.
 */
export function dateCover(st: AppState, all: Tx[], date: string, amount: number, old?: Tx): number {
  const p = periodOf(st, date)
  const replaced = new Set(old ? coverTopups(all, old).map((t) => t.id) : [])
  const rest = all.filter((t) => !replaced.has(t.id))
  return overdrawn(monthLeft(rest, p), amount, old && inPeriod(p, old.date) ? old.amount : 0)
}

/** The fund for the month picked in the Budget tab: that month's top-ups and spending. Months don't carry over. */
/**
 * Who has put what into the pool this month: the date expenses each of us paid, with my partner's transfers to me
 * on their side. A transfer adds to "In the bank" (it's a negative expense), not to my budget.
 */
function Contributions({ cur, period, partnerName }: { cur: string; period: Period; partnerName: string }) {
  const st = useAppState()
  const ds = useDate()
  const c = dateContributions(st, period, ds.txs, ds.uid!)
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayIso())
  const v = text.trim() ? parseMoney(text, cur) : null
  return (
    <View style={{ gap: 6 }}>
      <Label>Put in this month</Label>
      <KeyValue k="You" v={money(c.mine, cur)} />
      <KeyValue k={partnerName} v={money(c.theirs, cur)} />
      <Small>{`You paid ${money(c.iPaid, cur)} of date spending, ${partnerName} ${money(c.theyPaid, cur)}` + (c.transferred ? `, and ${partnerName} transferred you ${money(c.transferred, cur)}.` : '.')}</Small>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <PixelField value={text} onChange={setText} label={`${partnerName} transferred me`} keyboard="decimal-pad" placeholder="0.00" style={{ flex: 1 }}
          error={text.trim() !== '' && (v == null || v <= 0) ? 'Not an amount' : null} />
        <PixelButton text="Add" enabled={v != null && v > 0} onPress={() => {
          store.update((s) => saveTxn(s, normTxn({ date, total: -v!, category: 'Other', merchant: `From ${partnerName}`, note: DATE_TRANSFER })))
          setText('')
        }} />
      </View>
      <DateField label="Transferred on" value={date} onChange={setDate} />
    </View>
  )
}

function Fund({ cur, period }: { cur: string; period: Period }) {
  const ds = useDate()
  const b = ds.budget!
  const partner = b.members.find((m) => m !== ds.uid)
  const [copied, setCopied] = useState(false)
  const month = totals(ds.all.filter((t) => inPeriod(period, t.date)))
  const left = month.left
  return (
    <Section title="Shared fund">
      <Label>{period.end > todayIso() ? 'Left to spend this month' : `Left in ${period.key}`}</Label>
      <Text style={[Type.hero, { color: left < 0 ? Px.red : Px.brown }]}>{money(left, cur)}</Text>
      <KeyValue k={`Added in ${period.key}`} v={money(month.topped, cur)} />
      <KeyValue k={`Spent in ${period.key}`} v={money(month.spent, cur)} />
      {partner && <Contributions cur={cur} period={period} partnerName={b.names[partner] ?? 'Your partner'} />}
      <Rule />
      {partner
        ? <Small>Shared with {b.names[partner] ?? 'your partner'}.</Small>
        : <>
          <Small>Waiting for your partner. Give them this code to join (in Budgeter or DateBudget):</Small>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={Type.number}>{b.code}</Text>
            <PixelButton text={copied ? 'Copied' : 'Copy'} kind="secondary" onPress={() => { navigator.clipboard.writeText(b.code); setCopied(true) }} />
          </View>
        </>}
      {cur !== 'SGD' && <Small color={Px.red}>DateBudget counts in SGD; amounts here are shown in {cur} without converting.</Small>}
    </Section>
  )
}

/** The recurring pool for both of you, added every week, 2 weeks or month, and what I set aside for it in my budget each month. */
function PlanWindow({ cur }: { cur: string }) {
  const ds = useDate()
  const b = ds.budget!
  const step = currentStep(b.plan, todayIso())
  const [amount, setAmount] = useState(step ? plain(step.amount, cur) : '')
  const [every, setEvery] = useState<Every>(step?.every ?? 'month')
  const [day, setDay] = useState(String(step?.day ?? 1))
  const st = useAppState()
  const line = dateLine(st)
  const [aside, setAside] = useState(line?.kind === 'RESERVE' ? plain(line.amount, cur) : '')
  const [err, setErr] = useState<string | null>(null)
  const v = amount.trim() ? parseMoney(amount, cur) : 0
  const a = aside.trim() ? parseMoney(aside, cur) : null // blank: half the pool
  const d = Number(day)
  const ok = v != null && v >= 0 && (aside.trim() === '' || (a != null && a >= 0)) && (every !== 'month' || (Number.isInteger(d) && d >= 1 && d <= 31))
  return (
    <Section title="Pool">
      <Small>{step && step.amount > 0
        ? `${money(step.amount, cur)} is added every ${EVERY[step.every]}${step.every === 'month' ? ` on day ${step.day ?? 1}` : ' (on Monday)'}; you set ${money(line?.kind === 'RESERVE' ? line.amount : 0, cur)} aside in your budget each month.`
        : 'No recurring pool yet.'}</Small>
      <PixelField value={amount} onChange={setAmount} label={`Pool (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={v == null ? 'Not a number' : null} />
      <Choice options={['week', 'fortnight', 'month'] as Every[]} selected={every} label={(e) => `Every ${EVERY[e]}`} onSelect={setEvery} />
      {every === 'month' && <PixelField value={day} onChange={(s) => setDay(s.replace(/\D/g, '').slice(0, 2))} label="On day (1-31)" keyboard="number-pad" />}
      <PixelField value={aside} onChange={setAside} label={`Set aside in my budget each month (${cur})`} keyboard="decimal-pad"
        placeholder={plain(half(monthly(v ?? 0, every)), cur)} error={aside.trim() !== '' && a == null ? 'Not a number' : null} />
      <PixelButton text="Save" enabled={ok} onPress={() => {
        setErr(null)
        const keep = a ?? half(monthly(v!, every)) // blank: half the pool
        setPlan(withBudget(b.plan, todayIso(), v!, every, every === 'month' ? d : 1)).then(() => setPoolAside(keep)).catch((e) => setErr(e.message))
      }} />
      <Small>Starts with the current period; earlier ones keep what they had. Set it to 0 to stop. For one-off extras, add a top-up.</Small>
      {err && <Small color={Px.red}>! {err}</Small>}
    </Section>
  )
}

function AddWindow({ cur }: { cur: string }) {
  return (
    <Section title="One-off top up">
      <TxForm cur={cur} kind="topup" onSave={addTx} />
      <Small>Date spending is added like any expense: pick Date budget under Count toward.</Small>
    </Section>
  )
}

/** The amount of a top-up. New ones are dated today; edits keep their date and note. */
function TxForm({ cur, tx, kind: newKind = 'topup', onSave, onDone }: { cur: string; tx?: Tx; kind?: Tx['kind']; onSave: (d: Draft) => Promise<unknown>; onDone?: () => void }) {
  const kind = tx?.kind ?? newKind
  const [amount, setAmount] = useState(tx ? plain(tx.amount, cur) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const v = parseMoney(amount, cur)
  return (
    <View style={{ gap: 10 }}>
      <PixelField value={amount} onChange={setAmount} label={`Amount (${cur})`} keyboard="decimal-pad" placeholder="0.00" />
      <PixelButton text={tx ? 'Save' : 'Add'} enabled={!busy && v != null && v > 0} onPress={() => {
        setBusy(true); setErr(null)
        onSave({ kind, amount: v!, note: tx?.note ?? '', date: tx?.date ?? todayIso() })
          .then(() => { if (!tx) setAmount(''); onDone?.() })
          .catch((e) => setErr(e.message)).finally(() => setBusy(false))
      }} />
      {err && <Small color={Px.red}>! {err}</Small>}
    </View>
  )
}
