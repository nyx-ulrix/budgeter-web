import { store } from '../data/store'
import { AppState, Txn, myShare, personLabel } from '../data/state'
import { currency, periodOf } from '../data/ledger'
import { mergeRemote, Remote, toUpload } from '../data/records'
import { plain } from '../core/money'
import { currentToken } from './google'

/*
 * Same spreadsheet and layout as the Android app (sync/Sheets.kt): a readable tab per budget period, plus the
 * hidden "_sync" tab of records that carries every change between the two apps.
 */
const API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SYNC_TAB = '_sync'
const SYNC_HEADER = ['Key', 'Stamp', 'Data']
const HEADER = ['ID', 'Date', 'Name', 'Category', 'Amount', 'My Share', 'Tax', 'Service Charge',
  'Paid Currency', 'Paid Amount', 'Payer', 'Split Method', 'People', 'Trip', 'Items JSON', 'Notes']
const LAST_COL = 'P'

export class HttpError extends Error { constructor(public code: number, msg: string) { super(msg) } }

const needsSync = (t: Txn) => t.syncedAt == null || t.updatedAt > t.syncedAt
const col = (n: number) => String.fromCharCode(64 + n)

async function http(method: string, url: string, token: string, body?: unknown): Promise<any> {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  if (!r.ok) throw new HttpError(r.status, `Google Sheets error ${r.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : {}
}
const range = (s: string) => encodeURIComponent(s)

async function findSpreadsheet(token: string): Promise<string | null> {
  const q = encodeURIComponent("name = 'Budgeter' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false")
  const o = await http('GET', `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&fields=files(id)`, token)
  return o.files?.[0]?.id ?? null
}
const createSpreadsheet = async (token: string): Promise<string> =>
  (await http('POST', API, token, { properties: { title: 'Budgeter' } })).spreadsheetId

async function existingTabs(token: string, id: string): Promise<Set<string>> {
  const o = await http('GET', `${API}/${id}?fields=sheets.properties.title`, token)
  return new Set((o.sheets ?? []).map((s: any) => s.properties.title))
}
async function batchUpdate(token: string, id: string, data: [string, unknown[]][]) {
  await http('POST', `${API}/${id}/values:batchUpdate`, token, { valueInputOption: 'RAW', data: data.map(([r, row]) => ({ range: r, values: [row] })) })
}
async function append(token: string, id: string, tab: string, rows: unknown[][]) {
  await http('POST', `${API}/${id}/values/${range(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, token, { values: rows })
}
async function addTab(token: string, id: string, tab: string, header = HEADER) {
  await http('POST', `${API}/${id}:batchUpdate`, token, { requests: [{ addSheet: { properties: { title: tab, ...(tab === SYNC_TAB ? { hidden: true } : {}) } } }] })
  await batchUpdate(token, id, [[`'${tab}'!A1:${col(header.length)}1`, header]])
}
async function idRows(token: string, id: string, tab: string): Promise<Map<string, number>> {
  const o = await http('GET', `${API}/${id}/values/${range(`'${tab}'!A:A`)}`, token)
  return new Map((o.values ?? []).map((r: string[], i: number) => [r[0], i + 1]).filter(([k]: [string]) => k))
}

/** "_sync" rows: key → [row number, record]. A key written twice (two devices at once) keeps the newer row. */
async function readRecords(token: string, id: string): Promise<Map<string, [number, Remote]>> {
  const o = await http('GET', `${API}/${id}/values/${range(`'${SYNC_TAB}'!A2:C`)}`, token)
  const out = new Map<string, [number, Remote]>()
  ;(o.values ?? []).forEach((cells: string[], i: number) => {
    const key = cells[0]; const stamp = Number(cells[1])
    if (!key || !Number.isFinite(stamp)) return
    if (stamp > (out.get(key)?.[1].stamp ?? -1)) out.set(key, [i + 2, { stamp, json: cells[2] || null }])
  })
  return out
}

function row(st: AppState, t: Txn): unknown[] {
  const home = currency(st)
  const paidCur = t.foreign?.currency ?? home
  const n = (minor: number, cur: string) => Number(plain(minor, cur))
  const items = t.items.map((i) => ({ name: i.name, price: plain(i.price, paidCur), cost: plain(i.cost, home), category: i.category ?? null }))
  return [
    t.id, t.date, t.merchant, t.category,
    n(t.total, home), n(myShare(t), home), n(t.tax, paidCur), n(t.serviceCharge, paidCur),
    paidCur, n(t.foreign?.amount ?? t.total, paidCur),
    personLabel(t.payer), Object.keys(t.shares).length === 0 ? 'none' : t.method.toLowerCase(),
    Math.max(t.people, 1),
    st.trips.find((x) => x.id === t.tripId)?.name ?? '',
    t.items.length ? JSON.stringify(items) : '', t.note,
  ]
}

const tabOf = (st: AppState, t: Txn) => periodOf(st, t.date).key

/** Writes new, changed and deleted transactions to their period's readable tab. */
async function pushTxns(token: string, sheetId: string, tabs: Set<string>) {
  const st = store.get()
  const todo = st.txns.filter(needsSync)
  if (!todo.length) return
  const now = Date.now()
  const done = new Map<string, string | null>()
  const clears = todo.filter((t) => t.syncedTab != null && (t.deleted || t.syncedTab !== tabOf(st, t)))
  for (const tab of new Set(clears.map((t) => t.syncedTab!))) {
    if (!tabs.has(tab)) continue
    const rows = await idRows(token, sheetId, tab)
    for (const t of clears.filter((c) => c.syncedTab === tab)) {
      const r = rows.get(t.id)
      if (r) await http('POST', `${API}/${sheetId}/values/${range(`'${tab}'!A${r}:${LAST_COL}${r}`)}:clear`, token, {})
    }
  }
  todo.filter((t) => t.deleted).forEach((t) => done.set(t.id, null))
  const live = todo.filter((t) => !t.deleted)
  for (const tab of new Set(live.map((t) => tabOf(st, t)))) {
    if (!tabs.has(tab)) { await addTab(token, sheetId, tab); tabs.add(tab) }
    const rows = await idRows(token, sheetId, tab)
    const list = live.filter((t) => tabOf(st, t) === tab)
    const update = list.filter((t) => rows.has(t.id)), add = list.filter((t) => !rows.has(t.id))
    if (update.length) await batchUpdate(token, sheetId, update.map((t) => [`'${tab}'!A${rows.get(t.id)}:${LAST_COL}${rows.get(t.id)}`, row(st, t)]))
    if (add.length) await append(token, sheetId, tab, add.map((t) => row(st, t)))
    list.forEach((t) => done.set(t.id, tab))
  }
  store.update((s) => ({
    ...s,
    txns: s.txns.flatMap((t) => {
      if (!done.has(t.id)) return [t]
      if (t.updatedAt > todo.find((x) => x.id === t.id)!.updatedAt) return [t] // edited mid-sync: next run handles it
      if (t.deleted) return [] // removal reached Sheets: purge
      return [{ ...t, syncedAt: now, syncedTab: done.get(t.id) ?? undefined }]
    }),
  }), { notify: false })
}

async function runOnce(token: string) {
  let sheetId = store.get().sync.spreadsheetId ?? (await findSpreadsheet(token)) ?? (await createSpreadsheet(token))
  const setId = (id: string) => store.update((s) => ({ ...s, sync: { ...s.sync, spreadsheetId: id } }), { notify: false })
  setId(sheetId)
  let tabs: Set<string>
  try {
    tabs = await existingTabs(token, sheetId)
  } catch (e) {
    if (!(e instanceof HttpError) || e.code !== 404) throw e
    sheetId = await createSpreadsheet(token) // the spreadsheet was deleted: start fresh and push everything again
    setId(sheetId)
    store.update((s) => ({ ...s, txns: s.txns.map((t) => ({ ...t, syncedAt: undefined, syncedTab: undefined })) }), { notify: false })
    tabs = new Set()
  }
  // 1. Take every record the other app changed more recently. 2. Readable tabs. 3. Our newer records.
  const remote = tabs.has(SYNC_TAB) ? await readRecords(token, sheetId) : new Map<string, [number, Remote]>()
  const remoteRecords = Object.fromEntries([...remote].map(([k, [, r]]) => [k, r]))
  store.update((s) => mergeRemote(s, remoteRecords), { notify: false, stamp: false })
  // Before setup (first run, loading from the phone) we only take: nothing blank goes up to overwrite the sheet.
  if (!store.get().setup) return store.update((s) => ({ ...s, sync: { ...s.sync, lastSync: Date.now(), paused: undefined } }), { notify: false })
  await pushTxns(token, sheetId, tabs)
  const up = toUpload(store.get(), remoteRecords)
  const keys = Object.keys(up)
  if (keys.length) {
    if (!tabs.has(SYNC_TAB)) { await addTab(token, sheetId, SYNC_TAB, SYNC_HEADER); tabs.add(SYNC_TAB) }
    const cells = (k: string) => [k, String(up[k].stamp), up[k].json ?? '']
    const upd = keys.filter((k) => remote.has(k)), add = keys.filter((k) => !remote.has(k))
    if (upd.length) await batchUpdate(token, sheetId, upd.map((k) => [`'${SYNC_TAB}'!A${remote.get(k)![0]}:C${remote.get(k)![0]}`, cells(k)]))
    if (add.length) await append(token, sheetId, SYNC_TAB, add.map(cells))
  }
  store.update((s) => ({ ...s, sync: { ...s.sync, lastSync: Date.now(), paused: undefined } }), { notify: false })
}

let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

const pause = (reason: string) => store.update((s) => ({ ...s, sync: { ...s.sync, paused: reason } }), { notify: false })

/** One sync now (or right after the one in progress). Needs a token; without one, sync waits for the next tap. */
export async function syncNow(): Promise<void> {
  if (!store.get().sync.enabled) return
  if (running) { again = true; return running }
  const token = currentToken()
  if (!token) return pause('Tap anywhere to reconnect Google Sheets.')
  running = runOnce(token)
    .catch((e) => {
      if (e instanceof HttpError && (e.code === 401 || e.code === 403)) pause('Google access expired. Tap to reconnect.')
      else if (e instanceof TypeError) pause("Offline. Changes will sync when you're back online.")
      else pause(`Sync failed: ${e.message}`)
    })
    .finally(() => { running = null; if (again) { again = false; queueSync(0) } })
  return running
}

/** After every change: a couple of seconds later, so a burst of edits goes up together. */
export function queueSync(delayMs = 2000) {
  clearTimeout(timer)
  timer = setTimeout(syncNow, delayMs)
}

/** Sync on open, after each change, when the tab comes back into view, and every minute while it's visible. */
export function startSync() {
  store.onChange(() => queueSync())
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueSync(0) })
  window.addEventListener('online', () => queueSync(0))
  setInterval(() => { if (!document.hidden) syncNow() }, 60_000)
  queueSync(0)
}

