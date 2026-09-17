import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { isFirebaseConfigured } from '@/services/firebase'
import { uploadShopLogo } from '@/services/storage'
import { subscribeServiceOffersByOwner } from '@/services/serviceOffers'
import { subscribeShopReviewsForOwner } from '@/services/shopReviews'
import { updateOwnerShopProfile } from '@/services/users'
import { createdAtMs } from '@/utils/shopDashboardMetrics'
import type { ServiceOffer, ShopDayHours, ShopReview, UserProfile } from '@/types'
import { ROUTES } from '@/utils/constants'

const LOGO_MAX_BYTES = 5 * 1024 * 1024

const DEFAULT_HOURS: Record<string, ShopDayHours> = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '18:00' },
  saturday: { enabled: true, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '10:00', end: '14:00' },
}

const DAY_ORDER: { key: string; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

function mergeHours(loaded?: UserProfile['operatingHours']): Record<string, ShopDayHours> {
  const out: Record<string, ShopDayHours> = {}
  for (const d of DAY_ORDER) {
    out[d.key] = loaded?.[d.key] ?? DEFAULT_HOURS[d.key]!
  }
  return out
}

function inferYearsFromCreated(createdAt: unknown): number | null {
  if (!createdAt || typeof createdAt !== 'object') return null
  const ts = createdAt as { toDate?: () => Date }
  if (typeof ts.toDate !== 'function') return null
  const d = ts.toDate().getTime()
  const y = (Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.floor(y))
}

function mapQueryFromForm(address: string, city: string, province: string): string {
  return [address, city, province].filter((s) => s.trim()).join(', ') || 'Sri Lanka'
}

type FormState = {
  shopName: string
  displayName: string
  phone: string
  whatsapp: string
  website: string
  shopDescription: string
  shopAddress: string
  city: string
  postalCode: string
  province: string
  yearsInBusiness: string
  hours: Record<string, ShopDayHours>
}

function profileFormSyncKey(p: UserProfile | null): string {
  if (!p) return ''
  const hours = mergeHours(p.operatingHours)
  return JSON.stringify({
    u: p.uid,
    t: createdAtMs(p.updatedAt),
    shopName: p.shopName ?? '',
    displayName: p.displayName ?? '',
    phone: p.phone ?? '',
    whatsapp: p.whatsapp ?? '',
    website: p.website ?? '',
    shopDescription: p.shopDescription ?? '',
    shopAddress: p.shopAddress ?? '',
    district: p.district ?? '',
    location: p.location ?? '',
    postalCode: p.postalCode ?? '',
    province: p.province ?? '',
    shopLogoUrl: p.shopLogoUrl ?? '',
    yearsInBusiness: p.yearsInBusiness ?? null,
    hours,
  })
}

function profileToForm(p: UserProfile | null): FormState {
  if (!p) {
    return {
      shopName: '',
      displayName: '',
      phone: '',
      whatsapp: '',
      website: '',
      shopDescription: '',
      shopAddress: '',
      city: '',
      postalCode: '',
      province: '',
      yearsInBusiness: '',
      hours: mergeHours(),
    }
  }
  return {
    shopName: p.shopName ?? '',
    displayName: p.displayName ?? '',
    phone: p.phone ?? '',
    whatsapp: p.whatsapp ?? '',
    website: p.website ?? '',
    shopDescription: p.shopDescription ?? '',
    shopAddress: p.shopAddress ?? '',
    city: p.district ?? p.location ?? '',
    postalCode: p.postalCode ?? '',
    province: p.province ?? '',
    yearsInBusiness: p.yearsInBusiness != null ? String(p.yearsInBusiness) : '',
    hours: mergeHours(p.operatingHours),
  }
}

export function ShopProfilePage() {
  const { profile, firebaseUser } = useAuth()
  const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
  const [form, setForm] = useState<FormState>(() => profileToForm(null))
  const [editBasic, setEditBasic] = useState(false)
  const [editLocation, setEditLocation] = useState(false)
  const [editHours, setEditHours] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [logoPending, setLogoPending] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceOffer[]>([])
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])

  const emailReadonly = firebaseUser?.email ?? profile?.email ?? ''

  useEffect(() => {
    if (!ownerId) return
    return subscribeServiceOffersByOwner(
      ownerId,
      (rows) => setServices(rows),
      () => setServices([]),
    )
  }, [ownerId])

  useEffect(() => {
    if (!ownerId || !isFirebaseConfigured) {
      setShopReviews([])
      return
    }
    return subscribeShopReviewsForOwner(
      ownerId,
      (rows) => setShopReviews(rows),
      (err) => {
        console.error('[ShopProfilePage] shopReviews', err)
        setShopReviews([])
      },
    )
  }, [ownerId])

  const profileShopSyncKey = useMemo(() => profileFormSyncKey(profile), [profile])

  useEffect(() => {
    setForm(profileToForm(profile))
  }, [profileShopSyncKey])

  const onLogoFile = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (JPG, PNG, WebP, …).')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Image must be 5MB or smaller.')
      return
    }
    setLogoPending(file)
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const activeServiceCount = useMemo(
    () => services.filter((s) => s.active).length,
    [services],
  )

  const yearsStat = useMemo(() => {
    if (form.yearsInBusiness.trim() !== '') {
      const n = Number(form.yearsInBusiness)
      if (Number.isFinite(n) && n >= 0) return String(Math.floor(n))
    }
    const saved = profile?.yearsInBusiness
    if (typeof saved === 'number' && Number.isFinite(saved) && saved >= 0) {
      return String(Math.floor(saved))
    }
    const inferred = profile ? inferYearsFromCreated(profile.createdAt) : null
    if (inferred != null) {
      if (inferred >= 1) return String(inferred)
      return '< 1'
    }
    return '—'
  }, [form.yearsInBusiness, profile])

  const shopRatingDisplay = useMemo(() => {
    if (!shopReviews.length) return '—'
    const sum = shopReviews.reduce((a, r) => a + r.rating, 0)
    return (sum / shopReviews.length).toFixed(1)
  }, [shopReviews])

  const totalReviewsDisplay = useMemo(() => String(shopReviews.length), [shopReviews])

  const displayLogoSrc = useMemo(() => {
    const url = logoPreview || profile?.shopLogoUrl
    if (!url) return null
    if (logoPreview) return url
    const v = createdAtMs(profile?.updatedAt)
    if (!v) return url
    return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`
  }, [logoPreview, profile?.shopLogoUrl, profile?.updatedAt])

  const mapSrc = useMemo(() => {
    const q = mapQueryFromForm(form.shopAddress, form.city, form.province)
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=14&output=embed`
  }, [form.shopAddress, form.city, form.province])

  const resetFormFromProfile = useCallback(() => {
    setForm(profileToForm(profile))
    setEditBasic(false)
    setLogoPending(null)
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [profile])

  const saveAll = useCallback(async () => {
    if (!ownerId || !profile) {
      toast.error('Not signed in.')
      return
    }
    const shopName = form.shopName.trim()
    const displayName = form.displayName.trim()
    if (!shopName) {
      toast.error('Enter a shop name.')
      return
    }
    if (!displayName) {
      toast.error('Enter owner / contact name.')
      return
    }
    if (!isFirebaseConfigured) {
      toast.error('Firebase is not configured.')
      return
    }
    setSaving(true)
    try {
      let shopLogoUrl = profile.shopLogoUrl
      if (logoPending) {
        shopLogoUrl = await uploadShopLogo(ownerId, logoPending)
      }
      const yearsStr = form.yearsInBusiness.trim()
      let yearsInBusiness: number | null = null
      if (yearsStr !== '') {
        const n = Number(yearsStr)
        if (!Number.isFinite(n) || n < 0) {
          toast.error('Years in business must be a non‑negative number.')
          setSaving(false)
          return
        }
        yearsInBusiness = Math.floor(n)
      }
      await updateOwnerShopProfile(ownerId, {
        shopName,
        displayName,
        phone: form.phone,
        whatsapp: form.whatsapp,
        website: form.website,
        shopDescription: form.shopDescription,
        shopAddress: form.shopAddress,
        location: form.city,
        district: form.city,
        postalCode: form.postalCode,
        province: form.province,
        shopLogoUrl,
        yearsInBusiness,
        operatingHours: form.hours,
      })
      setLogoPending(null)
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setEditBasic(false)
      setEditLocation(false)
      setEditHours(false)
      setShowSuccess(true)
      toast.success('Profile updated')
      window.setTimeout(() => setShowSuccess(false), 5000)
    } catch (e) {
      console.error(e)
      toast.error('Could not save profile. Check your connection and Storage rules for logos.')
    } finally {
      setSaving(false)
    }
  }, [ownerId, profile, form, logoPending])

  const setHour = (day: string, patch: Partial<ShopDayHours>) => {
    setForm((f) => ({
      ...f,
      hours: { ...f.hours, [day]: { ...f.hours[day]!, ...patch } },
    }))
  }

  if (!profile || profile.role !== 'owner') {
    return (
      <div className="sp-panel">
        <p>Shop profile is for signed-in shop owners only.</p>
      </div>
    )
  }

  return (
    <div className="sp-profile-page">
      <div className="sp-top-bar">
        <div>
          <h1>Shop Profile</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Home</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>Shop Profile</span>
          </div>
        </div>
      </div>

      {showSuccess ? (
        <div className="sp-profile-success" role="status">
          <i className="fas fa-check-circle" aria-hidden />
          <div>
            <strong>Profile updated</strong>
            <p>Your changes have been saved.</p>
          </div>
        </div>
      ) : null}

      <div className="sp-profile-stats">
        <div className="sp-profile-stat-card">
          <h3>Shop rating</h3>
          <div className="sp-profile-stat-value">{shopRatingDisplay}</div>
        </div>
        <div className="sp-profile-stat-card">
          <h3>Total reviews</h3>
          <div className="sp-profile-stat-value">{totalReviewsDisplay}</div>
        </div>
        <div className="sp-profile-stat-card">
          <h3>Services offered</h3>
          <div className="sp-profile-stat-value">{activeServiceCount}</div>
        </div>
        <div className="sp-profile-stat-card">
          <h3>Years in business</h3>
          <div className="sp-profile-stat-value">{yearsStat}</div>
        </div>
      </div>

      <div className="sp-profile-card">
        <div className="sp-profile-section-header">
          <h2>
            <i className="fas fa-image" aria-hidden />
            Shop logo &amp; branding
          </h2>
        </div>
        <div className="sp-profile-logo-block">
          <div className="sp-profile-logo-preview">
            {displayLogoSrc ? (
              <img src={displayLogoSrc} alt="Shop logo" />
            ) : (
              <i className="fas fa-store" aria-hidden />
            )}
          </div>
          <div className="sp-profile-logo-text">
            <h3>Upload your shop logo</h3>
            <p>Recommended: square image ~500×500. Max 5MB. JPG, PNG, or WebP.</p>
            <input
              type="file"
              id="sp-logo-file"
              accept="image/*"
              className="sp-profile-file-input"
              onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="sp-logo-file" className="sp-profile-upload-btn">
              <i className="fas fa-upload" aria-hidden />
              Choose image
            </label>
          </div>
        </div>
      </div>

      <div className="sp-profile-card">
        <div className="sp-profile-section-header">
          <h2>
            <i className="fas fa-info-circle" aria-hidden />
            Basic information
          </h2>
          <button
            type="button"
            className="sp-profile-edit-btn"
            onClick={() => setEditBasic((v) => !v)}
            disabled={saving}
          >
            <i className="fas fa-edit" aria-hidden />
            {editBasic ? 'Lock' : 'Edit'}
          </button>
        </div>
        <div className="sp-profile-form-grid">
          <div className="sp-profile-field">
            <label htmlFor="sp-shopName">Shop name *</label>
            <input
              id="sp-shopName"
              className="sp-profile-input"
              value={form.shopName}
              onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-displayName">Owner name *</label>
            <input
              id="sp-displayName"
              className="sp-profile-input"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-email">Email</label>
            <input
              id="sp-email"
              className="sp-profile-input sp-profile-input--muted"
              value={emailReadonly}
              readOnly
              title="Change your sign-in email in your Firebase / account settings if needed"
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-phone">Phone</label>
            <input
              id="sp-phone"
              className="sp-profile-input"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-whatsapp">WhatsApp</label>
            <input
              id="sp-whatsapp"
              className="sp-profile-input"
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-website">Website (optional)</label>
            <input
              id="sp-website"
              className="sp-profile-input"
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
              placeholder="https://"
            />
          </div>
          <div className="sp-profile-field sp-profile-field--wide">
            <label htmlFor="sp-years">Years in business (optional, overrides auto)</label>
            <input
              id="sp-years"
              className="sp-profile-input"
              type="number"
              min={0}
              value={form.yearsInBusiness}
              onChange={(e) => setForm((f) => ({ ...f, yearsInBusiness: e.target.value }))}
              readOnly={!editBasic}
              disabled={saving}
              placeholder="e.g. 5"
            />
          </div>
        </div>
        <div className="sp-profile-field sp-profile-field--block">
          <label htmlFor="sp-desc">Shop description</label>
          <textarea
            id="sp-desc"
            className="sp-profile-textarea"
            value={form.shopDescription}
            onChange={(e) => setForm((f) => ({ ...f, shopDescription: e.target.value }))}
            readOnly={!editBasic}
            disabled={saving}
            rows={4}
            placeholder="What riders should know about your shop"
          />
        </div>
      </div>

      <div className="sp-profile-card">
        <div className="sp-profile-section-header">
          <h2>
            <i className="fas fa-map-marker-alt" aria-hidden />
            Location
          </h2>
          <button
            type="button"
            className="sp-profile-edit-btn"
            onClick={() => setEditLocation((v) => !v)}
            disabled={saving}
          >
            <i className="fas fa-edit" aria-hidden />
            {editLocation ? 'Lock' : 'Edit'}
          </button>
        </div>
        <div className="sp-profile-form-grid">
          <div className="sp-profile-field sp-profile-field--wide">
            <label htmlFor="sp-address">Street / address</label>
            <input
              id="sp-address"
              className="sp-profile-input"
              value={form.shopAddress}
              onChange={(e) => setForm((f) => ({ ...f, shopAddress: e.target.value }))}
              readOnly={!editLocation}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-city">City / district</label>
            <input
              id="sp-city"
              className="sp-profile-input"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              readOnly={!editLocation}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-postal">Postal code</label>
            <input
              id="sp-postal"
              className="sp-profile-input"
              value={form.postalCode}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              readOnly={!editLocation}
              disabled={saving}
            />
          </div>
          <div className="sp-profile-field">
            <label htmlFor="sp-province">Province</label>
            <input
              id="sp-province"
              className="sp-profile-input"
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              readOnly={!editLocation}
              disabled={saving}
            />
          </div>
        </div>
        <div className="sp-profile-map-wrap">
          <iframe
            className="sp-profile-map"
            title="Location preview"
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      <div className="sp-profile-card">
        <div className="sp-profile-section-header">
          <h2>
            <i className="fas fa-clock" aria-hidden />
            Operating hours
          </h2>
          <button
            type="button"
            className="sp-profile-edit-btn"
            onClick={() => setEditHours((v) => !v)}
            disabled={saving}
          >
            <i className="fas fa-edit" aria-hidden />
            {editHours ? 'Lock' : 'Edit'}
          </button>
        </div>
        <div className="sp-profile-hours">
          {DAY_ORDER.map(({ key, label }) => {
            const h = form.hours[key]!
            return (
              <div key={key} className="sp-profile-hour-row">
                <span className="sp-profile-day-label">{label}</span>
                <input
                  type="time"
                  className="sp-profile-input"
                  value={h.start}
                  onChange={(e) => setHour(key, { start: e.target.value })}
                  readOnly={!editHours}
                  disabled={!h.enabled}
                />
                <input
                  type="time"
                  className="sp-profile-input"
                  value={h.end}
                  onChange={(e) => setHour(key, { end: e.target.value })}
                  readOnly={!editHours}
                  disabled={!h.enabled}
                />
                <button
                  type="button"
                  className={`sp-profile-day-toggle${h.enabled ? ' sp-profile-day-toggle--on' : ''}`}
                  onClick={() => {
                    if (!editHours) return
                    setHour(key, { enabled: !h.enabled })
                  }}
                  disabled={!editHours || saving}
                  aria-pressed={h.enabled}
                >
                  {h.enabled ? 'Open' : 'Closed'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sp-profile-card">
        <div className="sp-profile-section-header">
          <h2>
            <i className="fas fa-wrench" aria-hidden />
            Services offered
          </h2>
          <Link to={ROUTES.shopServices} className="sp-profile-manage-link">
            <i className="fas fa-cog" aria-hidden />
            Manage services
          </Link>
        </div>
        {services.length === 0 ? (
          <p className="sp-profile-muted">No service lines yet — add them under Services.</p>
        ) : (
          <div className="sp-profile-services">
            {services.map((s) => (
              <div key={s.id} className="sp-profile-service-tile">
                <div>
                  <h4>{s.name}</h4>
                  <p>{s.description || 'Service'}</p>
                </div>
                <div className="sp-profile-service-price">LKR {s.price.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sp-profile-actions">
        <button
          type="button"
          className="sp-profile-save"
          onClick={() => void saveAll()}
          disabled={saving}
        >
          <i className="fas fa-save" aria-hidden />
          {saving ? 'Saving…' : 'Save all changes'}
        </button>
        <button
          type="button"
          className="sp-profile-reset"
          onClick={resetFormFromProfile}
          disabled={saving}
        >
          <i className="fas fa-undo" aria-hidden />
          Reset
        </button>
      </div>
    </div>
  )
}
