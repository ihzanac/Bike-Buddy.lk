/**
 * mailto: link so the customer can send themselves a booking summary to Gmail
 * (or any client) with one tap — no server required.
 */
export function mailtoBookingCopy(params: {
  to: string
  shopName: string
  contactName: string
  bikeNumber: string
  bikeType: string
  bikeModel?: string
  phone: string
  date: string
  time: string
  services: string
  totalLkr: number
  notes?: string
}): string {
  const lines = [
    'Hi,',
    '',
    'Please keep this as my BikeBuddy service booking summary.',
    '',
    `Shop: ${params.shopName}`,
    `Contact name: ${params.contactName}`,
    `Bike number: ${params.bikeNumber}`,
    `Bike type: ${params.bikeType}`,
  ]
  if (params.bikeModel?.trim()) lines.push(`Model: ${params.bikeModel.trim()}`)
  lines.push(
    `Phone: ${params.phone}`,
    `Date: ${params.date}`,
    `Time: ${params.time}`,
    '',
    `Services: ${params.services}`,
    `Estimated total: LKR ${params.totalLkr.toLocaleString()}`,
  )
  if (params.notes?.trim()) {
    lines.push('', `Notes: ${params.notes.trim()}`)
  }
  lines.push('', '— Sent from BikeBuddy.lk')
  const subject = `BikeBuddy booking — ${params.shopName}`
  const body = lines.join('\n')
  return `mailto:${encodeURIComponent(params.to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
