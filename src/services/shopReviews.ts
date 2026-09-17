import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { ShopReview } from '@/types'
import { requireDb } from '@/services/firebase'

const COL = 'shopReviews'

function mapReview(id: string, data: Record<string, unknown>): ShopReview {
  const rating = Number(data.rating)
  return {
    id,
    ownerId: String(data.ownerId ?? ''),
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? 'Customer'),
    text: String(data.text ?? ''),
    rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 1,
    serviceName: data.serviceName ? String(data.serviceName) : undefined,
    createdAt: data.createdAt,
    ownerReply: data.ownerReply ? String(data.ownerReply) : undefined,
    ownerRepliedAt: data.ownerRepliedAt,
    flagged: Boolean(data.flagged),
    flaggedAt: data.flaggedAt,
  }
}

function sortByCreatedDesc(rows: ShopReview[]): ShopReview[] {
  return [...rows].sort((a, b) => {
    const ma = createdMs(a.createdAt)
    const mb = createdMs(b.createdAt)
    return mb - ma
  })
}

function createdMs(createdAt: unknown): number {
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

export function subscribeShopReviewsForOwner(
  ownerId: string,
  onData: (reviews: ShopReview[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const q = query(
    collection(database, COL),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapReview(d.id, d.data() as Record<string, unknown>))
      onData(sortByCreatedDesc(rows))
    },
    (err) => onError?.(err),
  )
}

/** Customer submits a review for a shop (must not be the shop owner). */
export async function createShopReview(input: {
  ownerId: string
  customerId: string
  customerName: string
  rating: number
  text: string
  serviceName?: string
}) {
  const database = requireDb()
  const r = Math.min(5, Math.max(1, Math.round(input.rating)))
  const data: Record<string, unknown> = {
    ownerId: input.ownerId.trim(),
    customerId: input.customerId.trim(),
    customerName: input.customerName.trim(),
    rating: r,
    text: input.text.trim(),
    createdAt: serverTimestamp(),
  }
  const sn = input.serviceName?.trim()
  if (sn) data.serviceName = sn
  await addDoc(collection(database, COL), data)
}

export async function updateShopReviewOwnerReply(reviewId: string, ownerReply: string) {
  const database = requireDb()
  await updateDoc(doc(database, COL, reviewId), {
    ownerReply: ownerReply.trim(),
    ownerRepliedAt: serverTimestamp(),
  })
}

export async function setShopReviewFlagged(reviewId: string, flagged: boolean) {
  const database = requireDb()
  await updateDoc(doc(database, COL, reviewId), {
    flagged,
    flaggedAt: flagged ? serverTimestamp() : deleteField(),
  })
}
