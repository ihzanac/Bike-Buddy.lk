import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import type { SaleShop, SaleShopStatus } from '@/types/saleShop'
import { requireDb } from '@/services/firebase'

export const SALE_SHOPS_COLLECTION = 'saleShops'

/** `seed-*` docs from `npm run seed:sale-shops` — hidden so UI lists only real directory entries. */
export function isBulkSeededSaleShopId(docId: string): boolean {
  return docId.startsWith('seed-')
}

function toMillis(v: unknown): number | undefined {
  if (v && typeof v === 'object' && 'toMillis' in v) {
    const t = v as Timestamp
    if (typeof t.toMillis === 'function') return t.toMillis()
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return undefined
}

export function mapSaleShopDoc(id: string, data: Record<string, unknown>): SaleShop | null {
  const status = data.status
  if (status !== 'verified' && status !== 'pending') return null
  const name = String(data.name ?? '').trim()
  if (!name) return null
  const listingsRaw = data.listings
  const listings =
    typeof listingsRaw === 'number'
      ? Math.max(0, Math.floor(listingsRaw))
      : Math.max(0, parseInt(String(listingsRaw ?? '0'), 10) || 0)
  const ratingRaw = data.rating
  const rating =
    typeof ratingRaw === 'number' && Number.isFinite(ratingRaw)
      ? ratingRaw
      : parseFloat(String(ratingRaw ?? '4.5')) || 4.5

  const desc = data.description
  const ownerIdRaw = data.ownerId
  const ownerId =
    typeof ownerIdRaw === 'string' && ownerIdRaw.trim().length > 0 ? ownerIdRaw.trim() : undefined
  return {
    id,
    name,
    owner: String(data.owner ?? ''),
    phone: String(data.phone ?? ''),
    email: String(data.email ?? ''),
    district: String(data.district ?? ''),
    city: String(data.city ?? ''),
    address: String(data.address ?? ''),
    listings,
    rating,
    status: status as SaleShopStatus,
    established: String(data.established ?? '').trim() || '—',
    createdAtMs: toMillis(data.createdAt),
    description: typeof desc === 'string' && desc.trim() ? desc.trim() : undefined,
    ownerId,
  }
}

export type NewSaleShopInput = {
  name: string
  owner: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  listings: number
  rating: number
  status: SaleShopStatus
  established: string
  description?: string
  ownerId?: string
}

/** Why some Firestore `saleShops` docs may not appear in the admin list. */
export type SaleShopsListMeta = {
  excludedSeeds: number
  /** Doc id is not `seed-*` but `mapSaleShopDoc` returned null (e.g. wrong status or empty name). */
  excludedInvalidShape: number
}

export function subscribeSaleShops(
  onList: (shops: SaleShop[], meta: SaleShopsListMeta) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const database = requireDb()
  const ref = collection(database, SALE_SHOPS_COLLECTION)
  return onSnapshot(
    ref,
    (snap) => {
      const out: SaleShop[] = []
      let excludedSeeds = 0
      let excludedInvalidShape = 0
      for (const d of snap.docs) {
        if (isBulkSeededSaleShopId(d.id)) {
          excludedSeeds += 1
          continue
        }
        const row = mapSaleShopDoc(d.id, d.data() as Record<string, unknown>)
        if (!row) {
          excludedInvalidShape += 1
          continue
        }
        out.push(row)
      }
      out.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.id.localeCompare(a.id))
      onList(out, { excludedSeeds, excludedInvalidShape })
    },
    (err) => onError?.(err),
  )
}

/** Admin: create directory doc `saleShops/{ownerUid}` after provisioning Auth (matches owner portal doc id). */
export async function createSaleShopAtOwnerUid(
  ownerUid: string,
  input: NewSaleShopInput,
): Promise<void> {
  const database = requireDb()
  const ref = doc(database, SALE_SHOPS_COLLECTION, ownerUid)
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    listings: Math.max(0, Math.floor(input.listings)),
    rating: input.rating,
    status: input.status,
    established: input.established.trim() || '—',
    ownerId: ownerUid,
    createdAt: serverTimestamp(),
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  await setDoc(ref, payload)
}

export async function createSaleShop(input: NewSaleShopInput): Promise<void> {
  const database = requireDb()
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    listings: Math.max(0, Math.floor(input.listings)),
    rating: input.rating,
    status: input.status,
    established: input.established.trim() || '—',
    createdAt: serverTimestamp(),
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  if (input.ownerId?.trim()) payload.ownerId = input.ownerId.trim()
  await addDoc(collection(database, SALE_SHOPS_COLLECTION), payload)
}

