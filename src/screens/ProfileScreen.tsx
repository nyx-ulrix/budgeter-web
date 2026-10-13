import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Text, TextInput, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import {
  ArtImg, Body, Chip, Choice, CloseButton, FoldWindow, Label, Page, PageHeader, PickerBox, PixelButton, PixelDialog, PixelField, Rule,
  SearchPicker, Small, Window, frame, shadow, Avatar, avatarFromFile, Side } from '../ui/components'
import { useNav } from '../ui/nav'
import { store, useAppState } from '../data/store'
import { AppState, Txn } from '../data/state'
import { snapshot } from '../data/ledger'
import { setCategories, setDaily, setSync } from '../data/actions'
import { countryName } from '../data/countries'
import { PACE_LABEL, Pace } from '../core/budget'
import { Ai, PRESETS, Provider, chat, models, preset, safeBase } from '../ai/ai'
import { startOpenRouter } from '../ai/openrouter'
import { requestToken, signOut } from '../sync/google'
import { syncNow } from '../sync/sheets'

const row = { flexDirection: 'row', alignItems: 'center', gap: 8 } as const
const PACE_COLOR: Record<Pace, string> = { ON_TRACK: Px.green, SLIGHTLY_OVER: Px.orange, OVER: Px.red }
const PACE_SYMBOL: Record<Pace, string> = { ON_TRACK: '●', SLIGHTLY_OVER: '▲', OVER: '✖' }

export function ProfileScreen() {
  const st = useAppState()
  const nav = useNav()
  const s = st.setup!
  const snap = snapshot(st)
  const months = new Set(st.txns.map((t) => t.date.slice(0, 7))).size
  return (
    <Page>
      <Window title="Profile.exe">
        <View style={[row, { gap: 12 }]}>
          <Avatar size={88} label="Your profile picture" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={Type.number}>{(s.name.trim() || 'Player 1').toUpperCase()}</Text>
            <Small>{`${countryName(s.country)} · ${s.currency}`}</Small>
            <Chip text={`LV ${Math.max(months, 1)}`} color={Px.blue} />
            <Chip text={`${PACE_SYMBOL[snap.pace]} ${PACE_LABEL[snap.pace]}`} color={PACE_COLOR[snap.pace]} />
          </View>
        </View>
        <PictureButtons />
        <Rule />
        <Label>Likes</Label>
        <Small>{'- Staying under budget\n- Receipts that add up'}</Small>
      </Window>
      <Window title="Settings">
        <PixelButton text="Country, currency, month start" onPress={() => nav.go({ kind: 'editSetup' })} kind="secondary" />
        <PixelButton text="AI receipt reading" onPress={() => nav.go({ kind: 'ai' })} kind="secondary" art="icon_receipt" />
        <PixelButton text="Date budget (shared)" onPress={() => nav.go({ kind: 'date' })} kind="secondary" art="icon_heart" />
        <PixelButton text="Google Sheets sync" onPress={() => nav.go({ kind: 'sync' })} kind="secondary" glyph={Glyphs.sync} />
        <PixelButton text="Credits" onPress={() => nav.go({ kind: 'credits' })} kind="secondary" art="icon_heart" />
      </Window>
      <Side><CategoriesWindow st={st} /></Side>
      <Small>Budgeter for the web</Small>
    </Page>
  )
}

function CategoriesWindow({ st }: { st: AppState }) {
  const [name, setName] = useState('')
  const n = name.trim()
  return (
    <FoldWindow title="Categories">
      {st.categories.map((c) => (
        <View key={c} style={[row, { gap: 6, flexWrap: 'wrap' }]}>
          <Body style={{ flex: 1, minWidth: 100 }}>{c}</Body>
          <Choice options={[true, false]} selected={!st.monthlyCategories.includes(c)} label={(d) => (d ? 'Daily' : 'Monthly')}
            onSelect={(d) => store.update((s) => setDaily(s, c, d))} />
          {st.categories.length > 1 && <CloseButton onPress={() => store.update((s) => setCategories(s, s.categories.filter((x) => x !== c)))} />}
        </View>
      ))}
      <Small>Daily: comes out of today's budget. Monthly (groceries, bills): spread over the month. It lowers what's left for the month, so every remaining day's budget drops a little, but today isn't marked as overspent.</Small>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <PixelField value={name} onChange={setName} label="New category" style={{ flex: 1 }} />
        <PixelButton text="+" enabled={!!n && !st.categories.some((c) => c.toLowerCase() === n.toLowerCase())}
          onPress={() => { store.update((s) => setCategories(s, [...s.categories, n])); setName('') }} />
      </View>
      <Small>Removing a category keeps old expenses as they are. Its colour shows in the month bar.</Small>
    </FoldWindow>
  )
}

