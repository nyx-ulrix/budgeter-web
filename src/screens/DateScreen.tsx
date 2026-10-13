import React, { createElement, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import { useNav } from '../ui/nav'
import { Body, Choice, FoldWindow, Glyph, KeyValue, Label, PixelButton, PixelDialog, PixelField, Rule, Small } from '../ui/components'
import { store, useAppState } from '../data/store'
import { AppState, Line, newId } from '../data/state'
import { currency, periodOf, planFor } from '../data/ledger'
import { editPlan } from '../data/actions'
import { money, parseMoney, plain } from '../core/money'
import { inPeriod, Period, todayIso } from '../core/budget'
import { CLIENT_ID, loadGis } from '../sync/google'
import { addTx, create, deleteTx, Draft, join, refresh, setPlan, signIn, updateTx, useDate } from '../date/client'
import { currentStep, EVERY, Every, totals, Tx, withBudget } from '../date/money'

declare const google: any

/** The personal budget line that sets aside my share of the date budget each month (a fixed cost, carried over). */
export const dateLine = (st: AppState, key = periodOf(st).key): Line | undefined => planFor(st, key).lines.find((l) => l.tag === 'date')

/** What the shared budget adds per month on average: weekly ×52/12, fortnightly ×26/12. */
const monthly = (amount: number, every: Every) => Math.round(every === 'week' ? (amount * 52) / 12 : every === 'fortnight' ? (amount * 26) / 12 : amount)

/** Sets my monthly share as a "Date budget" fixed cost from this month on (replacing any earlier amount this month). */
function setMyShare(amount: number) {
  store.update((st) => {
    const key = periodOf(st).key
    return editPlan(st, key, (p) => ({
      ...p,
      lines: [...p.lines.filter((l) => l.tag !== 'date'), ...(amount > 0 ? [{ id: newId(), kind: 'FIXED' as const, name: 'Date budget (my share)', amount, tag: 'date', added: todayIso() }] : [])],
    }))
  })
}

/** Google's own "Sign in with Google" button; hands back an ID token for DateBudget's sign-in. */
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
    const partner = ds.budget!.members.find((m) => m !== ds.uid)
    const { step, mine } = contributions(ds.budget!.plan, ds.uid, partner)
    if (!(step as any)?.split) return // no agreed split yet: leave my set-aside alone
    const want = monthly(mine, step!.every)
    if ((dateLine(store.get())?.amount ?? 0) !== want) setMyShare(want)
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
  return (
    <>
      <Pressable role="button" aria-label={`Edit ${tx.note || 'date budget entry'}`} onPress={() => expense ? nav.go({ kind: 'expense', dateId: tx.id }) : setEditing(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 4 }}>
        <Glyph rows={Glyphs.heart} color={payerColor(ds.budget?.members, tx.by)} size={18} />
        <View style={{ flex: 1, gap: 4 }}>
          <Body>{tx.note || (expense ? 'Date' : 'Top up')}</Body>
          <Small>{`${expense ? 'Date budget' : 'Top up'} · ${who}`}</Small>
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
      <Small>Sign in with the Google account you use for DateBudget.</Small>
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

/** The fund for the month picked in the Budget tab: that month's top-ups and spending. Months don't carry over. */
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

/** Who puts in what: the current step's split (keys are uids; "partner" until the partner has joined). */
export function contributions(plan: unknown, uid: string, partnerUid: string | undefined) {
  const step = currentStep(plan, todayIso())
  const split: Record<string, number> = (step as any)?.split ?? {}
  const amount = step?.amount ?? 0
  const mine = Number.isSafeInteger(split[uid]) ? split[uid] : Math.ceil(amount / 2)
  const theirs = Number.isSafeInteger(split[partnerUid ?? '']) ? split[partnerUid!] : Number.isSafeInteger(split.partner) ? split.partner : amount - mine
  return { step, mine, theirs }
}

/**
 * The recurring budget for both of you: each person's contribution, added together every week, 2 weeks or month.
 * The split rides along on the plan step (DateBudget ignores it), and my part becomes my monthly set-aside.
 */
function PlanWindow({ cur }: { cur: string }) {
  const ds = useDate()
  const b = ds.budget!
  const partner = b.members.find((m) => m !== ds.uid)
  const partnerName = partner ? b.names[partner] ?? 'Your partner' : 'Your partner'
  const { step, mine: m0, theirs: t0 } = contributions(b.plan, ds.uid!, partner)
  const [mine, setMine] = useState(step ? plain(m0, cur) : '')
  const [theirs, setTheirs] = useState(step ? plain(t0, cur) : '')
  const [every, setEvery] = useState<Every>(step?.every ?? 'month')
  const [day, setDay] = useState(String(step?.day ?? 1))
  const [err, setErr] = useState<string | null>(null)
  const mv = mine.trim() ? parseMoney(mine, cur) : 0
  const tv = theirs.trim() ? parseMoney(theirs, cur) : 0
  const d = Number(day)
  const ok = mv != null && tv != null && mv >= 0 && tv >= 0 && (every !== 'month' || (Number.isInteger(d) && d >= 1 && d <= 31))
  const total = (mv ?? 0) + (tv ?? 0)
  const per = `every ${EVERY[every]}`
  return (
    <Section title="Budget for both of you">
      <Small>{step && step.amount > 0
        ? `${money(step.amount, cur)} is added every ${EVERY[step.every]}${step.every === 'month' ? ` on day ${step.day ?? 1}` : ' (on Monday)'}: you ${money(m0, cur)}, ${partnerName} ${money(t0, cur)}.`
        : 'No recurring budget yet.'}</Small>
      <PixelField value={mine} onChange={setMine} label={`You put in (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={mv == null ? 'Not a number' : null} />
      <PixelField value={theirs} onChange={setTheirs} label={`${partnerName} puts in (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={tv == null ? 'Not a number' : null} />
      <Choice options={['week', 'fortnight', 'month'] as Every[]} selected={every} label={(e) => `Every ${EVERY[e]}`} onSelect={setEvery} />
      {every === 'month' && <PixelField value={day} onChange={(s) => setDay(s.replace(/\D/g, '').slice(0, 2))} label="On day (1-31)" keyboard="number-pad" />}
      <KeyValue k={`Total ${per}`} v={money(total, cur)} />
      <PixelButton text="Save" enabled={ok} onPress={() => {
        setErr(null)
        const plan = withBudget(b.plan, todayIso(), total, every, every === 'month' ? d : 1)
        const last = plan[plan.length - 1] as any
        last.split = { [ds.uid!]: mv!, [partner ?? 'partner']: tv! }
        setPlan(plan).then(() => setMyShare(monthly(mv!, every))).catch((e) => setErr(e.message))
      }} />
      <Small>Starts with the current period; earlier ones keep what they had. Set both to 0 to stop. For one-off extras, add a top-up.</Small>
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
function TxForm({ cur, tx, kind: newKind = 'topup', onSave, onDone }: { cur: string; tx?: Tx; kind?: Tx['kind']; onSave: (d: Draft) => Promise<void>; onDone?: () => void }) {
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
