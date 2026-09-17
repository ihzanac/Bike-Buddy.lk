import type { Bike } from '@/types'
import type { Booking } from '@/types'

const MS_DAY = 86_400_000

/** Local calendar YYYY-MM-DD (shop “today” for scheduled booking date). */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + deltaDays)
  return localYmd(dt)
}

export function createdAtMs(createdAt: unknown): number {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis?: () => number }).toMillis === 'function'
  ) {
    return (createdAt as { toMillis: () => number }).toMillis()
  }
  if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
    const s = (createdAt as { seconds?: unknown }).seconds
    return typeof s === 'number' ? s * 1000 : 0
  }
  return 0
}

export function countBookingsOnScheduleDate(bookings: Booking[], ymd: string): number {
  return bookings.filter((b) => b.date === ymd).length
}

export function uniqueCustomerIds(bookings: Booking[]): number {
  return new Set(bookings.map((b) => b.customerId).filter(Boolean)).size
}

export function bookingsCreatedSinceMs(bookings: Booking[], sinceMs: number): number {
  return bookings.filter((b) => createdAtMs(b.createdAt) >= sinceMs).length
}

export function averageReviewRating(ratings: number[]): number {
  if (!ratings.length) return 0
  return ratings.reduce((a, b) => a + b, 0) / ratings.length
}

export function activeBikeListings(bikes: Bike[]): number {
  return bikes.filter((b) => b.active !== false).length
}

export function bikesCreatedSinceMs(bikes: Bike[], sinceMs: number): number {
  return bikes.filter((b) => createdAtMs(b.createdAt) >= sinceMs).length
}

function dayStartMs(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export type ChartRange = 'Week' | 'Month' | 'Year'

/** Buckets for line chart: new bookings per bucket + second series (revenue K or new listings). */
export function buildActivityLine(
  range: ChartRange,
  bookings: Booking[],
  bikes: Bike[],
): {
  labels: string[]
  bookingsPerBucket: number[]
  secondPerBucket: number[]
  secondLabel: string
  secondIsRevenue: boolean
} {
  const now = Date.now()
  let numBuckets: number
  let bucketMs: number

  if (range === 'Week') {
    numBuckets = 7
    bucketMs = MS_DAY
  } else if (range === 'Month') {
    numBuckets = 4
    bucketMs = 7 * MS_DAY
  } else {
    numBuckets = 12
    bucketMs = 30 * MS_DAY
  }

  const windowStart = dayStartMs(now - numBuckets * bucketMs)
  const labels: string[] = []
  const bookingsPerBucket: number[] = []
  const secondPerBucket: number[] = []

  const hasRevenue = bookings.some(
    (b) => typeof b.estimatedTotalLkr === 'number' && !Number.isNaN(b.estimatedTotalLkr) && b.estimatedTotalLkr > 0,
  )
  const secondIsRevenue = hasRevenue
  const secondLabel = secondIsRevenue ? 'Revenue (LKR ×1000)' : 'New listings'

  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = windowStart + i * bucketMs
    const bucketEnd = bucketStart + bucketMs
    if (range === 'Week') {
      labels.push(
        new Date(bucketStart).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      )
    } else if (range === 'Month') {
      labels.push(`W${i + 1}`)
    } else {
      labels.push(new Date(bucketStart).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }))
    }

    let bc = 0
    let rev = 0
    for (const b of bookings) {
      const t = createdAtMs(b.createdAt)
      if (t >= bucketStart && t < bucketEnd) {
        bc++
        if (typeof b.estimatedTotalLkr === 'number' && b.estimatedTotalLkr > 0) rev += b.estimatedTotalLkr
      }
    }
    bookingsPerBucket.push(bc)

    if (secondIsRevenue) {
      secondPerBucket.push(Number((rev / 1000).toFixed(1)))
    } else {
      let nb = 0
      for (const b of bikes) {
        const t = createdAtMs(b.createdAt)
        if (t >= bucketStart && t < bucketEnd) nb++
      }
      secondPerBucket.push(nb)
    }
  }

  return { labels, bookingsPerBucket, secondPerBucket, secondLabel, secondIsRevenue }
}

