import type { Accessory, Bike, Booking, ServiceOffer } from '@/types'
import seed from '@/data/demo-seed.json'

/** Synthetic owner id for browse-only demo listings (not a real Firebase user). */
export const DEMO_CATALOG_OWNER_ID = 'demo-catalog'

export function isDemoCatalogEnabled(): boolean {
  return import.meta.env.VITE_DEMO_DATA === 'true'
}

export function isDemoEntityId(id: string): boolean {
  return id.startsWith('demo-')
}

/** Seeded docs from `demo-seed.json` / `seed:firestore` — real Firestore ids, marker phrase in description. */
const FIRESTORE_SEED_DEMO_PHRASE = 'Demo listing'

export function isFirestoreSeedDemoListing(bike: Pick<Bike, 'description'>): boolean {
  return bike.description.includes(FIRESTORE_SEED_DEMO_PHRASE)
}

/** Hide junk rows from public `/bikes` (owner dashboards still list everything). */
export function isHiddenFromPublicBikeCatalog(bike: Bike): boolean {
  if (isFirestoreSeedDemoListing(bike)) return true
  return false
}

export const DEMO_BIKES: Bike[] = seed.bikes.map((b, i) => ({
  id: `demo-bike-${i + 1}`,
  title: b.title,
  description: b.description,
  price: b.price,
  category: b.category,
  location: b.location,
  images: [b.image],
  ownerId: DEMO_CATALOG_OWNER_ID,
}))

export const DEMO_ACCESSORIES: Accessory[] = seed.accessories.map((a, i) => ({
  id: `demo-accessory-${i + 1}`,
  title: a.title,
  description: a.description,
  price: a.price,
  category: a.category,
  images: [a.image],
  ownerId: DEMO_CATALOG_OWNER_ID,
}))

export const DEMO_SERVICE_OFFERS: ServiceOffer[] = seed.services.map((s, i) => ({
  id: `demo-service-${i + 1}`,
  name: s.name,
  description: s.description,
  durationMinutes: s.durationMinutes,
  price: s.price,
  ownerId: DEMO_CATALOG_OWNER_ID,
  active: true,
}))

export function getDemoBikeById(id: string): Bike | null {
  return DEMO_BIKES.find((b) => b.id === id) ?? null
}

export function getDemoAccessoryById(id: string): Accessory | null {
  return DEMO_ACCESSORIES.find((a) => a.id === id) ?? null
}

/** Sample rows for empty booking history when demo catalog is on (browse-only). */
export const DEMO_BOOKING_SAMPLES: Booking[] = [
  {
    id: 'demo-booking-sample-1',
    customerId: 'demo',
    ownerId: DEMO_CATALOG_OWNER_ID,
    serviceId: 'demo-service-1',
    serviceName: 'Premium Tune-Up',
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    location: 'BikeHub Demo Service Center',
    status: 'accepted',
    ownerNote: 'Demo data — not a live reservation.',
  },
  {
    id: 'demo-booking-sample-2',
    customerId: 'demo',
    ownerId: DEMO_CATALOG_OWNER_ID,
    serviceId: 'demo-service-2',
    serviceName: 'Tubeless Tire Setup',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: '14:30',
    location: 'BikeHub Demo Service Center',
    status: 'pending',
  },
  {
    id: 'demo-booking-sample-3',
    customerId: 'demo',
    ownerId: DEMO_CATALOG_OWNER_ID,
    serviceId: 'demo-service-1',
    serviceName: 'Chain & cassette service',
    date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
    time: '09:00',
    location: 'BikeHub Demo Service Center',
    status: 'completed',
    ownerNote: 'Demo — shows “service completed” after the shop finishes the job.',
  },
]
