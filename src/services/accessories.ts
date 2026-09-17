import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Accessory } from '@/types'
import {
  DEMO_ACCESSORIES,
  getDemoAccessoryById,
  isDemoCatalogEnabled,
  isDemoEntityId,
} from '@/data/demoCatalog'
import { requireDb } from '@/services/firebase'

const COL = 'accessories'

function mapAccessory(id: string, data: Record<string, unknown>): Accessory {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    price: Number(data.price ?? 0),
    category: String(data.category ?? 'General'),
    images: Array.isArray(data.images) ? (data.images as string[]) : [],
    ownerId: String(data.ownerId ?? ''),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listAccessories(): Promise<Accessory[]> {
  const database = requireDb()
  const q = query(collection(database, COL), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  const real = snap.docs.map((d) =>
    mapAccessory(d.id, d.data() as Record<string, unknown>),
  )
  return isDemoCatalogEnabled() ? [...DEMO_ACCESSORIES, ...real] : real
}

export async function listAccessoriesByOwner(ownerId: string): Promise<Accessory[]> {
  const database = requireDb()
  const q = query(
    collection(database, COL),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) =>
    mapAccessory(d.id, d.data() as Record<string, unknown>),
  )
}

export async function getAccessory(id: string): Promise<Accessory | null> {
  if (isDemoCatalogEnabled()) {
    const demo = getDemoAccessoryById(id)
    if (demo) return demo
  }
  const database = requireDb()
  const ref = doc(database, COL, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return mapAccessory(snap.id, snap.data() as Record<string, unknown>)
}

export async function createAccessory(
  ownerId: string,
  input: Omit<Accessory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
) {
  const database = requireDb()
  const ref = await addDoc(collection(database, COL), {
    ...input,
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAccessory(
  id: string,
  patch: Partial<
    Pick<Accessory, 'title' | 'description' | 'price' | 'category' | 'images'>
  >,
) {
  if (isDemoCatalogEnabled() && isDemoEntityId(id)) return
  const database = requireDb()
  const ref = doc(database, COL, id)
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteAccessory(id: string) {
  if (isDemoCatalogEnabled() && isDemoEntityId(id)) return
  const database = requireDb()
  await deleteDoc(doc(database, COL, id))
}
