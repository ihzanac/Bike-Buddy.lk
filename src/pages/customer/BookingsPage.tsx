import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listBookingsForCustomer, subscribeBookingsForCustomer } from '@/services/bookings'
import type { Booking } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateLabel } from '@/utils/date'

function statusTone(status: Booking['status']) {
  if (status === 'accepted' || status === 'completed') return 'success' as const
  if (status === 'pending') return 'warning' as const
  if (status === 'rejected') return 'danger' as const
  return 'neutral' as const
}

/** Short label shown on the badge (shop actions map to plain customer wording). */
function customerStatusLabel(status: Booking['status']) {
  if (status === 'pending') return 'Awaiting shop decision'
  if (status === 'accepted') return 'Accepted — confirmed'
  if (status === 'rejected') return 'Declined by shop'
  if (status === 'completed') return 'Service completed'
  return status
}

/** One line explaining what this status means for the customer. */
function customerStatusDetail(status: Booking['status']) {
  if (status === 'pending') {
    return 'The shop has not responded yet. When they accept or decline, it will update here.'
  }
  if (status === 'accepted') {
    return 'The shop accepted your booking. Go to the shop at the date and time below.'
  }
  if (status === 'rejected') {
    return 'The shop declined this reservation. You can try another time or a different service center.'
  }
  if (status === 'completed') {
    return 'The shop marked this service as finished. If anything is wrong, contact them using the details above.'
  }
  return ''
}

export function BookingsPage() {
  const { firebaseUser } = useAuth()
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    const stop = subscribeBookingsForCustomer(
      firebaseUser.uid,
      (data) => {
        if (!cancelled) {
          setRows(data)
          setLoading(false)
        }
      },
      () => {
        if (!cancelled) setLoading(false)
      },
    )
    ;(async () => {
      try {
        const data = await listBookingsForCustomer(firebaseUser.uid)
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [firebaseUser])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="space-y-5">
        <Card className="border-sky-200/80 bg-gradient-to-r from-sky-50 via-indigo-50 to-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">My service bookings</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-surface-900">Bookings</h1>
          <p className="mt-2 max-w-2xl text-sm text-surface-700">
            Track your booking lifecycle in one place - pending requests, accepted appointments, and completed services.
          </p>
        </Card>

        <Card className="border-dashed border-surface-300 bg-white p-5 sm:p-6">
          <EmptyState
            title="No bookings yet"
            description="When you reserve a bike service, it will appear here. Once the shop owner accepts it, you will see it under Accepted Service Bookings. After the shop marks it done, it appears under Completed Service Bookings."
          />
        </Card>
      </div>
    )
  }

  const acceptedRows = rows.filter((b) => b.status === 'accepted')
  const completedRows = rows.filter((b) => b.status === 'completed')
  const otherRows = rows.filter((b) => b.status !== 'accepted' && b.status !== 'completed')

  return (
    <div className="space-y-6">
      <Card className="border-sky-200/80 bg-gradient-to-r from-sky-50 via-indigo-50 to-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">My service bookings</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-surface-900">Bookings</h1>
        <p className="mt-2 max-w-2xl text-sm text-surface-700">
          Service bookings are grouped below, so you can quickly track accepted and completed requests.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Accepted</p>
          <p className="mt-1 text-3xl font-bold leading-none text-emerald-900">{acceptedRows.length}</p>
        </Card>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Completed</p>
          <p className="mt-1 text-3xl font-bold leading-none text-indigo-900">{completedRows.length}</p>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Other updates</p>
          <p className="mt-1 text-3xl font-bold leading-none text-amber-900">{otherRows.length}</p>
        </Card>
      </div>

      {acceptedRows.length ? (
        <section className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold text-emerald-900">Accepted Service Bookings</h2>
          {acceptedRows.map((b) => (
            <Card key={b.id} className="border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-surface-900">{b.serviceName}</div>
                  <div className="mt-1 text-sm text-surface-600">
                    {formatDateLabel(b.date)} · {b.time} · {b.location}
                  </div>
                  <p className="mt-2 text-sm text-surface-600">{customerStatusDetail(b.status)}</p>
                  {b.ownerNote ? (
                    <div className="mt-2 text-sm text-surface-700">
                      <span className="font-semibold">Shop note:</span> {b.ownerNote}
                    </div>
                  ) : null}
                </div>
                <Badge tone={statusTone(b.status)}>{customerStatusLabel(b.status)}</Badge>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {completedRows.length ? (
        <section className="space-y-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold text-indigo-900">Completed Service Bookings</h2>
          {completedRows.map((b) => (
            <Card key={b.id} className="border-indigo-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-surface-900">{b.serviceName}</div>
                  <div className="mt-1 text-sm text-surface-600">
                    {formatDateLabel(b.date)} · {b.time} · {b.location}
                  </div>
                  <p className="mt-2 text-sm text-surface-600">{customerStatusDetail(b.status)}</p>
                  {b.ownerNote ? (
                    <div className="mt-2 text-sm text-surface-700">
                      <span className="font-semibold">Shop note:</span> {b.ownerNote}
                    </div>
                  ) : null}
                </div>
                <Badge tone={statusTone(b.status)}>{customerStatusLabel(b.status)}</Badge>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {otherRows.length ? (
        <section className="space-y-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold text-amber-900">Other Booking Updates</h2>
          {otherRows.map((b) => (
            <Card key={b.id} className="border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-surface-900">{b.serviceName}</div>
                  <div className="mt-1 text-sm text-surface-600">
                    {formatDateLabel(b.date)} · {b.time} · {b.location}
                  </div>
                  <p className="mt-2 text-sm text-surface-600">{customerStatusDetail(b.status)}</p>
                  {b.ownerNote ? (
                    <div className="mt-2 text-sm text-surface-700">
                      <span className="font-semibold">Shop note:</span> {b.ownerNote}
                    </div>
                  ) : null}
                </div>
                <Badge tone={statusTone(b.status)}>{customerStatusLabel(b.status)}</Badge>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

    </div>
  )
}
