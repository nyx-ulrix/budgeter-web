/** Money is integer minor units (safe integers). Decimal maths goes through BigInt so it's exact. */

// Minor units where they differ from 2, from java.util.Currency (JDK 21); codes with none (metals, XDR) count as 0.
const DIGITS: Record<string, number> = Object.fromEntries(
  ('ADP BEF BIF BYB BYR CLP DJF ESP GNF GRD ISK ITL JPY KMF KRW LUF MGF PTE PYG ROL RWF TPE TRL UGX UYI VND VUV XAF XOF XPF ' +
    'XAG XAU XBA XBB XBC XBD XDR XFO XFU XPD XPT XSU XTS XUA XXX').split(' ').map((c) => [c, 0])
    .concat('BHD IQD JOD KWD LYD OMR TND'.split(' ').map((c) => [c, 3]), [['CLF', 4], ['UYW', 4]]),
)

/** Decimal places for an ISO currency code (JPY 0, SGD 2, KWD 3). Unknown codes get 2. */
export const digits = (currency: string): number => DIGITS[currency] ?? 2

/** Kotlin-style truncating integer division. */
export const div = (a: number, b: number): number => (a - (a % b)) / b

/** "12.5e-1" / "-0.009" → mantissa and power of ten, or null if it isn't a plain decimal number. */
function decimal(s: string): { m: bigint; e: number } | null {
  const r = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s)
  if (!r || (r[2] + (r[3] ?? '')) === '') return null
  const frac = r[3] ?? ''
  const m = BigInt(r[2] + frac || '0')
  return { m: r[1] === '-' ? -m : m, e: Number(r[4] ?? 0) - frac.length }
}

/** m × 10^e rounded to an integer, halves away from zero (BigDecimal HALF_UP). */
function roundHalfUp(m: bigint, e: number): bigint {
  if (e >= 0) return m * 10n ** BigInt(e)
  const p = 10n ** BigInt(-e)
  const neg = m < 0n
  const a = neg ? -m : m
  const q = a / p + ((a % p) * 2n >= p ? 1n : 0n)
  return neg ? -q : q
}

function toSafe(v: bigint): number | null {
  const n = Number(v)
  return Number.isSafeInteger(n) ? n : null
}

/** Minor units → "12.50". */
export function plain(minor: number, currency: string): string {
  const d = digits(currency)
  const s = Math.abs(minor).toString().padStart(d + 1, '0')
  const body = d === 0 ? s : s.slice(0, -d) + '.' + s.slice(-d)
  return (minor < 0 ? '-' : '') + body
}

function symbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

/** Minor units → "S$12.50" / "-¥300". */
export function money(minor: number, currency: string): string {
  const sym = symbol(currency)
  const d = digits(currency)
  const [int, frac] = plain(Math.abs(minor), currency).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + frac : '')
  const gap = /\p{L}$/u.test(sym) ? ' ' : '' // "SGD 12.50", "$12.50"
  return (minor < 0 ? '-' : '') + sym + gap + grouped
}

/** User text → minor units. Accepts "12", "12.5", "1,234.50", "12,50". Null if not a number. */
export function parseMoney(text: string, currency: string): number | null {
  const t = text.trim().replace(/[^0-9.,-]/g, '')
  if (!/\d/.test(t)) return null
  // The last separator is the decimal point, unless exactly 3 digits follow it (a thousands mark, "1,234")
  // in a currency that doesn't use 3 decimals.
  const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
  const num = last < 0 || (t.length - last - 1 === 3 && digits(currency) !== 3)
    ? t.replace(/[.,]/g, '')
    : t.substring(0, last).replace(/[.,]/g, '') + '.' + t.substring(last + 1)
  const v = /^-?\d*(\.\d*)?$/.test(num) ? decimal(num) : null // BigDecimal: one leading sign, no exponent here
  return v ? toSafe(roundHalfUp(v.m, v.e + digits(currency))) : null
}

/** Converts a foreign amount to home currency at [rate] home units per 1 foreign unit. */
export function convert(minor: number, from: string, to: string, rate: number): number {
  const r = decimal(String(rate))
  if (!r) throw new Error(`Bad rate: ${rate}`)
  return Number(roundHalfUp(BigInt(minor) * r.m, r.e - digits(from) + digits(to)))
}

/**
 * Splits [total] in proportion to [weights] so the parts sum exactly to [total] (largest remainder).
 * All-zero weights split equally. Negative totals are split by magnitude and keep their sign.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  if (!weights.every((w) => w >= 0)) throw new Error("Weights can't be negative")
  const w = weights.every((x) => x === 0) ? weights.map(() => 1n) : weights.map(BigInt)
  const sum = w.reduce((a, b) => a + b, 0n)
  const t = BigInt(Math.abs(total))
  const exact = w.map((x) => t * x)
  const parts = exact.map((x) => x / sum)
  let left = Number(t - parts.reduce((a, b) => a + b, 0n))
  const order = exact.map((_, i) => i).sort((a, b) => { const d = exact[b] % sum - exact[a] % sum; return d > 0n ? 1 : d < 0n ? -1 : 0 })
  for (const i of order) { if (left-- <= 0) break; parts[i]++ }
  return parts.map((p) => (total < 0 ? -Number(p) : Number(p)))
}
