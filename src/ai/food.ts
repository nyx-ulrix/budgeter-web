import { MACROS } from '../core/macros'
import { Provider, chat } from './ai'

/*
 * Macros for food you key in, from the same AI provider and key as receipt reading (each call is one request).
 * Look up gives a few likely matches per 100 g with a typical portion; Fill with AI totals a whole description.
 * Same as ai/Food.kt.
 */

/** One match: macros per 100 g, and one typical portion. */
export interface FoodHit { name: string; per100: Record<string, number>; portion?: { grams: number; label: string } }

/** Units for how much was eaten, portion first. ml counts as grams (close enough for drinks). */
export const UNITS: [string, string][] = [['portion', 'Portion'], ['g', 'Grams (g)'], ['ml', 'Millilitres (ml)'], ['oz', 'Ounces (oz)'], ['cup', 'Cups'], ['tbsp', 'Tablespoons'], ['tsp', 'Teaspoons']]
const GRAMS: Record<string, number> = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5 }

/** Grams in [amount] [unit] of [hit]; a portion with no size given counts as 100 g. */
export const gramsOf = (amount: number, unit: string, hit: FoodHit): number =>
  amount * (unit === 'portion' ? hit.portion?.grams ?? 100 : GRAMS[unit] ?? 1)

const round1 = (v: number) => Math.round(v * 10) / 10

/** [per100] scaled to [grams], to one decimal. */
export const scaleMacros = (per100: Record<string, number>, grams: number): Record<string, number> =>
  Object.fromEntries(Object.entries(per100).map(([k, v]) => [k, round1((v * grams) / 100)]))

/** Known macros in [o] as numbers of at least 0, rounded to one decimal. */
function macrosIn(o: any): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of MACROS) { const v = Number(o?.[m.key]); if (o?.[m.key] != null && Number.isFinite(v) && v >= 0) out[m.key] = round1(v) }
  return out
}

/** The JSON object in an AI reply (models sometimes wrap it in prose or code fences). */
function jsonIn(reply: string, p: Provider): any {
  const a = reply.indexOf('{'), b = reply.lastIndexOf('}')
  try { return JSON.parse(reply.slice(a, b + 1)) } catch { throw new Error(`${p.label} didn't return nutrition data. Try again.`) }
}

/** Reads the matches out of a Look up reply (exported for the test). */
export function readHits(d: any): FoodHit[] {
  return (Array.isArray(d?.foods) ? d.foods : []).flatMap((f: any) => {
    const per100 = macrosIn(f?.per100g)
    const grams = Number(f?.portion_grams)
    const name = String(f?.name ?? '').trim()
    if (!name || per100.calories == null) return []
    const portion = Number.isFinite(grams) && grams > 0 ? { grams: round1(grams), label: `${String(f.portion ?? '1 portion').trim() || '1 portion'} (${round1(grams)} g)` } : undefined
    return [{ name, per100, portion }]
  })
}

const LOOKUP = `You are a nutrition database. For the food the user names, list up to 5 likely matches: the plain version first,
then common variants (brands, regional or restaurant versions). Reply with JSON only, no prose, no code fences:
{"foods": [{"name": string, "portion": string like "1 scoop" or "1 cup" or "1 plate", "portion_grams": number,
 "per100g": {"calories": kcal, "protein": grams, "carbs": grams, "fat": grams, "fibre": grams, "sugar": grams, "sodium": milligrams}}]}
Values are per 100 g (per 100 ml for drinks). Use plain numbers.`

/** Likely matches for [query], from the AI provider [p]. */
export async function lookupFood(p: Provider, query: string): Promise<FoodHit[]> {
  return readHits(jsonIn(await chat(p, LOOKUP, query.trim()), p))
}

const SYSTEM = `You estimate nutrition for food someone ate. Reply with JSON only, no prose, no code fences:
{"calories": kcal, "protein": grams, "carbs": grams, "fat": grams, "fibre": grams, "sugar": grams, "sodium": milligrams}
Totals are for everything described, as eaten. If no amount is given, assume one typical serving. Use plain numbers.`

/** Macros for a free-text description as a whole, from the AI provider [p]. */
export async function aiMacros(p: Provider, description: string): Promise<Record<string, number>> {
  const out = macrosIn(jsonIn(await chat(p, SYSTEM, description), p))
  if (!Object.keys(out).length) throw new Error(`${p.label} didn't return nutrition data. Try again.`)
  return out
}
