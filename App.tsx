import React, { useEffect } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useFonts } from 'expo-font'
import { Fonts, Glyphs, Px, Type } from './src/ui/theme'
import { Avatar, Chip, Glyph, Small, Window, useWide } from './src/ui/components'
import { NavProvider, Tab, useNav } from './src/ui/nav'
import { ScannerProvider, useScanner } from './src/ocr/scanner'
import { store, useAppState } from './src/data/store'
import { snapshot } from './src/data/ledger'
import { startSync, queueSync } from './src/sync/sheets'
import { currentToken, preloadGoogle, requestToken } from './src/sync/google'
import { finishOpenRouter } from './src/ai/openrouter'
import { HomeScreen } from './src/screens/HomeScreen'
import { TxnsScreen } from './src/screens/TxnsScreen'
import { BudgetScreen } from './src/screens/BudgetScreen'
import { ProfileScreen, AiScreen, SyncScreen, CreditsScreen } from './src/screens/ProfileScreen'
import { ExpenseScreen } from './src/screens/ExpenseScreen'
import { PlannedScreen } from './src/screens/PlannedScreen'
import { TripScreen } from './src/screens/TripScreen'
import { SetupScreen } from './src/screens/SetupScreen'

const TABS: { tab: Tab; label: string; glyph: string[] }[] = [
  { tab: 'home', label: 'Home', glyph: Glyphs.home },
  { tab: 'txns', label: 'Txns', glyph: Glyphs.list },
  { tab: 'budget', label: 'Budget', glyph: Glyphs.coin },
  { tab: 'profile', label: 'Profile', glyph: Glyphs.person },
]

export default function App() {
  const [fontsLoaded] = useFonts(Fonts)
  useEffect(() => {
    startSync()
    preloadGoogle()
    finishOpenRouter().then((msg) => msg && alert(msg))
  }, [])
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: Px.cream, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Px.orange} /></View>
  return <NavProvider><Root /></NavProvider>
}

/**
 * Google tokens last about an hour and a new one needs a tap, so when sync is on and the token has expired,
 * the next tap anywhere quietly fetches a fresh one and syncs.
 */
function renewOnTap() {
  const st = store.get()
  if (!st.sync.enabled || currentToken()) return
  requestToken(false, st.sync.account).then(() => queueSync(0)).catch(() => {})
}

function Root() {
  const st = useAppState()
  const nav = useNav()
  const wide = useWide()
  if (!st.setup) return <View style={{ flex: 1, backgroundColor: Px.cream }}><SetupScreen existing={null} /></View>
  return (
    <ScannerProvider onResult={(receipt, text) => nav.go({ kind: 'expense', receipt, ocrText: text || undefined })}>
      <View style={{ flex: 1, backgroundColor: Px.cream }} {...({ onPointerDown: renewOnTap } as any)}>
        <Toolbar />
        {wide ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <SideBar />
            <View style={{ flex: 1 }}>{screen()}</View>
          </View>
        ) : <>
          <View style={{ flex: 1 }}>{screen()}</View>
          {nav.stack.length === 0 && <BottomBar />}
        </>}
        <ScanningOverlay />
      </View>
    </ScannerProvider>
  )

  function screen() {
    const top = nav.top
    if (!top) {
      switch (nav.tab) {
        case 'home': return <HomeScreen />
        case 'txns': return <TxnsScreen />
        case 'budget': return <BudgetScreen />
        case 'profile': return <ProfileScreen />
      }
    }
    switch (top!.kind) {
      case 'expense': return <ExpenseScreen key={nav.stack.length} screen={top!} />
      case 'planned': return <PlannedScreen key={top!.id ?? 'new'} id={top!.id} />
      case 'trip': return <TripScreen key={top!.id} id={top!.id} />
      case 'ai': return <AiScreen />
      case 'sync': return <SyncScreen />
      case 'editSetup': return <SetupScreen existing={st.setup} />
      case 'credits': return <CreditsScreen />
    }
  }
}

/** Desktop-style utility bar: icon, name, period, status. */
function Toolbar() {
  const st = useAppState()
  const nav = useNav()
  const snap = snapshot(st)
  const paused = st.sync.paused
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Px.orange, minHeight: 48, paddingHorizontal: 10 }}>
        <View style={{ borderWidth: 2, borderColor: Px.creamLight, padding: 2 }}><Avatar size={28} /></View>
        <Text style={[Type.number, { color: Px.creamLight, flex: 1 }]}>BUDGETER</Text>
        <Chip text={snap.period.key} color={Px.creamLight} style={{ alignSelf: 'center' }} />
        {st.sync.enabled && (
          <Pressable onPress={() => nav.go({ kind: 'sync' })} role="button" aria-label="Sync settings" style={{ alignSelf: 'center' }}>
            <Chip text={paused ? 'Sync paused' : 'Synced'} color={paused ? Px.red : Px.green} style={{ alignSelf: 'center' }} />
          </Pressable>
        )}
      </View>
      <View style={{ height: 3, backgroundColor: Px.brown }} />
    </View>
  )
}

function BottomBar() {
  const nav = useNav()
  return (
    <View>
      <View style={{ height: 3, backgroundColor: Px.brown }} />
      <View role="tablist" style={{ flexDirection: 'row', backgroundColor: Px.cream }}>
        {TABS.map(({ tab, label, glyph }) => {
          const on = nav.tab === tab
          return (
            <Pressable key={tab} role="tab" aria-selected={on} onPress={() => nav.reset(tab)}
              style={{ flex: 1, minHeight: 56, backgroundColor: on ? Px.orange : Px.cream, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 }}>
              <Glyph rows={glyph} color={on ? Px.creamLight : Px.brown} size={18} />
              <Text style={[Type.label, { color: on ? Px.creamLight : Px.brown }]}>{label.toUpperCase()}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/** Wide screens: the tabs as a sidebar on the left, always there (a tab also closes any open screen). */
function SideBar() {
  const nav = useNav()
  return (
    <View role="tablist" style={{ width: 200, backgroundColor: Px.cream, borderRightWidth: 3, borderColor: Px.brown, paddingVertical: 12, gap: 6 }}>
      {TABS.map(({ tab, label, glyph }) => {
        const on = nav.tab === tab && nav.stack.length === 0
        return (
          <Pressable key={tab} role="tab" aria-selected={on} onPress={() => nav.reset(tab)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 18, backgroundColor: on ? Px.orange : 'transparent' }}>
            <Glyph rows={glyph} color={on ? Px.creamLight : Px.brown} size={18} />
            <Text style={[Type.title, { color: on ? Px.creamLight : Px.brown }]}>{label.toUpperCase()}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function ScanningOverlay() {
  const scanner = useScanner()
  if (!scanner.busy) return null
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,23,47,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 420 }}>
        <Window title="Scanning.exe">
          <ActivityIndicator color={Px.orange} />
          <Small color={Px.brown}>{scanner.status || 'Working…'}</Small>
        </Window>
      </View>
    </View>
  )
}
