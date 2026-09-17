import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import type { PartsShop, PartsShopStatus, PartsStockLevel } from '@/types/partsShop'
import { formatPartsRevenueLkr } from '@/data/partsShopsSample'
import { requireDb } from '@/services/firebase'

export const PARTS_SHOPS_COLLECTION = 'partsShops'

/** `seed-*` docs from bulk scripts — hidden so the admin list matches real directory rows only. */
export function isBulkSeededPartsShopId(docId: string): boolean {
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

function revenueDisplayFromK(revenueK: number): string {
  return formatPartsRevenueLkr(Math.max(0, revenueK))
}

function normalizePartsShopStatus(raw: unknown): PartsShopStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'active' || s === 'inactive' || s === 'pending') return s
  return 'pending'
}

function normalizePartsStockLevel(raw: unknown): PartsStockLevel {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

export function mapPartsShopDoc(id: string, data: Record<string, unknown>): PartsShop | null {
  const status = normalizePartsShopStatus(data.status)
  const stockLevel = normalizePartsStockLevel(data.stockLevel)
  const name = String(data.name ?? '').trim()
  if (!name) return null

  const partsRaw = data.parts
  const parts =
    typeof partsRaw === 'number'
      ? Math.max(0, Math.floor(partsRaw))
      : Math.max(0, parseInt(String(partsRaw ?? '0'), 10) || 0)

  const ordersRaw = data.orders
  const orders =
    typeof ordersRaw === 'number'
      ? Math.max(0, Math.floor(ordersRaw))
      : Math.max(0, parseInt(String(ordersRaw ?? '0'), 10) || 0)

  const revenueKRaw = data.revenueK
  const revenueK =
    typeof revenueKRaw === 'number' && Number.isFinite(revenueKRaw)
      ? Math.max(0, revenueKRaw)
      : Math.max(0, parseFloat(String(revenueKRaw ?? '0')) || 0)

  const ownerIdRaw = data.ownerId
  const ownerId =
    typeof ownerIdRaw === 'string' && ownerIdRaw.trim().length > 0 ? ownerIdRaw.trim() : undefined

  const desc = data.description
  return {
    id,
    name,
    owner: String(data.owner ?? ''),
    phone: String(data.phone ?? ''),
    email: String(data.email ?? ''),
    district: String(data.district ?? ''),
    city: String(data.city ?? ''),
    address: String(data.address ?? ''),
    parts,
    orders,
    revenue: revenueDisplayFromK(revenueK),
    revenueK,
    stockLevel: stockLevel as PartsStockLevel,
    status: status as PartsShopStatus,
    established: String(data.established ?? '').trim() || '—',
    createdAtMs: toMillis(data.createdAt),
    description: typeof desc === 'string' && desc.trim() ? desc.trim() : undefined,
    ownerId,
  }
}

export type PartsShopsListMeta = {
  excludedSeeds: number
  excludedInvalidShape: number
}

export type NewPartsShopInput = {
  name: string
  owner: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  parts: number
  orders: number
  revenueK: number
  stockLevel: PartsStockLevel
  status: PartsShopStatus
  established: string
  description?: string
  ownerId?: string
}

export function subscribePartsShops(
  onList: (shops: PartsShop[], meta: PartsShopsListMeta) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const database = requireDb()
  const ref = collection(database, PARTS_SHOPS_COLLECTION)
  return onSnapshot(
    ref,
    (snap) => {
      const out: PartsShop[] = []
      let excludedSeeds = 0
      let excludedInvalidShape = 0
      for (const d of snap.docs) {
        if (isBulkSeededPartsShopId(d.id)) {
          excludedSeeds += 1
          continue
        }
        const row = mapPartsShopDoc(d.id, d.data() as Record<string, unknown>)
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

export async function createPartsShop(input: NewPartsShopInput): Promise<void> {
  const database = requireDb()
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    parts: Math.max(0, Math.floor(input.parts)),
    orders: Math.max(0, Math.floor(input.orders)),
    revenueK: Math.max(0, Number(input.revenueK) || 0),
    stockLevel: input.stockLevel,
    status: input.status,
    established: input.established.trim() || '—',
    createdAt: serverTimestamp(),
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  if (input.ownerId?.trim()) payload.ownerId = input.ownerId.trim()
  await addDoc(collection(database, PARTS_SHOPS_COLLECTION), payload)
}

/** Admin: create `partsShops/{ownerUid}` after provisioning Auth (matches `byDocId.get(uid)` merge). */
export async function createPartsShopAtOwnerUid(
  ownerUid: string,
  input: NewPartsShopInput,
): Promise<void> {
  const database = requireDb()
  const ref = doc(database, PARTS_SHOPS_COLLECTION, ownerUid)
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    parts: Math.max(0, Math.floor(input.parts)),
    orders: Math.max(0, Math.floor(input.orders)),
    revenueK: Math.max(0, Number(input.revenueK) || 0),
    stockLevel: input.stockLevel,
    status: input.status,
    established: input.established.trim() || '—',
    ownerId: ownerUid,
    createdAt: serverTimestamp(),
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  await setDoc(ref, payload)
}

export async function deletePartsShop(shopId: string): Promise<void> {
  const database = requireDb()
  await deleteDoc(doc(database, PARTS_SHOPS_COLLECTION, shopId))
}

export async function getPartsShopById(shopId: string): Promise<PartsShop | null> {
  const database = requireDb()
  const snap = await getDoc(doc(database, PARTS_SHOPS_COLLECTION, shopId))
  if (!snap.exists()) return null
  return mapPartsShopDoc(snap.id, snap.data() as Record<string, unknown>)
}

/**
 * Writes directory fields admin can edit; preserves `createdAt`. Rules require full core-field validity.
 */
export async function updatePartsShop(shopDocId: string, input: NewPartsShopInput): Promise<void> {
  const database = requireDb()
  const ref = doc(database, PARTS_SHOPS_COLLECTION, shopDocId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('PARTS_SHOP_NOT_FOUND')

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    parts: Math.max(0, Math.floor(input.parts)),
    orders: Math.max(0, Math.floor(input.orders)),
    revenueK: Math.max(0, Number(input.revenueK) || 0),
    stockLevel: input.stockLevel,
    status: input.status,
    established: input.established.trim() || '—',
  }
  if (input.description?.trim()) payload.description = input.description.trim()
  else payload.description = deleteField()

  await updateDoc(ref, payload)
}
