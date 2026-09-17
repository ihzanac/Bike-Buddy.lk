import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { ServiceOffer } from '@/types'
import {
  DEMO_SERVICE_OFFERS,
  isDemoCatalogEnabled,
  isDemoEntityId,
} from '@/data/demoCatalog'
import { requireDb } from '@/services/firebase'

const COL = 'services'

function createdAtMillis(createdAt: unknown): number {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (createdAt as { toMillis: () => number }).toMillis()
  }
  if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
    const s = (createdAt as { seconds: unknown }).seconds
    return typeof s === 'number' ? s * 1000 : 0
  }
  return 0
}

function sortServicesNewestFirst(rows: ServiceOffer[]): ServiceOffer[] {
  return [...rows].sort(
    (a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt),
  )
}

function mapService(id: string, data: Record<string, unknown>): ServiceOffer {
  return {
    id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    durationMinutes: Number(data.durationMinutes ?? 60),
    price: Number(data.price ?? 0),
    ownerId: String(data.ownerId ?? ''),
    active: Boolean(data.active ?? true),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listActiveServiceOffers(): Promise<ServiceOffer[]> {
  const database = requireDb()
  const q = query(
    collection(database, COL),
    where('active', '==', true),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  const real = snap.docs.map((d) =>
    mapService(d.id, d.data() as Record<string, unknown>),
  )
  return isDemoCatalogEnabled() ? [...DEMO_SERVICE_OFFERS, ...real] : real
}

export async function listServiceOffersByOwner(
  ownerId: string,
): Promise<ServiceOffer[]> {
  const database = requireDb()
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) =>
    mapService(d.id, d.data() as Record<string, unknown>),
  )
  return sortServicesNewestFirst(rows)
}

/** Live catalog for the shop owner services screen. */
export function subscribeServiceOffersByOwner(
  ownerId: string,
  onData: (offers: ServiceOffer[]) => void,
  onError?: (error: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapService(d.id, d.data() as Record<string, unknown>),
      )
      onData(sortServicesNewestFirst(rows))
    },
    (err) => onError?.(err),
  )
}

export async function createServiceOffer(
  ownerId: string,
  input: Omit<ServiceOffer, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
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

export async function updateServiceOffer(
  id: string,
  patch: Partial<
    Pick<ServiceOffer, 'name' | 'description' | 'durationMinutes' | 'price' | 'active'>
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

export async function deleteServiceOffer(id: string) {
  if (isDemoCatalogEnabled() && isDemoEntityId(id)) return
  const database = requireDb()
  await deleteDoc(doc(database, COL, id))
}
