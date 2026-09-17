import type { Accessory, Bike, Booking, UserProfile } from '@/types'

/** When `VITE_ADMIN_DUMMY_DATA=true`, admin views show sample rows + stat floors for empty DBs. */
export function isAdminDummyDataEnabled(): boolean {
  return import.meta.env.VITE_ADMIN_DUMMY_DATA === 'true'
}

export function isDemoRecordId(id: string): boolean {
  return id.startsWith('demo-')
}

export const DUMMY_COUNT_FLOORS = {
  users: 18,
  bikes: 5,
  accessories: 8,
  bookings: 6,
  services: 4,
  ownersPending: 2,
} as const

export function mergeAdminCounts(
  real: {
    users: number
    bikes: number
    accessories: number
    bookings: number
    services: number
    ownersPending: number
  } | null,
): {
  users: number
  bikes: number
  accessories: number
  bookings: number
  services: number
  ownersPending: number
} | null {
  if (!isAdminDummyDataEnabled()) {
    return real
  }
  if (!real) {
    return { ...DUMMY_COUNT_FLOORS }
  }
  return {
    users: Math.max(real.users, DUMMY_COUNT_FLOORS.users),
    bikes: Math.max(real.bikes, DUMMY_COUNT_FLOORS.bikes),
    accessories: Math.max(real.accessories, DUMMY_COUNT_FLOORS.accessories),
    bookings: Math.max(real.bookings, DUMMY_COUNT_FLOORS.bookings),
    services: Math.max(real.services, DUMMY_COUNT_FLOORS.services),
    ownersPending: Math.max(real.ownersPending, DUMMY_COUNT_FLOORS.ownersPending),
  }
}

export const DUMMY_PENDING_OWNERS: UserProfile[] = [
  {
    uid: 'demo-owner-pending-1',
    email: 'kandy.bikes@example.lk',
    displayName: 'Kandy Cycle Hub',
    role: 'owner',
    ownerStatus: 'pending',
    shopName: 'Kandy Cycle Hub',
    phone: '+94 77 100 2000',
  },
  {
    uid: 'demo-owner-pending-2',
    email: 'colombo.parts@example.lk',
    displayName: 'Colombo Parts & Service',
    role: 'owner',
    ownerStatus: 'pending',
    shopName: 'Colombo Parts & Service',
    phone: '+94 11 555 0101',
  },
]

export const DUMMY_USER_ROWS: UserProfile[] = [
  ...DUMMY_PENDING_OWNERS,
  {
    uid: 'demo-user-1',
    email: 'rider@example.lk',
    displayName: 'Nimal Perera',
    role: 'customer',
  },
  {
    uid: 'demo-admin-note',
    email: 'admin@bikebuddy.lk',
    displayName: 'Platform Admin',
    role: 'admin',
  },
  {
    uid: 'demo-owner-approved',
    email: 'galle.motors@example.lk',
    displayName: 'Galle Motors',
    role: 'owner',
    ownerStatus: 'approved',
    shopName: 'Galle Motors',
  },
]

export const DUMMY_BIKES: Bike[] = [
  {
    id: 'demo-bike-1',
    title: 'Yamaha FZ V3 (sample)',
    description: 'City commuter, well maintained. Sample row for admin layout preview.',
    price: 485000,
    category: 'street',
    location: 'Colombo',
    images: [],
    ownerId: 'demo-owner-approved',
  },
  {
    id: 'demo-bike-2',
    title: 'Honda CB150R (sample)',
    description: 'Lightweight street bike. Not a real listing.',
    price: 625000,
    category: 'street',
    images: [],
    ownerId: 'demo-owner-approved',
  },
]

export const DUMMY_ACCESSORIES: Accessory[] = [
  {
    id: 'demo-acc-1',
    title: 'AGV K1 Helmet (sample)',
    description: 'Full-face helmet — demo product row.',
    price: 18500,
    category: 'helmets',
    images: [],
    ownerId: 'demo-owner-approved',
  },
  {
    id: 'demo-acc-2',
    title: 'Chain lube 400ml (sample)',
    description: 'Maintenance consumable (preview).',
    price: 1200,
    category: 'maintenance',
    images: [],
    ownerId: 'demo-owner-approved',
  },
]

export const DUMMY_BOOKINGS: Booking[] = [
  {
    id: 'demo-book-1',
    customerId: 'demo-user-1',
    ownerId: 'demo-owner-approved',
    serviceId: 'demo-svc-1',
    serviceName: 'Full service + oil change',
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    location: 'Galle — shop floor',
    status: 'pending',
  },
  {
    id: 'demo-book-2',
    customerId: 'demo-user-1',
    ownerId: 'demo-owner-approved',
    serviceId: 'demo-svc-2',
    serviceName: 'Brake pad replacement',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: '14:30',
    location: 'Colombo — home visit (sample)',
    status: 'accepted',
    ownerNote: 'Parts ordered (demo row)',
  },
]