// AI

export function AiScreen() {
  const [version, setVersion] = useState(0) // bump to re-read saved providers
  const providers = Ai.providers()
  const active = Ai.activeId()
  const [missingKey, setMissingKey] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    let live = true
    Promise.all(providers.map(async (p) => [p.id, await Ai.hasKey(p)] as const))
      .then((r) => { if (live) setMissingKey(new Set(r.filter(([, has]) => !has).map(([id]) => id))) })
    return () => { live = false }
  }, [version])

  async function test(p: Provider) {
    setNote(`Asking ${p.label}…`)
    try { setNote(`${p.label} answered: ${(await chat(p, 'Reply with the single word OK.', 'Say OK.')).slice(0, 40)}`) }
    catch (e: any) { setNote(e?.message ?? 'Failed') }
  }

  return (
    <Page>
      <PageHeader title="AI" />
      <Window title="How it works">
        <Body>Receipt photos are sent to the AI provider you pick, to read them into items, tax and service charge. If it can't read photos, only the text read from the photo is sent.</Body>
        <Small>With no AI picked, the built-in reader is used. It's free and runs in this browser, but less accurate.</Small>
        <Small>Keys are stored encrypted in this browser only. They aren't synced to your phone or the Google Sheet, so add them on each device.</Small>
      </Window>
      <Window title="Your AI logins">
        {providers.length === 0 && <Small>None yet. Add one below.</Small>}
        {providers.map((p) => (
          <View key={p.id} style={{ gap: 6 }}>
            <View style={row}>
              <View style={{ flex: 1 }}>
                <Body>{p.label}</Body>
                <Small>{`${preset(p.preset).name} · ${p.model}` + (missingKey.has(p.id) ? ' · key missing' : '')}</Small>
              </View>
              {p.id === active && <Chip text="● In use" color={Px.green} />}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {p.id !== active && <PixelButton text="Use" onPress={() => { Ai.setActive(p.id); refresh() }} />}
              <PixelButton text="Edit" onPress={() => setEditing(p)} kind="secondary" />
              <PixelButton text="Test" onPress={() => test(p)} kind="secondary" />
            </View>
            <Rule />
          </View>
        ))}
        {note && <Body>{note}</Body>}
        {active != null && <PixelButton text="Use built-in reader instead" onPress={() => { Ai.setActive(null); refresh() }} kind="secondary" />}
      </Window>
      <Side>
      <Window title="Add a login">
        <Choice options={PRESETS.map((p) => p.id)} selected={adding} label={(id) => preset(id).name} onSelect={setAdding} />
        {adding && <>
          <Small>{preset(adding).note}</Small>
          {adding === 'openrouter' && <>
            <PixelButton text="Sign in with OpenRouter" onPress={() => { startOpenRouter() }} />
            <Small>Opens OpenRouter, then comes back here with your new key saved.</Small>
            <Small>Or paste an OpenRouter API key:</Small>
          </>}
          <ProviderForm key={adding} presetId={adding} existing={null} onSaved={() => { refresh(); setAdding(null) }} />
        </>}
      </Window>
      </Side>
      {editing && (
        <PixelDialog title={`Edit ${editing.label}`} onDismiss={() => setEditing(null)}>
          <ProviderForm presetId={editing.preset} existing={editing} onSaved={() => { refresh(); setEditing(null) }} />
        </PixelDialog>
      )}
    </Page>
  )
}

/** Masked key field, styled like PixelField (which has no password mode). */
function KeyField({ value, onChange, label }: { value: string; onChange: (s: string) => void; label: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 4 }}>
      <Label>{label}</Label>
      <TextInput value={value} onChangeText={onChange} secureTextEntry autoCapitalize="none" autoCorrect={false} aria-label={label}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[Type.body, frame(Px.creamLight, focused ? Px.orange : Px.brown), focused ? shadow(3) : {},
          { minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, outlineStyle: 'none' } as any]} />
    </View>
  )
}

