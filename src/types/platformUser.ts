import type { OwnerStatus } from '@/types'

export type PlatformUserRole = 'admin' | 'customer' | 'shop-owner'

export type PlatformUserStatus = 'active' | 'inactive' | 'suspended'

export type AdminPlatformUser = {
  /** Firebase Auth uid / `users` doc id */
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: PlatformUserRole
  city: string
  status: PlatformUserStatus
  joined: string
  lastActive: string
  /** Present for shop owners — drives pending-approval counts */
  ownerStatus?: OwnerStatus
}
