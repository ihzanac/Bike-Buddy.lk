export type UserRole = 'customer' | 'owner' | 'admin'

export type OwnerStatus = 'pending' | 'approved' | 'rejected'

/** One day row in shop opening hours (owner profile). */
export type ShopDayHours = {
  enabled: boolean
  start: string
  end: string
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  ownerStatus?: OwnerStatus
  shopName?: string
  phone?: string
  /** City / area for customers (e.g. Batticaloa), optional. */
  location?: string
  /** Full address line, optional. */
  address?: string
  /** ISO `YYYY-MM-DD` from date input. */
  dateOfBirth?: string
  /** e.g. male, female, other. */
  gender?: string
  /** Extra shop registration fields (owner). */
  shopCategory?: string
  /** Business line(s). `shopCategory` remains the first id for legacy queries. */
  shopCategories?: Array<'bike_service' | 'bike_parts' | 'bike_sale'>
  shopAddress?: string
  district?: string
  whatsapp?: string
  /** Public shop story / blurb (owner). */
  shopDescription?: string
  website?: string
  postalCode?: string
  province?: string
  /** Public logo URL in Storage (owner). */
  shopLogoUrl?: string
  /** Optional; if unset, UI can infer from `createdAt`. */
  yearsInBusiness?: number
  /** `monday` … `sunday` keys. */
  operatingHours?: Record<string, ShopDayHours>
  /** Super vs system admin (BikeBuddy UI); optional. */
  adminTier?: 'super' | 'admin'
  /** Admin dashboard UI preferences/configuration persisted per admin account. */
  adminSettings?: {
    general?: {
      platformName?: string
      language?: string
      timezone?: string
      dateFormat?: 'ddmm' | 'mmdd' | 'iso'
      currency?: string
    }
    shopManagement?: {
      autoApprove?: boolean
      requireVerify?: boolean
      maxBookings?: number
    }
    security?: {
      twoFa?: boolean
      sms?: boolean
      emailAuth?: boolean
    }
    appearance?: {
      theme?: 'light' | 'dark' | 'auto'
      itemsPerPage?: number
      viewMode?: 'table' | 'cards' | 'list'
    }
  }
  createdAt?: unknown
  updatedAt?: unknown
}

export type BikeSaleColor = { name: string; hex: string }
export type BikeSaleSpec = { label: string; value: string }

export interface Bike {
  id: string
  title: string
  description: string
  price: number
  category: string
  location?: string
  images: string[]
  ownerId: string
  /** Customer bike-sale page: swatches + details modal (optional) */
  saleColors?: BikeSaleColor[]
  saleSpecs?: BikeSaleSpec[]
  modalColorBlock?: boolean
  active?: boolean
  /** Shop inventory (owner dashboard) */
  brand?: string
  year?: number
  stockQty?: number
  purchasePrice?: number
  reorderLevel?: number
  chassisNo?: string
  engineNo?: string
  supplier?: string
  fuelType?: string
  bodyColor?: string
  engineCC?: number
  /** Optional extra text; also shown in customer “View Details” with the full spec list */
  additionalNotes?: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface Accessory {
  id: string
  title: string
  description: string
  price: number
  category: string
  images: string[]
  ownerId: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface ServiceOffer {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  ownerId: string
  active: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed'

export interface Booking {
  id: string
  customerId: string
  ownerId: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  location: string
  status: BookingStatus
  /** Optional: receipt / confirmation to this address (e.g. customer’s Gmail) */
  customerEmail?: string
  /** Optional: included in confirmation email (customer + walk-in flows) */
  estimatedTotalLkr?: number
  ownerNote?: string
  createdAt?: unknown
  updatedAt?: unknown
}

/** Customer review left for a shop (Firestore `shopReviews`). */
export interface ShopReview {
  id: string
  ownerId: string
  customerId: string
  customerName: string
  rating: number
  text: string
  serviceName?: string
  createdAt?: unknown
  ownerReply?: string
  ownerRepliedAt?: unknown
  flagged?: boolean
  flaggedAt?: unknown
}