/** Key, label, model (with a fetched list) and base URL for one login. */
function ProviderForm({ presetId, existing, onSaved }: { presetId: string; existing: Provider | null; onSaved: () => void }) {
  const pr = preset(presetId)
  const [label, setLabel] = useState(existing?.label ?? pr.name)
  const [base, setBase] = useState(existing?.base ?? pr.base)
  const [model, setModel] = useState(existing?.model ?? pr.model)
  const [key, setKey] = useState('')
  const [list, setList] = useState<string[]>(() => (model ? [model] : []))
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const b = base.trim()

  // Fetch the provider's models once there's a key to ask with (typed, or already saved). Restarts as you type,
  // which doubles as a debounce.
  useEffect(() => {
    if ((!key.trim() && !existing) || !safeBase(b)) return
    let live = true
    const timer = setTimeout(async () => {
      setLoading(true)
      const probe = { ...(existing ?? Ai.newProvider(presetId, pr.name, '', '')), base: b }
      const got = await models(probe, key)
      if (!live) return
      setLoading(false)
      if (got.length) {
        setList(got)
        setModel((m) => (got.includes(m) ? m : got.find((x) => x === pr.model) ?? got[0]))
      }
    }, 700)
    return () => { live = false; clearTimeout(timer); setLoading(false) }
  }, [presetId, b, key])

  async function save() {
    setError(null)
    try {
      await Ai.save({ ...(existing ?? Ai.newProvider(presetId, '', '', '')), label: label.trim(), base: b, model: model.trim() }, key.trim() || null)
      onSaved()
    } catch (e: any) { setError(e?.message ?? 'Saving failed.') }
  }

  return (
    <View style={{ gap: 10 }}>
      <PixelField value={label} onChange={setLabel} label="Name it" placeholder="Claude (work)" />
      <KeyField value={key} onChange={setKey} label={existing ? 'New key (blank keeps the old one)' : 'API key'} />
      {!!pr.keyUrl && <PixelButton text="Get a key" onPress={() => Linking.openURL(pr.keyUrl)} kind="secondary" />}
      {presetId === 'custom' && <PixelField value={base} onChange={setBase} label="Base URL" placeholder="http://localhost:11434/v1" keyboard="url" />}
      <Label>Model</Label>
      <PickerBox text={model || 'Pick a model'} onPress={() => setPicking(true)} />
      <Small>{loading ? 'Loading models…'
        : !key.trim() && !existing ? 'Enter your key to load the models you can use.'
        : `${list.length} model${list.length === 1 ? '' : 's'} available.`}</Small>
      {!!b && !safeBase(b) && <Small color={Px.red}>Use https, or http only for this computer or your home network.</Small>}
      <PixelButton text="Save" onPress={save}
        enabled={!!label.trim() && !!model.trim() && safeBase(b) && (existing != null || !!key.trim())} />
      {existing && <PixelButton text="Remove" kind="danger" onPress={async () => { await Ai.remove(existing.id); onSaved() }} />}
      {error && <Small color={Px.red}>! {error}</Small>}
      {picking && (
        <SearchPicker title="Model" options={list.map((m) => [m, m])} allowCustom onDismiss={() => setPicking(false)}
          onPick={(m) => { setModel(m); setPicking(false) }} />
      )}
    </View>
  )
}

// Google Sheets

const needsSync = (t: Txn) => t.syncedAt == null || t.updatedAt > t.syncedAt

