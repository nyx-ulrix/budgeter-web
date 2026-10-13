import { allocate } from './money'

export type SplitMethod = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES' | 'ITEMS'
export const SPLIT_LABEL: Record<SplitMethod, string> = { EQUAL: 'Equal', EXACT: 'Exact', PERCENT: 'Percent', SHARES: 'Shares', ITEMS: 'By item' }
export const SPLIT_METHODS = Object.keys(SPLIT_LABEL) as SplitMethod[]

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
function require(ok: boolean, msg: () => string) { if (!ok) throw new Error(msg()) }

/**
 * Each person's share of [total]. [values] is one entry per person:
 * EQUAL ignores it, EXACT is amounts that must sum to total, PERCENT is basis points (1% = 100) summing to 10000,
 * SHARES is weights. ITEMS is handled by itemShares. Throws an Error with a user-facing message.
 */
export function split(total: number, method: SplitMethod, values: number[]): number[] {
  require(values.length > 0, () => 'Add at least one person')
  switch (method) {
    case 'EQUAL':
      return allocate(total, values.map(() => 1))
    case 'SHARES':
      require(values.every((v) => v >= 0) && values.some((v) => v > 0), () => 'Shares must be positive')
      return allocate(total, values)
    case 'PERCENT': {
      require(values.every((v) => v >= 0), () => "Percentages can't be negative")
      const pct = sum(values) / 100
      require(sum(values) === 10_000, () => `Percentages add up to ${Number.isInteger(pct) ? pct.toFixed(1) : pct}%, not 100%`)
      return allocate(total, values)
    }
    case 'EXACT':
      require(sum(values) === total, () => 'Amounts must add up to the total')
      return values
    case 'ITEMS':
      throw new Error('Use itemShares for item splits')
  }
}

/**
 * Item split: [costs] are each item's cost (already including its share of tax and service charge),
 * [owners] the people indexes sharing each item (empty = everyone). Returns a share per person.
 */
export function itemShares(costs: number[], owners: number[][], people: number): number[] {
  const out = new Array<number>(people).fill(0)
  const everyone = [...Array(people).keys()]
  costs.forEach((cost, i) => {
    const mine = [...new Set(owners[i] ?? [])].filter((p) => p >= 0 && p < people)
    const who = mine.length ? mine : everyone
    allocate(cost, who.map(() => 1)).forEach((part, k) => { out[who[k]] += part })
  })
  return out
}
