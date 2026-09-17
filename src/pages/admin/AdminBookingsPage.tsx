import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { listAllBookings, createBooking, updateBookingStatus } from '@/services/bookings'
import { listApprovedOwnersForBooking } from '@/services/users'
import type { Booking, BookingStatus, UserProfile } from '@/types'
import { formatDateLabel } from '@/utils/date'
import { isDemoRecordId } from '@/data/adminDummyData'
import { SampleBadge } from '@/components/admin/AdminDemoBanner'
import { useAdminHeaderSearch } from '@/hooks/useAdminHeaderSearch'
import { rowMatchesAdminQuery } from '@/utils/adminSearch'
import { describeServiceError } from '@/utils/firebaseErrors'
import '@/styles/admin-bookings.css'

const SERVICES = [
  'Oil Change',
  'Full Service',
  'Brake Service',
  'Tire Change',
  'Engine Repair',
  'Electrical Work',
] as const

type ServiceOption = (typeof SERVICES)[number]

type BookingFormState = {
  customerName: string
  customerUid: string
  phone: string
  shopOwnerId: string
  service: ServiceOption
  date: string
  time: string
  statusAfter: 'pending' | 'accepted'
  vehicle: string
  notes: string
}

const FILTER_STATUS_OPTIONS: { v: string; l: string }[] = [
  { v: 'all', l: 'All status' },
  { v: 'pending', l: 'Pending' },
  { v: 'accepted', l: 'Confirmed' },
  { v: 'completed', l: 'Completed' },
  { v: 'rejected', l: 'Cancelled' },
]

const FILTER_DATE_OPTIONS: { v: string; l: string }[] = [
  { v: 'all', l: 'All dates' },
  { v: 'today', l: 'Today' },
  { v: 'week', l: 'This week' },
  { v: 'month', l: 'This month' },
]

function shortId(id: string): string {
  if (id.length <= 14) return id
  return `${id.slice(0, 10)}…`
}

function bookingSearchParts(b: Booking) {
  return [
    b.id,
    b.customerId,
    b.ownerId,
    b.serviceName,
    b.location,
    b.ownerNote ?? '',
    b.customerEmail ?? '',
    b.date,
    b.time,
    b.status,
  ] as const
}

