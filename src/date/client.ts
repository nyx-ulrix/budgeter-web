import { useSyncExternalStore } from 'react'
import { Secrets } from '../ai/secrets'
import { budgetRows, Plan, totals, Tx } from './money'

/*
 * The shared date budget lives in Budgeter's own Firebase project (budgeter-510810), which the DateBudget site also
 * uses, so a partner on either sees the same budget. One login: the Google account Budgeter already signs in with
 * (its Sheets token, or Sign in with Google) is exchanged for a Firebase session over REST. The phone app
 * (date/DateClient.kt) does exactly the same requests. Data: Firestore REST, refreshed every few seconds while a
 * screen shows it (no SDK). Layout (DateBudget's firestore.rules): budgets/{code} {members, names, plan}; budgets/{code}/tx/{id}.
 */
// Budgeter's Firebase web key, from .env.local (not committed). It ships in the page like any Firebase web key;
// it only works from the Budgeter and DateBudget sites and only for sign-in and the database.
const KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? ''
const PROJECT = 'budgeter-510810'
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const SESSION = 'date-session-budgeter' // refresh token, encrypted (Secrets); new name, as DateBudget-project sessions don't carry over

export interface Budget { code: string; members: string[]; names: Record<string, string>; plan: unknown }
export interface DateState {
  phase: 'signedOut' | 'loading' | 'noBudget' | 'ready'
  uid?: string
  name?: string
  budget?: Budget
  txs: Tx[] // stored entries, newest first
  all: Tx[] // plus the plan's top-ups
  left: number
  topped: number
  spent: number
  error?: string
}

let state: DateState = { phase: 'signedOut', txs: [], all: [], left: 0, topped: 0, spent: 0 }
let session: { idToken: string; expires: number; refresh: string; uid: string; name: string } | null = null
const listeners = new Set<() => void>()
const setState = (s: Partial<DateState>) => { state = { ...state, ...s }; listeners.forEach((l) => l()) }
const set = setState
export const useDate = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => state)
export const dateState = () => state

// --- Firestore value conversion ---
type FV = Record<string, any>
const enc = (v: unknown): FV =>
  v === null || v === undefined ? { nullValue: null }
    : typeof v === 'string' ? { stringValue: v }
    : typeof v === 'boolean' ? { booleanValue: v }
    : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
    : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)])) } }
const dec = (v: FV): any =>
  'stringValue' in v ? v.stringValue
    : 'integerValue' in v ? Number(v.integerValue)
    : 'doubleValue' in v ? v.doubleValue
    : 'booleanValue' in v ? v.booleanValue
    : 'arrayValue' in v ? (v.arrayValue.values ?? []).map(dec)
    : 'mapValue' in v ? decFields(v.mapValue.fields ?? {})
    : null
const decFields = (f: Record<string, FV>) => Object.fromEntries(Object.entries(f).map(([k, x]) => [k, dec(x)]))
const fields = (o: object) => (enc(o) as any).mapValue.fields

// --- auth ---
async function post(url: string, body: unknown, form = false) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? String(body) : JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message ?? `DateBudget sign-in failed (${r.status})`)
  return j
}

async function token(): Promise<string> {
  if (!session) throw new Error('Not signed in to the date budget.')
  if (session.expires > Date.now() + 60_000) return session.idToken
  const j = await post(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refresh)}`, true)
  session = { ...session, idToken: j.id_token, refresh: j.refresh_token, expires: Date.now() + Number(j.expires_in) * 1000 }
  await Secrets.put(SESSION, JSON.stringify({ refresh: session.refresh, uid: session.uid, name: session.name }))
  return session.idToken
}

/** Signs in with a Google ID token (from Sign in with Google). */
export const signIn = (googleIdToken: string) => signInWith(`id_token=${googleIdToken}`)

/**
 * The one login: signs in with the Google access token Budgeter already got for Sheets, unless already signed in.
 * Called whenever Budgeter gets a token, so the date budget needs no sign-in of its own.
 */
export function signInWithGoogleToken(accessToken: string) {
  if (session || state.phase === 'loading' || !KEY) return
  void signInWith(`access_token=${accessToken}`, true)
}

async function signInWith(credential: string, quiet = false) {
  set({ phase: 'loading', error: undefined })
  try {
    const j = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${KEY}`, {
      postBody: `${credential}&providerId=google.com`, requestUri: location.origin, returnSecureToken: true,
    })
    session = { idToken: j.idToken, refresh: j.refreshToken, expires: Date.now() + Number(j.expiresIn) * 1000, uid: j.localId, name: j.displayName || j.firstName || 'Me' }
    await Secrets.put(SESSION, JSON.stringify({ refresh: session.refresh, uid: session.uid, name: session.name }))
    await refresh()
  } catch (e: any) {
    set({ phase: 'signedOut', error: quiet ? undefined : e?.message ?? 'Sign-in failed.' })
  }
}

export async function signOut() {
  session = null
  await Secrets.remove(SESSION)
  set({ phase: 'signedOut', uid: undefined, name: undefined, budget: undefined, txs: [], all: [], left: 0, topped: 0, spent: 0, error: undefined })
}

/** On app start: picks up the saved session, if any. */
export async function resume() {
  const saved = await Secrets.get(SESSION)
  if (!saved) return
  try {
    const s = JSON.parse(saved)
    session = { idToken: '', expires: 0, refresh: s.refresh, uid: s.uid, name: s.name }
    set({ phase: 'loading' })
    await token()
    await refresh()
  } catch {
    session = null // the saved session no longer works: sign in again (quietly, with Budgeter's Google token)
    set({ phase: 'signedOut' })
  }
}

