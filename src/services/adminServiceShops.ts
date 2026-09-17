import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore'
import type { OwnerStatus, UserProfile } from '@/types'
import type { ServiceShop, ServiceShopStatus } from '@/types/serviceShop'
import { listAllUsersForAdmin } from '@/services/users'
import { requireDb } from '@/services/firebase'
import { createdAtMs } from '@/utils/shopDashboardMetrics'
import { SHOP_OWNER_CATEGORY, getOwnerShopCategories, shopCategoriesLine } from '@/utils/shopOwnerCategory'

const SERVICES_COL = 'services'
const REVIEWS_COL = 'shopReviews'
const BOOKINGS_COL = 'bookings'

export type OwnerServiceMetrics = {
  serviceCount: number
  reviewCount: number
  revenueK: number
  ratingAvg: number
}

async function getOwnerServiceOfferCount(ownerId: string): Promise<number> {
  const database = requireDb()
  const q = query(collection(database, SERVICES_COL), where('ownerId', '==', ownerId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

async function getOwnerReviewStats(ownerId: string): Promise<{ count: number; avg: number }> {
  const database = requireDb()
  const q = query(collection(database, REVIEWS_COL), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  if (snap.empty) return { count: 0, avg: 0 }
  let sum = 0
  let n = 0
  for (const d of snap.docs) {
    const r = Number((d.data() as { rating?: unknown }).rating)
    if (Number.isFinite(r) && r > 0) {
      sum += r
      n += 1
    }
  }
  return { count: snap.size, avg: n > 0 ? sum / n : 0 }
}

/** Completed (or equivalent) booking amount in LKR from raw Firestore fields. */
function completedBookingRevenueLkr(data: Record<string, unknown>): number {
  const st = String(data.status ?? '').trim().toLowerCase()
  if (!['completed', 'complete', 'done'].includes(st)) return 0
  for (const k of ['estimatedTotalLkr', 'estimatedTotal', 'totalLkr', 'amountLkr'] as const) {
    const v = data[k]
    if (typeof v === 'number' && !Number.isNaN(v) && v > 0) return v
  }
  const t = data.total
  if (typeof t === 'number' && !Number.isNaN(t) && t > 0) return t
  return 0
}

/** Sum completed booking totals in LKR, returned as thousands for UI (`revenueK`). */
async function getOwnerCompletedRevenueK(ownerId: string): Promise<number> {
  const database = requireDb()
  const q = query(collection(database, BOOKINGS_COL), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  let sumLkr = 0
  for (const d of snap.docs) {
    sumLkr += completedBookingRevenueLkr(d.data() as Record<string, unknown>)
  }
  return Math.round(sumLkr / 1000)
}

export async function fetchOwnerServiceMetrics(ownerId: string): Promise<OwnerServiceMetrics> {
  const [serviceCount, rev, revenueK] = await Promise.all([
    getOwnerServiceOfferCount(ownerId),
    getOwnerReviewStats(ownerId),
    getOwnerCompletedRevenueK(ownerId),
  ])
  return {
    serviceCount,
    reviewCount: rev.count,
    revenueK,
    ratingAvg: rev.avg,
  }
}

function ownerStatusToShopStatus(os: OwnerStatus | undefined): ServiceShopStatus {
  if (os === 'approved') return 'active'
  if (os === 'pending') return 'pending'
  return 'inactive'
}

function formatRevenueLabel(revenueK: number): string {
  if (revenueK >= 1000) {
    const m = revenueK / 1000
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  if (revenueK <= 0) return '0'
  return `${revenueK}K`
}

function establishedLabel(p: UserProfile): string {
  if (typeof p.yearsInBusiness === 'number' && p.yearsInBusiness >= 0) return String(p.yearsInBusiness)
  const ms = createdAtMs(p.createdAt)
  if (ms) return String(new Date(ms).getFullYear())
  return '—'
}

export function mapUserProfileToServiceShop(p: UserProfile, m: OwnerServiceMetrics): ServiceShop {
  const district = (p.district || '').trim() || '—'
  const city = (p.location || p.district || '').trim() || '—'
  const address = (p.shopAddress || p.address || '').trim() || '—'
  const name = (p.shopName || p.displayName || 'Shop').trim() || 'Shop'
  const joinedMs = createdAtMs(p.createdAt)
  const linesLabel = shopCategoriesLine(getOwnerShopCategories(p))

  return {
    id: p.uid,
    linesLabel,
    joinedMs,
    name,
    owner: p.displayName?.trim() || '—',
    phone: (p.phone || p.whatsapp || '—').trim() || '—',
    email: p.email?.trim() || '—',
    district,
    city,
    address,
    services: m.serviceCount,
    reviews: m.reviewCount,
    revenue: formatRevenueLabel(m.revenueK),
    revenueK: m.revenueK,
    rating: m.ratingAvg > 0 ? Math.round(m.ratingAvg * 10) / 10 : 0,
    status: ownerStatusToShopStatus(p.ownerStatus),
    established: establishedLabel(p),
  }
}

/** One read per collection; aggregate metrics by `ownerId` for the admin service list. */
async function buildOwnerServiceMetricsIndex(): Promise<(uid: string) => OwnerServiceMetrics> {
  const database = requireDb()
  const [svcSnap, revSnap, bookSnap] = await Promise.all([
    getDocs(collection(database, SERVICES_COL)),
    getDocs(collection(database, REVIEWS_COL)),
    getDocs(collection(database, BOOKINGS_COL)),
  ])

  const serviceCountByOwner = new Map<string, number>()
  for (const d of svcSnap.docs) {
    const oid = String((d.data() as { ownerId?: unknown }).ownerId ?? '').trim()
    if (!oid) continue
    serviceCountByOwner.set(oid, (serviceCountByOwner.get(oid) ?? 0) + 1)
  }

  const reviewAgg = new Map<string, { count: number; sum: number; n: number }>()
  for (const d of revSnap.docs) {
    const oid = String((d.data() as { ownerId?: unknown }).ownerId ?? '').trim()
    if (!oid) continue
    const r = Number((d.data() as { rating?: unknown }).rating)
    const cur = reviewAgg.get(oid) ?? { count: 0, sum: 0, n: 0 }
    cur.count += 1
    if (Number.isFinite(r) && r > 0) {
      cur.sum += r
      cur.n += 1
    }
    reviewAgg.set(oid, cur)
  }

  const revenueLkrByOwner = new Map<string, number>()
  for (const d of bookSnap.docs) {
    const oid = String((d.data() as { ownerId?: unknown }).ownerId ?? '').trim()
    if (!oid) continue
    const add = completedBookingRevenueLkr(d.data() as Record<string, unknown>)
    if (add > 0) revenueLkrByOwner.set(oid, (revenueLkrByOwner.get(oid) ?? 0) + add)
  }

  return (uid: string) => {
    const serviceCount = serviceCountByOwner.get(uid) ?? 0
    const rev = reviewAgg.get(uid)
    const reviewCount = rev?.count ?? 0
    const ratingAvg = rev && rev.n > 0 ? rev.sum / rev.n : 0
    const sumLkr = revenueLkrByOwner.get(uid) ?? 0
    const revenueK = Math.round(sumLkr / 1000)
    return { serviceCount, reviewCount, revenueK, ratingAvg }
  }
}

/** All shop owners from `users` + live counts from `services`, `shopReviews`, and `bookings`. */
export async function loadAdminServiceShopsFromFirestore(): Promise<ServiceShop[]> {
  const [all, metricsFor] = await Promise.all([listAllUsersForAdmin(), buildOwnerServiceMetricsIndex()])
  const owners = all.filter((u) => {
    if (u.role !== 'owner') return false
    const categories = getOwnerShopCategories(u)
    return categories.includes(SHOP_OWNER_CATEGORY.BIKE_SERVICE)
  })
  return owners.map((p) => mapUserProfileToServiceShop(p, metricsFor(p.uid)))
}
