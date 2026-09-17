export type ServiceShopStatus = 'active' | 'pending' | 'inactive'

export type ServiceShop = {
  /** Owner uid (Firestore `users` doc id). */
  id: string
  /** Business lines from profile (e.g. “Bike service · Bike parts shop”). */
  linesLabel: string
  /** `createdAt` millis for sorting / “new this month”. */
  joinedMs: number
  name: string
  owner: string
  phone: string
  email: string
  district: string
  city: string
  address: string
  services: number
  reviews: number
  /** Display e.g. "450K" */
  revenue: string
  /** Thousands LKR for aggregation */
  revenueK: number
  rating: number
  status: ServiceShopStatus
  established: string
}
