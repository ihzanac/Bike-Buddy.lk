import type { Booking } from '@/types'
import type { ShopReview } from '@/types'
import type { ShopPart } from '@/types/shopPart'
import { stockLevelForPart } from '@/types/shopPart'
import { createdAtMs } from '@/utils/shopDashboardMetrics'

export type InboxCategory = 'booking' | 'review' | 'payment' | 'alert' | 'system'

export type ShopInboxItem = {
  id: string
  category: InboxCategory
  read: boolean
  title: string
  time: string
  body: string
  isToday: boolean
  sortMs: number
  bookingId?: string
  bookingStatus?: Booking['status']
  reviewId?: string
  partId?: string
}

function localYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatRelativeTime(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function isSameLocalDay(ms: number): boolean {
  return new Date(ms).toDateString() === new Date().toDateString()
}

export function inboxKeyBooking(id: string): string {
  return `booking:${id}`
}

export function inboxKeyReview(id: string): string {
  return `review:${id}`
}

export function inboxKeyPartStock(id: string): string {
  return `part:${id}:stock`
}

export function inboxKeyPayment(bookingId: string): string {
  return `payment:${bookingId}`
}

export function inboxKeyPlatformReport(reportId: string): string {
  return `platformReport:${reportId}`
}

export type PlatformReportInboxSlice = {
  id: string
  issue: string
  shop: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  sortMs: number
}

const PRI_DOT: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: '🚨',
  high: '🔴',
  medium: '🟡',
  low: '🔵',
}

/** Build notification rows from Firestore-backed entities + dismissed key set. */
export function buildShopInboxFeed(
  bookings: Booking[],
  reviews: ShopReview[],
  parts: ShopPart[],
  dismissed: Set<string>,
  platformReports: PlatformReportInboxSlice[] = [],
): ShopInboxItem[] {
  const out: ShopInboxItem[] = []
  const todayYmd = localYmd()

  for (const b of bookings) {
    const createdMs = createdAtMs(b.createdAt)
    const sortMs = Math.max(createdMs, createdAtMs(b.updatedAt))
    const isPaymentRow =
      b.status === 'completed' &&
      typeof b.estimatedTotalLkr === 'number' &&
      !Number.isNaN(b.estimatedTotalLkr) &&
      b.estimatedTotalLkr > 0

    const id = isPaymentRow ? inboxKeyPayment(b.id) : inboxKeyBooking(b.id)
    const read = dismissed.has(id)
    const category: InboxCategory = isPaymentRow ? 'payment' : 'booking'

    let title = 'Booking update'
    let body = `${b.serviceName} — ${b.date} at ${b.time}.`
    if (isPaymentRow) {
      const totalLkr = b.estimatedTotalLkr as number
      title = 'Booking completed'
      body = `${b.serviceName} on ${b.date} at ${b.time}. Estimated total LKR ${Math.round(totalLkr).toLocaleString()}.`
    } else if (b.status === 'pending') {
      title = 'New booking request'
      body = `${b.serviceName} on ${b.date} at ${b.time}. Booking ref ${b.id.slice(0, 8)}…`
    } else if (b.status === 'accepted') {
      title = 'Booking accepted'
      body = `${b.serviceName} on ${b.date} at ${b.time}.`
    } else if (b.status === 'rejected') {
      title = 'Booking declined'
      body = `${b.serviceName} on ${b.date} at ${b.time}.`
    } else if (b.status === 'completed') {
      title = 'Booking marked complete'
      body = `${b.serviceName} on ${b.date} at ${b.time}.`
    }

    out.push({
      id,
      category,
      read,
      title,
      body,
      time: formatRelativeTime(sortMs),
      isToday: isSameLocalDay(sortMs) || b.date === todayYmd,
      sortMs,
      bookingId: b.id,
      bookingStatus: b.status,
    })
  }

  for (const r of reviews) {
    const key = inboxKeyReview(r.id)
    const sortMs = createdAtMs(r.createdAt)
    out.push({
      id: key,
      category: 'review',
      read: dismissed.has(key),
      title: `Review from ${r.customerName}`,
      time: formatRelativeTime(sortMs),
      body:
        r.text.length > 220
          ? `${r.rating}★ — ${r.text.slice(0, 220)}…`
          : `${r.rating}★ — ${r.text || '(No text)'}`,
      isToday: isSameLocalDay(sortMs),
      sortMs,
      reviewId: r.id,
    })
  }

  for (const p of parts) {
    if (!p.active) continue
    const level = stockLevelForPart(p.stockQty, p.reorderLevel)
    if (level === 'in-stock') continue
    const key = inboxKeyPartStock(p.id)
    out.push({
      id: key,
      category: 'alert',
      read: dismissed.has(key),
      title: level === 'out-stock' ? `Out of stock: ${p.name}` : `Low stock: ${p.name}`,
      time: formatRelativeTime(createdAtMs(p.updatedAt ?? p.createdAt)),
      body:
        level === 'out-stock'
          ? `Stock is 0. Reorder level was ${p.reorderLevel}.`
          : `${p.stockQty} unit(s) left (reorder at ${p.reorderLevel}).`,
      isToday: isSameLocalDay(createdAtMs(p.updatedAt ?? p.createdAt)),
      sortMs: createdAtMs(p.updatedAt ?? p.createdAt),
      partId: p.id,
    })
  }

  for (const pr of platformReports) {
    const key = inboxKeyPlatformReport(pr.id)
    const desc =
      pr.description.length > 180 ? `${pr.description.slice(0, 180)}…` : pr.description || '(No details)'
    out.push({
      id: key,
      category: 'system',
      read: dismissed.has(key),
      title: 'Complaint about your shop',
      time: formatRelativeTime(pr.sortMs),
      body: `${PRI_DOT[pr.priority]} ${pr.issue} — ${pr.shop}. ${desc}`,
      isToday: isSameLocalDay(pr.sortMs),
      sortMs: pr.sortMs,
    })
  }

  out.sort((a, b) => b.sortMs - a.sortMs)
  return out.slice(0, 120)
}
