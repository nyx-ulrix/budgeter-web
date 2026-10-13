import { isoDate, validDate } from './budget'
import { digits, parseMoney } from './money'
import { ParsedReceipt, ReceiptItem, parsedReceipt, receiptItem } from './receipt'

/*
 * Rule-based receipt parser for raw OCR text, one printed row per line. Used when no AI provider is selected
 * or the AI call fails. Only reads what is printed; never computes a tax or service charge.
 * ponytail: keyword heuristics cover common till receipts; odd layouts fall back to the user correcting the editor.
 */

/** A price at the end of a line, shaped by how many decimals the currency uses (¥1,200 / 12.50 / 1.250). */
function priceRegex(decimals: number): RegExp {
  const num = decimals === 0 ? String.raw`\d{1,3}(?:[,.]\d{3})+|\d+`
    : decimals === 2 ? String.raw`\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2}`
    : String.raw`\d{1,3}(?:,\d{3})+\.\d{${decimals}}|\d+[.,]\d{${decimals}}`
  return new RegExp(String.raw`(-)?\s*(?:S\$|RM|US\$|\$|€|£|¥|円|₩|SGD|MYR|USD|JPY|KD|KWD)?\s*(${num})\s*(-)?\s*[A-Za-z*#円]?\s*$`)
}
const qtyPrefix = /^(\d{1,2})\s*[xX@]?\s+(.*[A-Za-z].*)$/
const skip = /\b(CHANGE|CASH|TENDER|VISA|MASTER|AMEX|NETS|PAYNOW|CARD|PAID|PAYMENT|ROUNDING|ITEMS?\s*COUNT|QTY)\b/
// OCR often reads TOTAL's last letter as 1, I, |, O or 0 ("Net Tota1", "Subtotao"), so those count too.
const TOTAL = String.raw`T[O0]TA[L1I|!O0\]]`
const subtotalWord = new RegExp(String.raw`SUB\s*-?\s*(T[O0E]T|${TOTAL})`) // "Sub Teta )" too
const totalWord = new RegExp(String.raw`\b(GRAND|${TOTAL}|AMOUNT\s+DUE|NETT|BALANCE)`)
const serviceWord = /\b(SERVICE|SERV|SVC|SVR|S\/C|SC|CHG|CHRG)\b/
const taxWord = /\b(GST|TAX|VAT|SST)\b/
const discountWord = /\b(DISC|DISCOUNT|LESS|PROMO|VOUCHER)\b/
const inclusive = /INCL|INCLUSIVE|INCLUDES|INCLUDED/
/** Section headers like "*** Retail/Takeaway ***" or "== DINE IN ==": never items. */
const banner = /^[*=#~-]{2,}.*[*=#~-]{2,}$/
const hasLetter = (s: string) => /\p{L}/u.test(s)

/** Subtotal, total and payment lines: never items, whoever read the receipt. */
export function isSummary(name: string): boolean {
  const u = name.toUpperCase()
  return subtotalWord.test(u) || totalWord.test(u) || skip.test(u)
}

/** One recognised line of text: centre, size and slant (radians) in image pixels. */
export interface Seg { text: string; cx: number; cy: number; w: number; h: number; angle: number }

const priceOnly = /^(?:S\$|RM|US\$|SGD|MYR|\$)?\s*-?\s*\$?\d[\d,]*[.,]\d{2,3}\s*-?\s*[A-Z*#]?$/

const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/**
 * Joins OCR lines into printed rows. Words on the same row are grouped first; then each price-only line goes to the
 * row whose own slant, carried across to the price, passes closest to it. A curled or tilted receipt then keeps
 * "Svc Chg 10%" with 5.65 instead of the price drifting onto the GST row below.
 * ponytail: price-only lines need decimals, so whole-number prices (yen) fall back to plain row grouping.
 */
export function joinRows(segs: Seg[]): string {
  if (segs.length === 0) return ''
  const pitch = median(segs.map((s) => s.h))
  const wide = segs.filter((s) => s.w > 3 * s.h).map((s) => s.angle)
  const slant = wide.length ? median(wide) : 0
  const sin = Math.sin(slant), cos = Math.cos(slant)
  const ry = (s: Seg) => -s.cx * sin + s.cy * cos
  const isPrice = (s: Seg) => priceOnly.test(s.text.trim().toUpperCase())
  const prices = segs.filter(isPrice), words = segs.filter((s) => !isPrice(s))
  const rows: Seg[][] = []
  for (const s of [...words].sort((a, b) => ry(a) - ry(b))) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(ry(row[0]) - ry(s)) <= pitch * 0.5) row.push(s)
    else rows.push([s])
  }
  // How far the price sits from the row's baseline carried across to it; the row's widest piece sets the slant.
  const miss = (row: Seg[], p: Seg) => {
    const l = row.reduce((a, b) => (b.w > a.w ? b : a))
    const a = l.w > 3 * l.h ? l.angle : slant
    return Math.abs(p.cy - (l.cy + (p.cx - l.cx) * Math.tan(a)))
  }
  const pairs = prices
    .flatMap((p) => rows.flatMap((row, r) => (row.every((s) => s.cx < p.cx) ? [{ p, r, miss: miss(row, p) }] : [])))
    .filter((x) => x.miss < pitch * 0.75)
    .sort((a, b) => a.miss - b.miss)
  // Segs compare by value, like the Kotlin data class.
  const id = (s: Seg) => JSON.stringify([s.text, s.cx, s.cy, s.w, s.h, s.angle])
  const priceOf = new Map<number, Seg>()
  const used = new Set<string>()
  for (const { p, r } of pairs) if (!used.has(id(p)) && !priceOf.has(r)) { priceOf.set(r, p); used.add(id(p)) }
  const out: [number, string][] = [
    ...rows.map((row, r): [number, string] => {
      const parts = [...row].sort((a, b) => a.cx - b.cx)
      const p = priceOf.get(r)
      return [ry(row[0]), (p ? [...parts, p] : parts).map((s) => s.text).join('   ')]
    }),
    ...prices.filter((p) => !used.has(id(p))).map((p): [number, string] => [ry(p), p.text]),
  ]
  return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('\n')
}

