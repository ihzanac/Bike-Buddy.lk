import { collection, getDocs, type QuerySnapshot } from 'firebase/firestore'
import type { UserProfile } from '@/types'
import type { AdminBikeSaleShopRow, BikeSaleDirectoryStatus, SaleShop } from '@/types/saleShop'
import { listAllUsersForAdmin } from '@/services/users'
import { requireDb } from '@/services/firebase'
import {
  isBulkSeededSaleShopId,
  mapSaleShopDoc,
  SALE_SHOPS_COLLECTION,
} from '@/services/saleShops'
import { createdAtMs } from '@/utils/shopDashboardMetrics'
import {
  getOwnerShopCategories,
  SHOP_OWNER_CATEGORY,
} from '@/utils/shopOwnerCategory'

const BIKES_COL = 'bikes'
const REVIEWS_COL = 'shopReviews'

function ownerEligibleForBikeSaleDirectory(p: UserProfile): boolean {
  if (p.role !== 'owner') return false
  const cats = getOwnerShopCategories(p)
  if (cats.length === 0) return true
  return cats.includes(SHOP_OWNER_CATEGORY.BIKE_SALE)
}

function establishedLabel(p: UserProfile): string {
  if (typeof p.yearsInBusiness === 'number' && p.yearsInBusiness >= 0) {
    return String(p.yearsInBusiness)
  }
  const ms = createdAtMs(p.createdAt)
  if (ms) return String(new Date(ms).getFullYear())
  return '—'
}

function buildBikeCountByOwner(snap: QuerySnapshot): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>
    const oid = String(x.ownerId ?? '').trim()
    if (!oid) continue
    if (x.active === false) continue
    m.set(oid, (m.get(oid) ?? 0) + 1)
  }
  return m
}

function buildReviewAvgByOwner(snap: QuerySnapshot): Map<string, number> {
  const agg = new Map<string, { sum: number; n: number }>()
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>
    const oid = String(x.ownerId ?? '').trim()
    if (!oid) continue
    const r = Number(x.rating)
    const cur = agg.get(oid) ?? { sum: 0, n: 0 }
    if (Number.isFinite(r) && r > 0) {
      cur.sum += r
      cur.n += 1
    }
    agg.set(oid, cur)
  }
  const out = new Map<string, number>()
  for (const [oid, v] of agg) {
    if (v.n > 0) out.set(oid, Math.round((v.sum / v.n) * 10) / 10)
  }
  return out
}

type DirectoryRef = { docId: string; shop: SaleShop }

function pickRating(liveAvg: number | undefined, docRating: number): number {
  if (liveAvg !== undefined && liveAvg > 0) return liveAvg
  if (Number.isFinite(docRating) && docRating > 0) return docRating
  return 4.5
}

function mapProfileToBaseRow(
  p: UserProfile,
  listings: number,
  rating: number,
  directoryStatus: BikeSaleDirectoryStatus,
  directoryDocId: string | null,
  dirShop: SaleShop | null,
): AdminBikeSaleShopRow {
  const district = (p.district || '').trim() || '—'
  const city = (p.location || p.district || '').trim() || '—'
  const address = (p.shopAddress || p.address || '').trim() || '—'
  const name = (p.shopName || p.displayName || 'Shop').trim() || 'Shop'
  const joinedMs = createdAtMs(p.createdAt)
  const dirMs = dirShop?.createdAtMs
  const sortMs = Math.max(joinedMs ?? 0, dirMs ?? 0) || joinedMs || dirMs

  return {
    id: p.uid,
    ownerUid: p.uid,
    ownerStatus: p.ownerStatus,
    name,
    owner: p.displayName?.trim() || '—',
    phone: (p.phone || p.whatsapp || '—').trim() || '—',
    email: p.email?.trim() || '—',
    district,
    city,
    address,
    listings,
    rating,
    established: establishedLabel(p),
    createdAtMs: sortMs || undefined,
    directoryStatus,
    directoryDocId,
    description: dirShop?.description,
  }
}

