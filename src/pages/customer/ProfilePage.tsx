import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ROUTES } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'
import { updateCustomerProfile } from '@/services/users'
import type { UserProfile } from '@/types'
import '@/styles/bikebuddyCustomerArea.css'
import '@/styles/customerProfileGlass.css'

const CITIES: { value: string; label: string }[] = [
  { value: 'colombo', label: 'Colombo' },
  { value: 'kandy', label: 'Kandy' },
  { value: 'galle', label: 'Galle' },
  { value: 'jaffna', label: 'Jaffna' },
  { value: 'negombo', label: 'Negombo' },
  { value: 'matara', label: 'Matara' },
]

const DISTRICTS: { value: string; label: string }[] = [
  { value: 'colombo', label: 'Colombo' },
  { value: 'gampaha', label: 'Gampaha' },
  { value: 'kalutara', label: 'Kalutara' },
  { value: 'kandy', label: 'Kandy' },
  { value: 'galle', label: 'Galle' },
  { value: 'matara', label: 'Matara' },
]

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function splitDisplayName(full: string) {
  const t = full.trim()
  if (!t) return { first: '', last: '' }
  const i = t.indexOf(' ')
  if (i === -1) return { first: t, last: '' }
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() }
}

function slugFromLocation(loc: string | undefined) {
  if (!loc) return CITIES[0]!.value
  const l = loc.trim().toLowerCase()
  const byLabel = CITIES.find((c) => c.label.toLowerCase() === l)
  if (byLabel) return byLabel.value
  const byValue = CITIES.find((c) => c.value === l)
  return byValue?.value ?? CITIES[0]!.value
}

function slugFromDistrict(d: string | undefined) {
  if (!d) return DISTRICTS[0]!.value
  const l = d.trim().toLowerCase()
  const byLabel = DISTRICTS.find((x) => x.label.toLowerCase() === l)
  if (byLabel) return byLabel.value
  const byValue = DISTRICTS.find((x) => x.value === l)
  return byValue?.value ?? DISTRICTS[0]!.value
}

function labelFromOptions(value: string | undefined, list: { value: string; label: string }[]) {
  if (!value) return ''
  const f = list.find((o) => o.value === value)
  return f?.label ?? value
}

function formValuesFromProfile(profile: UserProfile | null | undefined): FormValues {
  const { first, last } = splitDisplayName(profile?.displayName ?? '')
  return {
    firstName: first,
    lastName: last,
    phone: profile?.phone ?? '',
    dateOfBirth: profile?.dateOfBirth ?? '',
    gender: profile?.gender && ['male', 'female', 'other'].includes(profile.gender) ? profile.gender : 'male',
    city: slugFromLocation(profile?.location),
    district: slugFromDistrict(profile?.district),
    address: profile?.address ?? '',
  }
}

function handleFromName(displayName: string) {
  const t = (displayName || 'biker')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return t ? `@${t}` : '@biker'
}

function formatLocationLine(p: UserProfile | null | undefined) {
  const city = p?.location?.trim() || '—'
  const dist = p?.district?.trim()
  if (dist && dist.toLowerCase() !== city.toLowerCase()) {
    return `${city}, ${dist} · Sri Lanka`
  }
  return city === '—' ? '—' : `${city} · Sri Lanka`
}

function formatFromLabelValues(cityValue: string | undefined, distValue: string | undefined) {
  const city = labelFromOptions(cityValue, CITIES) || '—'
  const dist = labelFromOptions(distValue, DISTRICTS) || '—'
  if (dist !== '—' && city !== '—' && dist.toLowerCase() !== city.toLowerCase()) {
    return `${city}, ${dist} · Sri Lanka`
  }
  if (city === '—') return '—'
  return `${city} · Sri Lanka`
}

