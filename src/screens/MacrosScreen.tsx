import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { todayIso } from '../core/budget'
import { MACROS, fmtMacro, macro, macroReport, sumMacros } from '../core/macros'
import { Ai } from '../ai/ai'
import { FoodHit, UNITS, aiMacros, gramsOf, lookupFood, scaleMacros } from '../ai/food'
import { money } from '../core/money'
import { currency, macroTarget, macrosOn, mealsOn, unloggedFood } from '../data/ledger'
import { AppState, FoodPreset, Meal, Txn, myShare, newId } from '../data/state'
import { store, useAppState } from '../data/store'
import { Body, Choice, CloseButton, DateField, Dropdown, FoldWindow, KeyValue, Label, Page, PixelButton, PixelDialog, PixelField, PixelProgress, Rule, Side, Small, Window } from '../ui/components'
import { useNav } from '../ui/nav'
import { Glyphs, Px, Type } from '../ui/theme'
import { Toggles } from './ExpenseScreen'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const dow = (iso: string) => DOW[new Date(iso + 'T00:00:00Z').getUTCDay()]
const shift = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
/** A typed number for a field: commas dropped. */
const plainNum = (v: number) => fmtMacro(v).replace(/,/g, '')
const toText = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, plainNum(v)]))
/** A typed amount: a number of at least 0, else null. */
const num = (s: string | undefined) => { const t = (s ?? '').trim(), n = Number(t); return t !== '' && Number.isFinite(n) && n >= 0 ? n : null }
/** The amounts typed in, as numbers (blank and invalid left out). */
const numbers = (x: Record<string, string>) => Object.fromEntries(Object.entries(x).flatMap(([k, v]) => { const n = num(v); return n == null ? [] : [[k, n] as const] }))

/** "650 kcal · 30 g protein" for the macros I track. */
const summary = (st: AppState, m: Record<string, number>) =>
  st.macros.tracked.map((k) => `${fmtMacro(m[k] ?? 0)} ${macro(k).unit}` + (k === 'calories' ? '' : ` ${macro(k).label.toLowerCase()}`)).join(' · ')

/** What a Food expense was, as a meal name: its items, else the shop. */
const mealName = (t: Txn) => t.items.map((i) => i.name).join(', ').trim() || t.merchant.trim() || 'Meal'

const saveMeal = (m: Meal) => store.update((s) => ({ ...s, meals: [...s.meals.filter((x) => x.id !== m.id), m] }))
const savePreset = (p: FoodPreset) => store.update((s) => ({ ...s, presets: [...s.presets.filter((x) => x.id !== p.id), p] }))
const deleteMeal = (id: string) => store.update((s) => ({ ...s, meals: s.meals.filter((x) => x.id !== id) }))
const editMacros = (f: (g: AppState['macros']) => AppState['macros']) => store.update((s) => ({ ...s, macros: f(s.macros) }))

/** Progress towards the day's target for each tracked macro. Shared by the Macros tab and the Home card. */
export function MacroBars({ st, day }: { st: AppState; day: string }) {
  const got = macrosOn(st, day)
  if (st.macros.tracked.length === 0) return <Small>Pick what to track under Goals on the Macros tab.</Small>
  return (
    <>
      {st.macros.tracked.map((k) => {
        const m = macro(k)
        const v = got[k] ?? 0
        const t = macroTarget(st, k)
        const over = !m.more && v > t
        return (
          <View key={k} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Label style={{ flex: 1 }}>{m.label}</Label>
              <Text style={[Type.body, { color: over ? Px.red : Px.brown }]}>{`${fmtMacro(v)} / ${fmtMacro(t)} ${m.unit}`}</Text>
            </View>
            <PixelProgress fraction={t > 0 ? v / t : v > 0 ? 1 : 0} color={m.more ? (v >= t ? Px.green : Px.orange) : over ? Px.red : Px.orange} />
          </View>
        )
      })}
    </>
  )
}

