import { collection, getDocs, type QuerySnapshot, type Timestamp } from 'firebase/firestore'
import type { OwnerStatus, UserProfile } from '@/types'
import type { PartsShop, PartsShopStatus } from '@/types/partsShop'
import { listAllUsersForAdmin } from '@/services/users'
import { requireDb } from '@/services/firebase'
import { createdAtMs } from '@/utils/shopDashboardMetrics'
import {
  isBulkSeededPartsShopId,
  mapPartsShopDoc,
  PARTS_SHOPS_COLLECTION,
} from '@/services/partsShops'
import { formatPartsRevenueLkr } from '@/data/partsShopsSample'
import { SHOP_OWNER_CATEGORY, getOwnerShopCategories } from '@/utils/shopOwnerCategory'

const ACCESSORIES_COL = 'accessories'

type DirectoryRef = { docId: string; data: Record<string, unknown> }

function toMillis(v: unknown): number | undefined {
  if (v && typeof v === 'object' && 'toMillis' in v) {
    const t = v as Timestamp
    if (typeof t.toMillis === 'function') return t.toMillis()
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return undefined
}

function ownerStatusToRowStatus(os: OwnerStatus | undefined): PartsShopStatus {
  if (os === 'approved') return 'active'
  if (os === 'pending') return 'pending'
  return 'inactive'
}

function establishedLabel(p: UserProfile): string {
  if (typeof p.yearsInBusiness === 'number' && p.yearsInBusiness >= 0) {
    return String(p.yearsInBusiness)
  }
  const ms = createdAtMs(p.createdAt)
  if (ms) return String(new Date(ms).getFullYear())
  return '—'
}

function revenueLabelFromK(revenueK: number): string {
  return formatPartsRevenueLkr(Math.max(0, revenueK))
}

function buildAccessoryCountByOwner(snap: QuerySnapshot): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of snap.docs) {
    const oid = String((d.data() as { ownerId?: unknown }).ownerId ?? '').trim()
    if (!oid) continue
    m.set(oid, (m.get(oid) ?? 0) + 1)
  }
  return m
}

function pickLatestDir(a: DirectoryRef | undefined, b: DirectoryRef): DirectoryRef {
  if (!a) return b
  const ta = toMillis(a.data.createdAt) ?? 0
  const tb = toMillis(b.data.createdAt) ?? 0
  return tb >= ta ? b : a
}

function mergeOwnerRow(
  p: UserProfile,
  accessoryCount: number,
  dir: DirectoryRef | undefined,
): PartsShop {
  const mapped = dir ? mapPartsShopDoc(dir.docId, dir.data) : null
  const districtP = (p.district || '').trim() || '—'
  const cityP = (p.location || p.district || '').trim() || '—'
  const addressP = (p.shopAddress || p.address || '').trim() || '—'
  const nameP = (p.shopName || p.displayName || 'Shop').trim() || 'Shop'
  const joinedMs = createdAtMs(p.createdAt)
  const docMs = mapped?.createdAtMs
  const sortMs = Math.max(joinedMs ?? 0, docMs ?? 0) || joinedMs || docMs

  const revenueK = mapped?.revenueK ?? 0

  /** When a partsShops directory exists, admin edits apply there — show directory on the card, not users. */
  if (mapped) {
    return {
      id: p.uid,
      ownerUid: p.uid,
      directoryDocId: dir?.docId ?? null,
      ownerStatus: p.ownerStatus,
      name: mapped.name || nameP,
      owner: mapped.owner.trim() || p.displayName?.trim() || '—',
      phone: mapped.phone.trim() || (p.phone || p.whatsapp || '—').trim() || '—',
      email: mapped.email.trim() || p.email?.trim() || '—',
      district: mapped.district.trim() || districtP,
      city: mapped.city.trim() || cityP,
      address: mapped.address.trim() || addressP,
      parts: accessoryCount,
      orders: mapped.orders,
      revenueK,
      revenue: revenueLabelFromK(revenueK),
      stockLevel: mapped.stockLevel,
      status: mapped.status,
      established: mapped.established.trim() ? mapped.established : establishedLabel(p),
      createdAtMs: sortMs,
      description: mapped.description,
      ownerId: p.uid,
    }
  }

  return {
    id: p.uid,
    ownerUid: p.uid,
    directoryDocId: dir?.docId ?? null,
    ownerStatus: p.ownerStatus,
    name: nameP,
    owner: p.displayName?.trim() || '—',
    phone: (p.phone || p.whatsapp || '—').trim() || '—',
    email: p.email?.trim() || '—',
    district: districtP,
    city: cityP,
    address: addressP,
    parts: accessoryCount,
    orders: 0,
    revenueK,
    revenue: revenueLabelFromK(revenueK),
    stockLevel: 'medium',
    status: ownerStatusToRowStatus(p.ownerStatus),
    established: establishedLabel(p),
    createdAtMs: sortMs,
    description: undefined,
    ownerId: p.uid,
  }
}