/** Single line: new bike listings created per time bucket. */
export function buildListingTrendLine(
  range: ChartRange,
  bikes: Bike[],
): { labels: string[]; counts: number[] } {
  const now = Date.now()
  let numBuckets: number
  let bucketMs: number
  if (range === 'Week') {
    numBuckets = 7
    bucketMs = MS_DAY
  } else if (range === 'Month') {
    numBuckets = 4
    bucketMs = 7 * MS_DAY
  } else {
    numBuckets = 12
    bucketMs = 30 * MS_DAY
  }
  const windowStart = dayStartMs(now - numBuckets * bucketMs)
  const labels: string[] = []
  const counts: number[] = []
  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = windowStart + i * bucketMs
    const bucketEnd = bucketStart + bucketMs
    if (range === 'Week') {
      labels.push(
        new Date(bucketStart).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      )
    } else if (range === 'Month') {
      labels.push(`W${i + 1}`)
    } else {
      labels.push(new Date(bucketStart).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }))
    }
    let n = 0
    for (const b of bikes) {
      const t = createdAtMs(b.createdAt)
      if (t >= bucketStart && t < bucketEnd) n++
    }
    counts.push(n)
  }
  return { labels, counts }
}

/** Doughnut: bike counts by category (top 5 + Other). */
const STATUS_COLORS: Record<string, string> = {
  pending: '#F39C12',
  accepted: '#27AE60',
  rejected: '#e74c3c',
  completed: '#3498DB',
}

/** Doughnut: booking counts by status (service shops). */
export function buildBookingStatusChart(bookings: Booking[]): {
  labels: string[]
  data: number[]
  colors: string[]
} {
  const order: Booking['status'][] = ['pending', 'accepted', 'rejected', 'completed']
  const labels: string[] = []
  const data: number[] = []
  const colors: string[] = []
  for (const st of order) {
    const n = bookings.filter((b) => b.status === st).length
    if (n > 0) {
      labels.push(st.charAt(0).toUpperCase() + st.slice(1))
      data.push(n)
      colors.push(STATUS_COLORS[st] ?? '#94a3b8')
    }
  }
  if (!labels.length) {
    return { labels: ['No bookings'], data: [1], colors: ['#e2e8f0'] }
  }
  return { labels, data, colors }
}

export function buildBikeCategoryChart(bikes: Bike[]): {
  labels: string[]
  data: number[]
  colors: string[]
} {
  const palette = ['#FF6B35', '#3498DB', '#27AE60', '#9B59B6', '#F39C12', '#94a3b8']
  const counts = new Map<string, number>()
  for (const b of bikes) {
    if (b.active === false) continue
    const c = (b.category || 'Other').trim() || 'Other'
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = entries.slice(0, 5)
  const rest = entries.slice(5).reduce((s, [, n]) => s + n, 0)
  const labels = top.map(([k]) => k)
  const data = top.map(([, n]) => n)
  if (rest > 0) {
    labels.push('Other')
    data.push(rest)
  }
  if (!labels.length) {
    return { labels: ['No listings'], data: [1], colors: ['#e2e8f0'] }
  }
  const colors = labels.map((_, i) => palette[i % palette.length]!)
  return { labels, data, colors }
}

export function formatDelta(current: number, previous: number): { text: string; up: boolean | null } {
  if (previous === 0 && current === 0) return { text: 'No change vs prior day', up: null }
  if (previous === 0) return { text: `+${current} vs prior day`, up: true }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: 'Same as prior day', up: null }
  if (pct > 0) return { text: `+${pct}% vs prior day`, up: true }
  return { text: `${pct}% vs prior day`, up: false }
}