export function MacrosScreen() {
  const st = useAppState()
  const today = todayIso()
  const [day, setDay] = useState(today)
  const [editing, setEditing] = useState<Meal | null>(null)
  const cur = currency(st)
  const meals = mealsOn(st, day)
  const waiting = unloggedFood(st, day)
  return (
    <Page>
      <Window title="Macros">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PixelButton text="<" kind="secondary" onPress={() => setDay(shift(day, -1))} />
          <Text style={[Type.number, { flex: 1 }]}>{day === today ? 'TODAY' : `${dow(day)} ${day}`}</Text>
          <PixelButton text=">" kind="secondary" enabled={day < today} onPress={() => setDay(shift(day, 1))} />
        </View>
        <MacroBars st={st} day={day} />
      </Window>

      <Window title="Meals">
        {meals.map((m) => <Row2 key={m.id} title={m.name || 'Meal'} sub={Object.keys(m.macros).length ? summary(st, m.macros) : 'Not counted'} onPress={() => setEditing(m)} />)}
        {waiting.map((t) => (
          <Row2 key={t.id} title={mealName(t)} sub={`${money(myShare(t), cur)} on Food · tap to add what you ate`} color={Px.orange}
            onPress={() => setEditing({ id: newId(), date: t.date, name: mealName(t), txnId: t.id, macros: {} })} />
        ))}
        {meals.length === 0 && waiting.length === 0 && <Small>Nothing yet. Food expenses (meals, not groceries) show up here to fill in.</Small>}
        <PixelButton text="Add food" glyph={Glyphs.plus} onPress={() => setEditing({ id: newId(), date: day, name: '', macros: {} })} />
        <Small>For food you didn't pay for: free food, a treat, home cooking.</Small>
      </Window>

      <Side>
        <ReportWindow st={st} />
        <PresetsWindow st={st} />
        <GoalsWindow st={st} />
      </Side>
      {editing && <MealDialog st={st} meal={editing} onDone={() => setEditing(null)} />}
    </Page>
  )
}

function Row2({ title, sub, color = Px.muted, onPress }: { title: string; sub: string; color?: string; onPress: () => void }) {
  return (
    <Pressable role="button" aria-label={`Edit ${title}`} onPress={onPress} style={{ gap: 2, minHeight: 48, paddingVertical: 4 }}>
      <Body>{title}</Body>
      <Small color={color}>{sub}</Small>
    </Pressable>
  )
}

function ReportWindow({ st }: { st: AppState }) {
  const [days, setDays] = useState(7)
  const byDay: Record<string, Record<string, number>[]> = {}
  for (const m of st.meals) if (Object.keys(m.macros).length) (byDay[m.date] ??= []).push(m.macros)
  const targets = Object.fromEntries(st.macros.tracked.map((k) => [k, macroTarget(st, k)]))
  const { logged, stats } = macroReport(byDay, st.macros.tracked, targets, todayIso(), days)
  return (
    <Window title="Report">
      <Choice options={[7, 30]} selected={days} label={(n) => `${n} days`} onSelect={setDays} />
      {logged.length === 0 ? <Small>{`Nothing logged in the last ${days} days.`}</Small> : (
        <>
          {stats.map((s) => {
            const m = macro(s.key)
            return (
              <View key={s.key} style={{ gap: 2 }}>
                <KeyValue k={`${m.label} a day`} v={`${fmtMacro(s.average)} / ${fmtMacro(targets[s.key])} ${m.unit}`} />
                <Small>{`On target ${s.onTargetDays} of ${logged.length} logged days ${m.more ? '(at least the target)' : '(at most the target)'}`}</Small>
              </View>
            )
          })}
          <Rule />
          {logged.map(([d, m]) => (
            <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Label style={{ flex: 1 }}>{`${dow(d)} ${d.slice(5)}`}</Label>
              <Small>{summary(st, m)}</Small>
            </View>
          ))}
        </>
      )}
    </Window>
  )
}

function GoalsWindow({ st }: { st: AppState }) {
  return (
    <FoldWindow title="Goals">
      <Label>Track</Label>
      <Toggles options={MACROS.map((m) => [m.key, m.label])} selected={st.macros.tracked}
        onToggle={(k) => editMacros((g) => ({ ...g, tracked: g.tracked.includes(k) ? g.tracked.filter((x) => x !== k) : MACROS.map((m) => m.key).filter((x) => x === k || g.tracked.includes(x)) }))} />
      {st.macros.tracked.map((k) => <TargetField key={k} st={st} k={k} />)}
      <Small>Daily targets. Calories, carbs, fat, sugar and sodium are limits; protein and fibre are minimums.</Small>
    </FoldWindow>
  )
}

