import type { OwnerStatus } from '@/types'

export type SaleShopStatus = 'verified' | 'pending'

/** Admin aggregate list: directory verification vs no `saleShops` doc for this owner yet. */
export type BikeSaleDirectoryStatus = SaleShopStatus | 'none'

/** Row from `loadAdminBikeSaleShopsFromFirestore` — owners + live metrics + merged directory. */
export type AdminBikeSaleShopRow = {
  /** Row key: owner uid, or orphan `saleShops` document id */
  id: string
  ownerUid: string
  /** From the `users` doc — pending owners surface in the admin bell / approvals. */
  ownerStatus?: OwnerStatus
  name: string
  owner: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  listings: number
  rating: number
  established: string
  createdAtMs?: number
  directoryStatus: BikeSaleDirectoryStatus
  /** Firestore `saleShops` doc id to delete; null when there is no directory row for this owner */
  directoryDocId: string | null
  description?: string
}

/** `id` is the Firestore document id when synced; local demo rows use string ids too. */
export type SaleShop = {
  id: string
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
  /** Server `createdAt` as ms; used for “newest first” when present. */
  createdAtMs?: number
  description?: string
  /** Approved shop owner Auth uid — when set, customer bike sale lists bikes for this owner. */
  ownerId?: string
}
