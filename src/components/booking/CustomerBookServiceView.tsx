import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { createBooking } from '@/services/bookings'
import { callSendBookingReceiptEmail } from '@/services/bookingSendReceipt'
import { sendBookingReceiptViaApi } from '@/services/bookingReceiptEmail'
import { listServiceOffersByOwner } from '@/services/serviceOffers'
import { listApprovedOwnersForBooking } from '@/services/users'
import type { ServiceOffer, UserProfile } from '@/types'
import { getOwnerShopCategories, shopCategoriesLine } from '@/utils/shopOwnerCategory'
import { mailtoBookingCopy } from '@/utils/bookingEmail'
import {
  downloadBookingConfirmationPdf,
  type BookingReceiptPdfInput,
} from '@/utils/bookingReceiptPdf'
import '@/styles/customer-bike-booking.css'

function mapUrl(q: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=14&output=embed`
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0]!
}

function mapQueryForShop(shop: UserProfile) {
  return (
    shop.shopAddress?.trim() ||
    shop.district?.trim() ||
    shop.location?.trim() ||
    'Batticaloa'
  )
}

function waDigits(shop: UserProfile) {
  const raw = (shop.whatsapp || shop.phone || '').trim()
  return raw.replace(/\D/g, '')
}

const BIKE_TYPES = ['Scooter', 'Manual Bike', 'Electric Bike', 'Sport Bike'] as const

export function CustomerBookServiceView() {
  const { firebaseUser, profile } = useAuth()
  const [owners, setOwners] = useState<UserProfile[]>([])
  const [ownersLoading, setOwnersLoading] = useState(true)
  const [ownerUid, setOwnerUid] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const [ownerName, setOwnerName] = useState('')
  const [bikeNumber, setBikeNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [bikeType, setBikeType] = useState<string>(BIKE_TYPES[0]!)
  const [bikeModel, setBikeModel] = useState('')
  const [notes, setNotes] = useState('')

  const [showSuccess, setShowSuccess] = useState(false)
  const [successText, setSuccessText] = useState('')
  const [successMailto, setSuccessMailto] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** Snapshot at confirm time so the PDF matches the saved booking even if the form is edited later. */
  const pdfSnapshotRef = useRef<BookingReceiptPdfInput | null>(null)

  const [catalogServices, setCatalogServices] = useState<ServiceOffer[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  const shop = useMemo(
    () => owners.find((o) => o.uid === ownerUid) ?? null,
    [owners, ownerUid],
  )
  const mapSrc = shop ? mapUrl(mapQueryForShop(shop)) : ''

  const total = useMemo(() => {
    let t = 0
    for (const s of catalogServices) {
      if (selected.has(s.id)) t += s.price
    }
    return t
  }, [selected, catalogServices])

  useEffect(() => {
    const uid = shop?.uid?.trim()
    if (!uid) return
    let cancelled = false
    ;(async () => {
      setCatalogLoading(true)
      setSelected(new Set())
      try {
        const all = await listServiceOffersByOwner(uid)
        const active = all.filter((s) => s.active !== false)
        if (!cancelled) setCatalogServices(active)
      } catch {
        if (!cancelled) {
          setCatalogServices([])
          toast.error('Could not load this shop’s services.')
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shop?.uid])

  const toggleService = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!firebaseUser) return
    let cancelled = false
    ;(async () => {
      setOwnersLoading(true)
      try {
        const list = await listApprovedOwnersForBooking()
        if (!cancelled) setOwners(list)
      } catch (err: unknown) {
        if (!cancelled) setOwners([])
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : ''
        if (code === 'failed-precondition') {
          toast.error(
            'Firestore needs a new composite index for the shop list. From the project folder run: npm run firebase:deploy:rules — or open the index URL from the browser console error.',
            { duration: 9000 },
          )
        } else if (code === 'permission-denied') {
          toast.error(
            'Could not load shops (permission denied). Deploy the latest firestore.rules from this project so approved shop owners are readable to signed-in customers.',
            { duration: 8000 },
          )
        } else {
          toast.error('Could not load service shops. Check your connection and try again.')
        }
      } finally {
        if (!cancelled) setOwnersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [firebaseUser])

  const openAi = useCallback(() => {
    toast.message(
      '🤖 AI assistant (coming soon): service tips, package compare, and instant booking help. Use WhatsApp to contact shops for now.',
      { duration: 5000 },
    )
  }, [])

  const sendWhatsApp = useCallback(() => {
    if (!ownerName.trim() || !bikeNumber.trim() || !phone.trim() || !serviceDate || !serviceTime) {
      toast.error('Please fill all required fields')
      return
    }
    if (!shop) {
      toast.error('Please select a shop first')
      return
    }
    const digits = waDigits(shop)
    if (!digits) {
      toast.error('This shop has no WhatsApp number on file. Use Confirm booking to submit online.')
      return
    }
    if (selected.size === 0) {
      toast.error('Please select at least one service')
      return
    }
    const shopLabel = shop.shopName?.trim() || shop.displayName
    const names = catalogServices.filter((s) => selected.has(s.id)).map((s) => s.name)
    const parts = [
      `Hi ${shopLabel},`,
      '',
      'I would like to book a bike service:',
      '',
      `👤 Owner: ${ownerName.trim()}`,
      `🏍️ Bike Number: ${bikeNumber.trim()}`,
      `📱 Phone: ${phone.trim()}`,
      `🏍️ Bike Type: ${bikeType}`,
    ]
    if (bikeModel.trim()) parts.push(`🔧 Model: ${bikeModel.trim()}`)
    parts.push(`📅 Preferred Date: ${serviceDate}`, `⏰ Preferred Time: ${serviceTime}`, '', '🔧 Services Required:')
    for (const n of names) parts.push(`• ${n}`)
    parts.push('', `💰 Estimated Total: LKR ${total.toLocaleString()}`)
    if (notes.trim()) parts.push('', `📝 Notes: ${notes.trim()}`)
    parts.push('', 'Please confirm my booking. Thank you!')
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(parts.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [shop, ownerName, bikeNumber, phone, serviceDate, serviceTime, bikeType, bikeModel, notes, selected, total, catalogServices])

  const confirmBooking = useCallback(async () => {
    if (!ownerName.trim() || !bikeNumber.trim() || !phone.trim() || !serviceDate || !serviceTime) {
      toast.error('Please fill all required fields')
      return
    }
    if (!shop) {
      toast.error('Please select a shop first')
      return
    }
    if (selected.size === 0) {
      toast.error('Please select at least one service')
      return
    }
    if (!firebaseUser) {
      toast.error('Please sign in as a customer to confirm a booking online.')
      return
    }
    if (profile?.role !== 'customer') {
      toast.error('Only customer accounts can save online bookings.')
      return
    }

    const selectedItems = catalogServices.filter((s) => selected.has(s.id))
    const serviceIds = [...selectedItems.map((s) => s.id)].sort().join('-')
    const serviceName = selectedItems.map((s) => s.name).join(', ')
    const parts: string[] = []
    if (ownerName.trim()) parts.push(`Name: ${ownerName.trim()}`)
    if (phone.trim()) parts.push(`Phone: ${phone.trim()}`)
    parts.push(`Bike: ${bikeNumber.trim()} (${bikeType})`)
    if (bikeModel.trim()) parts.push(`Model: ${bikeModel.trim()}`)
    if (email.trim()) parts.push(`Email: ${email.trim()}`)
    if (notes.trim()) parts.push(notes.trim())
    const ownerNote = parts.join(' · ')
    const locationLabel = [shop.shopName || shop.displayName, shop.shopAddress || shop.district || shop.location]
      .filter(Boolean)
      .join(' — ')

    setSubmitting(true)
    try {
      const customerEmail = email.trim() || undefined
      const bookingId = await createBooking({
        customerId: firebaseUser.uid,
        ownerId: shop.uid.trim(),
        serviceId: serviceIds ? `svc-${serviceIds}` : 'svc-custom',
        serviceName,
        date: serviceDate,
        time: serviceTime,
        location: locationLabel || shop.shopName || shop.displayName,
        ownerNote,
        estimatedTotalLkr: total,
        ...(customerEmail ? { customerEmail } : {}),
      })
      const lines = [
        'Booking saved.',
        `🏪 Shop: ${shop.shopName || shop.displayName}`,
        `👤 Contact: ${ownerName.trim()}`,
        `🏍️ Bike: ${bikeNumber.trim()} (${bikeType})`,
        `📞 Phone: ${phone.trim()}`,
        `📅 ${serviceDate} at ${serviceTime}`,
        `🔧 Services: ${serviceName}`,
        `💰 Total: LKR ${total.toLocaleString()}`,
        '',
        'The shop can accept or decline from their Bookings page.',
      ]
      if (customerEmail) {
        const emailPayload = {
          to: customerEmail,
          shopName: (shop.shopName || shop.displayName).trim(),
          serviceName,
          date: serviceDate,
          time: serviceTime,
          bikeNumber: bikeNumber.trim(),
          bikeType,
          contactName: ownerName.trim(),
          phone: phone.trim(),
          totalLkr: total,
          notes: notes.trim() || undefined,
        }
        setSuccessMailto(
          mailtoBookingCopy({
            to: customerEmail,
            shopName: (shop.shopName || shop.displayName).trim(),
            contactName: ownerName.trim(),
            bikeNumber: bikeNumber.trim(),
            bikeType,
            bikeModel: bikeModel.trim() || undefined,
            phone: phone.trim(),
            date: serviceDate,
            time: serviceTime,
            services: serviceName,
            totalLkr: total,
            notes: notes.trim() || undefined,
          }),
        )
        try {
          const r = await callSendBookingReceiptEmail(bookingId)
          if (r.sent) {
            lines.push(
              '',
              `A booking confirmation was sent to ${customerEmail} — check your inbox and spam folder.`,
            )
            toast.success(`Confirmation sent to ${customerEmail}.`)
          } else {
            await sendBookingReceiptViaApi(emailPayload)
            lines.push('', `A booking confirmation was sent to ${customerEmail}.`)
            toast.success(`Confirmation sent to ${customerEmail}.`)
          }
        } catch {
          try {
            await sendBookingReceiptViaApi(emailPayload)
            lines.push('', `A booking confirmation was sent to ${customerEmail}.`)
            toast.success(`Confirmation sent to ${customerEmail}.`)
          } catch {
            lines.push(
              '',
              'We could not send the email automatically. Use the link below to open Gmail and send a copy to yourself.',
            )
            toast.success('Booking sent to the shop.')
            toast.error('Email not delivered. Use the link below, or check SMTP settings.')
          }
        }
      } else {
        setSuccessMailto(null)
        toast.success('Booking sent to the shop.')
      }
      setSuccessText(lines.join('\n'))
      pdfSnapshotRef.current = {
        bookingId,
        bookedAtIso: new Date().toISOString(),
        shopName: (shop.shopName || shop.displayName).trim(),
        shopPhone: shop.phone?.trim() || undefined,
        contactName: ownerName.trim(),
        bikeNumber: bikeNumber.trim(),
        bikeType,
        bikeModel: bikeModel.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        serviceDate,
        serviceTime,
        servicesLine: serviceName,
        serviceLines: selectedItems.map((s) => ({
          name: s.name,
          priceLkr: s.price,
          durationMinutes: s.durationMinutes,
        })),
        totalLkr: total,
        notes: notes.trim() || undefined,
        locationLabel: locationLabel || undefined,
      }
      setShowSuccess(true)
    } catch {
      toast.error('Could not save booking. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }, [
    shop,
    ownerName,
    bikeNumber,
    phone,
    serviceDate,
    serviceTime,
    bikeType,
    bikeModel,
    email,
    notes,
    selected,
    total,
    firebaseUser,
    profile?.role,
    catalogServices,
  ])

  const resetForm = useCallback(() => {
    if (!window.confirm('Are you sure you want to reset the form?')) return
    setOwnerName('')
    setBikeNumber('')
    setPhone('')
    setEmail('')
    setServiceDate('')
    setServiceTime('')
    setBikeType(BIKE_TYPES[0]!)
    setBikeModel('')
    setNotes('')
    setSelected(new Set())
    setShowSuccess(false)
    setSuccessText('')
    setSuccessMailto(null)
    pdfSnapshotRef.current = null
  }, [])

  const downloadBookingPdf = useCallback(() => {
    const snap = pdfSnapshotRef.current
    if (!snap) {
      toast.error('Nothing to download. Confirm a booking first.')
      return
    }
    try {
      downloadBookingConfirmationPdf(snap)
      toast.success('Booking PDF downloaded.')
    } catch {
      toast.error('Could not create the PDF. Try again.')
    }
  }, [])

  const shopDisplayName = shop ? shop.shopName?.trim() || shop.displayName : ''

  return (
    <div className="cbb-page">
      <header className="cbb-header">
        <h1>🏍️ BikeBuddy.lk</h1>
        <p>AI-Powered Bike Service Booking System - Batticaloa</p>
      </header>

      <div className="cbb-container">
        <section className="cbb-section" aria-label="Select shop">
          <h2>🏪 Select a Bike Service Shop</h2>
          {!firebaseUser ? (
            <p className="text-sm text-amber-900" style={{ marginBottom: 12 }}>
              <Link to={ROUTES.customerLogin} className="font-semibold underline">
                Sign in as a customer
              </Link>{' '}
              to confirm a booking online (it will appear in the shop owner portal).
            </p>
          ) : null}
          <select
            className="cbb-select"
            value={ownerUid}
            disabled={ownersLoading}
            onChange={(e) => {
              setOwnerUid(e.target.value)
              setShowSuccess(false)
              setSuccessMailto(null)
              pdfSnapshotRef.current = null
            }}
          >
            <option value="">{ownersLoading ? 'Loading shops…' : '-- Choose an approved service shop --'}</option>
            {owners.map((o) => (
              <option key={o.uid} value={o.uid}>
                {(o.shopName || o.displayName || o.email).trim()}
              </option>
            ))}
          </select>
          {!ownersLoading && owners.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 14, color: '#64748b' }}>
              No approved service shops are available yet. An administrator must approve shop owner accounts before they
              appear here.
            </p>
          ) : null}
        </section>

        {shop ? (
          <section className="cbb-section cbb-pad-h3">
            <div className="cbb-shop-card">
              <h3>{shopDisplayName}</h3>
              <div className="cbb-shop-info">
                {shop.shopAddress || shop.district || shop.location ? (
                  <div className="cbb-info-item">
                    <span aria-hidden>📍</span>{' '}
                    {[shop.shopAddress, shop.district, shop.location].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
                {shop.phone ? (
                  <div className="cbb-info-item">
                    <span aria-hidden>📞</span> {shop.phone}
                  </div>
                ) : null}
                <div className="cbb-info-item">
                  <span aria-hidden>👤</span> {shop.displayName}
                </div>
                {(() => {
                  const withArr = getOwnerShopCategories(shop)
                  const line = withArr.length
                    ? shopCategoriesLine(withArr)
                    : shop.shopCategory
                      ? shop.shopCategory
                      : null
                  if (!line) return null
                  return (
                    <div className="cbb-info-item">
                      <span aria-hidden>🏷️</span> {line}
                    </div>
                  )
                })()}
              </div>
            </div>
            {mapSrc ? <iframe className="cbb-map" title="Shop location" src={mapSrc} /> : null}

            <h3>🔧 Available Services</h3>
            {catalogLoading ? (
              <p style={{ fontSize: 14, color: '#64748b' }}>Loading this shop’s services…</p>
            ) : !catalogServices.length ? (
              <p style={{ fontSize: 14, color: '#64748b' }}>
                This shop has not published any active services yet. The owner can add names and prices under{' '}
                <strong>Shop portal → Services</strong>.
              </p>
            ) : (
              <div className="cbb-services">
                {catalogServices.map((s) => (
                  <label
                    key={s.id}
                    className={cn('cbb-svc', selected.has(s.id) && 'cbb-svc--on')}
                    htmlFor={`svc-${s.id.replace(/\s/g, '')}`}
                  >
                    <input
                      id={`svc-${s.id.replace(/\s/g, '')}`}
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleService(s.id)}
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

            {total > 0 ? (
              <div className="cbb-summary" aria-label="Selected services">
                <h3>📋 Selected Services Summary</h3>
                {catalogServices.filter((s) => selected.has(s.id)).map((s) => (
                  <div key={s.id} className="cbb-sum-row">
                    <span>{s.name}</span>
                    <span>LKR {s.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="cbb-sum-tot">Total: LKR {total.toLocaleString()}</div>
              </div>
            ) : null}

            <h3>📝 Bike Owner Details</h3>
            <div className="cbb-form-grid">
              <div className="cbb-fg">
                <label htmlFor="cbb-on">👤 Bike Owner Name *</label>
                <input
                  id="cbb-on"
                  className="cbb-inp"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter owner name"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-bn">🏍️ Bike Number *</label>
                <input
                  id="cbb-bn"
                  className="cbb-inp"
                  value={bikeNumber}
                  onChange={(e) => setBikeNumber(e.target.value)}
                  placeholder="Ex: WP-BC-1234"
                  required
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-ph">📞 Phone Number *</label>
                <input
                  id="cbb-ph"
                  className="cbb-inp"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  required
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-em">📧 Email (optional)</label>
                <input
                  id="cbb-em"
                  className="cbb-inp"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name@gmail.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <h3>📅 Book Service Appointment</h3>
            <div className="cbb-form-grid">
              <div className="cbb-fg">
                <label htmlFor="cbb-dt">📅 Preferred Date *</label>
                <input
                  id="cbb-dt"
                  className="cbb-inp"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  min={todayIsoDate()}
                  required
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-tm">⏰ Preferred Time *</label>
                <input
                  id="cbb-tm"
                  className="cbb-inp"
                  type="time"
                  value={serviceTime}
                  onChange={(e) => setServiceTime(e.target.value)}
                  required
                />
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-bt">🏍️ Bike Type *</label>
                <select
                  id="cbb-bt"
                  className="cbb-sel2"
                  value={bikeType}
                  onChange={(e) => setBikeType(e.target.value)}
                >
                  {BIKE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cbb-fg">
                <label htmlFor="cbb-bm">🔧 Bike Model</label>
                <input
                  id="cbb-bm"
                  className="cbb-inp"
                  value={bikeModel}
                  onChange={(e) => setBikeModel(e.target.value)}
                  placeholder="Ex: Honda Dio, Yamaha FZ"
                />
              </div>
            </div>

            <div className="cbb-fg" style={{ marginTop: 8 }}>
              <label htmlFor="cbb-nt">📝 Additional Notes (optional)</label>
              <textarea
                id="cbb-nt"
                className="cbb-ta"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Any specific issues or requirements…"
              />
            </div>

            <div className="cbb-btns">
              <button
                type="button"
                className="cbb-btn-ok"
                onClick={() => void confirmBooking()}
                disabled={submitting || ownersLoading}
              >
                {submitting ? 'Saving…' : 'Confirm booking'}
              </button>
              <button type="button" className="cbb-btn-wa" onClick={sendWhatsApp}>
                Book via WhatsApp
              </button>
              <button type="button" className="cbb-btn-rst" onClick={resetForm}>
                Reset form
              </button>
            </div>

            {showSuccess ? (
              <div className="cbb-success" role="status">
                <h3>Booking confirmed</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{successText}</p>
                <p style={{ marginTop: 14 }}>
                  <button type="button" className="cbb-btn-pdf" onClick={downloadBookingPdf}>
                    Download booking PDF
                  </button>
                </p>
                {successMailto ? (
                  <p style={{ marginTop: 12 }}>
                    <a
                      className="font-semibold text-emerald-900 underline hover:no-underline"
                      href={successMailto}
                    >
                      Send copy to my email (Gmail / mail app)
                    </a>
                  </p>
                ) : null}
                <p style={{ marginTop: 12 }}>
                  <Link
                    to={ROUTES.bookings}
                    className="font-semibold text-emerald-900 underline hover:no-underline"
                  >
                    View your bookings
                  </Link>
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <button type="button" className="cbb-ai" onClick={openAi} aria-label="AI assistant (coming soon)">
        <span aria-hidden>🤖</span>
      </button>
    </div>
  )
}