function mapOrphanDoc(
  docId: string,
  shop: SaleShop,
  bikeCount: Map<string, number>,
  reviewAvg: Map<string, number>,
): AdminBikeSaleShopRow {
  const oid = shop.ownerId?.trim() ?? ''
  const listings = oid ? (bikeCount.get(oid) ?? shop.listings) : shop.listings
  const rLive = oid ? reviewAvg.get(oid) : undefined
  const rating = pickRating(rLive, shop.rating)

  return {
    id: docId,
    ownerUid: oid,
    name: shop.name,
    owner: shop.owner,
    phone: shop.phone,
    email: shop.email,
    district: shop.district,
    city: shop.city,
    address: shop.address,
    listings,
    rating,
    established: shop.established,
    createdAtMs: shop.createdAtMs,
    directoryStatus: shop.status as BikeSaleDirectoryStatus,
    directoryDocId: docId,
    description: shop.description,
  }
}

export async function loadAdminBikeSaleShopsFromFirestore(): Promise<AdminBikeSaleShopRow[]> {
  const database = requireDb()
  const [users, bikesSnap, revSnap, saleSnap] = await Promise.all([
    listAllUsersForAdmin(),
    getDocs(collection(database, BIKES_COL)),
    getDocs(collection(database, REVIEWS_COL)),
    getDocs(collection(database, SALE_SHOPS_COLLECTION)),
  ])

  const bikeCount = buildBikeCountByOwner(bikesSnap)
  const reviewAvg = buildReviewAvgByOwner(revSnap)

  const byDocId = new Map<string, DirectoryRef>()
  const byOwnerLink = new Map<string, DirectoryRef>()

  for (const d of saleSnap.docs) {
    if (isBulkSeededSaleShopId(d.id)) continue
    const shop = mapSaleShopDoc(d.id, d.data() as Record<string, unknown>)
    if (!shop) continue
    const ref: DirectoryRef = { docId: d.id, shop }
    byDocId.set(d.id, ref)
    const oid = shop.ownerId?.trim()
    if (oid) {
      const prev = byOwnerLink.get(oid)
      if (
        !prev ||
        (shop.createdAtMs ?? 0) > (prev.shop.createdAtMs ?? 0)
      ) {
        byOwnerLink.set(oid, ref)
      }
    }
  }

  const bikeOwners = users.filter(ownerEligibleForBikeSaleDirectory)
  const bikeOwnerUidSet = new Set(bikeOwners.map((p) => p.uid))
  const consumedDocIds = new Set<string>()
  const out: AdminBikeSaleShopRow[] = []

  for (const p of bikeOwners) {
    const uid = p.uid
    let dir: DirectoryRef | undefined = byDocId.get(uid)
    if (!dir) dir = byOwnerLink.get(uid)

    let directoryStatus: BikeSaleDirectoryStatus = 'none'
    let directoryDocId: string | null = null
    let dirShop: SaleShop | null = null

    if (dir) {
      directoryStatus = dir.shop.status as BikeSaleDirectoryStatus
      directoryDocId = dir.docId
      dirShop = dir.shop
      consumedDocIds.add(dir.docId)
    }

    const listings = bikeCount.get(uid) ?? 0
    const rLive = reviewAvg.get(uid)
    const docR = dirShop?.rating ?? 4.5
    const rating = pickRating(rLive, docR)

    out.push(
      mapProfileToBaseRow(p, listings, rating, directoryStatus, directoryDocId, dirShop),
    )
  }

  for (const d of saleSnap.docs) {
    if (isBulkSeededSaleShopId(d.id)) continue
    if (consumedDocIds.has(d.id)) continue
    const shop = mapSaleShopDoc(d.id, d.data() as Record<string, unknown>)
    if (!shop) continue
    const oid = shop.ownerId?.trim() ?? ''
    if (oid && bikeOwnerUidSet.has(oid)) continue
    out.push(mapOrphanDoc(d.id, shop, bikeCount, reviewAvg))
  }

  out.sort(
    (a, b) =>
      (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || a.name.localeCompare(b.name),
  )
  return out
}
