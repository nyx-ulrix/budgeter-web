import React, { createElement, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import { Body, Chip, Choice, DateField, FoldWindow, KeyValue, Label, PixelButton, PixelDialog, PixelField, Rule, Small } from '../ui/components'
import { store, useAppState } from '../data/store'
import { AppState, Line, newId } from '../data/state'
import { currency, periodOf, planFor } from '../data/ledger'
import { editPlan } from '../data/actions'
import { money, parseMoney, plain } from '../core/money'
import { inPeriod, Period, todayIso } from '../core/budget'
import { CLIENT_ID, loadGis } from '../sync/google'
import { addTx, create, deleteTx, Draft, join, refresh, setPlan, signIn, signOut, updateTx, useDate } from '../date/client'
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
  return (
    <FoldWindow title={ds.phase === 'ready' ? `Date budget · ${money(leftBy(ds.all, period), cur)} left` : 'Date budget'}>
      {ds.error && <Small color={Px.red}>! {ds.error}</Small>}
      {ds.phase === 'signedOut' && <SignIn />}
      {ds.phase === 'loading' && <ActivityIndicator color={Px.orange} />}
      {ds.phase === 'noBudget' && <Connect />}
      {ds.phase === 'ready' && <>
        <Fund cur={cur} period={period} />
        <PlanWindow cur={cur} />
        <ShareWindow cur={cur} />
        <AddWindow cur={cur} />
      </>}
      {ds.phase !== 'signedOut' && ds.phase !== 'loading' && <PixelButton text="Sign out of the date budget" kind="secondary" onPress={signOut} />}
    </FoldWindow>
  )
}

