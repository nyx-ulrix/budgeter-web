import { store } from '../data/store'

/**
 * Google sign-in for Sheets with Google Identity Services (token model, no server). Same Cloud project and the
 * same drive.file scope as the Android app, so both see the same Budgeter spreadsheet.
 * Tokens last about an hour; a new one needs a user gesture (the browser blocks popups otherwise), so an
 * expired token is renewed on the next tap anywhere in the app.
 */
export const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
export const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ''

declare const google: any

let token: { value: string; expires: number } | null = null
let loading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) return Promise.resolve()
  return (loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => resolve()
    s.onerror = () => { loading = null; reject(new Error("Couldn't load Google sign-in. Check your connection.")) }
    document.head.appendChild(s)
  }))
}

/** Load the sign-in script at startup, so a later tap can open the popup straight away (browsers block it otherwise). */
export const preloadGoogle = () => { loadGis().catch(() => {}) }

/** A valid token if we have one, without any popup. */
export const currentToken = () => (token && token.expires > Date.now() + 60_000 ? token.value : null)

/**
 * Asks Google for a token. [interactive] shows the account chooser and consent; otherwise the popup closes
 * by itself when consent was already given. Must run inside a click/tap handler.
 */
export async function requestToken(interactive: boolean, hint?: string | null): Promise<{ token: string; email?: string }> {
  if (!CLIENT_ID) throw new Error('Google sign-in isn\'t set up for this site yet (missing client ID).')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: `${DRIVE_FILE} email`,   // email only to remember which account to renew with
      hint: hint ?? undefined,
      prompt: interactive ? 'consent' : '',
      callback: (r: any) => {
        if (r.error) return reject(new Error(r.error_description || r.error))
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_FILE)) return reject(new Error('Google Sheets access wasn\'t granted.'))
        token = { value: r.access_token, expires: Date.now() + Number(r.expires_in) * 1000 }
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${r.access_token}` } })
          .then((x) => x.json()).then((u) => u.email && store.update((s) => ({ ...s, sync: { ...s.sync, account: u.email } }), { notify: false }))
          .catch(() => {})
        resolve({ token: r.access_token })
      },
      error_callback: (e: any) => reject(new Error(e?.type === 'popup_closed' ? 'Sign-in was closed.' : e?.message || 'Google sign-in failed.')),
    })
    client.requestAccessToken()
  })
}

export function signOut() {
  if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token.value, () => {})
  token = null
}