export function SyncScreen() {
  const st = useAppState()
  const sync = st.sync
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setError(null)
    try {
      setBusy('Waiting for Google sign-in…')
      await requestToken(true, sync.account) // must start inside the tap: browsers block the popup otherwise
      store.update((s) => setSync(s, (x) => ({ ...x, enabled: true, paused: undefined })))
      setBusy('Syncing…')
      await syncNow()
    } catch (e: any) {
      setError(`Google sign-in failed: ${e?.message ?? e}`)
    } finally { setBusy(null) }
  }

  async function now() {
    setBusy('Syncing…')
    try { await syncNow() } finally { setBusy(null) }
  }

  const pending = st.txns.filter(needsSync).length
  return (
    <Page>
      <PageHeader title="Sheets" />
      <Window title="Google Sheets">
        <Body>Keeps everything in a spreadsheet called Budgeter in your Google Drive, with a readable tab for each month.</Body>
        <Small>The Budgeter phone app and this web app share everything through it: a hidden _sync tab carries every change (setup, budgets, expenses, trips, planned purchases) between them, and the month tabs list your expenses. Connect the same Google account in both.</Small>
        <Small>Budgeter can only see files it made itself. Edits typed into the month tabs don't come back to the app.</Small>
        <Small>Already using Budgeter on your phone? Connect before setting things up here. Newer changes win, so settings entered in this browser first would replace the phone's.</Small>
        {!sync.enabled ? <PixelButton text="Connect Google" onPress={connect} glyph={Glyphs.sync} enabled={busy == null} />
          : sync.paused ? <>
            <Chip text="✖ Sync paused" color={Px.red} />
            <Body>{sync.paused}</Body>
            <PixelButton text="Sign in again" onPress={connect} enabled={busy == null} />
          </> : <Chip text="● Sync on" color={Px.green} />}
        {busy && (
          <View style={row} aria-live="polite">
            <ActivityIndicator color={Px.orange} />
            <Small color={Px.brown}>{busy}</Small>
          </View>
        )}
        {error && <Small color={Px.red}>! {error}</Small>}
        {sync.account && <Small>Account: {sync.account}</Small>}
        {sync.lastSync != null && <Small>Last sync: {new Date(sync.lastSync).toLocaleString()}</Small>}
        {sync.enabled && <Small>{pending} change(s) waiting</Small>}
        {sync.spreadsheetId && (
          <PixelButton text="Open the spreadsheet" kind="secondary"
            onPress={() => Linking.openURL(`https://docs.google.com/spreadsheets/d/${sync.spreadsheetId}`)} />
        )}
        {sync.enabled && <>
          <PixelButton text="Sync now" onPress={now} kind="secondary" enabled={busy == null} />
          <PixelButton text="Turn off sync" kind="danger" onPress={() => {
            store.update((s) => setSync(s, (x) => ({ ...x, enabled: false, paused: undefined })))
            signOut()
          }} />
        </>}
        <Small>Google sign-in in a browser lasts about an hour. After that, your next tap anywhere in the app signs in again quietly and syncs.</Small>
      </Window>
    </Page>
  )
}

export function CreditsScreen() {
  return (
    <Page>
      <PageHeader title="Credits" />
      <Window title="Art">
        <Body>Ninja Adventure by Pixel-boy & AAA (CC0)</Body>
        <Small>pixel-boy.itch.io/ninja-adventure-asset-pack</Small>
        <Body>1-bit Pixel Icons by Nikoichu (CC0)</Body>
        <Small>nikoichu.itch.io/pixel-icons</Small>
        <Small>Placeholder art.</Small>
      </Window>
      <Window title="Fonts">
        <Body>Press Start 2P, Silkscreen, VT323</Body>
        <Small>SIL Open Font License 1.1</Small>
      </Window>
    </Page>
  )
}

/** Upload or clear the profile picture. Synced to the phone with your settings. */
function PictureButtons() {
  const st = useAppState()
  const input = React.useRef<HTMLInputElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const set = (avatar?: string) => store.update((s) => ({ ...s, setup: { ...s.setup!, avatar } }))
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <PixelButton text={st.setup?.avatar ? 'Change picture' : 'Upload a picture'} kind="secondary" onPress={() => input.current?.click()} />
        {!!st.setup?.avatar && <PixelButton text="Use app icon" kind="secondary" onPress={() => set(undefined)} />}
      </View>
      <Small>Shown at the top, on Home and here, on your phone too.</Small>
      {err && <Small color={Px.red}>! {err}</Small>}
      {React.createElement('input', {
        ref: input, type: 'file', accept: 'image/*', style: { display: 'none' },
        onChange: async (e: any) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          try { setErr(null); set(await avatarFromFile(f)) } catch { setErr("Couldn't read that picture.") }
        },
      })}
    </View>
  )
}
