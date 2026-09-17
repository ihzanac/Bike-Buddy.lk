import type { AdminBike, AdminBikeSpec } from '@/data/adminBikeSaleData'
import type { Bike } from '@/types'

export function formatLkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`
}

const PLACEHOLDER_IMG = '/bikes/ktm-duke-200.jpg'

/**
 * Merges custom “Label: value” lines from the shop with key inventory fields so
 * the customer “View Details” panel matches what was entered in the shop form.
 */
export function mergeDisplaySpecs(b: Bike): AdminBikeSpec[] {
  const seen = new Set<string>()
  const out: AdminBikeSpec[] = []
  const add = (label: string, value: string) => {
    const v = value?.trim()
    if (!v || v === '—') return
    const k = label.trim().toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push({ label: label.trim(), value: v })
  }
  for (const s of b.saleSpecs ?? []) {
    const lab = s.label?.trim()
    if (!lab) continue
    add(lab, s.value ?? '—')
  }
  if (b.brand?.trim()) add('Brand', b.brand)
  if (b.title?.trim()) add('Model', b.title)
  if (b.category?.trim()) add('Category', b.category)
  if (b.year != null && !Number.isNaN(b.year)) add('Year', String(b.year))
  if (b.bodyColor?.trim()) add('Color', b.bodyColor)
  if (b.fuelType?.trim()) add('Fuel', b.fuelType)
  if (b.engineCC != null && b.engineCC > 0) add('Engine', `${b.engineCC} cc`)
  if (b.location?.trim()) add('Location', b.location)
  if (b.supplier?.trim()) add('Supplier', b.supplier)
  if (b.stockQty != null && b.stockQty >= 0) add('Stock', `${b.stockQty} available`)
  if (out.length === 0) {
    const d = b.description?.trim()
    if (d) return [{ label: 'Details', value: d.length > 240 ? `${d.slice(0, 240)}…` : d }]
    return [
      { label: 'Category', value: b.category || '—' },
      { label: 'Info', value: '—' },
    ]
  }
  return out
}

function isChassisOrEngineIdSpec(label: string): boolean {
  const t = label.trim().toLowerCase()
  return (
    t === 'chassis' ||
    t === 'chassis no' ||
    t === 'chassis no.' ||
    t === 'chassis number' ||
    t === 'engine #' ||
    t === 'engine no' ||
    t === 'engine no.' ||
    t === 'engine number' ||
    t === 'eng no' ||
    t === 'frame no' ||
    t === 'frame number'
  )
}

/** Strips internal ID rows from the merged list for the public customer bike sale UI. */
export function customerVisibleSpecs(b: Bike): AdminBikeSpec[] {
  return mergeDisplaySpecs(b).filter((s) => !isChassisOrEngineIdSpec(s.label))
}

function displayNameForBike(b: Bike): string {
  const t = b.title?.trim() || 'Bike'
  const br = b.brand?.trim()
  if (!br) return t
  if (t.toLowerCase().startsWith(br.toLowerCase())) return t
  return `${br} ${t}`.trim()
}

function metaLineForBike(b: Bike): string | undefined {
  const parts: string[] = []
  if (b.category?.trim()) parts.push(b.category.trim())
  if (b.year != null && !Number.isNaN(b.year)) parts.push(String(b.year))
  if (b.location?.trim()) parts.push(b.location.trim())
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** Map a Firestore `bikes` doc to the card UI model used in BikeSaleShopView. */
export function bikeToAdminBike(b: Bike): AdminBike {
  const image = b.images[0]?.trim() || PLACEHOLDER_IMG
  const colors =
    b.saleColors && b.saleColors.length > 0
      ? b.saleColors
      : [{ name: 'As listed', hex: '#64748B' }]
  return {
    id: b.id,
    name: displayNameForBike(b),
    price: formatLkr(b.price),
    priceN: b.price,
    image,
    colors,
    modalColorBlock: b.modalColorBlock === true,
    specs: customerVisibleSpecs(b),
    description: b.description?.trim() || undefined,
    metaLine: metaLineForBike(b),
    additionalNotes: b.additionalNotes?.trim() || undefined,
  }
}
