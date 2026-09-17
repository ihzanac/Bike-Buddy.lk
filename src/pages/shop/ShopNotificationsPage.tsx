import { useCallback, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { ROUTES } from '@/utils/constants'
import type { ShopPortalOutletContext } from '@/layouts/ShopLayout'
import { updateBookingStatus } from '@/services/bookings'
import type { InboxCategory } from '@/utils/shopInboxFeed'

type FilterKey = 'all' | 'unread' | InboxCategory

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'fa-list' },
  { key: 'unread', label: 'Unread', icon: 'fa-envelope' },
  { key: 'booking', label: 'Bookings', icon: 'fa-calendar-check' },
  { key: 'review', label: 'Reviews', icon: 'fa-star' },
  { key: 'payment', label: 'Payments', icon: 'fa-dollar-sign' },
  { key: 'alert', label: 'Alerts', icon: 'fa-exclamation-triangle' },
  { key: 'system', label: 'System', icon: 'fa-info-circle' },
]

function iconClass(cat: InboxCategory) {
  if (cat === 'booking') return 'sp-notif-icon sp-notif-icon-booking'
  if (cat === 'review') return 'sp-notif-icon sp-notif-icon-review'
  if (cat === 'payment') return 'sp-notif-icon sp-notif-icon-payment'
  if (cat === 'alert') return 'sp-notif-icon sp-notif-icon-alert'
  return 'sp-notif-icon sp-notif-icon-system'
}

function badgeClass(cat: InboxCategory) {
  if (cat === 'booking') return 'sp-notif-badge sp-notif-badge-booking'
  if (cat === 'review') return 'sp-notif-badge sp-notif-badge-review'
  if (cat === 'payment') return 'sp-notif-badge sp-notif-badge-payment'
  if (cat === 'alert') return 'sp-notif-badge sp-notif-badge-alert'
  return 'sp-notif-badge sp-notif-badge-system'
}

function categoryLabel(cat: InboxCategory) {
  if (cat === 'booking') return 'Booking'
  if (cat === 'review') return 'Review'
  if (cat === 'payment') return 'Payment'
  if (cat === 'alert') return 'Alert'
  return 'System'
}

