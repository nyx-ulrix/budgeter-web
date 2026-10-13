import { Ai, preset } from './ai'

/**
 * "Sign in with OpenRouter" (OAuth PKCE). On the web OpenRouter redirects straight back to this page with a code,
 * which is swapped for a key the user controls. The verifier waits in sessionStorage across the redirect.
 */
const VERIFIER = 'budgeter-openrouter-verifier'
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function startOpenRouter() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  sessionStorage.setItem(VERIFIER, verifier)
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const callback = `${location.origin}${location.pathname}?openrouter=1`
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${challenge}&code_challenge_method=S256`
}

/** On page load: finishes a sign-in we were redirected back from. Returns a status message, or null if none. */
export async function finishOpenRouter(): Promise<string | null> {
  const url = new URL(location.href)
  if (url.searchParams.get('openrouter') !== '1') return null
  const code = url.searchParams.get('code')
  history.replaceState(null, '', url.pathname)
  const verifier = sessionStorage.getItem(VERIFIER)
  sessionStorage.removeItem(VERIFIER)
  if (!code || !verifier) return 'OpenRouter sign-in was cancelled.'
  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    })
    if (!r.ok) return `OpenRouter said ${r.status}. Try signing in again.`
    const { key } = await r.json()
    const p = preset('openrouter')
    await Ai.save(Ai.newProvider(p.id, 'OpenRouter', p.base, p.model), key)
    return 'Signed in to OpenRouter.'
  } catch (e: any) {
    return e?.message ?? 'Sign-in failed.'
  }
}
