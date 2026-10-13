import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { addDays, inPeriod, nextPeriod, prevPeriod } from '../core/budget'
import { money } from '../core/money'
import { togglePaidBack } from '../data/actions'
import { currency, liveTxns, periodFromKey, periodOf } from '../data/ledger'
import { ME, Txn, debtors, isSplit, myShare, personLabel } from '../data/state'
import { store, useAppState } from '../data/store'
import { ArtImg, Body, Chip, Choice, FoldWindow, KeyValue, Label, Page, PixelButton, PixelField, Rule, Small, Window, Side } from '../ui/components'
import { useNav } from '../ui/nav'
import { Px, Type } from '../ui/theme'
import { Toggles } from './ExpenseScreen'
import { useDate } from '../date/client'
import type { Tx as DateTx } from '../date/money'
import { DateTxnRow, useDateRefresh } from './DateScreen'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const SCOPES = ['All', 'Budget', 'Trips', 'Split', 'Dates']

export function TxnsScreen() {
  const st = useAppState()
  const [key, setKey] = useState(() => periodOf(st).key)
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('All')
  const p = periodFromKey(st, key)
  const q = query.toLowerCase()
  const list = liveTxns(st)
    .filter((t) => inPeriod(p, t.date))
    .filter((t) => category == null || t.category === category || t.items.some((i) => i.category === category))
    .filter((t) => !query.trim() || [t.merchant, t.note, t.items.map((i) => i.name).join(', ')].join(' ').toLowerCase().includes(q))
    .filter((t) => scope === 'Budget' ? t.tripId == null : scope === 'Trips' ? t.tripId != null : scope === 'Split' ? isSplit(t) : scope !== 'Dates')
    .map((t) => ({ t, sort: t.date + String(t.updatedAt).padStart(15, '0') }))
    .sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0))
    .map((x) => x.t)
  const active = !!query.trim() || scope !== 'All' || category != null
  // Date budget entries (shared fund) join the list. Total = my share of each expense plus the date spending I paid
  // (not my partner's, so a meal counts once, for whoever paid; not top-ups).
  const ds = useDate()
  useDateRefresh()
  const dates = ds.phase !== 'ready' || category != null || (scope !== 'All' && scope !== 'Dates') ? []
    : ds.txs.filter((d) => inPeriod(p, d.date) && (!query.trim() || d.note.toLowerCase().includes(q)))
  const rows: ({ k: 'txn'; t: Txn; date: string } | { k: 'date'; d: DateTx; date: string })[] = [
    ...list.map((t) => ({ k: 'txn' as const, t, date: t.date })),
    ...dates.map((d) => ({ k: 'date' as const, d, date: d.date })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <Page>
      <Window title="Transactions">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PixelButton text="<" kind="secondary" onPress={() => setKey(prevPeriod(p).key)} />
          <Text style={[Type.number, { flex: 1 }]}>{key}</Text>
          <PixelButton text=">" kind="secondary" onPress={() => setKey(nextPeriod(p).key)} />
        </View>
        <Small>{p.start} to {addDays(p.end, -1)}</Small>
      </Window>
      <Side>
      <FoldWindow title={active ? 'Search & filters (on)' : 'Search & filters'}>
        <PixelField value={query} onChange={setQuery} label="" placeholder="Search merchant, item, note" />
        <Choice options={SCOPES} selected={scope} label={(x) => x} onSelect={setScope} />
        <Choice<string | null> options={[null, ...st.categories]} selected={category} label={(c) => c ?? 'Any category'} onSelect={setCategory} />
        {active && <PixelButton text="Clear" kind="secondary" onPress={() => { setQuery(''); setScope('All'); setCategory(null) }} />}
      </FoldWindow>
      </Side>
      <Window title={`${rows.length} items`}>
        {rows.length === 0 && <Small>Nothing here.</Small>}
        {rows.map((r, i) => (
          <View key={r.k === 'txn' ? r.t.id : 'date-' + r.d.id} style={{ gap: 10 }}>
            {(i === 0 || rows[i - 1].date !== r.date) && <Label>{`${DOW[new Date(r.date + 'T00:00:00Z').getUTCDay()]} ${r.date}`}</Label>}
            {r.k === 'txn' ? <TxnRow txn={r.t} trackPaid /> : <DateTxnRow tx={r.d} />}
          </View>
        ))}
        {rows.length > 0 && (
          <>
            <Rule />
            <KeyValue k="Total" v={money(list.reduce((a, t) => a + myShare(t), 0) + dates.reduce((a, d) => a + (d.kind === 'expense' && d.by === ds.uid ? d.amount : 0), 0), currency(st))} />
          </>
        )}
      </Window>
    </Page>
  )
}

/** One transaction: what, category, my share. Tap to edit. [trackPaid] adds the paid-back toggles. */
export function TxnRow({ txn: t, trackPaid = false }: { txn: Txn; trackPaid?: boolean }) {
  const st = useAppState()
  const nav = useNav()
  const cur = currency(st)
  const split = isSplit(t)
  const owed = debtors(t)
  return (
    <View style={{ gap: 4 }}>
      <Pressable role="button" aria-label={`Edit ${t.merchant || t.category}`} onPress={() => nav.go({ kind: 'expense', id: t.id })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 4 }}>
        {t.tripId != null ? <ArtImg name="icon_airplane" size={18} label="Trip" />
          : t.items.length > 0 ? <ArtImg name="icon_receipt" size={18} label="Itemised" /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Body>{t.merchant.trim() || t.category}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip text={t.category} color={Px.cream} />
            {split && <Chip text={`Split ×${Math.max(t.people, Object.keys(t.shares).length)}`} color={Px.blue} />}
            {split && owed.length > 0 && (
              <Chip text={`${owed.filter((w) => t.paidBack.includes(w)).length}/${owed.length} paid`}
                color={owed.every((w) => t.paidBack.includes(w)) ? Px.green : Px.creamLight} />
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Body>{money(myShare(t), cur)}</Body>
          {split && <Small>my share of {money(t.total, cur)}</Small>}
          {t.foreign && <Small>{money(t.foreign.amount, t.foreign.currency)}</Small>}
        </View>
      </Pressable>
      {trackPaid && split && owed.length > 0 && (
        <>
          <Small>{t.payer === ME ? 'Tap who has paid you back:' : `Paid ${personLabel(t.payer)} back?`}</Small>
          <Toggles options={owed.map((w) => [w, personLabel(w) + (w === ME ? ' (you)' : '')])} selected={t.paidBack}
            onToggle={(w) => store.update((s) => togglePaidBack(s, t.id, w))} />
        </>
      )}
    </View>
  )
}
