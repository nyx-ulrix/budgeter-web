import { useSyncExternalStore } from 'react'
import { AppState, normState } from './state'
import { stampedSince } from './records'

const KEY = 'budgeter-state'

/**
 * The whole app state in memory, saved to the browser's localStorage after every change (same idea as the
 * Android app's one JSON file). Other open tabs pick changes up through the storage event.
 * ponytail: rewrites the full JSON per change; move to IndexedDB if it passes ~5 MB.
 */
function load(): AppState {
  const raw = localStorage.getItem(KEY)
  if (!raw) return normState({})
  try {
    return normState(JSON.parse(raw))
  } catch {
    // Never overwrite data we couldn't read: keep it aside and start empty.
    localStorage.setItem(`${KEY}-unreadable-${Date.now()}`, raw)
    return normState({})
  }
}

let state = load()
const listeners = new Set<() => void>()
const changeHooks = new Set<() => void>()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { console.error('save failed', e) }
}

export const store = {
  get: () => state,
  /**
   * [notify] false skips the change hooks (sync uses it to record its own progress without re-triggering itself).
   * Changed records are stamped for two-way sync; [stamp] false keeps the stamps [f] sets (applying the sheet's copy).
   */
  update(f: (s: AppState) => AppState, opts: { notify?: boolean; stamp?: boolean } = {}) {
    const old = state
    let next = f(old)
    if (next === old) return
    if (opts.stamp !== false) next = stampedSince(next, old, Date.now())
    state = next
    save()
    listeners.forEach((l) => l())
    if (opts.notify !== false) changeHooks.forEach((h) => h())
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  /** Called after every user change (sync is queued). */
  onChange(h: () => void) { changeHooks.add(h); return () => { changeHooks.delete(h) } },
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return
  try { state = normState(JSON.parse(e.newValue)); listeners.forEach((l) => l()) } catch { /* the other tab's write was partial */ }
})

export const useAppState = () => useSyncExternalStore(store.subscribe, store.get)
