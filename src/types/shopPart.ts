/** Aligns with customer parts filters. */
export type PartCategory = 'engine' | 'brake' | 'electrical' | 'body' | 'accessories'
export type PartBrand = 'genuine' | 'oem' | 'aftermarket'
export type StockLevel = 'in-stock' | 'low-stock' | 'out-stock'

export const PART_CATEGORY_OPTIONS: { value: PartCategory; label: string }[] = [
  { value: 'engine', label: 'Engine Parts' },
  { value: 'brake', label: 'Brake System' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'body', label: 'Body Parts' },
  { value: 'accessories', label: 'Accessories' },
]

export const PART_BRAND_OPTIONS: { value: PartBrand; label: string }[] = [
  { value: 'genuine', label: 'Genuine' },
  { value: 'oem', label: 'OEM' },
  { value: 'aftermarket', label: 'Aftermarket' },
]

export const PART_CATEGORY_LABEL: Record<PartCategory, string> = Object.fromEntries(
  PART_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PartCategory, string>

export const PART_BRAND_LABEL: Record<PartBrand, string> = Object.fromEntries(
  PART_BRAND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PartBrand, string>

export type ShopPart = {
  id: string
  ownerId: string
  name: string
  category: PartCategory
  brand: PartBrand
  sku: string
  /** Units on hand */
  stockQty: number
  unitPrice: number
  oldPrice?: number
  reorderLevel: number
  supplier: string
  description: string
  imageUrl: string
  active: boolean
  createdAt: unknown
  updatedAt: unknown
}

export function stockLevelForPart(stockQty: number, reorderLevel: number): StockLevel {
  if (stockQty <= 0) return 'out-stock'
  if (stockQty <= reorderLevel) return 'low-stock'
  return 'in-stock'
}
