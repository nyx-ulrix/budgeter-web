import { allocate } from './money'

/** One printed line item. [price] is the line total in minor units (qty already multiplied in). */
export interface ReceiptItem { name: string; price: number; qty: number }
export const receiptItem = (name: string, price: number, qty = 1): ReceiptItem => ({ name, price, qty })

/**
 * What a receipt prints, nothing more. Amounts are minor units. Charges the receipt doesn't print stay 0:
 * the app never applies a tax or service-charge rate on its own.
 */
export interface ParsedReceipt {
  merchant: string
  date?: string | null // ISO yyyy-MM-dd when known
  currency?: string | null
  items: ReceiptItem[]
  discount: number // bill-level discount, positive number
  subtotal?: number | null
  serviceCharge: number // only when printed as a separate line
  tax: number
  taxIncluded: boolean // "prices inclusive of GST": tax line is informational, not added
  total?: number | null
  category?: string | null // picked by the AI from the user's categories; the built-in reader leaves it empty
}

export const parsedReceipt = (r: Partial<ParsedReceipt> = {}): ParsedReceipt => ({
  merchant: '', items: [], discount: 0, serviceCharge: 0, tax: 0, taxIncluded: false, ...r,
})

/** Charges spread over the items: printed service charge + tax (unless already inside prices) − discount. */
export const charges = (r: ParsedReceipt): number => r.serviceCharge + (r.taxIncluded ? 0 : r.tax) - r.discount

export const computedTotal = (r: ParsedReceipt): number => r.items.reduce((a, i) => a + i.price, 0) + charges(r)

/** Printed total minus computed total; 0 when they agree or no total was printed. */
export const mismatch = (r: ParsedReceipt): number => (r.total == null ? 0 : r.total - computedTotal(r))

/** Each item's cost including its proportional share of charges. Sums exactly to computedTotal. */
export function itemCosts(r: ParsedReceipt): number[] {
  const shares = allocate(charges(r), r.items.map((i) => Math.max(i.price, 0)))
  return r.items.map((item, i) => item.price + shares[i])
}
