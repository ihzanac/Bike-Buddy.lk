import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { subscribeBookingsForOwner, updateBookingStatus } from '@/services/bookings'
import type { Booking, BookingStatus } from '@/types'
import { formatDateLabel } from '@/utils/date'
import { isWalkInCustomerId } from '@/utils/walkInBooking'

function shortUid(uid: string) {
  if (uid.length <= 12) return uid
  return `${uid.slice(0, 8)}…`
}

function nameFromOwnerNote(note: string | undefined): string | null {
  if (!note) return null
  const m = note.match(/Name:\s*([^·]+)/)
  return m?.[1]?.trim() || null
}

function statusBadgeClass(s: BookingStatus) {
  if (s === 'pending') return 'sp-status-badge sp-status-pending'
  if (s === 'accepted') return 'sp-status-badge sp-status-processing'
  if (s === 'completed') return 'sp-status-badge sp-status-completed'
  return 'sp-status-badge'
}

export function ShopBookingsPage() {
  const { firebaseUser, profile } = useAuth()
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
    if (!ownerId) return
    const unsub = subscribeBookingsForOwner(
      ownerId,
      (data) => {
        setRows(data)
        setLoading(false)
      },
      () => {
        setRows([])
        setLoading(false)
        toast.error(
          'Could not load bookings. Check Firestore rules, your connection, and that bookings use the same owner account ID as this login.',
        )
      },
    )
    return () => unsub()
  }, [profile?.uid, firebaseUser?.uid])

  const pendingCount = useMemo(
    () => rows.filter((b) => b.status === 'pending').length,
    [rows],
  )

  async function setStatus(id: string, status: BookingStatus) {
    setBusyId(id)
    try {
      await updateBookingStatus(id, status)
      setRows((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b)),
      )
      toast.success(
        status === 'accepted'
          ? 'Booking confirmed'
          : status === 'rejected'
            ? 'Booking declined'
            : 'Booking marked completed',
      )
    } catch {
      toast.error('Update failed. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <>
        <div className="sp-top-bar">
          <div className="sp-welcome">
            <h1>Bookings</h1>
            <p className="sp-breadcrumb" style={{ margin: 0 }}>
              Loading…
            </p>
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            color: 'var(--sp-gray)',
          }}
        >
          Loading reservations…
        </div>
      </>
    )
  }

  return (
    <>
      <div className="sp-top-bar">
        <div className="sp-welcome">
          <h1>Bookings</h1>
          <p className="sp-breadcrumb" style={{ margin: 0 }}>
            Service reservations from customers. {pendingCount > 0 ? `${pendingCount} pending.` : ''}
          </p>
        </div>
      </div>

      <div className="sp-activity-card" style={{ padding: '16px 0 0' }}>
        {!rows.length ? (
          <p style={{ padding: '32px 24px', margin: 0, color: 'var(--sp-gray)', textAlign: 'center' }}>
            No bookings yet for this account. Online bookings from Book service and walk-ins you record under
            Services appear here automatically. If you use multiple owner accounts, sign in as the same one that was
            chosen in the shop list.
          </p>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>When</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ minWidth: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const hint = nameFromOwnerNote(b.ownerNote)
                  const busy = busyId === b.id
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="sp-bike-cell">
                          <div
                            className="sp-bike-thumb"
                            style={{
                              background: 'linear-gradient(135deg, var(--sp-primary), var(--sp-secondary))',
                              fontSize: 14,
                            }}
                          >
                            {(hint || b.customerId).slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {hint || `Customer ${shortUid(b.customerId)}`}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--sp-gray)' }}>
                              {isWalkInCustomerId(b.customerId)
                                ? 'Walk-in · not registered in app'
                                : shortUid(b.customerId)}
                            </div>
                          </div>
                        </div>
                        {b.ownerNote ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--sp-gray)',
                              marginTop: 8,
                              maxWidth: 280,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {b.ownerNote}
                          </div>
                        ) : null}
                      </td>
                      <td>{b.serviceName}</td>
                      <td>
                        {formatDateLabel(b.date)}
                        <br />
                        <span style={{ fontSize: 12, color: 'var(--sp-gray)' }}>{b.time}</span>
                      </td>
                      <td>{b.location}</td>
                      <td>
                        <span
                          className={statusBadgeClass(b.status)}
                          style={
                            b.status === 'rejected'
                              ? {
                                  background: 'rgba(231, 76, 60, 0.13)',
                                  color: 'var(--sp-danger)',
                                }
                              : undefined
                          }
                        >
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {b.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className="sp-btn-quick sp-btn-quick-primary"
                                style={{ padding: '8px 14px', fontSize: 13 }}
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm('Accept this booking?')) return
                                  void setStatus(b.id, 'accepted')
                                }}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="sp-btn-quick sp-btn-quick-secondary"
                                style={{ padding: '8px 14px', fontSize: 13 }}
                                disabled={busy}
                                onClick={() => {
                                  if (!window.confirm('Decline this booking?')) return
                                  void setStatus(b.id, 'rejected')
                                }}
                              >
                                Decline
                              </button>
                            </>
                          ) : null}
                          {b.status === 'accepted' ? (
                            <button
                              type="button"
                              className="sp-btn-quick sp-btn-quick-primary"
                              style={{ padding: '8px 14px', fontSize: 13 }}
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm('Mark this service as completed?')) return
                                void setStatus(b.id, 'completed')
                              }}
                            >
                              Complete
                            </button>
                          ) : null}
                          {(b.status === 'rejected' || b.status === 'completed') && !busy ? (
                            <span style={{ fontSize: 12, color: 'var(--sp-gray)' }}>—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
