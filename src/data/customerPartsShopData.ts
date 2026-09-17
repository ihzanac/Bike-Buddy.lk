export type PartsShopId = 'ravi' | 'kumar' | 'speed'

export type PartCategory = 'engine' | 'brake' | 'electrical' | 'body' | 'accessories'
export type PartBrand = 'genuine' | 'oem' | 'aftermarket'
export type StockLevel = 'in-stock' | 'low-stock' | 'out-stock'

export type CustomerPart = {
  id: string
  name: string
  price: number
  oldPrice?: number
  category: PartCategory
  brand: PartBrand
  stock: StockLevel
  categoryLabel: string
  brandLabel: string
  features: string[]
  image: string
}

export const PARTS_SHOPS: Record<
  PartsShopId,
  {
    name: string
    phone: string
    owner: string
    location: string
    hours: string
    whatsapp: string
    mapQuery: string
  }
> = {
  ravi: {
    name: 'Ravi Auto Parts',
    phone: '+94 77 123 4567',
    owner: 'Mr. Ravi Kumar',
    location: 'Main Road, Batticaloa',
    hours: '8:00 AM - 6:00 PM',
    whatsapp: '94771234567',
    mapQuery: 'batticaloa',
  },
  kumar: {
    name: 'Kumar Bike Accessories',
    phone: '+94 77 987 6543',
    owner: 'Mr. Kumar Perera',
    location: 'Kallady, Batticaloa',
    hours: '9:00 AM - 7:00 PM',
    whatsapp: '94779876543',
    mapQuery: 'kallady batticaloa',
  },
  speed: {
    name: 'Speed Parts Center',
    phone: '+94 75 112 2334',
    owner: 'Mr. Suresh Fernando',
    location: 'Eravur Road, Batticaloa',
    hours: '8:30 AM - 6:30 PM',
    whatsapp: '94751122334',
    mapQuery: 'eravur road batticaloa',
  },
}

export const PARTS_CATALOG: CustomerPart[] = [
  {
    id: 'p1',
    name: 'Engine Oil Filter',
    price: 1500,
    oldPrice: 2000,
    category: 'engine',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Engine Parts',
    brandLabel: 'Genuine Parts',
    features: ['High quality filtration', 'Fits: Honda, Yamaha, Bajaj', '6 months warranty'],
    image: '/parts/p1.jpg',
  },
  {
    id: 'p2',
    name: 'Brake Pads Set',
    price: 3500,
    category: 'brake',
    brand: 'oem',
    stock: 'in-stock',
    categoryLabel: 'Brake System',
    brandLabel: 'OEM Quality',
    features: ['Front & Rear set', 'Low dust formula', '3 months warranty'],
    image: '/parts/p2.jpg',
  },
  {
    id: 'p3',
    name: 'LED Headlight',
    price: 4500,
    oldPrice: 6000,
    category: 'electrical',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Electrical',
    brandLabel: 'Genuine Parts',
    features: ['Super bright 6000K', 'Energy efficient', '1 year warranty'],
    image: '/parts/p3.jpg',
  },
  {
    id: 'p4',
    name: 'Air Filter',
    price: 1200,
    category: 'engine',
    brand: 'oem',
    stock: 'in-stock',
    categoryLabel: 'Engine Parts',
    brandLabel: 'OEM Quality',
    features: ['High flow design', 'Washable & reusable', 'Fits most 150cc bikes'],
    image: '/parts/p4.jpg',
  },
  {
    id: 'p5',
    name: 'Side Mirror Set',
    price: 2500,
    category: 'body',
    brand: 'aftermarket',
    stock: 'in-stock',
    categoryLabel: 'Body Parts',
    brandLabel: 'Aftermarket',
    features: ['Left & Right pair', 'Universal fit', 'Anti-glare coating'],
    image: '/parts/p5.jpg',
  },
  {
    id: 'p6',
    name: 'Phone Holder',
    price: 850,
    category: 'accessories',
    brand: 'aftermarket',
    stock: 'in-stock',
    categoryLabel: 'Accessories',
    brandLabel: 'Aftermarket',
    features: ['360° rotation', 'Shock absorbing', 'Fits all phones'],
    image: '/parts/p6.jpg',
  },
  {
    id: 'p7',
    name: 'Spark Plug Set (4pcs)',
    price: 2500,
    category: 'engine',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Engine Parts',
    brandLabel: 'Genuine Parts',
    features: ['NGK / Denso quality', 'Long lasting', 'Improved fuel efficiency'],
    image: '/parts/p7.jpg',
  },
  {
    id: 'p8',
    name: 'Battery 12V 7Ah',
    price: 6500,
    category: 'electrical',
    brand: 'oem',
    stock: 'low-stock',
    categoryLabel: 'Electrical',
    brandLabel: 'OEM Quality',
    features: ['Maintenance free', '1 year warranty', 'High cranking power'],
    image: '/parts/p8.jpg',
  },
  {
    id: 'p9',
    name: 'Front Fender',
    price: 15000,
    category: 'body',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Body Parts',
    brandLabel: 'Genuine Parts',
    features: ['Perfect fit', 'Multiple colors', 'Original quality'],
    image: '/parts/p9.jpg',
  },
  {
    id: 'p10',
    name: 'Bike Cover Waterproof',
    price: 1800,
    oldPrice: 2500,
    category: 'accessories',
    brand: 'aftermarket',
    stock: 'in-stock',
    categoryLabel: 'Accessories',
    brandLabel: 'Aftermarket',
    features: ['UV protection', 'Dust & rain proof', 'Universal size'],
    image: '/parts/p10.jpg',
  },
  {
    id: 'p11',
    name: 'Brake Disc Rotor',
    price: 4200,
    category: 'brake',
    brand: 'oem',
    stock: 'in-stock',
    categoryLabel: 'Brake System',
    brandLabel: 'OEM Quality',
    features: ['220mm diameter', 'Heat resistant', 'Smooth braking'],
    image: '/parts/p11.jpg',
  },
  {
    id: 'p12',
    name: 'Chain Sprocket Kit',
    price: 8500,
    category: 'engine',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Engine Parts',
    brandLabel: 'Genuine Parts',
    features: ['Complete set', 'Heavy duty chain', '6 months warranty'],
    image: '/parts/p12.jpg',
  },
  {
    id: 'p13',
    name: 'Full Face Helmet',
    price: 3200,
    oldPrice: 4500,
    category: 'accessories',
    brand: 'aftermarket',
    stock: 'in-stock',
    categoryLabel: 'Accessories',
    brandLabel: 'Aftermarket',
    features: ['DOT approved', 'Multiple sizes', 'Anti-fog visor'],
    image: '/parts/p13.jpg',
  },
  {
    id: 'p14',
    name: 'Electric Horn',
    price: 2800,
    category: 'electrical',
    brand: 'genuine',
    stock: 'in-stock',
    categoryLabel: 'Electrical',
    brandLabel: 'Genuine Parts',
    features: ['Loud & clear sound', 'Waterproof', 'Easy installation'],
    image: '/parts/p14.jpg',
  },
  {
    id: 'p15',
    name: 'Handlebar Set',
    price: 12000,
    category: 'body',
    brand: 'oem',
    stock: 'in-stock',
    categoryLabel: 'Body Parts',
    brandLabel: 'OEM Quality',
    features: ['Chrome finished', 'Ergonomic design', 'Fits most bikes'],
    image: '/parts/p15.jpg',
  },
]
