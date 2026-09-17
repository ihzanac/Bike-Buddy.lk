import { ROUTES } from '@/utils/constants'

/** Stored on `UserProfile.shopCategory` for owner accounts. */
export const SHOP_OWNER_CATEGORY = {
  BIKE_SERVICE: 'bike_service',
  BIKE_PARTS: 'bike_parts',
  BIKE_SALE: 'bike_sale',
} as const

export type ShopOwnerCategoryId = (typeof SHOP_OWNER_CATEGORY)[keyof typeof SHOP_OWNER_CATEGORY]

export const SHOP_OWNER_CATEGORY_OPTIONS: { value: ShopOwnerCategoryId; label: string }[] = [
  { value: SHOP_OWNER_CATEGORY.BIKE_SERVICE, label: 'Bike service' },
  { value: SHOP_OWNER_CATEGORY.BIKE_PARTS, label: 'Bike parts shop' },
  { value: SHOP_OWNER_CATEGORY.BIKE_SALE, label: 'Bike sale shop' },
]

/**
 * `select#reg-cat` value: registers service + parts + sale in one account.
 * (Not a stored Firestore id; expanded before save.)
 */
export const SHOP_REGISTER_ALL_TYPES_VALUE = 'all_shop_types' as const

/** Map a registration dropdown value to the list of business lines to save. */
export function shopCategoriesFromRegisterChoice(choice: string): ShopOwnerCategoryId[] {
  if (choice === SHOP_REGISTER_ALL_TYPES_VALUE) {
    return [
      SHOP_OWNER_CATEGORY.BIKE_SERVICE,
      SHOP_OWNER_CATEGORY.BIKE_PARTS,
      SHOP_OWNER_CATEGORY.BIKE_SALE,
    ]
  }
  const n = normalizeShopCategory(choice)
  return n ? [n] : []
}

/** Map Firestore / legacy display strings to canonical ids. */
export function normalizeShopCategory(raw: string | undefined | null): ShopOwnerCategoryId | undefined {
  if (raw == null || String(raw).trim() === '') return undefined
  const s = String(raw).trim()
  if (
    s === SHOP_OWNER_CATEGORY.BIKE_SERVICE ||
    s === SHOP_OWNER_CATEGORY.BIKE_PARTS ||
    s === SHOP_OWNER_CATEGORY.BIKE_SALE
  ) {
    return s
  }
  const slug = s.toLowerCase().replace(/[-\s]+/g, '_').replace(/_+/g, '_')
  if (slug === SHOP_OWNER_CATEGORY.BIKE_SERVICE) return SHOP_OWNER_CATEGORY.BIKE_SERVICE
  if (slug === SHOP_OWNER_CATEGORY.BIKE_PARTS) return SHOP_OWNER_CATEGORY.BIKE_PARTS
  if (slug === SHOP_OWNER_CATEGORY.BIKE_SALE) return SHOP_OWNER_CATEGORY.BIKE_SALE
  if (s === 'Bike Service Center') return SHOP_OWNER_CATEGORY.BIKE_SERVICE
  if (s === 'Spare Parts Shop') return SHOP_OWNER_CATEGORY.BIKE_PARTS
  if (s === 'Bike Dealer') return SHOP_OWNER_CATEGORY.BIKE_SALE
  return undefined
}

export function shopCategoryLabel(id: ShopOwnerCategoryId | undefined): string {
  if (!id) return 'Shop'
  const o = SHOP_OWNER_CATEGORY_OPTIONS.find((x) => x.value === id)
  return o?.label ?? 'Shop'
}

export function shopCategoriesLine(cats: ShopOwnerCategoryId[]): string {
  if (cats.length === 0) return 'Shop'
  if (cats.length === 1) return shopCategoryLabel(cats[0])
  return cats.map((c) => shopCategoryLabel(c)).join(' · ')
}

/** `shopCategories[]` on the profile, else legacy `shopCategory` as a single entry. */
export function getOwnerShopCategories(profile: {
  shopCategories?: unknown
  shopCategory?: string | null
} | null | undefined): ShopOwnerCategoryId[] {
  if (!profile) return []
  const arr = profile.shopCategories
  if (Array.isArray(arr) && arr.length > 0) {
    const out: ShopOwnerCategoryId[] = []
    for (const x of arr) {
      const n = normalizeShopCategory(String(x))
      if (n) out.push(n)
    }
    if (out.length) return out
  }
  const one = normalizeShopCategory(profile.shopCategory)
  return one ? [one] : []
}

export function ownerIsListedForServiceBooking(
  profile: { shopCategories?: unknown; shopCategory?: string | null } | null | undefined,
): boolean {
  const cats = getOwnerShopCategories(profile)
  if (cats.length === 0) return true
  return cats.includes(SHOP_OWNER_CATEGORY.BIKE_SERVICE)
}

/** Approved parts shops shown on the public customer parts page (browsing inventory). */
export function ownerIsListedForPartsCatalog(
  profile: { shopCategories?: unknown; shopCategory?: string | null } | null | undefined,
): boolean {
  const cats = getOwnerShopCategories(profile)
  if (cats.length === 0) return true
  return cats.includes(SHOP_OWNER_CATEGORY.BIKE_PARTS)
}

function canAccessPathForOneCategory(pathname: string, category: ShopOwnerCategoryId): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  const is = (route: string) => path === route || path.startsWith(`${route}/`)

  if (category === SHOP_OWNER_CATEGORY.BIKE_SERVICE) {
    if (is(ROUTES.shopParts)) return false
    if (is(ROUTES.shopBikeSales)) return false
    return true
  }
  if (category === SHOP_OWNER_CATEGORY.BIKE_PARTS) {
    if (is(ROUTES.shopBookings)) return false
    if (is(ROUTES.shopServices)) return false
    if (is(ROUTES.shopBikeSales)) return false
    return true
  }
  if (category === SHOP_OWNER_CATEGORY.BIKE_SALE) {
    if (is(ROUTES.shopBookings)) return false
    if (is(ROUTES.shopServices)) return false
    if (is(ROUTES.shopParts)) return false
    return true
  }
  return true
}

export function canOwnerAccessShopPath(
  pathname: string,
  ownerCategories: ShopOwnerCategoryId[] | undefined,
): boolean {
  if (ownerCategories == null || ownerCategories.length === 0) return true
  return ownerCategories.some((c) => canAccessPathForOneCategory(pathname, c))
}