/** A date budget entry in the Txns list. Tap to edit or delete; it's paid from the shared fund, not my budget. */
export function DateTxnRow({ tx }: { tx: Tx }) {
  const st = useAppState()
  const ds = useDate()
  const cur = currency(st)
  const [editing, setEditing] = useState(false)
  return (
    <>
      <Pressable role="button" onPress={() => setEditing(true)} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Body style={{ flex: 1 }}>{tx.note || (tx.kind === 'expense' ? 'Date' : 'Top up')}</Body>
          <Text style={[Type.body, { color: tx.kind === 'expense' ? Px.brown : Px.green }]}>{(tx.kind === 'expense' ? '' : '+') + money(tx.amount, cur)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip text="Date budget" color={Px.blue} />
          <Small>{`${tx.kind === 'expense' ? 'Shared fund' : 'Added to the shared fund'} · ${ds.budget?.names[tx.by] ?? 'Partner'}`}</Small>
        </View>
      </Pressable>
      {editing && (
        <PixelDialog title="Date budget" onDismiss={() => setEditing(false)}>
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
const leftBy = (all: Tx[], p: Period) => totals(all.filter((t) => t.date < p.end)).left

/** The fund for the month picked in the Budget tab: that month's top-ups and spending, and what carries over. */
function Fund({ cur, period }: { cur: string; period: Period }) {
  const ds = useDate()
  const b = ds.budget!
  const partner = b.members.find((m) => m !== ds.uid)
  const [copied, setCopied] = useState(false)
  const month = totals(ds.all.filter((t) => inPeriod(period, t.date)))
  const left = leftBy(ds.all, period)
  return (
    <Section title="Shared fund">
      <Label>{period.end > todayIso() ? 'Left to spend' : `Left at the end of ${period.key}`}</Label>
      <Text style={[Type.hero, { color: left < 0 ? Px.red : Px.brown }]}>{money(left, cur)}</Text>
      <KeyValue k={`Carried over into ${period.key}`} v={money(leftBy(ds.all, { ...period, end: period.start }), cur)} />
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

function PlanWindow({ cur }: { cur: string }) {
  const ds = useDate()
  const step = currentStep(ds.budget!.plan, todayIso())
  const [amount, setAmount] = useState(step ? plain(step.amount, cur) : '')
  const [every, setEvery] = useState<Every>(step?.every ?? 'month')
  const [day, setDay] = useState(String(step?.day ?? 1))
  const [err, setErr] = useState<string | null>(null)
  const v = amount.trim() ? parseMoney(amount, cur) : 0
  const d = Number(day)
  const ok = v != null && v >= 0 && (every !== 'month' || (Number.isInteger(d) && d >= 1 && d <= 31))
  return (
    <Section title="Budget">
      <Small>{step && step.amount > 0 ? `${money(step.amount, cur)} is added every ${EVERY[step.every]}${step.every === 'month' ? ` on day ${step.day ?? 1}` : ' (on Monday)'}.` : 'No recurring budget yet.'}</Small>
      <PixelField value={amount} onChange={setAmount} label={`Add (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={v == null ? 'Not a number' : null} />
      <Choice options={['week', 'fortnight', 'month'] as Every[]} selected={every} label={(e) => `Every ${EVERY[e]}`} onSelect={setEvery} />
      {every === 'month' && <PixelField value={day} onChange={(s) => setDay(s.replace(/\D/g, '').slice(0, 2))} label="On day (1-31)" keyboard="number-pad" />}
      <PixelButton text="Save" enabled={ok} onPress={() => { setErr(null); setPlan(withBudget(ds.budget!.plan, todayIso(), v!, every, every === 'month' ? d : 1)).catch((e) => setErr(e.message)) }} />
      <Small>Starts with the current period; earlier ones keep what they had. Set it to 0 to stop. For one-off extras, add a top-up.</Small>
      {err && <Small color={Px.red}>! {err}</Small>}
    </Section>
  )
}

function ShareWindow({ cur }: { cur: string }) {
  const st = useAppState()
  const ds = useDate()
  const step = currentStep(ds.budget!.plan, todayIso())
  const line = dateLine(st)
  const suggested = step ? Math.round(monthly(step.amount, step.every) / 2) : 0
  const [text, setText] = useState(line ? plain(line.amount, cur) : suggested ? plain(suggested, cur) : '')
  const v = text.trim() ? parseMoney(text, cur) : 0
  return (
    <Section title="My share">
      <Body>{line ? `${money(line.amount, cur)} a month is set aside from your budget for dates.` : 'Set aside your share each month from your own budget.'}</Body>
      <PixelField value={text} onChange={setText} label={`Each month (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={v == null ? 'Not a number' : null} />
      {suggested > 0 && <Small>Half of the shared budget is about {money(suggested, cur)} a month.</Small>}
      <PixelButton text="Set" kind="secondary" enabled={v != null && v !== (line?.amount ?? 0)} onPress={() => setMyShare(v!)} />
      <Small>It's a fixed cost in your budget from this month on, so your daily budget already allows for it. Date spending then comes out of the shared fund only: add an expense as usual and pick Date budget under Count toward.</Small>
    </Section>
  )
}

function AddWindow({ cur }: { cur: string }) {
  return (
    <Section title="One-off top up or expense">
      <TxForm cur={cur} onSave={addTx} />
    </Section>
  )
}

function TxForm({ cur, tx, onSave, onDone }: { cur: string; tx?: Tx; onSave: (d: Draft) => Promise<void>; onDone?: () => void }) {
  const [kind, setKind] = useState<Tx['kind']>(tx?.kind ?? 'expense')
  const [amount, setAmount] = useState(tx ? plain(tx.amount, cur) : '')
  const [note, setNote] = useState(tx?.note ?? '')
  const [date, setDate] = useState(tx?.date ?? todayIso())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const v = parseMoney(amount, cur)
  return (
    <View style={{ gap: 10 }}>
      <Choice options={['expense', 'topup'] as Tx['kind'][]} selected={kind} label={(k) => (k === 'expense' ? 'Expense' : 'Top up')} onSelect={setKind} />
      <PixelField value={amount} onChange={setAmount} label={`Amount (${cur})`} keyboard="decimal-pad" placeholder="0.00" />
      <PixelField value={note} onChange={(s) => setNote(s.slice(0, 100))} label="What for" placeholder={kind === 'expense' ? 'Dinner, movie…' : 'Top up'} />
      <DateField label="Date" value={date} onChange={setDate} />
      <PixelButton text={tx ? 'Save' : 'Add'} enabled={!busy && v != null && v > 0} onPress={() => {
        setBusy(true); setErr(null)
        onSave({ kind, amount: v!, note: note.trim(), date })
          .then(() => { if (!tx) { setAmount(''); setNote('') }; onDone?.() })
          .catch((e) => setErr(e.message)).finally(() => setBusy(false))
      }} />
      {err && <Small color={Px.red}>! {err}</Small>}
    </View>
  )
}
