import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAccessory } from '@/services/accessories'
import type { Accessory } from '@/types'
import { ROUTES } from '@/utils/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'

export function AccessoryDetailPage() {
  const { profile } = useAuth()
  const { id } = useParams()
  const [item, setItem] = useState<Accessory | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const a = await getAccessory(id)
        if (!cancelled) setItem(a)
      } catch {
        if (!cancelled) setItem(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (item === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Accessory not found</h1>
        <Link className="mt-6 inline-block" to={ROUTES.accessories}>
          <Button>Back to accessories</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={ROUTES.accessories}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          ← All accessories
        </Link>
        <Link to={profile?.role === 'customer' ? ROUTES.bookService : ROUTES.login}>
          <Button>Book a service</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
          {item.images[0] ? (
            <img src={item.images[0]} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center bg-surface-100 text-sm text-surface-500">
              No image
            </div>
          )}
        </div>
        <div>
          <Badge tone="neutral">{item.category}</Badge>
          <h1 className="mt-3 font-display text-3xl font-bold text-surface-900">{item.title}</h1>
          <div className="mt-3 text-3xl font-bold text-brand-700">${item.price.toFixed(2)}</div>
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  )
}
