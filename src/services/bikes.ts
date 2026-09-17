import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { Bike } from '@/types'
import {
  DEMO_BIKES,
  getDemoBikeById,
  isDemoCatalogEnabled,
  isDemoEntityId,
  isHiddenFromPublicBikeCatalog,
} from '@/data/demoCatalog'
import { requireDb } from '@/services/firebase'

const COL = 'bikes'

function mapBike(id: string, data: Record<string, unknown>): Bike {
  const saleColorsRaw = data.saleColors
  const saleColors =
    Array.isArray(saleColorsRaw) && saleColorsRaw.length
      ? (saleColorsRaw as { name?: unknown; hex?: unknown }[])
          .map((c) => ({
            name: String(c.name ?? 'Colour'),
            hex: String(c.hex ?? '#64748B'),
          }))
          .filter((c) => c.name.trim().length > 0)
      : undefined
  const saleSpecsRaw = data.saleSpecs
  const saleSpecs =
    Array.isArray(saleSpecsRaw) && saleSpecsRaw.length
      ? (saleSpecsRaw as { label?: unknown; value?: unknown }[]).map((s) => ({
          label: String(s.label ?? ''),
          value: String(s.value ?? ''),
        }))
      : undefined
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    price: Number(data.price ?? 0),
    category: String(data.category ?? 'General'),
    location: data.location ? String(data.location) : undefined,
    images: Array.isArray(data.images) ? (data.images as string[]) : [],
    ownerId: String(data.ownerId ?? ''),
    saleColors: saleColors?.length ? saleColors : undefined,
    saleSpecs: saleSpecs?.length ? saleSpecs : undefined,
    modalColorBlock: data.modalColorBlock === true,
    active: data.active !== false,
    brand: data.brand != null ? String(data.brand) : undefined,
    year: data.year != null ? Math.max(0, Math.floor(Number(data.year))) : undefined,
    stockQty: Math.max(0, Math.floor(Number(data.stockQty ?? 0))),
    purchasePrice:
      data.purchasePrice != null && data.purchasePrice !== ''
        ? Math.max(0, Number(data.purchasePrice))
        : undefined,
    reorderLevel: Math.max(0, Math.floor(Number(data.reorderLevel ?? 5))),
    chassisNo: data.chassisNo != null ? String(data.chassisNo) : undefined,
    engineNo: data.engineNo != null ? String(data.engineNo) : undefined,
    supplier: data.supplier != null ? String(data.supplier) : undefined,
    fuelType: data.fuelType != null ? String(data.fuelType) : undefined,
    bodyColor: data.bodyColor != null ? String(data.bodyColor) : undefined,
    engineCC: data.engineCC != null ? Math.max(0, Number(data.engineCC)) : undefined,
    additionalNotes:
      data.additionalNotes != null && String(data.additionalNotes).trim() !== ''
        ? String(data.additionalNotes)
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function stripUndefinedForFirestore<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T
}

/** For client-side sort when we avoid composite index (where + orderBy on different fields). */
function createdAtMillis(data: Record<string, unknown>): number {
  const c = data.createdAt
  if (
    c &&
    typeof c === 'object' &&
    'toMillis' in c &&
    typeof (c as { toMillis?: () => number }).toMillis === 'function'
  ) {
    return (c as { toMillis: () => number }).toMillis()
  }
  return 0
}

function mapOwnerBikesNewestFirst(docs: QueryDocumentSnapshot[]): Bike[] {
  const sorted = [...docs].sort(
    (a, b) =>
      createdAtMillis(b.data() as Record<string, unknown>) -
      createdAtMillis(a.data() as Record<string, unknown>),
  )
  return sorted.map((d) => mapBike(d.id, d.data() as Record<string, unknown>))
}

export async function listBikes(): Promise<Bike[]> {
  const database = requireDb()
  const q = query(collection(database, COL), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  const real = snap.docs
    .map((d) => mapBike(d.id, d.data() as Record<string, unknown>))
    .filter((b) => b.active !== false)
    .filter((b) => !isHiddenFromPublicBikeCatalog(b))
  return isDemoCatalogEnabled() ? [...DEMO_BIKES, ...real] : real
}

export async function listBikesByOwner(ownerId: string): Promise<Bike[]> {
  const database = requireDb()
  // Only `where` — no orderBy — so the default single-field index on `ownerId` is enough
  // (avoids requiring a composite index that may be missing until deploy/build finishes).
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  return mapOwnerBikesNewestFirst(snap.docs)
}

export type BikeInput = Omit<Bike, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>

/**
 * All bikes (newest first) for the public bike-sale catalog. Limited for performance.
 */
export function subscribeBikesCatalog(
  onData: (bikes: Bike[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), orderBy('createdAt', 'desc'), limit(400))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapBike(d.id, d.data() as Record<string, unknown>))
      onData(
        rows
          .filter((b) => b.active !== false)
          .filter((b) => !isHiddenFromPublicBikeCatalog(b)),
      )
    },
    (err) => onError?.(err),
  )
}

export function subscribeBikesByOwner(
  ownerId: string,
  onData: (bikes: Bike[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  return onSnapshot(
    q,
    (snap) => {
      onData(mapOwnerBikesNewestFirst(snap.docs))
    },
    (err) => onError?.(err),
  )
}

export async function getBike(id: string): Promise<Bike | null> {
  if (isDemoCatalogEnabled()) {
    const demo = getDemoBikeById(id)
    if (demo) return demo
  }
  const database = requireDb()
  const ref = doc(database, COL, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return mapBike(snap.id, snap.data() as Record<string, unknown>)
}

export async function createBike(ownerId: string, input: BikeInput) {
  const database = requireDb()
  const docData = stripUndefinedForFirestore({
    ...input,
    ownerId,
    active: input.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as Record<string, unknown>)
  const ref = await addDoc(collection(database, COL), docData)
  return ref.id
}

export async function updateBike(
  id: string,
  patch: Partial<
    Pick<
      Bike,
      | 'title'
      | 'description'
      | 'price'
      | 'category'
      | 'location'
      | 'images'
      | 'saleColors'
      | 'saleSpecs'
      | 'modalColorBlock'
      | 'active'
      | 'brand'
      | 'year'
      | 'stockQty'
      | 'purchasePrice'
      | 'reorderLevel'
      | 'chassisNo'
      | 'engineNo'
      | 'supplier'
      | 'fuelType'
      | 'bodyColor'
      | 'engineCC'
      | 'additionalNotes'
    >
  >,
) {
  if (isDemoCatalogEnabled() && isDemoEntityId(id)) return
  const database = requireDb()
  const ref = doc(database, COL, id)
  const merged = stripUndefinedForFirestore({
    ...patch,
    updatedAt: serverTimestamp(),
  } as Record<string, unknown>)
  await updateDoc(ref, merged)
}

export async function deleteBike(id: string) {
  if (isDemoCatalogEnabled() && isDemoEntityId(id)) return
  const database = requireDb()
  await deleteDoc(doc(database, COL, id))
}
