import type { OwnerStatus } from '@/types'

export type PartsShopStatus = 'active' | 'inactive' | 'pending'

export type PartsStockLevel = 'high' | 'medium' | 'low'

/**
 * Admin list: `id` is usually the owner uid (same pattern as Service Shops). Orphan-only directory rows
 * use the `partsShops` document id. `directoryDocId` is the Firestore doc id when a directory row exists.
 */
export type PartsShop = {
  id: string
  ownerUid?: string
  /** Firestore `partsShops` doc id linked to this row, if any */
  directoryDocId?: string | null
  ownerStatus?: OwnerStatus
  name: string
  owner: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  parts: number
  orders: number
  revenue: string
  /** Thousands LKR for sorting / totals */
  revenueK: number
  stockLevel: PartsStockLevel
  status: PartsShopStatus
  established: string
  /** Server `createdAt` as ms; used for “newest first” when present. */
  createdAtMs?: number
  description?: string
  ownerId?: string
}
