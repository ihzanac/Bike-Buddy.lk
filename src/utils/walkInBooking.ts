/** Synthetic Firestore customer id for walk-ins (no app account). Must match `firestore.rules` pattern. */
export function makeWalkInCustomerId(ownerUid: string): string {
  const uid = ownerUid.trim()
  let hex: string
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    hex = crypto.randomUUID().replace(/-/g, '').toLowerCase()
  } else {
    hex = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.replace(/\./g, '').toLowerCase()
  }
  const suffix = hex.slice(0, 32).padEnd(32, '0')
  return `walkin__${uid}__${suffix}`
}

export function buildWalkInOwnerNote(input: {
  customerName: string
  bikeNumber?: string
  phone?: string
  email?: string
  bikeType?: string
  bikeModel?: string
  details?: string
}): string {
  const parts = ['Walk-in', `Owner: ${input.customerName.trim()}`]
  const bn = input.bikeNumber?.trim()
  if (bn) parts.push(`Bike #: ${bn}`)
  const ph = input.phone?.trim()
  if (ph) parts.push(`Phone: ${ph}`)
  const em = input.email?.trim()
  if (em) parts.push(`Email: ${em}`)
  const bt = input.bikeType?.trim()
  if (bt) parts.push(`Bike type: ${bt}`)
  const bm = input.bikeModel?.trim()
  if (bm) parts.push(`Model: ${bm}`)
  const d = input.details?.trim()
  if (d) parts.push(`Notes: ${d}`)
  return parts.join(' · ')
}

export function isWalkInCustomerId(customerId: string): boolean {
  return customerId.startsWith('walkin__')
}

export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]!
}
