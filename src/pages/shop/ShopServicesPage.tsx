import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { createBooking } from '@/services/bookings'
import { callSendBookingReceiptEmail } from '@/services/bookingSendReceipt'
import {
  createServiceOffer,
  deleteServiceOffer,
  subscribeServiceOffersByOwner,
  updateServiceOffer,
} from '@/services/serviceOffers'
import type { ServiceOffer } from '@/types'
import { ROUTES } from '@/utils/constants'
import {
  buildWalkInOwnerNote,
  makeWalkInCustomerId,
  todayIsoDate,
} from '@/utils/walkInBooking'
import '@/styles/customer-bike-booking.css'

type Draft = {
  name: string
  description: string
  durationMinutes: number
  price: number
  active: boolean
}

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  active: true,
})

export function ShopServicesPage() {
  const { firebaseUser, profile } = useAuth()
  const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
  const approved = profile?.role === 'owner' && profile?.ownerStatus === 'approved'

  const [rows, setRows] = useState<ServiceOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [addForm, setAddForm] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<(Draft & { id: string }) | null>(null)

  const [walkInOwnerName, setWalkInOwnerName] = useState('')
  const [walkInBikeNumber, setWalkInBikeNumber] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInEmail, setWalkInEmail] = useState('')
  const [walkInBikeType, setWalkInBikeType] = useState('')
  const [walkInBikeModel, setWalkInBikeModel] = useState('')
  const [walkInAdditionalNotes, setWalkInAdditionalNotes] = useState('')
  const [walkInServiceIds, setWalkInServiceIds] = useState<Set<string>>(() => new Set())
  const [walkInDate, setWalkInDate] = useState('')
  const [walkInTime, setWalkInTime] = useState('')
  const [walkInSaving, setWalkInSaving] = useState(false)

  const walkInTotal = useMemo(() => {
    let t = 0
    for (const s of rows) {
      if (walkInServiceIds.has(s.id) && s.active) t += s.price
    }
    return t
  }, [rows, walkInServiceIds])

  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')

  const filteredRows = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false),
    )
  }, [rows, serviceSearch])

  const totalServicesCount = rows.length
  const activeServicesCount = useMemo(() => rows.filter((s) => s.active).length, [rows])

  useEffect(() => {
    if (!ownerId) return
    const unsub = subscribeServiceOffersByOwner(
      ownerId,
      (data) => {
        setRows(data)
        setLoading(false)
      },
      () => {
        setRows([])
        setLoading(false)
        toast.error('Could not load your services. Check Firestore rules and your connection.')
      },
    )
    return () => unsub()
  }, [ownerId])

  const onAdd = useCallback(async () => {
    if (!approved) {
      toast.error('Your shop must be approved before you can publish services.')
      return
    }
    const name = addForm.name.trim()
    if (!name) {
      toast.error('Enter a service name.')
      return
    }
    if (addForm.price < 0 || addForm.durationMinutes < 1) {
      toast.error('Price must be ≥ 0 and duration at least 1 minute.')
      return
    }
    setSaving(true)
    try {
      await createServiceOffer(ownerId, {
        name,
        description: addForm.description.trim(),
        durationMinutes: Math.round(addForm.durationMinutes),
        price: addForm.price,
        active: addForm.active,
      })
      setAddForm(emptyDraft())
      toast.success('Service added — customers will see it on Book service when they pick your shop.')
    } catch {
      toast.error('Could not add service. Try again when your account is approved.')
    } finally {
      setSaving(false)
    }
  }, [addForm, approved, ownerId])

  const onSaveEdit = useCallback(async () => {
    if (!editing || !approved) return
    const name = editing.name.trim()
    if (!name) {
      toast.error('Enter a service name.')
      return
    }
    if (editing.price < 0 || editing.durationMinutes < 1) {
      toast.error('Price must be ≥ 0 and duration at least 1 minute.')
      return
    }
    setSaving(true)
    try {
      await updateServiceOffer(editing.id, {
        name,
        description: editing.description.trim(),
        durationMinutes: Math.round(editing.durationMinutes),
        price: editing.price,
        active: editing.active,
      })
      setEditing(null)
      toast.success('Service updated.')
    } catch {
      toast.error('Could not update service.')
    } finally {
      setSaving(false)
    }
  }, [approved, editing])

  const onToggleActive = useCallback(
    async (s: ServiceOffer) => {
      if (!approved) return
      try {
        await updateServiceOffer(s.id, { active: !s.active })
        toast.success(s.active ? 'Service hidden from customers.' : 'Service visible to customers.')
      } catch {
        toast.error('Could not update.')
      }
    },
    [approved],
  )

  const toggleWalkInService = useCallback((id: string) => {
    setWalkInServiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onRecordWalkInBooking = useCallback(async () => {
    if (!approved) {
      toast.error('Your shop must be approved to record walk-in bookings.')
      return
    }
    const name = walkInOwnerName.trim()
    if (!name) {
      toast.error('Enter the bike owner’s name.')
      return
    }
    if (!walkInBikeNumber.trim()) {
      toast.error('Enter the bike number.')
      return
    }
    if (!walkInPhone.trim()) {
      toast.error('Enter the phone number.')
      return
    }
    if (!walkInBikeType.trim()) {
      toast.error('Enter the bike type.')
      return
    }
    const oid = ownerId.trim()
    if (!oid) return
    const offers = rows.filter((s) => walkInServiceIds.has(s.id) && s.active)
    if (!offers.length) {
      toast.error('Select at least one active service from your catalog.')
      return
    }
    if (!walkInDate || !walkInTime) {
      toast.error('Choose preferred date and time.')
      return
    }
    const serviceIds = [...offers.map((o) => o.id)].sort().join('-')
    const serviceName = offers.map((o) => o.name).join(', ')
    const ownerNote = buildWalkInOwnerNote({
      customerName: name,
      bikeNumber: walkInBikeNumber,
      phone: walkInPhone,
      email: walkInEmail,
      bikeType: walkInBikeType,
      bikeModel: walkInBikeModel,
      details: walkInAdditionalNotes,
    })
    const locationLabel =
      [profile?.shopName, profile?.district].filter(Boolean).join(' — ') ||
      profile?.displayName ||
      'Shop'
    setWalkInSaving(true)
    try {
      const walkEmail = walkInEmail.trim() || undefined
      const newBookingId = await createBooking({
        customerId: makeWalkInCustomerId(oid),
        ownerId: oid,
        serviceId: serviceIds ? `svc-${serviceIds}` : 'svc-custom',
        serviceName,
        date: walkInDate,
        time: walkInTime,
        location: locationLabel,
        ownerNote,
        estimatedTotalLkr: walkInTotal,
        ...(walkEmail ? { customerEmail: walkEmail } : {}),
      })
      if (walkEmail) {
        try {
          const r = await callSendBookingReceiptEmail(newBookingId)
          if (r.sent) {
            toast.message(`A booking copy was emailed to ${walkEmail}.`, { duration: 5000 })
          }
        } catch {
          /* non-fatal */
        }
      }
      setWalkInOwnerName('')
      setWalkInBikeNumber('')
      setWalkInPhone('')
      setWalkInEmail('')
      setWalkInBikeType('')
      setWalkInBikeModel('')
      setWalkInAdditionalNotes('')
      setWalkInServiceIds(new Set())
      setWalkInDate('')
      setWalkInTime('')
      toast.success('Walk-in booking saved. It appears under Bookings for your shop.')
    } catch {
      toast.error('Could not save. Deploy updated Firestore rules if walk-ins are new for this project.')
    } finally {
      setWalkInSaving(false)
    }
  }, [
    approved,
    ownerId,
    profile?.displayName,
    profile?.district,
    profile?.shopName,
    rows,
    walkInDate,
    walkInAdditionalNotes,
    walkInBikeModel,
    walkInBikeNumber,
    walkInBikeType,
    walkInEmail,
    walkInOwnerName,
    walkInPhone,
    walkInServiceIds,
    walkInTime,
    walkInTotal,
  ])

  async function onDelete(s: ServiceOffer) {
    if (!approved) return
    if (!window.confirm(`Delete “${s.name}”? Customers will no longer see it.`)) return
    try {
      await deleteServiceOffer(s.id)
      if (editing?.id === s.id) setEditing(null)
      toast.success('Service removed.')
    } catch {
      toast.error('Could not delete service.')
    }
  }

  if (loading) {
    return (
      <div className="cbb-page srv-mgmt-page">
        <div className="cbb-container">
          <div className="srv-mgmt-hero">
            <p style={{ margin: 0, color: '#64748b' }}>Loading your catalog…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cbb-page srv-mgmt-page">
      <div className="cbb-container">
        {!approved ? (
          <section className="cbb-section" role="status">
            <strong>Catalog locked until approval</strong>
            <p style={{ margin: '10px 0 0', color: '#64748b' }}>
              An administrator must approve your shop before you can add services or record walk-ins.
            </p>
          </section>
        ) : null}

        {profile ? (
          <>
            <header className="srv-mgmt-hero">
              <div>
                <h1 className="srv-mgmt-title">Service Management</h1>
                <p className="srv-mgmt-breadcrumb">
                  <Link to={ROUTES.shopDashboard}>Home</Link>
                  <span className="srv-mgmt-breadcrumb-sep"> &gt; </span>
                  <span>Services</span>
                </p>
              </div>
              <button
                type="button"
                className="srv-mgmt-primary-btn"
                disabled={!approved}
                aria-expanded={addPanelOpen}
                onClick={() => setAddPanelOpen((o) => !o)}
              >
                <span className="srv-mgmt-primary-btn-icon" aria-hidden>
                  <i className="fas fa-plus" />
                </span>
                {addPanelOpen ? 'Close' : '+ Add New Service'}
              </button>
            </header>

            <div className="srv-mgmt-stats" aria-label="Service summary">
              <div className="srv-mgmt-stat">
                <div className="srv-mgmt-stat-icon srv-mgmt-stat-icon--tools" aria-hidden>
                  <i className="fas fa-wrench" />
                </div>
                <div className="srv-mgmt-stat-body">
                  <div className="srv-mgmt-stat-value">{totalServicesCount}</div>
                  <div className="srv-mgmt-stat-label">Total Services</div>
                </div>
              </div>
              <div className="srv-mgmt-stat">
                <div className="srv-mgmt-stat-icon srv-mgmt-stat-icon--active" aria-hidden>
                  <i className="fas fa-check-circle" />
                </div>
                <div className="srv-mgmt-stat-body">
                  <div className="srv-mgmt-stat-value">{activeServicesCount}</div>
                  <div className="srv-mgmt-stat-label">Active Services</div>
                </div>
              </div>
              <div className="srv-mgmt-stat">
                <div className="srv-mgmt-stat-icon srv-mgmt-stat-icon--star" aria-hidden>
                  <i className="fas fa-star" />
                </div>
                <div className="srv-mgmt-stat-body">
                  <div className="srv-mgmt-stat-value" title="Not tracked yet">
                    —
                  </div>
                  <div className="srv-mgmt-stat-label">Average Rating</div>
                </div>
              </div>
            </div>

            <div className="srv-mgmt-search-card">
              <div className="srv-mgmt-search-field">
                <input
                  type="search"
                  placeholder="Search services by name or category…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  aria-label="Search services"
                  autoComplete="off"
                />
                <i className="fas fa-search srv-mgmt-search-icon" aria-hidden />
              </div>
            </div>

            {addPanelOpen ? (
          <section className="cbb-section cbb-pad-h3 srv-mgmt-add-panel" id="shop-service-add-panel">
            <h3>➕ Add service to your menu</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: -6 }}>
              Same style as customer booking — these lines show on <strong>Book service</strong> when riders pick your
              shop.
            </p>
            <div className="cbb-form-grid">
              <div className="cbb-fg">
                <label htmlFor="shop-add-name">Service name *</label>
                <input
                  id="shop-add-name"
                  className="cbb-inp"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Full service"
                  disabled={!approved || saving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="shop-add-price">Price (LKR) *</label>
                <input
                  id="shop-add-price"
                  className="cbb-inp"
                  type="number"
                  min={0}
                  step={100}
                  value={addForm.price || ''}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, price: e.target.value === '' ? 0 : Number(e.target.value) }))
                  }
                  disabled={!approved || saving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="shop-add-min">Duration (minutes) *</label>
                <input
                  id="shop-add-min"
                  className="cbb-inp"
                  type="number"
                  min={1}
                  step={15}
                  value={addForm.durationMinutes || ''}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      durationMinutes: e.target.value === '' ? 0 : Number(e.target.value),
                    }))
                  }
                  disabled={!approved || saving}
                />
              </div>
              <div className="cbb-fg" style={{ alignSelf: 'end' }}>
                <label
                  htmlFor="shop-add-active"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 15 }}
                >
                  <input
                    id="shop-add-active"
                    type="checkbox"
                    checked={addForm.active}
                    onChange={(e) => setAddForm((f) => ({ ...f, active: e.target.checked }))}
                    disabled={!approved || saving}
                  />
                  Visible to customers
                </label>
              </div>
            </div>
            <div className="cbb-fg" style={{ marginTop: 12 }}>
              <label htmlFor="shop-add-desc">Description</label>
              <textarea
                id="shop-add-desc"
                className="cbb-ta"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is included?"
                rows={3}
                disabled={!approved || saving}
              />
            </div>
            <div className="cbb-btns" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="cbb-btn-ok"
                disabled={!approved || saving}
                onClick={() => void onAdd()}
              >
                {saving ? 'Saving…' : 'Add service'}
              </button>
            </div>

            <h3 style={{ marginTop: 36 }}>🔧 Services for walk-in visit</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: -6 }}>
              Visitor without an app account — tick services, then enter their details below. Saved to{' '}
              <Link to={ROUTES.shopBookings}>Bookings</Link>.
            </p>
            {rows.filter((s) => s.active).length === 0 ? (
              <p style={{ fontSize: 14, color: '#64748b' }}>Add at least one active service above first.</p>
            ) : (
              <div className="cbb-services">
                {rows
                  .filter((s) => s.active)
                  .map((s) => (
                    <label
                      key={`wi-${s.id}`}
                      className={cn('cbb-svc', walkInServiceIds.has(s.id) && 'cbb-svc--on')}
                      htmlFor={`wi-svc-${s.id.replace(/\s/g, '')}`}
                    >
                      <input
                        id={`wi-svc-${s.id.replace(/\s/g, '')}`}
                        type="checkbox"
                        checked={walkInServiceIds.has(s.id)}
                        onChange={() => toggleWalkInService(s.id)}
                        disabled={walkInSaving}
                      />
                      <div className="cbb-svc-info">
                        <div className="cbb-svc-name">{s.name}</div>
                        {s.description ? (
                          <div className="cbb-svc-name" style={{ fontSize: 12, fontWeight: 400, opacity: 0.9 }}>
                            {s.description}
                          </div>
                        ) : null}
                        <div className="cbb-svc-price">
                          LKR {s.price.toLocaleString()}
                          {s.durationMinutes ? (
                            <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.85 }}>
                              · ~{s.durationMinutes} min
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            )}
            {walkInTotal > 0 ? (
              <div className="cbb-summary" aria-label="Walk-in selected total">
                <h3>📋 Selected for walk-in</h3>
                {rows
                  .filter((s) => walkInServiceIds.has(s.id) && s.active)
                  .map((s) => (
                    <div key={s.id} className="cbb-sum-row">
                      <span>{s.name}</span>
                      <span>LKR {s.price.toLocaleString()}</span>
                    </div>
                  ))}
                <div className="cbb-sum-tot">Total: LKR {walkInTotal.toLocaleString()}</div>
              </div>
            ) : null}

            <h3>👤 Bike owner details</h3>
            <div className="cbb-form-grid">
              <div className="cbb-fg">
                <label htmlFor="wi-owner">👤 Bike owner name *</label>
                <input
                  id="wi-owner"
                  className="cbb-inp"
                  value={walkInOwnerName}
                  onChange={(e) => setWalkInOwnerName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-bike-no">🏍️ Bike number *</label>
                <input
                  id="wi-bike-no"
                  className="cbb-inp"
                  value={walkInBikeNumber}
                  onChange={(e) => setWalkInBikeNumber(e.target.value)}
                  placeholder="e.g. CAA-1234"
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-phone">📞 Phone number *</label>
                <input
                  id="wi-phone"
                  className="cbb-inp"
                  type="tel"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  autoComplete="tel"
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-email">📧 Email (optional)</label>
                <input
                  id="wi-email"
                  className="cbb-inp"
                  type="email"
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                  disabled={walkInSaving}
                />
              </div>
            </div>

            <h3>📅 Book service appointment</h3>
            <div className="cbb-form-grid">
              <div className="cbb-fg">
                <label htmlFor="wi-dt">📅 Preferred date *</label>
                <input
                  id="wi-dt"
                  className="cbb-inp"
                  type="date"
                  value={walkInDate}
                  min={todayIsoDate()}
                  onChange={(e) => setWalkInDate(e.target.value)}
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-tm">⏰ Preferred time *</label>
                <input
                  id="wi-tm"
                  className="cbb-inp"
                  type="time"
                  value={walkInTime}
                  onChange={(e) => setWalkInTime(e.target.value)}
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-bike-type">🏍️ Bike type *</label>
                <input
                  id="wi-bike-type"
                  className="cbb-inp"
                  value={walkInBikeType}
                  onChange={(e) => setWalkInBikeType(e.target.value)}
                  placeholder="e.g. Scooter, Sport, Cruiser"
                  disabled={walkInSaving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="wi-bike-model">🔧 Bike model</label>
                <input
                  id="wi-bike-model"
                  className="cbb-inp"
                  value={walkInBikeModel}
                  onChange={(e) => setWalkInBikeModel(e.target.value)}
                  placeholder="e.g. Honda PCX 160"
                  disabled={walkInSaving}
                />
              </div>
            </div>
            <div className="cbb-fg" style={{ marginTop: 8 }}>
              <label htmlFor="wi-notes">📝 Additional notes (optional)</label>
              <textarea
                id="wi-notes"
                className="cbb-ta"
                value={walkInAdditionalNotes}
                onChange={(e) => setWalkInAdditionalNotes(e.target.value)}
                placeholder="Service notes, access instructions…"
                rows={3}
                disabled={walkInSaving}
              />
            </div>
            <div className="cbb-btns">
              <button
                type="button"
                className="cbb-btn-ok"
                disabled={walkInSaving || rows.filter((s) => s.active).length === 0}
                onClick={() => void onRecordWalkInBooking()}
              >
                {walkInSaving ? 'Saving…' : 'Record walk-in booking'}
              </button>
            </div>
          </section>
            ) : null}

            <section className="cbb-section srv-mgmt-catalog">
              <h2 className="srv-mgmt-catalog-title">Your full catalog</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginTop: 0 }}>
                Edit, show/hide, or delete service lines.
              </p>
              {!rows.length ? (
                <p style={{ color: '#64748b', margin: 0 }}>
                  No services yet — use <strong>Add New Service</strong> to create your first.
                </p>
              ) : !filteredRows.length ? (
                <p style={{ color: '#64748b', margin: 0 }}>No services match your search.</p>
              ) : (
                <div className="sp-table-wrap" style={{ marginTop: 12 }}>
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Minutes</th>
                        <th>Price (LKR)</th>
                        <th>Active</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td style={{ maxWidth: 260, fontSize: 13, color: '#64748b' }}>
                            {s.description || '—'}
                          </td>
                          <td>{s.durationMinutes}</td>
                          <td className="sp-amount">{s.price.toLocaleString()}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={s.active}
                              onChange={() => void onToggleActive(s)}
                              disabled={!approved}
                              aria-label={s.active ? 'Active' : 'Hidden'}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <button
                                type="button"
                                className="cbb-btn-rst"
                                style={{ padding: '8px 14px', fontSize: 13 }}
                                disabled={!approved}
                                onClick={() =>
                                  setEditing({
                                    id: s.id,
                                    name: s.name,
                                    description: s.description,
                                    durationMinutes: s.durationMinutes,
                                    price: s.price,
                                    active: s.active,
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="cbb-btn-rst"
                                style={{ padding: '8px 14px', fontSize: 13 }}
                                disabled={!approved}
                                onClick={() => void onDelete(s)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="cbb-section">
            <p style={{ margin: 0, color: '#64748b' }}>Sign in as a shop owner to manage services.</p>
          </section>
        )}

        {editing ? (
          <section className="cbb-section" style={{ marginTop: 20, border: '2px solid #ff6b35' }}>
            <h3 style={{ marginTop: 0 }}>Edit service</h3>
            <div className="cbb-form-grid">
              <div className="cbb-fg" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="ed-name">Name *</label>
                <input
                  id="ed-name"
                  className="cbb-inp"
                  value={editing.name}
                  onChange={(e) => setEditing((d) => (d ? { ...d, name: e.target.value } : d))}
                  disabled={saving}
                />
              </div>
              <div className="cbb-fg" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="ed-desc">Description</label>
                <textarea
                  id="ed-desc"
                  className="cbb-ta"
                  value={editing.description}
                  onChange={(e) => setEditing((d) => (d ? { ...d, description: e.target.value } : d))}
                  rows={3}
                  disabled={saving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="ed-price">Price (LKR)</label>
                <input
                  id="ed-price"
                  className="cbb-inp"
                  type="number"
                  min={0}
                  value={editing.price}
                  onChange={(e) =>
                    setEditing((d) =>
                      d ? { ...d, price: e.target.value === '' ? 0 : Number(e.target.value) } : d,
                    )
                  }
                  disabled={saving}
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="ed-min">Minutes</label>
                <input
                  id="ed-min"
                  className="cbb-inp"
                  type="number"
                  min={1}
                  value={editing.durationMinutes}
                  onChange={(e) =>
                    setEditing((d) =>
                      d
                        ? {
                            ...d,
                            durationMinutes: e.target.value === '' ? 0 : Number(e.target.value),
                          }
                        : d,
                    )
                  }
                  disabled={saving}
                />
              </div>
              <div className="cbb-fg" style={{ alignSelf: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing((d) => (d ? { ...d, active: e.target.checked } : d))}
                    disabled={saving}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="cbb-btns">
              <button type="button" className="cbb-btn-ok" disabled={saving} onClick={() => void onSaveEdit()}>
                Save changes
              </button>
              <button type="button" className="cbb-btn-rst" disabled={saving} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