export function ShopNotificationsPage() {
  const { inboxItems, dismissInboxKey, dismissAllInboxKeys } = useOutletContext<ShopPortalOutletContext>()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const unread = useMemo(() => inboxItems.filter((n) => !n.read).length, [inboxItems])
  const today = useMemo(() => inboxItems.filter((n) => n.isToday).length, [inboxItems])

  const counts = useMemo(() => {
    const c = (cat: InboxCategory) => inboxItems.filter((n) => n.category === cat).length
    return {
      all: inboxItems.length,
      unread,
      booking: c('booking'),
      review: c('review'),
      payment: c('payment'),
      alert: c('alert'),
      system: c('system'),
    }
  }, [inboxItems, unread])

  const visible = useMemo(() => {
    return inboxItems.filter((n) => {
      if (filter === 'all') return true
      if (filter === 'unread') return !n.read
      return n.category === filter
    })
  }, [inboxItems, filter])

  const markAllRead = useCallback(async () => {
    if (inboxItems.length === 0) {
      toast.message('No notifications in your inbox.')
      return
    }
    try {
      await dismissAllInboxKeys()
      toast.success('All notifications marked as read')
    } catch {
      /* error toast from ShopLayout */
    }
  }, [dismissAllInboxKeys, inboxItems.length])

  const markOneRead = useCallback(
    async (id: string) => {
      await dismissInboxKey(id)
    },
    [dismissInboxKey],
  )

  const onRowClick = (id: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.sp-notif-row-actions')) return
    void markOneRead(id)
  }

  return (
    <>
      <div className="sp-top-bar">
        <div>
          <h1>Notifications</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Dashboard</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>Notifications</span>
          </div>
        </div>
        <div className="sp-notif-top-actions">
          <button type="button" className="sp-btn-quick sp-btn-quick-primary" onClick={() => void markAllRead()}>
            <i className="fas fa-check-double" aria-hidden />
            Mark all read
          </button>
          <button
            type="button"
            className="sp-btn-quick sp-btn-quick-secondary"
            onClick={() =>
              toast.message('Email and push preferences can be added later; inbox is live from Firestore.')
            }
          >
            <i className="fas fa-cog" aria-hidden />
            Settings
          </button>
        </div>
      </div>

      <div className="sp-stats-grid">
        <div className="sp-stat-card">
          <div className="sp-stat-header">
            <div className="sp-stat-icon orange">
              <i className="fas fa-bell" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">Total</div>
          <div className="sp-stat-value">{inboxItems.length}</div>
          <div className="sp-stat-trend" style={{ color: 'var(--sp-gray)' }}>
            From bookings, reviews &amp; stock
          </div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-header">
            <div className="sp-stat-icon blue">
              <i className="fas fa-envelope" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">Unread</div>
          <div className="sp-stat-value">{unread}</div>
          <div className="sp-stat-trend">
            {unread > 0 ? (
              <>
                <i className="fas fa-circle" style={{ fontSize: 8 }} aria-hidden /> Needs attention
              </>
            ) : (
              <span style={{ color: 'var(--sp-gray)' }}>You&apos;re caught up</span>
            )}
          </div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-header">
            <div className="sp-stat-icon green">
              <i className="fas fa-clock" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">Today</div>
          <div className="sp-stat-value">{today}</div>
          <div className="sp-stat-trend" style={{ color: 'var(--sp-gray)' }}>
            Same local calendar day
          </div>
        </div>
      </div>

      <div className="sp-notif-filter-bar">
        <div className="sp-notif-tabs" role="tablist" aria-label="Filter notifications">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={clsx('sp-notif-tab', filter === f.key && 'active')}
              onClick={() => setFilter(f.key)}
            >
              <i className={clsx('fas', f.icon)} aria-hidden />
              {f.label}
              <span className="sp-notif-tab-count">{counts[f.key as keyof typeof counts] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sp-notif-list">
        {visible.length === 0 ? (
          <div className="sp-notif-empty">
            <i className="fas fa-bell-slash" aria-hidden />
            <h3>Nothing here</h3>
            <p>Try another filter or check back when customers book, review, or stock runs low.</p>
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={clsx('sp-notif-item', !n.read && 'unread')}
              onClick={(e) => onRowClick(n.id, e)}
            >
              <div className={iconClass(n.category)}>
                <i
                  className={clsx(
                    'fas',
                    n.category === 'booking' && 'fa-calendar-check',
                    n.category === 'review' && 'fa-star',
                    n.category === 'payment' && 'fa-dollar-sign',
                    n.category === 'alert' && 'fa-exclamation-triangle',
                    n.category === 'system' && 'fa-info-circle',
                  )}
                  aria-hidden
                />
              </div>
              <div className="sp-notif-body">
                <div className="sp-notif-head">
                  <span className="sp-notif-title">{n.title}</span>
                  <span className="sp-notif-time">{n.time}</span>
                </div>
                <p className="sp-notif-text">{n.body}</p>
                <div className="sp-notif-meta">
                  <span className={badgeClass(n.category)}>{categoryLabel(n.category)}</span>
                </div>
                {n.category === 'booking' && n.bookingStatus === 'pending' && n.bookingId ? (
                  <div className="sp-notif-row-actions">
                    <button
                      type="button"
                      className="sp-notif-btn sp-notif-btn-pri"
                      disabled={acceptingId === n.bookingId}
                      onClick={(e) => {
                        e.stopPropagation()
                        void (async () => {
                          setAcceptingId(n.bookingId!)
                          try {
                            await updateBookingStatus(n.bookingId!, 'accepted')
                            await dismissInboxKey(n.id)
                            toast.success('Booking accepted')
                          } catch (err) {
                            console.error(err)
                            toast.error('Could not accept booking.')
                          } finally {
                            setAcceptingId(null)
                          }
                        })()
                      }}
                    >
                      <i className="fas fa-check" aria-hidden />
                      {acceptingId === n.bookingId ? 'Saving…' : 'Accept'}
                    </button>
                    <Link
                      to={ROUTES.shopBookings}
                      className="sp-notif-btn sp-notif-btn-sec"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-eye" aria-hidden />
                      View
                    </Link>
                  </div>
                ) : null}
                {n.category === 'booking' && n.bookingStatus && n.bookingStatus !== 'pending' && n.bookingId ? (
                  <div className="sp-notif-row-actions">
                    <Link
                      to={ROUTES.shopBookings}
                      className="sp-notif-btn sp-notif-btn-sec"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-eye" aria-hidden />
                      Bookings
                    </Link>
                  </div>
                ) : null}
                {n.category === 'review' ? (
                  <div className="sp-notif-row-actions">
                    <Link
                      to={ROUTES.shopFeedback}
                      className="sp-notif-btn sp-notif-btn-pri"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-reply" aria-hidden />
                      Open feedback
                    </Link>
                  </div>
                ) : null}
                {n.category === 'payment' && n.bookingId ? (
                  <div className="sp-notif-row-actions">
                    <Link
                      to={ROUTES.shopBookings}
                      className="sp-notif-btn sp-notif-btn-sec"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-eye" aria-hidden />
                      View bookings
                    </Link>
                  </div>
                ) : null}
                {n.category === 'alert' ? (
                  <div className="sp-notif-row-actions">
                    <Link
                      to={ROUTES.shopParts}
                      className="sp-notif-btn sp-notif-btn-pri"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-boxes" aria-hidden />
                      Parts
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="sp-notif-footnote">
        Inbox is built from your Firestore <strong>bookings</strong>, <strong>shopReviews</strong>, and{' '}
        <strong>shopParts</strong> (low / out of stock). Read state is stored in <strong>shopInboxState</strong> for
        this account.
      </p>
    </>
  )
}