// --- data ---
async function api(method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(path.startsWith('http') ? path : `${DOCS}${path}`, {
    method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(r.status === 403 ? "You don't have access to that budget." : j?.error?.message ?? `DateBudget error ${r.status}`)
  return j
}

let latest = 0 // only the newest reload may write: an older one finishing late would drop a just-saved entry

/** Reloads the budget and its entries. */
export async function refresh() {
  if (!session) return
  const mine = ++latest
  const set = (s: Partial<DateState>) => { if (mine === latest) setState(s) }
  try {
    const q = await api('POST', ':runQuery', {
      structuredQuery: {
        from: [{ collectionId: 'budgets' }],
        where: { fieldFilter: { field: { fieldPath: 'members' }, op: 'ARRAY_CONTAINS', value: { stringValue: session.uid } } },
        limit: 1,
      },
    })
    const doc = (q as any[]).find((x) => x.document)?.document
    if (!doc) return set({ phase: 'noBudget', uid: session.uid, name: session.name, budget: undefined, txs: [], all: [], error: undefined })
    const f = decFields(doc.fields ?? {})
    const code = doc.name.split('/').pop()
    const budget: Budget = { code, members: f.members ?? [], names: f.names ?? {}, plan: f.plan ?? f.monthly }
    const txs: Tx[] = []
    let page = ''
    do {
      const r = await api('GET', `/budgets/${code}/tx?pageSize=300${page ? `&pageToken=${page}` : ''}`)
      for (const d of r.documents ?? []) {
        const x = decFields(d.fields ?? {})
        // Whole minor units, rounded as Android does, even if a document holds a decimal.
        txs.push({ ...x, id: d.name.split('/').pop(), amount: Math.round(Number(x.amount)) || 0 } as Tx)
      }
      page = r.nextPageToken ?? ''
    } while (page)
    const rows = budgetRows(budget.plan, today())
    // DateBudget's carry-over for budgets from its first version: a fixed starting amount counts as a top-up,
    // once, on the budget's first day (dated today it would count again in every month's view).
    const base = typeof f.base === 'number' ? Math.round(f.base) : 0
    if (Number.isSafeInteger(base) && base > 0 && !txs.some((t) => t.id === 'starting-budget')) {
      const first = [...txs, ...rows].map((t) => t.date).filter(Boolean).sort()[0] ?? today()
      txs.push({ id: 'starting-budget', kind: 'topup', amount: base, note: 'Starting budget', date: first, by: '' })
    }
    txs.sort((a, b) => b.date.localeCompare(a.date))
    const all = [...txs, ...rows].sort((a, b) => b.date.localeCompare(a.date))
    set({ phase: 'ready', uid: session.uid, name: session.name, budget, txs, all, ...totals(all), error: undefined })
  } catch (e: any) {
    set({ error: e?.message ?? 'Couldn\'t load the date budget.' })
  }
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I lookalikes, as in DateBudget
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % 32]).join('')

/** Starts a new shared budget with you as its only member; the code is what your partner enters. */
export async function create() {
  await api('POST', `/budgets?documentId=${newCode()}`, { fields: fields({ members: [session!.uid], names: { [session!.uid]: session!.name } }) })
  await refresh()
}

/** Joins your partner's budget with their code (as DateBudget does: add yourself to members and names). */
export async function join(code: string) {
  const c = code.trim().toUpperCase()
  await api('POST', ':commit', {
    writes: [{
      update: { name: `projects/${PROJECT}/databases/(default)/documents/budgets/${c}`, fields: { names: { mapValue: { fields: { [session!.uid]: { stringValue: session!.name } } } } } },
      updateMask: { fieldPaths: [`names.\`${session!.uid}\``] },
      updateTransforms: [{ fieldPath: 'members', appendMissingElements: { values: [{ stringValue: session!.uid }] } }],
      currentDocument: { exists: true },
    }],
  }).catch(() => { throw new Error("That code didn't work. Check it, or the budget may already have two people.") })
  await refresh()
}

export async function setPlan(plan: Plan) {
  await api('PATCH', `/budgets/${state.budget!.code}?updateMask.fieldPaths=plan`, { fields: fields({ plan }) })
  await refresh()
}

export type Draft = { kind: Tx['kind']; amount: number; note: string; date: string }

export async function addTx(d: Draft) {
  const doc = await api('POST', `/budgets/${state.budget!.code}/tx`, { fields: fields({ ...d, by: session!.uid }) })
  const id = String(doc?.name ?? '').split('/').pop()
  if (!id) throw new Error("The date budget didn't confirm the save. Try again.")
  show({ id, ...d, by: session!.uid }) // in the list straight away, whatever the reload does
  await refresh()
}

/** Puts [t] into the loaded entries now (the next reload brings the stored copy). */
function show(t: Tx) {
  const txs = [t, ...state.txs.filter((x) => x.id !== t.id)].sort((a, b) => b.date.localeCompare(a.date))
  const all = [t, ...state.all.filter((x) => x.id !== t.id)].sort((a, b) => b.date.localeCompare(a.date))
  setState({ txs, all, ...totals(all) })
}

export async function updateTx(id: string, d: Draft) {
  await api('PATCH', `/budgets/${state.budget!.code}/tx/${id}?updateMask.fieldPaths=kind&updateMask.fieldPaths=amount&updateMask.fieldPaths=note&updateMask.fieldPaths=date`, { fields: fields(d) })
  await refresh()
}

export async function deleteTx(id: string) {
  await api('DELETE', `/budgets/${state.budget!.code}/tx/${id}`)
  await refresh()
}
