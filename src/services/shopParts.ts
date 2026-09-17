import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { PartBrand, PartCategory, ShopPart } from '@/types/shopPart'
import { requireDb } from '@/services/firebase'

const COL = 'shopParts'

function parseCategory(v: unknown): PartCategory {
  const s = String(v ?? '')
  if (s === 'engine' || s === 'brake' || s === 'electrical' || s === 'body' || s === 'accessories')
    return s
  return 'accessories'
}

function parseBrand(v: unknown): PartBrand {
  const s = String(v ?? '')
  if (s === 'genuine' || s === 'oem' || s === 'aftermarket') return s
  return 'aftermarket'
}

function mapPart(id: string, data: Record<string, unknown>): ShopPart {
  return {
    id,
    ownerId: String(data.ownerId ?? ''),
    name: String(data.name ?? ''),
    category: parseCategory(data.category),
    brand: parseBrand(data.brand),
    sku: data.sku != null ? String(data.sku) : '',
    stockQty: Math.max(0, Math.floor(Number(data.stockQty ?? 0))),
    unitPrice: Math.max(0, Number(data.unitPrice ?? 0)),
    oldPrice: data.oldPrice != null && data.oldPrice !== '' ? Math.max(0, Number(data.oldPrice)) : undefined,
    reorderLevel: Math.max(0, Math.floor(Number(data.reorderLevel ?? 5))),
    supplier: data.supplier != null ? String(data.supplier) : '',
    description: data.description != null ? String(data.description) : '',
    imageUrl: data.imageUrl != null ? String(data.imageUrl) : '',
    active: Boolean(data.active ?? true),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function sortNewest(a: ShopPart, b: ShopPart): number {
  const ma = (data: ShopPart) => {
    const c = data.createdAt
    if (c && typeof c === 'object' && 'toMillis' in c && typeof (c as { toMillis: () => number }).toMillis === 'function') {
      return (c as { toMillis: () => number }).toMillis()
    }
    return 0
  }
  return ma(b) - ma(a)
}

export function subscribeShopPartsByOwner(
  ownerId: string,
  onData: (rows: ShopPart[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapPart(d.id, d.data() as Record<string, unknown>))
      onData(rows.sort(sortNewest))
    },
    (err) => onError?.(err),
  )
}

export async function listActiveShopPartsForCustomer(ownerId: string): Promise<ShopPart[]> {
  const database = requireDb()
  const q = query(
    collection(database, COL),
    where('ownerId', '==', ownerId),
    where('active', '==', true),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => mapPart(d.id, d.data() as Record<string, unknown>))
    .sort(sortNewest)
}

export type ShopPartInput = {
  name: string
  category: PartCategory
  brand: PartBrand
  sku: string
  stockQty: number
  unitPrice: number
  oldPrice?: number
  reorderLevel: number
  supplier: string
  description: string
  imageUrl: string
  active: boolean
}

export async function createShopPart(ownerId: string, input: ShopPartInput) {
  const database = requireDb()
  return addDoc(collection(database, COL), {
    ownerId,
    name: input.name.trim(),
    category: input.category,
    brand: input.brand,
    sku: input.sku.trim(),
    stockQty: Math.max(0, Math.floor(input.stockQty)),
    unitPrice: Math.max(0, input.unitPrice),
    oldPrice: input.oldPrice != null && input.oldPrice > 0 ? input.oldPrice : null,
    reorderLevel: Math.max(0, Math.floor(input.reorderLevel)),
    supplier: input.supplier.trim(),
    description: input.description.trim(),
    imageUrl: input.imageUrl.trim(),
    active: input.active,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateShopPart(partId: string, input: ShopPartInput) {
  const database = requireDb()
  const ref = doc(database, COL, partId)
  await updateDoc(ref, {
    name: input.name.trim(),
    category: input.category,
    brand: input.brand,
    sku: input.sku.trim(),
    stockQty: Math.max(0, Math.floor(input.stockQty)),
    unitPrice: Math.max(0, input.unitPrice),
    oldPrice: input.oldPrice != null && input.oldPrice > 0 ? input.oldPrice : null,
    reorderLevel: Math.max(0, Math.floor(input.reorderLevel)),
    supplier: input.supplier.trim(),
    description: input.description.trim(),
    imageUrl: input.imageUrl.trim(),
    active: input.active,
    updatedAt: serverTimestamp(),
  })
}

export async function updateShopPartStock(
  partId: string,
  newStock: number,
) {
  const database = requireDb()
  const ref = doc(database, COL, partId)
  await updateDoc(ref, {
    stockQty: Math.max(0, Math.floor(newStock)),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteShopPart(partId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COL, partId))
}
