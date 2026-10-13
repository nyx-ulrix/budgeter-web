import { parseMoney } from '../core/money'
import type { ParsedReceipt } from '../core/receipt'
import * as ReceiptText from '../core/receiptText'
import { newId } from '../data/state'
import { Secrets } from './secrets'

/**
 * A provider preset. Every one speaks the OpenAI-style `POST {base}/chat/completions` with a Bearer key,
 * so one client covers them all (same list as the Android app).
 */
export interface Preset { id: string; name: string; base: string; model: string; keyUrl: string; note: string }

export const PRESETS: Preset[] = [
  { id: 'gemini', name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', keyUrl: 'https://aistudio.google.com/apikey', note: 'Free key from Google AI Studio. Cheapest way to start.' },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys', note: 'Sign in once to reach Claude, Gemini, GPT, DeepSeek, Perplexity and free models.' },
  { id: 'claude', name: 'Claude', base: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5', keyUrl: 'https://console.anthropic.com/settings/keys', note: 'Anthropic API key.' },
  { id: 'openai', name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini', keyUrl: 'https://platform.openai.com/api-keys', note: 'OpenAI API key.' },
  { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', note: 'DeepSeek API key. Very cheap. Reads text only, not photos.' },
  { id: 'perplexity', name: 'Perplexity', base: 'https://api.perplexity.ai', model: 'sonar', keyUrl: 'https://www.perplexity.ai/account/api/keys', note: 'Perplexity API key.' },
  { id: 'custom', name: 'Custom', base: '', model: '', keyUrl: '', note: 'Any OpenAI-compatible server that allows browser requests (CORS): a proxy, Ollama with OLLAMA_ORIGINS set.' },
]
export const preset = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1]

/** A saved login. The key itself lives encrypted in [Secrets], never in this object. Kept on this device only. */
export interface Provider { id: string; preset: string; label: string; base: string; model: string }

const PROVIDERS = 'budgeter-ai-providers', ACTIVE = 'budgeter-ai-active'
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d } catch { return d } }

export const Ai = {
  providers: (): Provider[] => read(PROVIDERS, []),
  activeId(): string | null { const id = localStorage.getItem(ACTIVE); return Ai.providers().some((p) => p.id === id) ? id : null },
  active: (): Provider | null => Ai.providers().find((p) => p.id === Ai.activeId()) ?? null,
  setActive(id: string | null) { id ? localStorage.setItem(ACTIVE, id) : localStorage.removeItem(ACTIVE) },
  async save(p: Provider, key: string | null) {
    localStorage.setItem(PROVIDERS, JSON.stringify([...Ai.providers().filter((x) => x.id !== p.id), p]))
    if (key != null) await Secrets.put(`key_${p.id}`, key.trim())
    if (!Ai.activeId()) Ai.setActive(p.id)
  },
  async remove(id: string) {
    localStorage.setItem(PROVIDERS, JSON.stringify(Ai.providers().filter((x) => x.id !== id)))
    await Secrets.remove(`key_${id}`)
    if (!Ai.activeId()) Ai.setActive(Ai.providers()[0]?.id ?? null)
  },
  hasKey: async (p: Provider) => (await Secrets.get(`key_${p.id}`)) != null,
  newProvider: (presetId: string, label: string, base: string, model: string): Provider => ({ id: newId(), preset: presetId, label, base, model }),
}

const SYSTEM = `You read a receipt (a photo, or text produced by OCR) and return JSON only, no prose, no code fences.
Schema:
{"merchant": string, "date": "YYYY-MM-DD" or null, "currency": ISO 4217 code or null,
 "items": [{"name": string, "qty": integer, "price": number}],
 "discount": number, "subtotal": number or null, "service_charge": number, "tax": number,
 "tax_included_in_prices": boolean, "total": number or null}
Rules:
- Copy only values that are printed. Never calculate, estimate or invent a tax, GST, VAT or service charge. If one is not printed, use 0.
- "price" is the printed line total for that item (quantity already multiplied).
- A discount printed against one item is its own item with a negative price. A discount on the whole bill goes in "discount" as a positive number.
- If the receipt says prices include tax (e.g. "inclusive of GST"), set tax_included_in_prices true and still copy the printed tax amount.
- If a service charge is already inside item prices and not printed as its own line, service_charge is 0.
- Ignore payment, card, cash, change, rounding and loyalty-point lines.
- Section headers such as "*** Retail/Takeaway ***" or "== Dine in ==" are not items. If a price sits on a header row, it belongs to the item printed next to it.
- Items are only the things bought. Their prices should add up to the printed subtotal; a line whose amount equals the sum of the items above it is a subtotal or total, not an item.
- Service charge is often printed as "Svc Chg", "S/C" or "Service Charge 10%", usually just before GST. Take each charge from its own label, not from the line next to it.
- Subtotal, total, grand total, balance, net total and tax lines are never items, even when the OCR misspells them (e.g. "Subtotao", "Net Tota1").
- Numbers are plain decimals without currency symbols or thousands separators.
- Dates on receipts are usually day-first unless that is impossible.`

/** Keys only travel over HTTPS, except to this computer or the local network (Ollama, LM Studio). */
export function safeBase(base: string): boolean {
  let u: URL
  try { u = new URL(base) } catch { return false }
  if (u.protocol === 'https:') return true
  if (u.protocol !== 'http:') return false
  const h = u.hostname
  return h === 'localhost' || h.endsWith('.local') || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
}

async function http(method: string, url: string, key: string, p: Provider, body?: unknown): Promise<any> {
  if (!safeBase(url)) throw new Error(`${p.label}: plain http is only allowed on your own network. Use https.`)
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (p.preset === 'claude') Object.assign(headers, { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' })
  if (p.preset === 'openrouter') headers['X-Title'] = 'Budgeter'
  let r: Response
  try {
    r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(90_000) })
  } catch {
    throw new Error(`Couldn't reach ${p.label}. Check your connection, or the provider may not allow requests from a browser.`)
  }
  const text = await r.text()
  if (!r.ok) {
    let msg = text.slice(0, 200)
    try { const e = JSON.parse(text).error; msg = typeof e === 'string' ? e : e?.message ?? msg } catch { /* not JSON */ }
    const s = r.status
    throw new Error(
      s === 401 || s === 403 ? `${p.label} rejected the key. Check it in Profile → AI. (${msg})`
        : s === 402 ? `${p.label} account is out of credit. (${msg})`
        : s === 404 ? `${p.label} doesn't know model "${p.model}". Pick another in Profile → AI.`
        : s === 429 ? `${p.label} rate limit hit. Wait a minute and retry.`
        : `${p.label} error ${s}: ${msg}`)
  }
  return JSON.parse(text)
}

async function keyOf(p: Provider): Promise<string> {
  const k = await Secrets.get(`key_${p.id}`)
  if (!k) throw new Error(`${p.label} has no key saved. Add it in Profile → AI.`)
  return k
}

/** One chat completion; returns the reply text. [image] is a data URL sent with the user message. */
export async function chat(p: Provider, system: string, user: string, image?: string): Promise<string> {
  const content = image ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: image } }] : user
  const res = await http('POST', p.base.replace(/\/+$/, '') + '/chat/completions', await keyOf(p), p,
    { model: p.model, messages: [{ role: 'system', content: system }, { role: 'user', content }] })
  const out = res?.choices?.[0]?.message?.content
  if (typeof out !== 'string') throw new Error(`${p.label} sent an unexpected reply.`)
  return out
}

