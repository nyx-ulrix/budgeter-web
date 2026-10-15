import { MACROS } from '../core/macros'
import { Provider, chat } from './ai'

/*
 * Macros for food you key in. The free USDA FoodData Central database comes first (generic foods like coffee or
 * rice, and branded products like protein powders); the AI provider is the paid fallback. Same as ai/Food.kt.
 * ponytail: the shared DEMO_KEY allows about 30 lookups an hour per network; a personal key from api.data.gov
 * lifts that if it ever bites.
 */

const FDC = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const FDC_KEY = 'DEMO_KEY'
/** USDA nutrient ids per macro (energy: kcal, Atwater general, Atwater specific). Sodium comes in mg. */
const IDS: Record<string, number[]> = { calories: [1008, 2047, 2048], protein: [1003], carbs: [1005], fat: [1004], fibre: [1079], sugar: [2000, 1063], sodium: [1093] }

/** One database match: macros per 100 g, and a serving size in grams when the label gives one. */
export interface FoodHit { name: string; per100: Record<string, number>; serving?: number }

const round1 = (v: number) => Math.round(v * 10) / 10

/** [per100] scaled to [grams], to one decimal. */
export const scaleMacros = (per100: Record<string, number>, grams: number): Record<string, number> =>
  Object.fromEntries(Object.entries(per100).map(([k, v]) => [k, round1((v * grams) / 100)]))

/** Reads one search result (exported for the test). */
export function readHit(f: any): FoodHit | null {
  const per100: Record<string, number> = {}
  for (const [k, ids] of Object.entries(IDS)) {
    const n = (f.foodNutrients ?? []).find((x: any) => ids.includes(x.nutrientId) && (k !== 'calories' || String(x.unitName).toUpperCase() === 'KCAL'))
    if (n && Number.isFinite(n.value)) per100[k] = n.value
  }
  if (per100.calories == null) return null
  const brand = f.brandName || f.brandOwner
  const name = String(f.description ?? '').trim()
  return {
    name: (/[a-z]/.test(name) ? name : name.charAt(0) + name.slice(1).toLowerCase()) + (brand ? ` · ${brand}` : ''),
    per100,
    serving: String(f.servingSizeUnit ?? '').toLowerCase() === 'g' && f.servingSize > 0 ? round1(f.servingSize) : undefined,
  }
}

/** Searches the food database. */
export async function lookupFood(query: string): Promise<FoodHit[]> {
  const res = await fetch(`${FDC}?api_key=${FDC_KEY}&pageSize=10&query=${encodeURIComponent(query.trim())}`)
  if (res.status === 429) throw new Error('The food database has had too many lookups from this network this hour. Try later, or fill with AI.')
  if (!res.ok) throw new Error(`Food lookup failed (${res.status}).`)
  const d = await res.json()
  return (d.foods ?? []).map(readHit).filter((h: FoodHit | null): h is FoodHit => h != null)
}

const SYSTEM = `You estimate nutrition for food someone ate. Reply with JSON only, no prose, no code fences:
{"calories": kcal, "protein": grams, "carbs": grams, "fat": grams, "fibre": grams, "sugar": grams, "sodium": milligrams}
Totals are for everything described, as eaten. If no amount is given, assume one typical serving. Use plain numbers.`

/** Macros for a free-text description, from the AI provider [p] (costs a request). */
export async function aiMacros(p: Provider, description: string): Promise<Record<string, number>> {
  const reply = await chat(p, SYSTEM, description)
  const a = reply.indexOf('{'), b = reply.lastIndexOf('}')
  let d: any
  try { d = JSON.parse(reply.slice(a, b + 1)) } catch { throw new Error(`${p.label} didn't return nutrition data. Try again.`) }
  const out: Record<string, number> = {}
  for (const m of MACROS) { const v = Number(d?.[m.key]); if (Number.isFinite(v) && v >= 0) out[m.key] = round1(v) }
  if (!Object.keys(out).length) throw new Error(`${p.label} didn't return nutrition data. Try again.`)
  return out
}
