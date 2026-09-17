export type SaleShopId = 'batticaloa' | 'kallady'

export type AdminBikeColor = { name: string; hex: string }

export type AdminBikeSpec = { label: string; value: string }

export type AdminBike = {
  id: string
  name: string
  price: string
  priceN: number
  image: string
  colors: AdminBikeColor[]
  modalColorBlock: boolean
  specs: AdminBikeSpec[]
  /** Public description (from shop listing) */
  description?: string
  /** e.g. Category · Year — shown under the title in the customer modal */
  metaLine?: string
  /** Shown in customer View Details when set in shop (shop “Additional notes”) */
  additionalNotes?: string
  /** Extra spec row for e.g. top speed */
  extraSpecs?: AdminBikeSpec[]
}

export const ADMIN_SALE_SHOPS: Record<
  SaleShopId,
  { name: string; owner: string; phone: string; location: string; whatsapp: string; mapQ: string }
> = {
  batticaloa: {
    name: 'Ravi Bike Sale',
    owner: 'Mr. Ravi Kumar',
    phone: '+94 77 123 4567',
    location: 'Batticaloa, Eastern Province',
    whatsapp: '94771234567',
    mapQ: 'batticaloa',
  },
  kallady: {
    name: 'Speed Motors',
    owner: 'Mr. Suresh Perera',
    phone: '+94 77 987 6543',
    location: 'Kallady, Batticaloa',
    whatsapp: '94779876543',
    mapQ: 'kallady batticaloa',
  },
}

/**
 * Local demo images (served from /public/bikes). Replace with your own assets anytime.
 * Images are keyword-based motorcycle stock (Lorem Flickr) for catalogue preview.
 */
const DEMO_BIKE_IMAGES: Record<string, string> = {
  b1: '/bikes/ktm-duke-200.jpg',
  b2: '/bikes/yamaha-fz-v3.jpg',
  b3: '/bikes/ktm-duke-390.jpg',
  b4: '/bikes/yamaha-mt15.jpg',
  b5: '/bikes/bajaj-ns200.jpg',
}

const bikeImg = (id: string) => DEMO_BIKE_IMAGES[id] ?? '/bikes/ktm-duke-200.jpg'

export const ADMIN_SALE_BIKES: AdminBike[] = [
  {
    id: 'b1',
    name: 'KTM Duke 200',
    price: 'LKR 950,000',
    priceN: 950_000,
    image: bikeImg('b1'),
    modalColorBlock: true,
    colors: [
      { name: 'Orange', hex: '#FF6B00' },
      { name: 'Black', hex: '#000000' },
      { name: 'White', hex: '#FFFFFF' },
    ],
    specs: [
      { label: 'Engine', value: '199.5cc' },
      { label: 'Mileage', value: '35 km/l' },
      { label: 'ABS', value: 'Dual Channel' },
      { label: 'Power', value: '25 HP' },
    ],
  },
  {
    id: 'b2',
    name: 'Yamaha FZ V3',
    price: 'LKR 780,000',
    priceN: 780_000,
    image: bikeImg('b2'),
    modalColorBlock: false,
    colors: [
      { name: 'Blue', hex: '#1E3A8A' },
      { name: 'Black', hex: '#000000' },
      { name: 'Red', hex: '#DC2626' },
    ],
    specs: [
      { label: 'Engine', value: '149cc' },
      { label: 'Mileage', value: '45 km/l' },
      { label: 'ABS', value: 'Single Channel' },
      { label: 'Power', value: '12.4 HP' },
    ],
  },
  {
    id: 'b3',
    name: 'KTM Duke 390',
    price: 'LKR 2,200,000',
    priceN: 2_200_000,
    image: bikeImg('b3'),
    modalColorBlock: false,
    colors: [
      { name: 'Orange', hex: '#FF6B00' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Black', hex: '#000000' },
    ],
    specs: [
      { label: 'Engine', value: '373cc' },
      { label: 'Top Speed', value: '170 km/h' },
      { label: 'ABS', value: 'Dual Channel' },
      { label: 'Power', value: '43 HP' },
    ],
  },
  {
    id: 'b4',
    name: 'Yamaha MT15',
    price: 'LKR 1,110,000',
    priceN: 1_110_000,
    image: bikeImg('b4'),
    modalColorBlock: false,
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Blue', hex: '#1E3A8A' },
      { name: 'Grey', hex: '#6B7280' },
    ],
    specs: [
      { label: 'Engine', value: '155cc' },
      { label: 'Mileage', value: '48 km/l' },
      { label: 'ABS', value: 'Single Channel' },
      { label: 'Power', value: '18.6 HP' },
    ],
  },
  {
    id: 'b5',
    name: 'Bajaj NS200',
    price: 'LKR 1,100,000',
    priceN: 1_100_000,
    image: bikeImg('b5'),
    modalColorBlock: false,
    colors: [
      { name: 'Red', hex: '#DC2626' },
      { name: 'Black', hex: '#000000' },
      { name: 'Yellow', hex: '#FBBF24' },
    ],
    specs: [
      { label: 'Engine', value: '199cc' },
      { label: 'Mileage', value: '36 km/l' },
      { label: 'ABS', value: 'Dual Channel' },
      { label: 'Power', value: '24.5 HP' },
    ],
  },
]
