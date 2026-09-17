export type BookServiceShopId = 'ravi' | 'kumar' | 'speed'

export const BOOK_SERVICE_SHOPS: Record<
  BookServiceShopId,
  {
    name: string
    ratingLabel: string
    location: string
    phone: string
    owner: string
    hours: string
    whatsapp: string
    mapQuery: string
  }
> = {
  ravi: {
    name: 'Ravi Bike Service Center',
    ratingLabel: '⭐ 4.6',
    location: 'Main Road, Batticaloa',
    phone: '+94 75 090 0658',
    owner: 'Mr. Ravi Kumar',
    hours: '8:00 AM - 6:00 PM',
    whatsapp: '94750900658',
    mapQuery: 'batticaloa',
  },
  kumar: {
    name: 'Kumar Auto Bike Care',
    ratingLabel: '⭐ 4.4',
    location: 'Kallady, Batticaloa',
    phone: '+94 77 987 6543',
    owner: 'Mr. Kumar Perera',
    hours: '9:00 AM - 7:00 PM',
    whatsapp: '94779876543',
    mapQuery: 'kallady batticaloa',
  },
  speed: {
    name: 'Speed Bike Garage',
    ratingLabel: '⭐ 4.8',
    location: 'Eravur Road, Batticaloa',
    phone: '+94 75 112 2334',
    owner: 'Mr. Suresh Fernando',
    hours: '8:30 AM - 6:30 PM',
    whatsapp: '94751122334',
    mapQuery: 'eravur road batticaloa',
  },
}

export const BOOK_SERVICE_ITEMS = [
  { id: 's1', key: 'full', name: 'Full Service', price: 3500, display: '🛠️ Full Service' },
  { id: 's2', key: 'oil', name: 'Oil Change', price: 1500, display: '🛢️ Oil Change' },
  { id: 's3', key: 'brake', name: 'Brake Repair', price: 800, display: '🛑 Brake Repair' },
  { id: 's4', key: 'chain', name: 'Chain & Sprocket', price: 1200, display: '⛓️ Chain & Sprocket' },
  { id: 's5', key: 'tune', name: 'Engine Tuning', price: 2500, display: '⚙️ Engine Tuning' },
  { id: 's6', key: 'tire', name: 'Tire Change', price: 600, display: '🛞 Tire Change' },
] as const

export type BookServiceItem = (typeof BOOK_SERVICE_ITEMS)[number]
