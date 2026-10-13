import React, { createElement, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import { Body, Choice, DateField, KeyValue, Label, Page, PageHeader, PixelButton, PixelDialog, PixelField, Rule, Side, Small, Window } from '../ui/components'
import { store, useAppState } from '../data/store'
import { AppState, Line, newId } from '../data/state'
import { currency, periodOf, planFor } from '../data/ledger'
import { editPlan } from '../data/actions'
import { money, parseMoney, plain } from '../core/money'
import { todayIso } from '../core/budget'
import { CLIENT_ID, loadGis } from '../sync/google'
import { addTx, create, deleteTx, Draft, join, refresh, setPlan, signIn, signOut, updateTx, useDate } from '../date/client'
import { currentStep, EVERY, Every, Tx, withBudget } from '../date/money'

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

export function DateScreen() {
  const st = useAppState()
  const ds = useDate()
  const cur = currency(st)
  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, 10_000) // the partner's changes show within seconds
    return () => clearInterval(t)
  }, [])

  return (
    <Page>
      <PageHeader title="Date budget" />
      {ds.error && <Small color={Px.red}>! {ds.error}</Small>}
      {ds.phase === 'signedOut' && <SignIn />}
      {ds.phase === 'loading' && <ActivityIndicator color={Px.orange} />}
      {ds.phase === 'noBudget' && <Connect />}
      {ds.phase === 'ready' && <>
        <Fund cur={cur} />
        <PlanWindow cur={cur} />
        <ShareWindow cur={cur} />
        <Side>
          <AddWindow cur={cur} />
          <History cur={cur} />
        </Side>
      </>}
      {ds.phase !== 'signedOut' && <PixelButton text="Sign out of the date budget" kind="secondary" onPress={signOut} />}
    </Page>
  )
}

function SignIn() {
  return (
    <Window title="Date budget">
      <Body>One shared fund for your dates, with your partner. It's the same budget as the DateBudget app, so either of you can use either app.</Body>
      <Small>Sign in with the Google account you use for DateBudget.</Small>
      <GoogleButton onToken={signIn} />
    </Window>
  )
}

function Connect() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const run = (f: () => Promise<void>) => { setErr(null); f().catch((e) => setErr(e.message)) }
  return <>
    <Window title="Start a budget">
      <Small>You'll get a code to give your partner.</Small>
      <PixelButton text="Start a budget" onPress={() => run(create)} />
    </Window>
    <Window title="Join your partner">
      <PixelField value={code} onChange={(s) => setCode(s.toUpperCase().slice(0, 8))} label="Code" placeholder="ABCD2345" />
      <PixelButton text="Join" enabled={code.trim().length === 8} onPress={() => run(() => join(code))} />
      {err && <Small color={Px.red}>! {err}</Small>}
    </Window>
  </>
}

function Fund({ cur }: { cur: string }) {
  const ds = useDate()
  const b = ds.budget!
  const partner = b.members.find((m) => m !== ds.uid)
  const [copied, setCopied] = useState(false)
  return (
    <Window title="Date fund.exe">
      <Label>Left to spend</Label>
      <Text style={[Type.hero, { color: ds.left < 0 ? Px.red : Px.brown }]}>{money(ds.left, cur)}</Text>
      <KeyValue k="Added" v={money(ds.topped, cur)} />
      <KeyValue k="Spent" v={money(ds.spent, cur)} />
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
    </Window>
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
    <Window title="Budget">
      <Small>{step && step.amount > 0 ? `${money(step.amount, cur)} is added every ${EVERY[step.every]}${step.every === 'month' ? ` on day ${step.day ?? 1}` : ' (on Monday)'}.` : 'No recurring budget yet.'}</Small>
      <PixelField value={amount} onChange={setAmount} label={`Add (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={v == null ? 'Not a number' : null} />
      <Choice options={['week', 'fortnight', 'month'] as Every[]} selected={every} label={(e) => `Every ${EVERY[e]}`} onSelect={setEvery} />
      {every === 'month' && <PixelField value={day} onChange={(s) => setDay(s.replace(/\D/g, '').slice(0, 2))} label="On day (1-31)" keyboard="number-pad" />}
      <PixelButton text="Save" enabled={ok} onPress={() => { setErr(null); setPlan(withBudget(ds.budget!.plan, todayIso(), v!, every, every === 'month' ? d : 1)).catch((e) => setErr(e.message)) }} />
      <Small>Starts with the current period; earlier ones keep what they had. Set it to 0 to stop. For one-off extras, add a top-up.</Small>
      {err && <Small color={Px.red}>! {err}</Small>}
    </Window>
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
    <Window title="My share">
      <Body>{line ? `${money(line.amount, cur)} a month is set aside from your budget for dates.` : 'Set aside your share each month from your own budget.'}</Body>
      <PixelField value={text} onChange={setText} label={`Each month (${cur})`} keyboard="decimal-pad" placeholder="0.00" error={v == null ? 'Not a number' : null} />
      {suggested > 0 && <Small>Half of the shared budget is about {money(suggested, cur)} a month.</Small>}
      <PixelButton text="Set" kind="secondary" enabled={v != null && v !== (line?.amount ?? 0)} onPress={() => setMyShare(v!)} />
      <Small>It's a fixed cost in your budget from this month on, so your daily budget already allows for it. Date spending then comes out of the shared fund only: tag an expense "Date budget" under Count toward.</Small>
    </Window>
  )
}

function AddWindow({ cur }: { cur: string }) {
  return (
    <Window title="Add">
      <TxForm cur={cur} onSave={addTx} />
    </Window>
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

function History({ cur }: { cur: string }) {
  const ds = useDate()
  const [editing, setEditing] = useState<Tx | null>(null)
  return (
    <Window title="History">
      {ds.all.length === 0 && <Small>Nothing yet. Add your first date.</Small>}
      {ds.all.map((t) => (
        <View key={t.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Body>{t.note || (t.kind === 'expense' ? 'Expense' : 'Top up')}</Body>
              <Small>{`${t.date}${t.auto ? '' : ` · ${ds.budget!.names[t.by] ?? 'Partner'}`}`}</Small>
            </View>
            <Text style={[Type.body, { color: t.kind === 'expense' ? Px.brown : Px.green }]}>{(t.kind === 'expense' ? '−' : '+') + money(t.amount, cur)}</Text>
          </View>
          {!t.auto && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable role="button" onPress={() => setEditing(t)}><Small color={Px.blue}>Edit</Small></Pressable>
              <Pressable role="button" onPress={() => { if (confirm(`Delete ${money(t.amount, cur)} ${t.note || t.kind}?`)) deleteTx(t.id) }}><Small color={Px.red}>Delete</Small></Pressable>
            </View>
          )}
          <Rule />
        </View>
      ))}
      {editing && (
        <PixelDialog title="Edit" onDismiss={() => setEditing(null)}>
          <TxForm cur={cur} tx={editing} onSave={(d) => updateTx(editing.id, d)} onDone={() => setEditing(null)} />
        </PixelDialog>
      )}
    </Window>
  )
}