export function ProfilePage() {
  const { firebaseUser, profile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const editStartRef = useRef<FormValues | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formValuesFromProfile(null),
  })

  useEffect(() => {
    if (isEditing) return
    form.reset(formValuesFromProfile(profile))
  }, [profile, isEditing, form])

  const email = (profile?.email || firebaseUser?.email || '') as string
  const wFirst = form.watch('firstName')
  const wLast = form.watch('lastName')
  const wPhone = form.watch('phone')
  const wCity = form.watch('city')
  const wDistrict = form.watch('district')
  const fullName = [wFirst, wLast].filter(Boolean).join(' ').trim()
  const displayNameForHeader = fullName || profile?.displayName || 'Biker'
  const phone = profile?.phone?.trim() || '—'
  const locationLine = formatLocationLine(profile)
  const phoneForBadge = isEditing ? wPhone?.trim() || '—' : phone
  const locationForBadge = isEditing
    ? formatFromLabelValues(wCity, wDistrict)
    : locationLine
  const handleLine = handleFromName(fullName || profile?.displayName || 'biker')

  const enterEdit = () => {
    editStartRef.current = form.getValues()
    setIsEditing(true)
  }

  const exitEditDiscard = () => {
    if (editStartRef.current) {
      form.reset(editStartRef.current)
    }
    setIsEditing(false)
  }

  const onToggleHeader = () => {
    if (isEditing) {
      exitEditDiscard()
    } else {
      enterEdit()
    }
  }

  const onCancel = () => {
    if (window.confirm('Discard changes to your profile?')) {
      exitEditDiscard()
      toast.info('Changes discarded')
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!firebaseUser) return
    const displayName = [values.firstName, values.lastName].filter(Boolean).join(' ').trim()
    try {
      await updateCustomerProfile(firebaseUser.uid, {
        displayName: displayName || 'Member',
        phone: values.phone?.trim() || undefined,
        location: labelFromOptions(values.city, CITIES) || undefined,
        district: labelFromOptions(values.district, DISTRICTS) || undefined,
        address: values.address?.trim() || undefined,
        dateOfBirth: values.dateOfBirth?.trim() || undefined,
        gender: values.gender || undefined,
      })
      setIsEditing(false)
      editStartRef.current = null
      toast.success('Profile updated')
    } catch {
      toast.error('Could not update profile')
    }
  })

  return (
    <div className="bbl-cprofile bbl-cprofile--glass">
      <div className="bbl-cpg-gradient" aria-hidden />
      <div className="bbl-cpg-shapes" aria-hidden>
        <div className="bbl-cpg-shape" />
        <div className="bbl-cpg-shape" />
        <div className="bbl-cpg-shape" />
      </div>

      <div className="bbl-cpg-wrap">
        <Link className="bbl-cpg-back" to={ROUTES.dashboard}>
          ← Back to home
        </Link>
        <div className="bbl-cpg-glass">
          <div className="bbl-cpg-header">
            <div className="bbl-cpg-avatar-wrap">
              <div className="bbl-cpg-avatar-ring" aria-hidden>
                <div className="bbl-cpg-avatar" aria-hidden>
                  {'👤'}
                </div>
              </div>
              <button
                type="button"
                className="bbl-cpg-avatar-badge"
                onClick={() => toast.message('Profile photo', { description: 'Photo upload is coming soon.' })}
                title="Change profile picture"
                aria-label="Change profile picture"
              >
                📷
              </button>
            </div>

            <div className="bbl-cpg-info">
              <h1 className="bbl-cpg-name">{displayNameForHeader || 'Rider'}</h1>
              <p className="bbl-cpg-handle">{handleLine}</p>
              <div className="bbl-cpg-badges">
                <span className="bbl-cpg-badge">{'✉️ '}{email || '—'}</span>
                <span className="bbl-cpg-badge">{'📱 '}{phoneForBadge}</span>
                <span className="bbl-cpg-badge">{'📍 '}{locationForBadge}</span>
                <span className="bbl-cpg-badge bbl-cpg-badge--premium">{'⭐ Premium Member'}</span>
              </div>
            </div>
          </div>

          <form className="bbl-cpg-info-card" onSubmit={onSubmit} noValidate>
            <div className="bbl-cpg-card-top">
              <h2 className="bbl-cpg-card-title">{'👤 Personal information'}</h2>
              <button
                type="button"
                className={`bbl-cpg-edit ${isEditing ? 'bbl-cpg-edit--danger' : ''}`}
                onClick={onToggleHeader}
              >
                {isEditing ? '✖️ Cancel edit' : '✏️ Edit'}
              </button>
            </div>

            <p className="bbl-cpg-hint" style={{ marginTop: 0, marginBottom: 20 }}>
              Email is linked to your Firebase sign-in. Other fields are saved to your account.
            </p>

            <div className="bbl-cpg-grid">
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-firstName">
                  First name
                </label>
                <input
                  id="cpg-firstName"
                  className={`bbl-cpg-input ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  disabled={!isEditing}
                  autoComplete="given-name"
                  {...form.register('firstName')}
                />
                {form.formState.errors.firstName && (
                  <p className="bbl-cpg-err">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-lastName">
                  Last name
                </label>
                <input
                  id="cpg-lastName"
                  className={`bbl-cpg-input ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  disabled={!isEditing}
                  autoComplete="family-name"
                  {...form.register('lastName')}
                />
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-email">
                  Email
                </label>
                <input
                  id="cpg-email"
                  className="bbl-cpg-input"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                />
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-phone">
                  Phone
                </label>
                <input
                  id="cpg-phone"
                  className={`bbl-cpg-input ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  type="tel"
                  disabled={!isEditing}
                  autoComplete="tel"
                  {...form.register('phone')}
                />
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-dob">
                  Date of birth
                </label>
                <input
                  id="cpg-dob"
                  className={`bbl-cpg-input ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  type="date"
                  disabled={!isEditing}
                  {...form.register('dateOfBirth')}
                />
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-gender">
                  Gender
                </label>
                <select
                  id="cpg-gender"
                  className={`bbl-cpg-select ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  disabled={!isEditing}
                  {...form.register('gender')}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-city">
                  City
                </label>
                <select
                  id="cpg-city"
                  className={`bbl-cpg-select ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  disabled={!isEditing}
                  {...form.register('city')}
                >
                  {CITIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bbl-cpg-field">
                <label className="bbl-cpg-label" htmlFor="cpg-district">
                  District
                </label>
                <select
                  id="cpg-district"
                  className={`bbl-cpg-select ${isEditing ? 'bbl-cpg--editing' : ''}`}
                  disabled={!isEditing}
                  {...form.register('district')}
                >
                  {DISTRICTS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bbl-cpg-field bbl-cpg-field--full" style={{ marginBottom: 0 }}>
              <label className="bbl-cpg-label" htmlFor="cpg-address">
                Address
              </label>
              <textarea
                id="cpg-address"
                className={`bbl-cpg-textarea ${isEditing ? 'bbl-cpg--editing' : ''}`}
                disabled={!isEditing}
                rows={4}
                {...form.register('address')}
              />
            </div>

            {isEditing && (
              <div className="bbl-cpg-actions">
                <button
                  className="bbl-cpg-btn bbl-cpg-btn--primary"
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? '⏳ Saving…' : '💾 Save changes'}
                </button>
                <button
                  type="button"
                  className="bbl-cpg-btn bbl-cpg-btn--ghost"
                  onClick={onCancel}
                  disabled={form.formState.isSubmitting}
                >
                  {'✖️ Cancel'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      <button
        type="button"
        className="bbl-cpg-fab"
        title="Quick actions"
        aria-label="Quick actions"
        onClick={() => toast.message('Quick actions', { description: 'Shortcuts will appear here in a future update.' })}
      >
        ⚡
      </button>
    </div>
  )
}