/** Model ids the provider offers, for the model dropdown. Uses [typedKey], else the saved key of [p]. */
export async function models(p: Provider, typedKey?: string): Promise<string[]> {
  const key = typedKey?.trim() || (await Secrets.get(`key_${p.id}`))
  if (!key) return []
  try {
    const res = await http('GET', p.base.replace(/\/+$/, '') + '/models', key, p)
    return (res.data ?? []).map((m: any) => String(m.id).replace(/^models\//, '')).sort()
  } catch { return [] }
}

/**
 * Turns a receipt into a [ParsedReceipt] with [p], or with the built-in rules on the OCR [text] when [p] is null.
 * With a [photo] (JPEG data URL) the AI reads the photo itself; otherwise it gets the OCR text.
 */
export async function parse(p: Provider | null, text: string, fallbackCurrency: string, categories: string[], photo?: string): Promise<ParsedReceipt> {
  if (!p) return ReceiptText.parse(text, fallbackCurrency)
  const system = SYSTEM + `\n- Add "category": the one best fit for the whole receipt from this list, spelled exactly: ${categories.join(', ')}. Use "Other" only if nothing fits.`
  const reply = await chat(p, system, photo ? 'Read this receipt photo.' : text, photo)
  const a = reply.indexOf('{'), b = reply.lastIndexOf('}')
  let d: any
  try { d = JSON.parse(a >= 0 && b > a ? reply.slice(a, b + 1) : '') } catch { throw new Error(`${p.label} didn't return receipt data. Try again or use the built-in reader.`) }
  const curIn = typeof d.currency === 'string' && d.currency.length === 3 ? d.currency.toUpperCase() : null
  const cur = curIn ?? fallbackCurrency
  const m = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? parseMoney(String(v), cur) : null)   // exact, half-up
  return {
    merchant: d.merchant ?? '',
    date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
    currency: curIn,
    items: (Array.isArray(d.items) ? d.items : []).filter((i: any) => !ReceiptText.isSummary(String(i?.name ?? '')))
      .map((i: any) => ({ name: String(i.name ?? ''), price: m(i.price) ?? 0, qty: Math.max(Number(i.qty) || 1, 1) })),
    discount: Math.abs(m(d.discount) ?? 0),
    subtotal: m(d.subtotal),
    serviceCharge: m(d.service_charge) ?? 0,
    tax: m(d.tax) ?? 0,
    taxIncluded: d.tax_included_in_prices === true,
    total: m(d.total),
    category: categories.find((c) => c.toLowerCase() === String(d.category ?? '').trim().toLowerCase()) ?? null,
  } as ParsedReceipt
}
