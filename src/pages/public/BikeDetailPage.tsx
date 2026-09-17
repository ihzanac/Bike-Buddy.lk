import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBike } from '@/services/bikes'
import type { Bike } from '@/types'
import { ROUTES } from '@/utils/constants'
import { formatLkr } from '@/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'

export function BikeDetailPage() {
  const { profile } = useAuth()
  const { id } = useParams()
  const [bike, setBike] = useState<Bike | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const b = await getBike(id)
        if (!cancelled) setBike(b)
      } catch {
        if (!cancelled) setBike(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (bike === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!bike) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Bike not found</h1>
        <Link className="mt-6 inline-block" to={ROUTES.bikes}>
          <Button>Back to bikes</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={ROUTES.bikes}
          className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-800"
        >
          ← All bikes
        </Link>
        <Link to={profile?.role === 'customer' ? ROUTES.bookService : ROUTES.login}>
          <Button>Book a service</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
          {bike.images[0] ? (
            <img src={bike.images[0]} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center bg-surface-100 text-sm text-surface-500">
              No image
            </div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{bike.category}</Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold text-surface-900">{bike.title}</h1>
          <div className="mt-3 text-3xl font-bold text-brand-700">{formatLkr(bike.price)}</div>
          {bike.location ? (
            <p className="mt-2 text-sm text-surface-600">Location: {bike.location}</p>
          ) : null}
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
            {bike.description}
          </p>
        </div>
      </div>
    </div>
  )
}