function mapOrphanPartsDoc(
  docId: string,
  data: Record<string, unknown>,
  accessoryCount: Map<string, number>,
): PartsShop | null {
  const row = mapPartsShopDoc(docId, data)
  if (!row) return null
  const oid = row.ownerId?.trim() ?? ''
  const live = oid ? accessoryCount.get(oid) ?? row.parts : row.parts
  return {
    ...row,
    id: docId,
    parts: live,
    directoryDocId: docId,
    revenue: revenueLabelFromK(row.revenueK),
  }
}

export type AdminPartsShopsLoadMeta = {
  excludedSeeds: number
  excludedInvalidShape: number
}

/**
 * Same idea as Service Shops: one row per shop owner from `users`, live part (accessory) counts from
 * `accessories`, merged with `partsShops` directory metadata. Orphan directory docs appear as extra rows.
 */
export async function loadAdminPartsShopsFromFirestore(): Promise<{
  rows: PartsShop[]
  meta: AdminPartsShopsLoadMeta
}> {
  const database = requireDb()
  const [users, accSnap, partsSnap] = await Promise.all([
    listAllUsersForAdmin(),
    getDocs(collection(database, ACCESSORIES_COL)),
    getDocs(collection(database, PARTS_SHOPS_COLLECTION)),
  ])

  const accessoryCount = buildAccessoryCountByOwner(accSnap)

  let excludedSeeds = 0
  let excludedInvalidShape = 0

  const byDocId = new Map<string, DirectoryRef>()
  const byOwnerLink = new Map<string, DirectoryRef>()

  for (const d of partsSnap.docs) {
    if (isBulkSeededPartsShopId(d.id)) {
      excludedSeeds += 1
      continue
    }
    const data = d.data() as Record<string, unknown>
    const ref: DirectoryRef = { docId: d.id, data }
    byDocId.set(d.id, ref)
    const oid = String(data.ownerId ?? '').trim()
    if (oid) {
      const prev = byOwnerLink.get(oid)
      byOwnerLink.set(oid, prev ? pickLatestDir(prev, ref) : ref)
    }
  }

  const owners = users.filter((u) => {
    if (u.role !== 'owner') return false
    const categories = getOwnerShopCategories(u)
    return categories.includes(SHOP_OWNER_CATEGORY.BIKE_PARTS)
  })
  const ownerUidSet = new Set(owners.map((p) => p.uid))
  const consumedDocIds = new Set<string>()
  const out: PartsShop[] = []

  for (const p of owners) {
    const uid = p.uid
    let dir: DirectoryRef | undefined = byDocId.get(uid)
    if (!dir) dir = byOwnerLink.get(uid)

    if (dir) consumedDocIds.add(dir.docId)

    const ac = accessoryCount.get(uid) ?? 0
    out.push(mergeOwnerRow(p, ac, dir))
  }

  // Keep this list owner-scoped: only bike-parts owners from `users`.
  // We intentionally do not append orphan `partsShops` directory rows here.

  out.sort(
    (a, b) =>
      (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || a.name.localeCompare(b.name),
  )

  return { rows: out, meta: { excludedSeeds, excludedInvalidShape } }
}
