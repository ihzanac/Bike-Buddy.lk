import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isDemoEntityId } from '@/data/demoCatalog'
import { subscribeBikesCatalog } from '@/services/bikes'
import type { Bike } from '@/types'
import { ProductCard } from '@/components/product/ProductCard'
import { ROUTES } from '@/utils/constants'
import { CatalogToolbar } from '@/pages/public/CatalogToolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'

/**
 * Shared bike grid + filters (used on public `/bikes` and in the customer portal).
 */
export function BikeCatalog() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<Bike[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')

  const qParam = searchParams.get('q')
  useEffect(() => {
    if (qParam != null) setSearch(qParam)
  }, [qParam])

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeBikesCatalog(
      (data) => {
        setItems(data)
        setLoading(false)
      },
      () => {
        setItems([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const b of items) if (b.category) set.add(b.category)
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const max = maxPrice ? Number(maxPrice) : null
    return items.filter((b) => {
      if (isDemoEntityId(b.id)) return false
      if (q && !b.title.toLowerCase().includes(q) && !b.description.toLowerCase().includes(q)) {
        return false
      }
      if (category !== 'all' && b.category !== category) return false
      if (max !== null && !Number.isNaN(max) && b.price > max) return false
      return true
    })
  }, [items, search, category, maxPrice])

  return (
    <div className="bb-cat-inner px-0 py-0">
      {profile?.role === 'owner' ? (
        <div className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-500/[0.12] px-4 py-3 text-sm text-emerald-50 shadow-[0_12px_32px_-20px_rgba(16,185,129,0.45)] sm:px-5 sm:py-3.5">
          {profile.ownerStatus === 'approved' ? (
            <p className="leading-relaxed">
              <span className="font-semibold text-white">Shop owner:</span> Listings you publish as{' '}
              <strong className="text-white">active</strong> appear here for everyone.{' '}
              <Link
                to={ROUTES.shopBikeSales}
                className="font-semibold text-emerald-200 underline decoration-emerald-300/80 underline-offset-2 hover:text-white"
              >
                Add or edit bike inventory
              </Link>
              .
            </p>
          ) : (
            <p className="leading-relaxed">
              <span className="font-semibold text-white">Shop owner:</span> After your account is{' '}
              <strong className="text-white">approved</strong> by an admin, you can add bikes from the shop portal.{' '}
              <Link
                to={ROUTES.shopBikeSales}
                className="font-semibold text-emerald-200 underline decoration-emerald-300/80 underline-offset-2 hover:text-white"
              >
                Open bike sales
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}

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
            ? filtered.map((b) => (
                <ProductCard
                  key={b.id}
                  to={ROUTES.bikeDetail(b.id)}
                  title={b.title}
                  subtitle={b.description}
                  price={b.price}
                  imageUrl={b.images[0]}
                  badge={b.category}
                />
              ))
            : (
                <div className="col-span-full">
                  <EmptyState title="No bikes match your filters" />
                </div>
              )}
      </div>
    </div>
  )
}
