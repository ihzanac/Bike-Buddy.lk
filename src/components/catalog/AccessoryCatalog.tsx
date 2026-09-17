import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isDemoEntityId, isFirestoreSeedDemoListing } from '@/data/demoCatalog'
import { listAccessories } from '@/services/accessories'
import { listActiveShopPartsForCustomer } from '@/services/shopParts'
import { listApprovedOwnersForParts } from '@/services/users'
import type { Accessory } from '@/types'
import { ProductCard } from '@/components/product/ProductCard'
import { ROUTES } from '@/utils/constants'
import { CatalogToolbar } from '@/pages/public/CatalogToolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PART_CATEGORY_LABEL, PART_BRAND_LABEL } from '@/types/shopPart'

/** Shared parts/accessories grid + filters (public `/accessories` and customer portal). */
export function AccessoryCatalog() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')

  const qParam = searchParams.get('q')
  useEffect(() => {
    if (qParam != null) setSearch(qParam)
  }, [qParam])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [accessoryRows, owners] = await Promise.all([listAccessories(), listApprovedOwnersForParts()])
        const partRows = (
          await Promise.all(
            owners.map(async (o) => {
              const rows = await listActiveShopPartsForCustomer(o.uid)
              return rows.map<Accessory>((p) => ({
                id: `part-${p.id}`,
                title: p.name,
                description: `${PART_BRAND_LABEL[p.brand]} · ${p.description}`.trim(),
                price: p.unitPrice,
                category: PART_CATEGORY_LABEL[p.category],
                images: p.imageUrl?.trim() ? [p.imageUrl.trim()] : [],
                ownerId: p.ownerId,
              }))
            }),
          )
        ).flat()
        if (!cancelled) setItems([...partRows, ...accessoryRows])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const a of items) if (a.category) set.add(a.category)
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const max = maxPrice ? Number(maxPrice) : null
    return items.filter((a) => {
      if (isDemoEntityId(a.id)) return false
      if (isFirestoreSeedDemoListing(a)) return false
      if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) {
        return false
      }
      if (category !== 'all' && a.category !== category) return false
      if (max !== null && !Number.isNaN(max) && a.price > max) return false
      return true
    })
  }, [items, search, category, maxPrice])

  return (
    <div className="bb-cat-inner px-0 py-0">
      <div className="mt-6 sm:mt-7">
        <CatalogToolbar
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          maxPrice={maxPrice}
          onMaxPriceChange={setMaxPrice}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96" />)
          : filtered.length
            ? filtered.map((a) => (
                <ProductCard
                  key={a.id}
                  to={a.id.startsWith('part-') ? ROUTES.customerParts : ROUTES.accessoryDetail(a.id)}
                  title={a.title}
                  subtitle={a.description}
                  price={a.price}
                  imageUrl={a.images[0]}
                  badge={a.category}
                />
              ))
            : (
                <div className="col-span-full">
                  <EmptyState title="No accessories match your filters" />
                </div>
              )}
      </div>
    </div>
  )
}