function formatTime12h(time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return time
  let h = parseInt(m[1]!, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m[2]} ${ampm}`
}

function customerInitials(b: Booking, nameHint?: string): string {
  if (nameHint?.trim()) {
    const p = nameHint.trim().split(/\s+/)
    if (p.length >= 2) return `${p[0]![0]}${p[1]![0]}`.toUpperCase()
    return nameHint.slice(0, 2).toUpperCase()
  }
  const c = b.customerId
  if (c.length <= 2) return c.toUpperCase() || '—'
  const p = c.replace(/[^a-zA-Z0-9]+/g, ' ').split(/\s+/)
  if (p.length >= 2) {
    return `${(p[0]![0] || '').toUpperCase()}${(p[1]![0] || '').toUpperCase()}`
  }
  return c.slice(0, 2).toUpperCase()
}

function customerLabel(b: Booking, nameHint?: string): string {
  if (nameHint) return nameHint
  if (b.customerId.length > 20) return `Customer ${shortId(b.customerId)}`
  return b.customerId || 'Unknown'
}

function isThisWeek(d: string): boolean {
  const t = new Date(d + 'T12:00:00')
  const n = new Date()
  const diff = n.getTime() - t.getTime()
  if (diff < 0) return false
  return diff < 7 * 86400000
}

function isThisMonth(d: string): boolean {
  const t = new Date(d + 'T12:00:00')
  const n = new Date()
  return t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear()
}

function displayStatus(
  s: BookingStatus,
): { cls: 'conf' | 'pen' | 'com' | 'canc'; text: string } {
  if (s === 'accepted') return { cls: 'conf', text: '✓ Confirmed' }
  if (s === 'pending') return { cls: 'pen', text: '⏳ Pending' }
  if (s === 'completed') return { cls: 'com', text: '✓ Completed' }
  return { cls: 'canc', text: '🚫 Cancelled' }
}

function shopPickerLabel(u: UserProfile): string {
  const name = (u.shopName?.trim() || u.displayName?.trim() || u.email || u.uid).trim()
  const extra = u.location?.trim() || u.district?.trim()
  return extra ? `${name} — ${extra}` : name
}

function bookingLocationForOwner(u: UserProfile): string {
  const s = (u.shopName?.trim() || u.displayName?.trim() || u.email || u.uid || '').trim()
  return s
}

function shopFilterMatches(filterKey: string, b: Booking): boolean {
  if (filterKey === 'all') return true
  return b.ownerId === filterKey
}

export function AdminBookingsPage() {
  const adminHeaderSearch = useAdminHeaderSearch()
  const [rows, setRows] = useState<Booking[]>([])
  const [bookingShops, setBookingShops] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [demoStatusMap, setDemoStatusMap] = useState<Record<string, BookingStatus>>({})
  const [nameHints, setNameHints] = useState<Record<string, string>>({})

  const [fSearch, setFSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fShop, setFShop] = useState('all')
  const [fService, setFService] = useState('all')
  const [fDate, setFDate] = useState('all')
  const [applied, setApplied] = useState({
    search: '',
    status: 'all',
    shop: 'all',
    service: 'all',
    date: 'all',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BookingFormState>({
    customerName: '',
    customerUid: '',
    phone: '',
    shopOwnerId: '',
    service: SERVICES[0]!,
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    statusAfter: 'pending',
    vehicle: '',
    notes: '',
  })

  const refresh = useCallback(async () => {
    const [data, shops] = await Promise.all([
      listAllBookings(),
      listApprovedOwnersForBooking(),
    ])
    setRows(data)
    setBookingShops(shops)
    setForm((f) => ({
      ...f,
      shopOwnerId: shops.some((s) => s.uid === f.shopOwnerId)
        ? f.shopOwnerId
        : (shops[0]?.uid ?? ''),
    }))
  }, [])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        await refresh()
      } catch {
        if (!c) toast.error('Could not load bookings or shops')
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [refresh])

  const shopFilterOptions = useMemo(() => {
    const opts: { v: string; l: string }[] = [{ v: 'all', l: 'All shops' }]
    for (const u of bookingShops) {
      opts.push({ v: u.uid, l: shopPickerLabel(u) })
    }
    return opts
  }, [bookingShops])

  useEffect(() => {
    if (fShop === 'all') return
    if (bookingShops.some((s) => s.uid === fShop)) return
    setFShop('all')
  }, [bookingShops, fShop])

  const withStatus = useCallback(
    (b: Booking): Booking => {
      const s = demoStatusMap[b.id]
      return s ? { ...b, status: s } : b
    },
    [demoStatusMap],
  )

  /** Firestore only — `VITE_ADMIN_DUMMY_DATA` does not inject sample rows here. */
  const allEffective = useMemo(
    () => rows.map(withStatus),
    [rows, withStatus],
  )

  const stats = useMemo(() => {
    const list = allEffective
    const total = list.length
    const confirmed = list.filter((b) => b.status === 'accepted').length
    const pending = list.filter((b) => b.status === 'pending').length
    const completed = list.filter((b) => b.status === 'completed').length
    const cancelled = list.filter((b) => b.status === 'rejected').length
    const today = new Date().toISOString().slice(0, 10)
    const todays = list.filter((b) => b.date === today).length
    const confPct = total > 0 ? Math.round((confirmed / total) * 100) : 0
    return {
      total,
      confirmed,
      pending,
      completed,
      cancelled,
      todays,
      confPct,
    }
  }, [allEffective])

  const applyFilters = useCallback(() => {
    setApplied({
      search: fSearch,
      status: fStatus,
      shop: fShop,
      service: fService,
      date: fDate,
    })
  }, [fSearch, fStatus, fShop, fService, fDate])

  const filtered = useMemo(() => {
    return allEffective.filter((b) => {
      const parts = bookingSearchParts(b)
      if (!rowMatchesAdminQuery(parts, adminHeaderSearch)) return false
      if (!rowMatchesAdminQuery(parts, applied.search)) return false
      if (applied.status !== 'all' && b.status !== applied.status) return false
      if (applied.service !== 'all' && b.serviceName !== applied.service) return false
      if (applied.date === 'today' && b.date !== new Date().toISOString().slice(0, 10)) {
        return false
      }
      if (applied.date === 'week' && !isThisWeek(b.date)) return false
      if (applied.date === 'month' && !isThisMonth(b.date)) return false
      if (!shopFilterMatches(applied.shop, b)) return false
      return true
    })
  }, [allEffective, applied, adminHeaderSearch])

  async function changeStatus(id: string, status: BookingStatus) {
    if (isDemoRecordId(id)) {
      setDemoStatusMap((m) => ({ ...m, [id]: status }))
      toast.success('Demo booking updated')
      return
    }
    try {
      await updateBookingStatus(id, status)
      toast.success('Booking updated')
      await refresh()
    } catch {
      toast.error('Could not update booking')
    }
  }

  function onView(b: Booking) {
    setViewingBooking(b)
  }

  function onConfirm(b: Booking) {
    if (!window.confirm(`Confirm booking ${shortId(b.id)} for this customer?`)) return
    void changeStatus(b.id, 'accepted')
  }

  function onCancel(b: Booking) {
    if (!window.confirm(`Cancel booking ${shortId(b.id)}?`)) return
    void changeStatus(b.id, 'rejected')
  }

  async function onSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const owner = bookingShops.find((s) => s.uid === form.shopOwnerId)
    if (!owner) {
      toast.error('Select a shop (load approved service shops from Firestore first)')
      setSaving(false)
      return
    }
    const uid = form.customerUid.trim()
    if (!uid) {
      toast.error('Enter the customer’s Firebase user ID')
      setSaving(false)
      return
    }
    const parts: string[] = []
    if (form.customerName.trim()) parts.push(`Name: ${form.customerName.trim()}`)
    if (form.phone.trim()) parts.push(`Phone: ${form.phone.trim()}`)
    if (form.vehicle.trim()) parts.push(`Vehicle: ${form.vehicle.trim()}`)
    if (form.notes.trim()) parts.push(form.notes.trim())
    const note = parts.length > 0 ? parts.join(' · ') : undefined
    const location =
      bookingLocationForOwner(owner) ||
      owner.shopName?.trim() ||
      owner.displayName?.trim() ||
      'Service shop'
    if (!form.date?.trim() || !form.time?.trim()) {
      toast.error('Choose booking date and time')
      setSaving(false)
      return
    }
    let newId: string
    try {
      newId = await createBooking({
        customerId: uid,
        ownerId: owner.uid.trim(),
        serviceId: 'svc-admin',
        serviceName: String(form.service),
        date: form.date.trim(),
        time: form.time.trim(),
        location,
        ...(note ? { ownerNote: note } : {}),
      })
    } catch (err) {
      toast.error('Could not create booking', {
        description: describeServiceError(err),
        duration: 14_000,
      })
      setSaving(false)
      return
    }
    try {
      if (form.customerName.trim()) {
        setNameHints((h) => ({ ...h, [newId]: form.customerName.trim() }))
      }
      if (form.statusAfter === 'accepted') {
        await updateBookingStatus(newId, 'accepted')
      }
      toast.success('Booking created')
      setModalOpen(false)
      setForm((f) => ({
        ...f,
        customerName: '',
        customerUid: '',
        phone: '',
        vehicle: '',
        notes: '',
      }))
      await refresh()
    } catch (err) {
      toast.error('Booking was created as pending, but finishing the request failed', {
        description: describeServiceError(err),
        duration: 14_000,
      })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    const line = (b: Booking) => {
      const d = displayStatus(b.status)
      return [shortId(b.id), b.customerId, b.serviceName, b.date, b.time, d.text, b.location]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    }
    const head = 'BookingId,Customer,Service,Date,Time,Status,Location\n'
    const body = filtered.map(line).join('\n')
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bikebuddy-bookings.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.message('Download started')
  }

  if (loading) {
    return (
      <div className="bb-bk">
        <p className="bb-bk-loading">Loading bookings…</p>
      </div>
    )
  }

  return (
    <div className="bb-bk">
      <div className="bb-bk-topbar">
        <div className="bb-bk-topbar-left">
          <h1 className="bb-bk-topbar-title">Bookings management</h1>
        </div>
        <div className="bb-bk-topbar-right">
          <button
            type="button"
            className="bb-bk-quick-add-btn"
            onClick={() => {
              setModalOpen(true)
              setForm((f) => ({
                ...f,
                shopOwnerId:
                  f.shopOwnerId && bookingShops.some((s) => s.uid === f.shopOwnerId)
                    ? f.shopOwnerId
                    : (bookingShops[0]?.uid ?? ''),
              }))
            }}
          >
            <span>➕</span>
            <span>New booking</span>
          </button>
          <button
            type="button"
            className="bb-bk-notify-btn"
            aria-label={
              stats.pending > 0
                ? `${stats.pending} booking${stats.pending === 1 ? '' : 's'} pending approval`
                : 'No pending bookings'
            }
            onClick={() => {
              setFStatus('pending')
              setApplied((a) => ({ ...a, status: 'pending' }))
              document.getElementById('bk-all-bookings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            🔔
            {stats.pending > 0 ? (
              <span className="bb-bk-notify-badge" aria-hidden>
                {stats.pending > 99 ? '99+' : stats.pending}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="bb-bk-hero">
        <div className="bb-bk-hero-content">
          <div className="bb-bk-hero-title">
            <span>📅</span>
            <span>Bookings management</span>
          </div>
          <p className="bb-bk-hero-sub">
            Manage all service bookings, track appointments, confirm reservations, and monitor booking
            status across all shops
          </p>
        </div>
      </div>

      <div className="bb-bk-stats">
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon indigo">📅</div>
          </div>
          <div className="bb-bk-stat-number">{stats.total}</div>
          <div className="bb-bk-stat-label">Total bookings</div>
          <div className="bb-bk-stat-trend up">
            <span>↑</span>
            <span>+8 this week</span>
          </div>
        </div>
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon emerald">✓</div>
          </div>
          <div className="bb-bk-stat-number">{stats.confirmed}</div>
          <div className="bb-bk-stat-label">Confirmed</div>
          <div className="bb-bk-stat-trend up">
            <span>↑</span>
            <span>{stats.confPct}% confirmed</span>
          </div>
        </div>
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon amber">⏳</div>
          </div>
          <div className="bb-bk-stat-number">{stats.pending}</div>
          <div className="bb-bk-stat-label">Pending</div>
          <div className="bb-bk-stat-trend">
            <span>→</span>
            <span>Awaiting confirm</span>
          </div>
        </div>
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon sky">✓</div>
          </div>
          <div className="bb-bk-stat-number">{stats.completed}</div>
          <div className="bb-bk-stat-label">Completed</div>
          <div className="bb-bk-stat-trend up">
            <span>↑</span>
            <span>This week</span>
          </div>
        </div>
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon rose">🚫</div>
          </div>
          <div className="bb-bk-stat-number">{stats.cancelled}</div>
          <div className="bb-bk-stat-label">Cancelled</div>
          <div className="bb-bk-stat-trend">
            <span>→</span>
            <span>Low rate</span>
          </div>
        </div>
        <div className="bb-bk-stat">
          <div className="bb-bk-stat-head">
            <div className="bb-bk-stat-icon violet">📆</div>
          </div>
          <div className="bb-bk-stat-number">{stats.todays}</div>
          <div className="bb-bk-stat-label">Today&apos;s bookings</div>
          <div className="bb-bk-stat-trend up">
            <span>↑</span>
            <span>Active now</span>
          </div>
        </div>
      </div>

      <div className="bb-bk-section" id="bk-all-bookings">
        <div className="bb-bk-section-top">
          <h2 className="bb-bk-section-title">All bookings</h2>
          <div className="bb-bk-section-actions">
            <button type="button" className="bb-bk-btn bb-bk-btn-sec" onClick={exportCsv}>
              <span>📥</span>
              <span>Export</span>
            </button>
            <button
              type="button"
              className="bb-bk-btn bb-bk-btn-pri"
              onClick={() => {
                setModalOpen(true)
                setForm((f) => ({
                  ...f,
                  shopOwnerId:
                    f.shopOwnerId && bookingShops.some((s) => s.uid === f.shopOwnerId)
                      ? f.shopOwnerId
                      : (bookingShops[0]?.uid ?? ''),
                }))
              }}
            >
              <span>➕</span>
              <span>New booking</span>
            </button>
          </div>
        </div>

        <div className="bb-bk-filters">
          <div className="bb-bk-filter-group">
            <label className="bb-bk-filter-lbl" htmlFor="bk-f-search">
              Search
            </label>
            <input
              id="bk-f-search"
              className="bb-bk-filter-input"
              value={fSearch}
              onChange={(e) => setFSearch(e.target.value)}
              placeholder="Booking ID, customer…"
            />
          </div>
          <div className="bb-bk-filter-group">
            <span className="bb-bk-filter-lbl">Status</span>
            <select
              className="bb-bk-filter-select"
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              aria-label="Filter by status"
            >
              {FILTER_STATUS_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-bk-filter-group">
            <span className="bb-bk-filter-lbl">Shop</span>
            <select
              className="bb-bk-filter-select"
              value={fShop}
              onChange={(e) => setFShop(e.target.value)}
              aria-label="Filter by shop"
            >
              {shopFilterOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-bk-filter-group">
            <span className="bb-bk-filter-lbl">Service type</span>
            <select
              className="bb-bk-filter-select"
              value={fService}
              onChange={(e) => setFService(e.target.value)}
              aria-label="Filter by service"
            >
              <option value="all">All services</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-bk-filter-group">
            <span className="bb-bk-filter-lbl">Date</span>
            <select
              className="bb-bk-filter-select"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              aria-label="Filter by date"
            >
              {FILTER_DATE_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-bk-filter-group bb-bk-apply-wrap">
            <button type="button" className="bb-bk-btn bb-bk-btn-pri" onClick={applyFilters}>
              Apply
            </button>
          </div>
        </div>

        <div className="bb-bk-table-wrap">
          <table className="bb-bk-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Service type</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="bb-bk-empty">
                      <div className="bb-bk-empty-icon" aria-hidden>
                        📅
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bk-dark, #0f172a)' }}>
                        No bookings found
                      </div>
                      <div>
                        {rows.length === 0
                          ? 'Nothing in Firestore yet — add bookings with New booking (admin) or from the customer booking flow.'
                          : 'Try adjusting your filters or the admin header search.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const hint = nameHints[b.id]
                  const lab = customerLabel(b, hint)
                  const st = displayStatus(b.status)
                  return (
                    <tr key={b.id}>
                      <td>
                        <span className="bb-bk-cell-id">{shortId(b.id)}</span>
                        {isDemoRecordId(b.id) ? <SampleBadge /> : null}
                      </td>
                      <td>
                        <div className="bb-bk-cust">
                          <div className="bb-bk-cust-av" aria-hidden>
                            {customerInitials(b, hint)}
                          </div>
                          <div>
                            <div className="bb-bk-cust-name">{lab}</div>
                            <div className="bb-bk-cust-id">{b.customerId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="bb-bk-svc-type">{b.serviceName}</div>
                          <div className="bb-bk-svc-loc">{b.location}</div>
                        </div>
                      </td>
                      <td>
                        {formatDateLabel(
                          b.date.length === 10 ? `${b.date}T12:00:00` : b.date,
                        )}
                      </td>
                      <td>{formatTime12h(b.time)}</td>
                      <td>
                        <span className={`bb-bk-badge ${st.cls}`}>{st.text}</span>
                      </td>
                      <td>
                        <div className="bb-bk-actions">
                          <button
                            type="button"
                            className="bb-bk-action view"
                            title="View"
                            onClick={() => onView(b)}
                          >
                            👁
                          </button>
                          {b.status === 'pending' ? (
                            <button
                              type="button"
                              className="bb-bk-action conf"
                              title="Confirm"
                              onClick={() => onConfirm(b)}
                            >
                              ✓
                            </button>
                          ) : null}
                          {b.status !== 'rejected' && b.status !== 'completed' ? (
                            <button
                              type="button"
                              className="bb-bk-action canc"
                              title="Cancel"
                              onClick={() => onCancel(b)}
                            >
                              🚫
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingBooking ? (
        <div
          className="bb-bk-modal"
          role="dialog"
          aria-modal
          aria-labelledby="bk-view-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewingBooking(null)
          }}
        >
          <div className="bb-bk-modal-in">
            <div className="bb-bk-modal-head">
              <h2 className="bb-bk-modal-title" id="bk-view-title">
                <span>👁</span>
                <span>Booking details</span>
              </h2>
              <button
                type="button"
                className="bb-bk-close"
                onClick={() => setViewingBooking(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="bb-bk-form-grid">
              <div className="bb-bk-field">
                <label>Booking ID</label>
                <input value={viewingBooking.id} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Status</label>
                <input value={displayStatus(viewingBooking.status).text} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Customer ID</label>
                <input value={viewingBooking.customerId} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Owner ID</label>
                <input value={viewingBooking.ownerId} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Service</label>
                <input value={viewingBooking.serviceName} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Location</label>
                <input value={viewingBooking.location} readOnly />
              </div>
              <div className="bb-bk-field">
                <label>Date</label>
                <input
                  value={formatDateLabel(
                    viewingBooking.date.length === 10
                      ? `${viewingBooking.date}T12:00:00`
                      : viewingBooking.date,
                  )}
                  readOnly
                />
              </div>
              <div className="bb-bk-field">
                <label>Time</label>
                <input value={formatTime12h(viewingBooking.time)} readOnly />
              </div>
              <div className="bb-bk-field full">
                <label>Owner note</label>
                <textarea value={viewingBooking.ownerNote || 'No notes'} readOnly />
              </div>
            </div>
            <div className="bb-bk-modal-actions">
              <button
                type="button"
                className="bb-bk-btn bb-bk-btn-ghost"
                onClick={() => setViewingBooking(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="bb-bk-modal"
          role="dialog"
          aria-modal
          aria-labelledby="bk-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="bb-bk-modal-in">
            <div className="bb-bk-modal-head">
              <h2 className="bb-bk-modal-title" id="bk-modal-title">
                <span>➕</span>
                <span>Create new booking</span>
              </h2>
              <button
                type="button"
                className="bb-bk-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={onSubmitForm}>
              <div className="bb-bk-form-grid">
                <div className="bb-bk-field">
                  <label htmlFor="bk-cname">Customer name</label>
                  <input
                    id="bk-cname"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder="e.g. Kasun Perera"
                    autoComplete="name"
                  />
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-uid">Customer user ID (Firebase) *</label>
                  <input
                    id="bk-uid"
                    required
                    value={form.customerUid}
                    onChange={(e) => setForm((f) => ({ ...f, customerUid: e.target.value }))}
                    placeholder="Firebase Auth UID (Console → Authentication → User UID)"
                    autoComplete="off"
                  />
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-phone">Phone</label>
                  <input
                    id="bk-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+94 77 XXX XXXX"
                  />
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-shop">Shop *</label>
                  <select
                    id="bk-shop"
                    required={bookingShops.length > 0}
                    value={form.shopOwnerId}
                    disabled={bookingShops.length === 0}
                    onChange={(e) => setForm((f) => ({ ...f, shopOwnerId: e.target.value }))}
                  >
                    {bookingShops.length === 0 ? (
                      <option value="">No approved service shops</option>
                    ) : (
                      bookingShops.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {shopPickerLabel(u)}
                        </option>
                      ))
                    )}
                  </select>
                  {bookingShops.length === 0 ? (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--bk-dark-3, #64748b)' }}>
                      Approve a shop owner with a service line in Users so they appear here.
                    </p>
                  ) : null}
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-svc">Service type *</label>
                  <select
                    id="bk-svc"
                    required
                    value={form.service}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, service: e.target.value as ServiceOption }))
                    }
                  >
                    {SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-date">Booking date *</label>
                  <input
                    id="bk-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-time">Time *</label>
                  <input
                    id="bk-time"
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-initial">Initial status *</label>
                  <select
                    id="bk-initial"
                    value={form.statusAfter}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        statusAfter: e.target.value as 'pending' | 'accepted',
                      }))
                    }
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="accepted">✓ Confirmed</option>
                  </select>
                </div>
                <div className="bb-bk-field">
                  <label htmlFor="bk-veh">Vehicle</label>
                  <input
                    id="bk-veh"
                    value={form.vehicle}
                    onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                    placeholder="e.g. ABC-1234"
                  />
                </div>
                <div className="bb-bk-field full">
                  <label htmlFor="bk-note">Notes (optional)</label>
                  <textarea
                    id="bk-note"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Special requirements…"
                  />
                </div>
              </div>
              <div className="bb-bk-modal-actions">
                <button
                  type="button"
                  className="bb-bk-btn bb-bk-btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bb-bk-btn bb-bk-btn-submit"
                  disabled={saving || bookingShops.length === 0}
                >
                  <span>✓</span>
                  <span>{saving ? 'Saving…' : 'Create booking'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
