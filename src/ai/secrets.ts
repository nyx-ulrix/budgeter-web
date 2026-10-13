/**
 * Small values encrypted with an AES-GCM key the browser generates as non-extractable: page code can use it
 * but never read it out, the closest a web app gets to the Android Keystore. Key in IndexedDB, ciphertext in
 * localStorage. Clearing site data loses both (re-enter the key).
 */
const DB = 'budgeter-secrets', STORE = 'keys', PREFIX = 'budgeter-secret-'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function key(): Promise<CryptoKey> {
  const d = await db()
  const existing = await new Promise<CryptoKey | undefined>((res, rej) => {
    const q = d.transaction(STORE).objectStore(STORE).get('aes'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error)
  })
  if (existing) return existing
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(k, 'aes'); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
  })
  return k
}

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const Secrets = {
  async put(name: string, value: string) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value))
    localStorage.setItem(PREFIX + name, `${b64(iv)}:${b64(enc)}`)
  },
  /** Null if missing or unreadable (e.g. the browser's key store was cleared). */
  async get(name: string): Promise<string | null> {
    const v = localStorage.getItem(PREFIX + name)
    if (!v) return null
    try {
      const [iv, enc] = v.split(':').map(unb64)
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), enc))
    } catch { return null }
  },
  async remove(name: string) { localStorage.removeItem(PREFIX + name) },
}