function TargetField({ st, k }: { st: AppState; k: string }) {
  const m = macro(k)
  const [text, setText] = useState(() => plainNum(macroTarget(st, k)))
  const v = Number(text.trim())
  const ok = text.trim() !== '' && Number.isFinite(v) && v > 0
  return (
    <PixelField value={text} label={`${m.label} (${m.unit} a day)`} keyboard="decimal-pad" error={ok ? null : 'Enter a number above 0'}
      onChange={(s) => {
        setText(s)
        const n = Number(s.trim())
        if (s.trim() && Number.isFinite(n) && n > 0) editMacros((g) => ({ ...g, targets: { ...g.targets, [k]: n } }))
      }} />
  )
}

/**
 * One meal: name, day and macros. Macros can come from a preset, the free food database (each result adds on,
 * so a recipe is built ingredient by ingredient), the AI provider, or be typed in from a label.
 */
function MealDialog({ st, meal, onDone }: { st: AppState; meal: Meal; onDone: () => void }) {
  const saved = st.meals.some((m) => m.id === meal.id)
  const [name, setName] = useState(meal.name)
  const [date, setDate] = useState(meal.date)
  const [values, setValues] = useState<Record<string, string>>(() => toText(meal.macros))
  const [all, setAll] = useState(false)
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('1')
  const [unit, setUnit] = useState('portion')
  const [hits, setHits] = useState<FoodHit[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ai = Ai.active()
  const shown = all ? MACROS.map((m) => m.key) : st.macros.tracked
  const bad = Object.keys(values).filter((k) => (values[k] ?? '').trim() !== '' && num(values[k]) == null)
  const n = num(amount)
  const run = (what: string, f: () => Promise<void>) => { setBusy(what); setErr(null); setNote(null); f().catch((e) => setErr(e.message)).finally(() => setBusy(null)) }
  return (
    <PixelDialog title={saved ? 'Edit food' : 'Add food'} onDismiss={onDone}>
      {st.presets.length > 0 && <>
        <Label>Presets</Label>
        <Choice options={st.presets.map((p) => p.id)} selected={null} label={(id) => st.presets.find((p) => p.id === id)!.name}
          onSelect={(id) => { const p = st.presets.find((x) => x.id === id)!; setName(p.name); setValues(toText(p.macros)) }} />
      </>}
      <PixelField value={name} onChange={(s) => setName(s.slice(0, 100))} label="What you ate" placeholder="Chicken rice" />
      <DateField label="Date" value={date} onChange={setDate} />
      {shown.map((k) => (
        <PixelField key={k} value={values[k] ?? ''} onChange={(s) => setValues((x) => ({ ...x, [k]: s }))} label={`${macro(k).label} (${macro(k).unit})`}
          keyboard="decimal-pad" placeholder="0" error={bad.includes(k) ? 'Not a number' : null} />
      ))}
      <PixelButton text={all ? 'Only what I track' : 'All nutrients'} kind="secondary" onPress={() => setAll(!all)} />
      <Rule />
      <Label>Look up (free food database)</Label>
      <PixelField value={query} onChange={setQuery} label="" placeholder={name.trim() || 'Whey protein, flat white, rice'} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <PixelField value={amount} onChange={setAmount} label="Amount eaten" keyboard="decimal-pad" error={n == null || n <= 0 ? 'Enter an amount' : null} style={{ flex: 1 }} />
        <View style={{ flex: 1.4 }}>
          <Dropdown label="Unit" value={unit} options={UNITS} onChange={(u) => {
            // Keep the amount sensible when switching between a count and a weight.
            const weight = (x: string) => x === 'g' || x === 'ml'
            if (weight(u) && !weight(unit) && amount.trim() === '1') setAmount('100')
            if (!weight(u) && weight(unit) && amount.trim() === '100') setAmount('1')
            setUnit(u)
          }} />
        </View>
      </View>
      <PixelButton text={busy === 'look' ? 'Looking up…' : 'Look up'} kind="secondary" enabled={!busy && !!(query.trim() || name.trim())}
        onPress={() => run('look', async () => setHits(await lookupFood(query.trim() || name.trim())))} />
      {hits?.length === 0 && <Small>No matches. Try other words, or fill with AI.</Small>}
      {hits?.map((h, i) => (
        <Pressable key={i} role="button" aria-label={`Add ${h.name}`} style={{ gap: 2, minHeight: 44, paddingVertical: 4 }} onPress={() => {
          const grams = gramsOf(n ?? 1, unit, h)
          setValues((x) => toText(sumMacros([numbers(x), scaleMacros(h.per100, grams)])))
          if (!name.trim()) setName(h.name.split(' · ')[0])
          setNote(`Added ${fmtMacro(n ?? 1)} ${unit}${unit === 'g' ? '' : ` (${fmtMacro(grams)} g)`} of ${h.name}. Tap more to add ingredients.`)
        }}>
          <Body>{h.name}</Body>
          <Small>{`per 100 g: ${summary(st, h.per100)} · portion: ${h.portion?.label ?? '100 g (none listed)'}`}</Small>
        </Pressable>
      ))}
      {ai
        ? <PixelButton text={busy === 'ai' ? 'Asking AI…' : `Fill with AI (${ai.label})`} kind="secondary" enabled={!busy && !!name.trim()}
          onPress={() => run('ai', async () => { setValues(toText(await aiMacros(ai, name.trim()))); setNote('Filled by AI: check the numbers.') })} />
        : <Small>Set up AI in Profile to fill macros from a description.</Small>}
      <Small>The lookup is free. AI uses your provider and may cost a little; put amounts in the name (e.g. "2 eggs and toast").</Small>
      {note && <Small color={Px.green}>{note}</Small>}
      {err && <Small color={Px.red}>! {err}</Small>}
      <Rule />
      <PixelButton text="Save" enabled={bad.length === 0 && !!name.trim()} onPress={() => { saveMeal({ ...meal, name: name.trim(), date, macros: numbers(values) }); onDone() }} />
      <PixelButton text="Save as preset" kind="secondary" enabled={bad.length === 0 && !!name.trim()} onPress={() => {
        const p = st.presets.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
        savePreset({ id: p?.id ?? newId(), name: name.trim(), macros: numbers(values) }); setNote(`Saved "${name.trim()}" as a preset.`)
      }} />
      {!saved && meal.txnId != null && (
        <PixelButton text="Not a meal for me" kind="secondary" onPress={() => { saveMeal({ ...meal, name: name.trim() || 'Meal', macros: {} }); onDone() }} />
      )}
      {saved && <PixelButton text="Delete" kind="danger" onPress={() => { deleteMeal(meal.id); onDone() }} />}
    </PixelDialog>
  )
}

/** Presets I've saved, to remove ones I no longer use. */
function PresetsWindow({ st }: { st: AppState }) {
  return (
    <FoldWindow title={`Presets (${st.presets.length})`}>
      {st.presets.length === 0 && <Small>Save something you eat often (protein powder, morning coffee, your own recipe) with "Save as preset" when adding food.</Small>}
      {st.presets.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}><Body>{p.name}</Body><Small>{summary(st, p.macros)}</Small></View>
          <CloseButton onPress={() => store.update((s) => ({ ...s, presets: s.presets.filter((x) => x.id !== p.id) }))} />
        </View>
      ))}
    </FoldWindow>
  )
}

/** Home "Food" button: opens Add food for today. */
export function AddFoodButton({ style }: { style?: object }) {
  const st = useAppState()
  const [adding, setAdding] = useState<Meal | null>(null)
  return (
    <>
      <PixelButton text="Food" glyph={Glyphs.food} style={style} onPress={() => setAdding({ id: newId(), date: todayIso(), name: '', macros: {} })} />
      {adding && <MealDialog st={st} meal={adding} onDone={() => setAdding(null)} />}
    </>
  )
}

/** Home card: today's macro progress. Tap to open the Macros tab. */
export function MacrosCard() {
  const st = useAppState()
  const nav = useNav()
  const today = todayIso()
  const waiting = unloggedFood(st, today).length
  return (
    <Pressable role="button" aria-label="Open macros" onPress={() => nav.reset('macros')}>
      <Window title="Macros today">
        <MacroBars st={st} day={today} />
        {waiting > 0 && <Small color={Px.orange}>{`${waiting} meal${waiting > 1 ? 's' : ''} to fill in`}</Small>}
      </Window>
    </Pressable>
  )
}