function item(name: string, amount: number): ReceiptItem {
  const m = qtyPrefix.exec(name)
  return m ? receiptItem(m[2].trim(), amount, Number(m[1])) : receiptItem(name, amount)
}

export function parse(text: string, fallbackCurrency: string): ParsedReceipt {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const upper = text.toUpperCase()
  const currency = upper.includes('S$') || upper.includes('SGD') ? 'SGD'
    : /\bRM\b|MYR/.test(upper) ? 'MYR'
    : text.includes('€') ? 'EUR'
    : text.includes('£') ? 'GBP'
    : text.includes('¥') || text.includes('円') ? 'JPY'
    : undefined
  const cur = currency ?? fallbackCurrency
  const price = priceRegex(digits(cur))
  let merchant = ''
  let date: string | undefined
  const items: ReceiptItem[] = []
  let subtotal: number | undefined
  let total: number | undefined
  let service = 0
  let tax = 0
  let discount = 0
  let taxIncluded = false
  let pendingName = ''
  let pendingPrice: number | undefined // a price that landed on a header row (tilted photo): it belongs to the next item

  for (const line of lines) {
    const u = line.toUpperCase()
    if (date == null) date = findDate(line) ?? undefined
    if (taxWord.test(u) && inclusive.test(u)) taxIncluded = true
    const m = price.exec(line)
    if (!m) {
      if (banner.test(line)) continue
      if (pendingPrice != null && hasLetter(line)) { items.push(item(line, pendingPrice)); pendingPrice = undefined; continue }
      if (merchant === '' && (line.match(/\p{L}/gu) ?? []).length >= 3) merchant = line
      else if (total == null && hasLetter(line)) pendingName = line
      continue
    }
    const negative = !!m[1] || !!m[3]
    const parsed = parseMoney(m[2], cur)
    if (parsed == null) continue
    const amount = negative ? -parsed : parsed
    const name = line.substring(0, m.index).trim() || pendingName
    const n = name.toUpperCase()
    pendingName = ''
    pendingPrice = undefined
    if (banner.test(name)) { if (total == null && subtotal == null) pendingPrice = amount; continue }
    if (skip.test(n)) { /* payment line */ }
    else if (subtotalWord.test(n)) subtotal = amount
    else if (totalWord.test(n)) { if (total == null || n.includes('GRAND')) total = amount }
    else if (serviceWord.test(n)) service += amount
    else if (taxWord.test(n)) tax += amount
    else if (discountWord.test(n)) {
      if (subtotal == null && total == null) items.push(receiptItem(name, -Math.abs(amount)))
      else discount += Math.abs(amount)
    } else if (total != null || name === '') { /* after the total, or no name */ }
    else items.push(item(name, amount))
  }
  return parsedReceipt({ merchant, date, currency, items, discount, subtotal, serviceCharge: service, tax, taxIncluded, total })
}

const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
const dmy = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/
const dMonY = /\b(\d{1,2})\s*([A-Za-z]{3})[A-Za-z]*[\s,]*(\d{2,4})\b/
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

/** ISO date from a receipt line. Numeric dates are read day-first unless that is impossible. */
export function findDate(line: string): string | null {
  const mk = (y: number, m: number, d: number) => {
    const yy = y < 100 ? 2000 + y : y
    return validDate(yy, m, d) ? isoDate(yy, m, d) : null
  }
  const i = iso.exec(line)
  if (i) { const r = mk(Number(i[1]), Number(i[2]), Number(i[3])); if (r) return r }
  const n = dmy.exec(line)
  if (n) {
    const [a, b, y] = [Number(n[1]), Number(n[2]), Number(n[3])]
    return mk(y, b, a) ?? mk(y, a, b)
  }
  const w = dMonY.exec(line)
  if (w) {
    const mon = MONTHS.findIndex((m) => m.startsWith(w[2].toUpperCase()))
    return mon < 0 ? null : mk(Number(w[3]), mon + 1, Number(w[1]))
  }
  return null
}
