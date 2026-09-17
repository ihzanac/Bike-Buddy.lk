import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Booking, BookingStatus } from '@/types'
import { requireDb } from '@/services/firebase'

const COL = 'bookings'

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

function sortBookingsNewestFirst(rows: Booking[]): Booking[] {
  return [...rows].sort(
    (a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt),
  )
}

function mapBooking(id: string, data: Record<string, unknown>): Booking {
  const ce = data.customerEmail
  return {
    id,
    customerId: String(data.customerId ?? ''),
    ownerId: String(data.ownerId ?? ''),
    serviceId: String(data.serviceId ?? ''),
    serviceName: String(data.serviceName ?? ''),
    date: String(data.date ?? ''),
    time: String(data.time ?? ''),
    location: String(data.location ?? ''),
    status: data.status as Booking['status'],
    customerEmail:
      typeof ce === 'string' && ce.trim() !== '' ? ce.trim() : undefined,
    estimatedTotalLkr:
      typeof data.estimatedTotalLkr === 'number' &&
      !Number.isNaN(data.estimatedTotalLkr) &&
      data.estimatedTotalLkr >= 0
        ? data.estimatedTotalLkr
        : undefined,
    ownerNote: data.ownerNote ? String(data.ownerNote) : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listBookingsForCustomer(
  customerId: string,
): Promise<Booking[]> {
  const database = requireDb()
  // Single-field equality only (no orderBy) so this works even when a
  // composite index has not been created yet. We sort in memory instead.
  const q = query(collection(database, COL), where('customerId', '==', customerId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) =>
    mapBooking(d.id, d.data() as Record<string, unknown>),
  )
  return sortBookingsNewestFirst(rows)
}

export async function listBookingsForOwner(ownerId: string): Promise<Booking[]> {
  const database = requireDb()
  // Single-field equality only (no orderBy) so the query always uses the
  // built-in index — avoids empty results when the composite index is missing.
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) =>
    mapBooking(d.id, d.data() as Record<string, unknown>),
  )
  return sortBookingsNewestFirst(rows)
}

/** Live updates when customers create or change bookings for this owner. */
export function subscribeBookingsForOwner(
  ownerId: string,
  onData: (bookings: Booking[]) => void,
  onError?: (error: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), where('ownerId', '==', ownerId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapBooking(d.id, d.data() as Record<string, unknown>),
      )
      onData(sortBookingsNewestFirst(rows))
    },
    (err) => onError?.(err),
  )
}

/** Live updates for customer booking history (My Bookings page). */
export function subscribeBookingsForCustomer(
  customerId: string,
  onData: (bookings: Booking[]) => void,
  onError?: (error: unknown) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COL), where('customerId', '==', customerId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapBooking(d.id, d.data() as Record<string, unknown>),
      )
      onData(sortBookingsNewestFirst(rows))
    },
    (err) => onError?.(err),
  )
}

/** Full collection read for admin. No `orderBy` so docs without `createdAt` still load; sorted in memory. */
export async function listAllBookings(): Promise<Booking[]> {
  const database = requireDb()
  const snap = await getDocs(collection(database, COL))
  const rows = snap.docs.map((d) =>
    mapBooking(d.id, d.data() as Record<string, unknown>),
  )
  return sortBookingsNewestFirst(rows)
}

export async function createBooking(
  input: Omit<Booking, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'ownerNote'> & {
    ownerNote?: string
  },
) {
  const database = requireDb()
  const { ownerNote, customerEmail, estimatedTotalLkr, ...rest } = input
  const ref = await addDoc(collection(database, COL), {
    ...rest,
    ...(ownerNote != null && ownerNote !== '' ? { ownerNote } : {}),
    ...(customerEmail != null && String(customerEmail).trim() !== ''
      ? { customerEmail: String(customerEmail).trim() }
      : {}),
    ...(typeof estimatedTotalLkr === 'number' &&
    !Number.isNaN(estimatedTotalLkr) &&
    estimatedTotalLkr >= 0
      ? { estimatedTotalLkr }
      : {}),
    status: 'pending' satisfies BookingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  ownerNote?: string,
) {
  const database = requireDb()
  const ref = doc(database, COL, id)
  await updateDoc(ref, {
    status,
    ...(ownerNote !== undefined ? { ownerNote } : {}),
    updatedAt: serverTimestamp(),
  })
}