/** Customer bike sale: verified directory entries (public read when status is verified). */
export function subscribeVerifiedSaleShops(
  onList: (shops: SaleShop[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const database = requireDb()
  const q = query(collection(database, SALE_SHOPS_COLLECTION), where('status', '==', 'verified'))
  return onSnapshot(
    q,
    (snap) => {
      const out: SaleShop[] = []
      for (const d of snap.docs) {
        if (isBulkSeededSaleShopId(d.id)) continue
        const row = mapSaleShopDoc(d.id, d.data() as Record<string, unknown>)
        if (row?.status === 'verified') out.push(row)
      }
      out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      onList(out)
    },
    (err) => onError?.(err),
  )
}

export async function deleteSaleShop(shopId: string): Promise<void> {
  const database = requireDb()
  await deleteDoc(doc(database, SALE_SHOPS_COLLECTION, shopId))
}

export async function getSaleShopById(shopId: string): Promise<SaleShop | null> {
  const database = requireDb()
  const snap = await getDoc(doc(database, SALE_SHOPS_COLLECTION, shopId))
  if (!snap.exists()) return null
  return mapSaleShopDoc(snap.id, snap.data() as Record<string, unknown>)
}

/** Admin update — keeps `createdAt`; clears optional fields when omitted/empty. */
export async function updateSaleShop(shopId: string, input: NewSaleShopInput): Promise<void> {
  const database = requireDb()
  const ref = doc(database, SALE_SHOPS_COLLECTION, shopId)
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    listings: Math.max(0, Math.floor(input.listings)),
    rating: input.rating,
    status: input.status,
    established: input.established.trim() || '—',
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  else payload.description = deleteField()
  if (input.ownerId?.trim()) payload.ownerId = input.ownerId.trim()
  else payload.ownerId = deleteField()
  await updateDoc(ref, payload)
}

export type BikeSaleDirectoryUpsertInput = {
  uid: string
  shopName: string
  ownerDisplayName: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  /** Active bike models shown on public bike sale (count). */
  listings: number
}

/**
 * Approved bike-sale owner: writes `saleShops/{uid}` with `ownerId` = uid (pending until admin verifies).
 * Updates preserve `status` and `createdAt` when already stored.
 */
export async function upsertMyBikeSaleShopDirectory(input: BikeSaleDirectoryUpsertInput): Promise<void> {
  const database = requireDb()
  const ref = doc(database, SALE_SHOPS_COLLECTION, input.uid)
  const snap = await getDoc(ref)
  const core: Record<string, unknown> = {
    name: (input.shopName.trim() || input.ownerDisplayName.trim() || 'Bike sale shop').slice(0, 200),
    owner: (input.ownerDisplayName.trim() || 'Owner').slice(0, 200),
    phone: (input.phone.trim() || '—').slice(0, 80),
    email: (input.email.trim() || '—').slice(0, 200),
    district: (input.district.trim() || '—').slice(0, 120),
    city: (input.city.trim() || '—').slice(0, 120),
    address: (input.address.trim() || '—').slice(0, 500),
    listings: Math.max(0, Math.floor(input.listings)),
    rating: 4.5,
    established: '—',
    ownerId: input.uid,
  }

  if (!snap.exists()) {
    await setDoc(ref, {
      ...core,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    return
  }

  const d = snap.data() as Record<string, unknown>
  const status: SaleShopStatus = d.status === 'verified' ? 'verified' : 'pending'
  await setDoc(
    ref,
    {
      ...core,
      status,
      createdAt: d.createdAt,
    },
    { merge: true },
  )
}

/** Listen to this owner’s directory row (pending / verified) for shop portal UI. */
export function subscribeMyBikeSaleShopDirectory(
  uid: string,
  onSnap: (shop: SaleShop | null) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const database = requireDb()
  const ref = doc(database, SALE_SHOPS_COLLECTION, uid)
  return onSnapshot(
    ref,
    (s) => {
      if (!s.exists()) {
        onSnap(null)
        return
      }
      const row = mapSaleShopDoc(s.id, s.data() as Record<string, unknown>)
      onSnap(row)
    },
    (e) => onError?.(e),
  )
}
