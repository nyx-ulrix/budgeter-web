import React, { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Glyphs, Px, Type } from '../ui/theme'
import { ArtImg, Body, Label, Page, PageHeader, PickerBox, PixelButton, PixelField, SearchPicker, Small, Window } from '../ui/components'
import { useNav } from '../ui/nav'
import { store } from '../data/store'
import { Setup } from '../data/state'
import { editSetup, finishSetup, setSync } from '../data/actions'
import { countries, countryName, currencyCodes, currencyOf, detectCountry } from '../data/countries'
import { parseMoney } from '../core/money'
import { requestToken } from '../sync/google'
import { syncNow } from '../sync/sheets'

/** First run when [existing] is null, otherwise the settings editor. */
export function SetupScreen({ existing }: { existing: Setup | null | undefined }) {
  const first = existing == null
  const nav = useNav()
  const [name, setName] = useState(existing?.name ?? '')
  const [country, setCountry] = useState(() => existing?.country ?? detectCountry())
  const [currency, setCurrency] = useState(() => existing?.currency ?? currencyOf(country))
  const [startDay, setStartDay] = useState(String(existing?.startDay ?? 1))
  const [income, setIncome] = useState('')
  const [balance, setBalance] = useState('')
  const [pickCountry, setPickCountry] = useState(false)
  const [pickCurrency, setPickCurrency] = useState(false)
  const [showForm, setShowForm] = useState(false)   // first run: the form only after sign-in finds nothing, or on skip
  const day = /^\d+$/.test(startDay) ? Number(startDay) : null
  const dayOk = day != null && day >= 1 && day <= 28
  const incomeMinor = income.trim() ? parseMoney(income, currency) : 0
  const balanceMinor = balance.trim() ? parseMoney(balance, currency) : 0
  const ok = dayOk && incomeMinor != null && balanceMinor != null

  return (
    <Page>
      {first ? <SignIn onSkip={() => setShowForm(true)} onNew={() => setShowForm(true)} /> : <PageHeader title="Settings" />}
      {first && !showForm ? null : <>
      <Window title="You">
        <PixelField value={name} onChange={setName} label="Name (optional)" />
      </Window>
      <Window title="Where you are">
        <Label>Country</Label>
        <PickerBox text={`${countryName(country)} (${country})`} onPress={() => setPickCountry(true)} />
        <Label>Currency</Label>
        <PickerBox text={currency} onPress={() => setPickCurrency(true)} />
        <Small>Currency follows your country. Change it if you budget in another one.</Small>
      </Window>
      <Window title="Budget month">
        <PixelField value={startDay} onChange={(s) => setStartDay(s.replace(/\D/g, '').slice(0, 2))} label="Month starts on day (1-28)"
          keyboard="number-pad" error={dayOk ? null : 'Pick a day from 1 to 28'} />
        <Small>Use your payday if you're paid mid-month.</Small>
        {first && <>
          <PixelField value={income} onChange={setIncome} label={`Money in each month: pay, allowance (${currency})`} keyboard="decimal-pad"
            placeholder="0.00" error={incomeMinor == null ? 'Not a number' : null} />
          <PixelField value={balance} onChange={setBalance} label="Money you have now (optional)" keyboard="decimal-pad"
            placeholder="0.00" error={balanceMinor == null ? 'Not a number' : null} />
          <Small>Your starting money is added to this month as extra money.</Small>
        </>}
      </Window>
      <PixelButton text={first ? 'Start budgeting' : 'Save'} enabled={ok} onPress={() => {
        const s: Setup = { ...existing, country, currency, startDay: day!, name: name.trim() } // keeps the profile picture
        if (first) store.update((st) => finishSetup(st, s, incomeMinor!, balanceMinor!))
        else { store.update((st) => editSetup(st, s)); nav.back() }
      }} />
      </>}

      {pickCountry && (
        <SearchPicker title="Country" options={countries().map((c) => [c.code, `${c.name} (${c.code})`])} onDismiss={() => setPickCountry(false)}
          onPick={(c) => { setCountry(c); setCurrency(currencyOf(c)); setPickCountry(false) }} />
      )}
      {pickCurrency && (
        <SearchPicker title="Currency" options={currencyCodes().map((c) => [c, c])} onDismiss={() => setPickCurrency(false)}
          onPick={(c) => { setCurrency(c); setPickCurrency(false) }} />
      )}
    </Page>
  )
}

/**
 * First run: sign in with Google. If that account already has a Budgeter sheet (phone or another browser), everything
 * loads and the app opens by itself (it shows setup only while there is none). A new account gets the form.
 */
function SignIn({ onSkip, onNew }: { onSkip: () => void; onNew: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [done, setDone] = useState(false)

  async function signIn() {
    setMsg(null)
    try {
      setBusy('Waiting for Google sign-in…')
      await requestToken(true) // must start inside the click: browsers block the popup otherwise
      setBusy('Looking for your budget in Google Sheets…')
      store.update((s) => setSync(s, (x) => ({ ...x, enabled: true, paused: undefined })))
      await syncNow()
      const st = store.get()
      if (st.sync.paused) setMsg({ text: st.sync.paused, error: true })
      else if (!st.setup) { setDone(true); onNew() }
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Google sign-in failed.', error: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Window title="Welcome.exe">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ArtImg name="app_icon" size={96} label="Budgeter" />
        <View style={{ flex: 1, gap: 6 }}>
          <Text role="heading" style={Type.hero}>HELLO!</Text>
          <Body>{done ? "You're new here. Fill in a few things below to start." : 'Sign in with Google to start.'}</Body>
        </View>
      </View>
      {!done && <>
        <Small>Already use Budgeter on your phone or another browser? Your budget loads by itself. New? You'll set it up next. Both apps then share everything through a Google Sheet in your own Drive.</Small>
        <PixelButton text="Sign in with Google" glyph={Glyphs.person} enabled={busy == null} onPress={signIn} />
        {busy && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} aria-live="polite">
            <ActivityIndicator color={Px.orange} />
            <Small color={Px.brown}>{busy}</Small>
          </View>
        )}
        {msg && <Small color={msg.error ? Px.red : Px.brown}>{msg.error ? `! ${msg.text}` : msg.text}</Small>}
        <PixelButton text="Continue without Google" kind="secondary" enabled={busy == null} onPress={onSkip} />
        <Small>Without Google your budget stays in this browser only. You can connect later in Profile → Google Sheets sync.</Small>
      </>}
      {done && <Small>Signed in. Your budget will be kept in your Google Sheet and shared with the phone app.</Small>}
    </Window>
  )
}
