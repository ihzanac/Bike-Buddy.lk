import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import {
  ADMIN_SALE_BIKES,
  ADMIN_SALE_SHOPS,
  type AdminBike,
} from '@/data/adminBikeSaleData'
import type { SaleShop } from '@/types/saleShop'
import { requireDb } from '@/services/firebase'
import { subscribeBikesCatalog } from '@/services/bikes'
import { subscribeVerifiedSaleShops } from '@/services/saleShops'
import type { Bike } from '@/types'
import { bikeToAdminBike } from '@/utils/bikeSaleMappers'

export type BikeSaleShopOption = {
  id: string
  name: string
  owner: string
  phone: string
  location: string
  whatsapp: string
  mapQ: string
}

const DEMO_SHOP_OPTIONS: BikeSaleShopOption[] = [
  {
    id: 'batticaloa',
    name: ADMIN_SALE_SHOPS.batticaloa.name,
    owner: ADMIN_SALE_SHOPS.batticaloa.owner,
    phone: ADMIN_SALE_SHOPS.batticaloa.phone,
    location: ADMIN_SALE_SHOPS.batticaloa.location,
    whatsapp: ADMIN_SALE_SHOPS.batticaloa.whatsapp,
    mapQ: ADMIN_SALE_SHOPS.batticaloa.mapQ,
  },
  {
    id: 'kallady',
    name: ADMIN_SALE_SHOPS.kallady.name,
    owner: ADMIN_SALE_SHOPS.kallady.owner,
    phone: ADMIN_SALE_SHOPS.kallady.phone,
    location: ADMIN_SALE_SHOPS.kallady.location,
    whatsapp: ADMIN_SALE_SHOPS.kallady.whatsapp,
    mapQ: ADMIN_SALE_SHOPS.kallady.mapQ,
  },
]

function digitsOnly(s: string) {
  return s.replace(/\D/g, '') || '94'
}

function saleShopToCatalogOption(s: SaleShop): BikeSaleShopOption {
  const id = s.ownerId?.trim() || `__dir__${s.id}`
  const location = [s.city, s.district].filter(Boolean).join(', ') || s.address || 'Sri Lanka'
  const mapQ = s.address.trim() ? s.address : location
  return {
    id,
    name: s.name,
    owner: s.owner,
    phone: s.phone,
    location,
    whatsapp: digitsOnly(s.phone) || '94',
    mapQ,
  }
}

export function useBikeSaleCatalog() {
  const [rawBikes, setRawBikes] = useState<Bike[]>([])
  const [firstLoad, setFirstLoad] = useState(true)
  const [err, setErr] = useState<unknown>(null)
  const [verifiedSaleShops, setVerifiedSaleShops] = useState<SaleShop[]>([])
  const [ownerShopRows, setOwnerShopRows] = useState<BikeSaleShopOption[]>([])

  const useDemo = !firstLoad && rawBikes.length === 0
  const hasRealShopCatalog = verifiedSaleShops.length > 0 || ownerShopRows.length > 0

  useEffect(() => {
    return subscribeBikesCatalog(
      (list) => {
        setRawBikes(list)
        setFirstLoad(false)
        setErr(null)
      },
      (e) => {
        setErr(e)
        setFirstLoad(false)
      },
    )
  }, [])

  useEffect(() => {
    return subscribeVerifiedSaleShops(
      (list) => {
        setVerifiedSaleShops(list)
        setErr(null)
      },
      (e) => {
        setErr(e)
      },
    )
  }, [])

  useEffect(() => {
    if (firstLoad) return
    const ownerIds = [...new Set(rawBikes.map((b) => b.ownerId).filter(Boolean))]
    if (ownerIds.length === 0) {
      setOwnerShopRows([])
      return
    }
    const db = requireDb()
    void (async () => {
      const rows: BikeSaleShopOption[] = []
      for (const id of ownerIds) {
        try {
          const snap = await getDoc(doc(db, 'users', id))
          if (!snap.exists()) continue
          const d = snap.data() as Record<string, unknown>
          const name = String(d.shopName ?? d.displayName ?? 'Bike shop')
          const owner = String(d.displayName ?? 'Owner')
          const phone = d.phone != null ? String(d.phone) : '—'
          const location = String(d.district ?? d.location ?? d.shopAddress ?? 'Sri Lanka')
          const mapQ = location
          const wa = d.whatsapp != null ? digitsOnly(String(d.whatsapp)) : '94'
          rows.push({ id, name, owner, phone, location, whatsapp: wa, mapQ })
        } catch {
          /* skip */
        }
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      if (rows.length > 0) {
        setOwnerShopRows(rows)
      } else {
        setOwnerShopRows(
          ownerIds.map((id) => ({
            id,
            name: 'Bike sale shop',
            owner: '—',
            phone: '—',
            location: 'Sri Lanka',
            whatsapp: '94',
            mapQ: 'Sri Lanka',
          })),
        )
      }
    })()
  }, [rawBikes, firstLoad])

  const shopOptions = useMemo(() => {
    if (verifiedSaleShops.length === 0 && ownerShopRows.length === 0) {
      return DEMO_SHOP_OPTIONS
    }
    const byId = new Map<string, BikeSaleShopOption>()
    for (const s of verifiedSaleShops) {
      const o = saleShopToCatalogOption(s)
      byId.set(o.id, o)
    }
    for (const o of ownerShopRows) {
      if (!byId.has(o.id)) byId.set(o.id, o)
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }, [verifiedSaleShops, ownerShopRows])

  const getDisplayBikes = useCallback(
    (shopId: string): AdminBike[] => {
      if (!shopId) return []
      if (shopId.startsWith('__dir__')) return []
      if (useDemo && !hasRealShopCatalog) return ADMIN_SALE_BIKES
      return rawBikes
        .filter((b) => b.ownerId === shopId && b.active !== false)
        .map(bikeToAdminBike)
    },
    [useDemo, rawBikes, hasRealShopCatalog],
  )

  const getShop = useCallback(
    (shopId: string) => {
      if (!shopId) return null
      return shopOptions.find((s) => s.id === shopId) ?? null
    },
    [shopOptions],
  )

  const loading = firstLoad

  return {
    loading,
    error: err,
    useDemo: useDemo && !hasRealShopCatalog,
    shopOptions,
    getDisplayBikes,
    getShop,
  }
}
