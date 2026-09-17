import { useCallback, useEffect, useState, useRef } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword as updateAuthPassword } from 'firebase/auth'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { updateAdminSettings, updateCustomerProfile } from '@/services/users'
import { describeServiceError, getErrorCode, mapFirebaseAuthError } from '@/utils/firebaseErrors'
import '@/styles/admin-settings.css'

type SettingsTab = 'profile' | 'general' | 'notifications' | 'security' | 'appearance'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: '👤 Profile' },
  { id: 'general', label: '⚙️ General' },
  { id: 'notifications', label: '🔔 Notifications' },
  { id: 'security', label: '🔒 Security' },
  { id: 'appearance', label: '🎨 Appearance' },
]

function ToggleRow({
  on,
  onChange,
  label,
  desc,
  id,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
  id: string
}) {
  return (
    <div className="bb-st-row">
      <div className="bb-st-rinfo">
        <p className="bb-st-rlab" id={`${id}-l`}>
          {label}
        </p>
        <p className="bb-st-rdesc" id={`${id}-d`}>
          {desc}
        </p>
      </div>
      <button
        type="button"
        className="bb-st-toggle"
        id={id}
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-l`}
        aria-describedby={`${id}-d`}
        onClick={() => onChange(!on)}
      />
    </div>
  )
}

function BtnGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { v: T; l: string }[]
}) {
  return (
    <div className="bb-st-btns">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`bb-st-btn ${value === o.v ? 'is-on' : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function AdminSettingsPage() {
  const { profile, firebaseUser } = useAuth()
  const [tab, setTab] = useState<SettingsTab>('profile')
  const fileRef = useRef<HTMLInputElement>(null)
  const syncedUserUid = useRef<string | null>(null)

  const displayName = profile?.displayName?.trim() || firebaseUser?.displayName || 'Admin User'
  const emailFromAuth = profile?.email || firebaseUser?.email || 'admin@bikebuddy.lk'
  const [firstName, setFirstName] = useState('Admin')
  const [lastName, setLastName] = useState('User')
  const [email, setEmail] = useState('admin@bikebuddy.lk')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('Administrator')
  const [department, setDepartment] = useState('Administration')
  const [addr1, setAddr1] = useState('')
  const [addr2, setAddr2] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')

  const [platformName, setPlatformName] = useState('BikeBuddy.lk')
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('asia-colombo')
  const [dateFormat, setDateFormat] = useState<'ddmm' | 'mmdd' | 'iso'>('ddmm')
  const [currency, setCurrency] = useState('lkr')
  const [maxBookings, setMaxBookings] = useState(50)

  const [gen, setGen] = useState({
    autoApprove: false,
    requireVerify: true,
  })

  const [notif, setNotif] = useState({
    newBooking: true,
    newReport: true,
    newUser: true,
    daily: true,
    weekly: false,
    push: true,
    pushCritical: false,
    sound: true,
  })

  const [sec, setSec] = useState({
    twoFa: false,
    sms: false,
    emailAuth: true,
  })
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [conPwd, setConPwd] = useState('')

  const [app, setApp] = useState({
    theme: 'light' as 'light' | 'dark' | 'auto',
    primaryColor: '#64748b',
    sidebar: 'left' as 'left' | 'right',
    compact: false,
    anim: true,
  })
  const [itemsPage, setItemsPage] = useState('50')
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'list'>('table')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  useEffect(() => {
    const currentUid = firebaseUser?.uid || profile?.uid || null
    if (!currentUid) return
    if (syncedUserUid.current === currentUid) return

    const p = displayName.split(/\s+/)
    setFirstName(p[0] || 'Admin')
    setLastName(p.slice(1).join(' ') || 'User')
    setEmail(emailFromAuth)
    setPhone(profile?.phone?.trim() || '')
    setAddr1(profile?.address?.trim() || '')
    setCity(profile?.location?.trim() || '')
    setDistrict(profile?.district?.trim() || '')
    setJobTitle(profile?.adminTier === 'super' ? 'Super Administrator' : 'Administrator')
    const general = profile?.adminSettings?.general
    if (general) {
      if (general.platformName) setPlatformName(general.platformName)
      if (general.language) setLanguage(general.language)
      if (general.timezone) setTimezone(general.timezone)
      if (general.dateFormat) setDateFormat(general.dateFormat)
      if (general.currency) setCurrency(general.currency)
    }
    const shopManagement = profile?.adminSettings?.shopManagement
    if (shopManagement) {
      setGen((g) => ({
        ...g,
        autoApprove: Boolean(shopManagement.autoApprove),
        requireVerify:
          typeof shopManagement.requireVerify === 'boolean' ? shopManagement.requireVerify : g.requireVerify,
      }))
      if (typeof shopManagement.maxBookings === 'number' && Number.isFinite(shopManagement.maxBookings)) {
        setMaxBookings(shopManagement.maxBookings)
      }
    }
    const security = profile?.adminSettings?.security
    if (security) {
      setSec((s) => ({
        ...s,
        twoFa: typeof security.twoFa === 'boolean' ? security.twoFa : s.twoFa,
        sms: typeof security.sms === 'boolean' ? security.sms : s.sms,
        emailAuth: typeof security.emailAuth === 'boolean' ? security.emailAuth : s.emailAuth,
      }))
    }
    const appearance = profile?.adminSettings?.appearance
    if (appearance?.theme === 'light' || appearance?.theme === 'dark' || appearance?.theme === 'auto') {
      setApp((a) => ({ ...a, theme: appearance.theme }))
    }
    if (typeof appearance?.itemsPerPage === 'number' && [10, 25, 50, 100].includes(appearance.itemsPerPage)) {
      setItemsPage(String(appearance.itemsPerPage))
    }
    if (appearance?.viewMode === 'table' || appearance?.viewMode === 'cards' || appearance?.viewMode === 'list') {
      setViewMode(appearance.viewMode)
    }
    syncedUserUid.current = currentUid
  }, [displayName, emailFromAuth, firebaseUser?.uid, profile])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemPrefersDark(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedTheme = window.localStorage.getItem('bb-admin-theme')
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
      setApp((prev) => ({ ...prev, theme: savedTheme }))
    }
    const savedItemsPerPage = Number(window.localStorage.getItem('bb-admin-items-per-page'))
    if (Number.isFinite(savedItemsPerPage) && [10, 25, 50, 100].includes(savedItemsPerPage)) {
      setItemsPage(String(savedItemsPerPage))
    }
    const savedViewMode = window.localStorage.getItem('bb-admin-view-mode')
    if (savedViewMode === 'table' || savedViewMode === 'cards' || savedViewMode === 'list') {
      setViewMode(savedViewMode)
    }
  }, [])

  const save = useCallback(async () => {
    if (!firebaseUser) {
      toast.error('You must be signed in to save settings.')
      return
    }
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() || 'Admin User'
    try {
      await updateCustomerProfile(firebaseUser.uid, {
        displayName: fullName,
        phone: phone.trim() || undefined,
        address: [addr1.trim(), addr2.trim()].filter(Boolean).join(', ') || undefined,
        location: city.trim() || undefined,
        district: district.trim() || undefined,
      })
      await updateAdminSettings(firebaseUser.uid, {
        general: {
          platformName,
          language,
          timezone,
          dateFormat,
          currency,
        },
        shopManagement: {
          autoApprove: gen.autoApprove,
          requireVerify: gen.requireVerify,
          maxBookings: Number.isFinite(maxBookings) ? Math.max(1, maxBookings) : 1,
        },
        security: {
          twoFa: sec.twoFa,
          sms: sec.sms,
          emailAuth: sec.emailAuth,
        },
        appearance: {
          theme: app.theme,
          itemsPerPage: [10, 25, 50, 100].includes(Number(itemsPage)) ? Number(itemsPage) : 50,
          viewMode,
        },
      })
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('bb-admin-theme', app.theme)
        window.localStorage.setItem('bb-admin-items-per-page', String(itemsPage))
        window.localStorage.setItem('bb-admin-view-mode', viewMode)
        window.dispatchEvent(
          new CustomEvent('bb-admin-theme-change', {
            detail: {
              theme: app.theme,
              itemsPerPage: [10, 25, 50, 100].includes(Number(itemsPage)) ? Number(itemsPage) : 50,
              viewMode,
            },
          }),
        )
      }
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error('Could not save settings', { description: describeServiceError(err) })
    }
  }, [
    addr1,
    addr2,
    city,
    currency,
    dateFormat,
    district,
    firebaseUser,
    firstName,
    gen.autoApprove,
    gen.requireVerify,
    language,
    lastName,
    maxBookings,
    phone,
    platformName,
    app.theme,
    itemsPage,
    sec.emailAuth,
    sec.sms,
    sec.twoFa,
    viewMode,
    timezone,
  ])

  const onPhoto = () => fileRef.current?.click()
  const onPhotoPicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (e.target.files?.[0]) toast.message('Photo selected — upload will connect when storage is ready.')
    e.target.value = ''
  }

  const updatePassword = async () => {
    if (!firebaseUser) {
      toast.error('You must be signed in to change password.')
      return
    }
    const current = curPwd.trim()
    const next = newPwd.trim()
    if (!current || !next) {
      toast.error('Enter current and new password.')
      return
    }
    if (next.length < 6) {
      toast.error('Password should be at least 6 characters.')
      return
    }
    if (next !== conPwd.trim()) {
      toast.error('New password and confirmation do not match.')
      return
    }
    if (!firebaseUser.email) {
      toast.error('Your account email is missing. Sign in again and retry.')
      return
    }
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, current)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updateAuthPassword(firebaseUser, next)
      toast.success('Password updated successfully.')
      setCurPwd('')
      setNewPwd('')
      setConPwd('')
    } catch (err) {
      toast.error(mapFirebaseAuthError(getErrorCode(err)))
    }
  }

  const topAv = (firstName[0] || 'A').toUpperCase()
  const pInitials = `${(firstName[0] || 'A').toUpperCase()}${(lastName[0] || 'U').toUpperCase()}`
  const roleLabel = profile?.adminTier === 'super' ? 'Super administrator' : 'Administrator'
  const resolvedTheme = app.theme === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : app.theme

  return (
    <div className={`bb-st ${resolvedTheme === 'dark' ? 'bb-st-dark' : ''}`}>
      <div className="bb-st-top">
        <h1 className="bb-st-title">Settings &amp; configuration</h1>
        <div className="bb-st-top-r">
          <button type="button" className="bb-st-save" onClick={save}>
            <span>💾</span>
            <span>Save changes</span>
          </button>
          <div className="bb-st-av" aria-hidden>
            {topAv}
          </div>
        </div>
      </div>

      <nav className="bb-st-nav" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'profile' && (
        <>
          <div className="bb-st-card">
            <div className="bb-st-phead">
              <div className="bb-st-pav" aria-hidden>
                {pInitials}
              </div>
              <div className="bb-st-pmeta">
                <h2 className="bb-st-pname">
                  {firstName} {lastName}
                </h2>
                <p className="bb-st-prole">{roleLabel}</p>
                <div className="bb-st-pact">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onPhotoPicked}
                  />
                  <button type="button" className="bb-st-btn is-on" onClick={onPhoto}>
                    Change photo
                  </button>
                  <button
                    type="button"
                    className="bb-st-btn"
                    onClick={() => toast.message('Profile photo removed (preview).')}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            </div>

            <div className="bb-st-fgrid">
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-fn">
                  First name
                </label>
                <input
                  id="st-fn"
                  className="bb-st-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-ln">
                  Last name
                </label>
                <input
                  id="st-ln"
                  className="bb-st-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-em">
                  Email
                </label>
                <input
                  id="st-em"
                  className="bb-st-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-ph">
                  Phone
                </label>
                <input
                  id="st-ph"
                  className="bb-st-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-job">
                  Job title
                </label>
                <input
                  id="st-job"
                  className="bb-st-input"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-dept">
                  Department
                </label>
                <select
                  id="st-dept"
                  className="bb-st-sel"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option>Administration</option>
                  <option>Operations</option>
                  <option>Support</option>
                  <option>Development</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Address information</h3>
            <p className="bb-st-sec-sub">Update your location and contact details</p>
            <div className="bb-st-fgrid">
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-a1">
                  Address line 1
                </label>
                <input
                  id="st-a1"
                  className="bb-st-input"
                  value={addr1}
                  onChange={(e) => setAddr1(e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-a2">
                  Address line 2
                </label>
                <input
                  id="st-a2"
                  className="bb-st-input"
                  value={addr2}
                  onChange={(e) => setAddr2(e.target.value)}
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-city">
                  City
                </label>
                <input
                  id="st-city"
                  className="bb-st-input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-dis">
                  District
                </label>
                <select
                  id="st-dis"
                  className="bb-st-sel"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option>Colombo</option>
                  <option>Gampaha</option>
                  <option>Kalutara</option>
                  <option>Kandy</option>
                  <option>Matale</option>
                  <option>Nuwara Eliya</option>
                  <option>Galle</option>
                  <option>Matara</option>
                  <option>Hambantota</option>
                  <option>Jaffna</option>
                  <option>Kilinochchi</option>
                  <option>Mannar</option>
                  <option>Mullaitivu</option>
                  <option>Vavuniya</option>
                  <option>Puttalam</option>
                  <option>Kurunegala</option>
                  <option>Anuradhapura</option>
                  <option>Polonnaruwa</option>
                  <option>Badulla</option>
                  <option>Monaragala</option>
                  <option>Ratnapura</option>
                  <option>Kegalle</option>
                  <option>Ampara</option>
                  <option>Batticaloa</option>
                  <option>Trincomalee</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'general' && (
        <>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Platform settings</h3>
            <p className="bb-st-sec-sub">Configure general platform behavior and preferences</p>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Platform name</p>
                <p className="bb-st-rdesc">Display name for the platform</p>
              </div>
              <input
                className="bb-st-input"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                aria-label="Platform name"
              />
            </div>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Default language</p>
                <p className="bb-st-rdesc">Primary language for the platform</p>
              </div>
              <select
                className="bb-st-sel"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Language"
              >
                <option value="en">English</option>
                <option value="si">Sinhala</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Timezone</p>
                <p className="bb-st-rdesc">Set your local timezone</p>
              </div>
              <select
                className="bb-st-sel"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-label="Timezone"
              >
                <option value="asia-colombo">Asia/Colombo (UTC+5:30)</option>
                <option value="asia-dubai">Asia/Dubai (UTC+4:00)</option>
                <option value="asia-sg">Asia/Singapore (UTC+8:00)</option>
              </select>
            </div>
            <div className="bb-st-row" style={{ alignItems: 'flex-start' }}>
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Date format</p>
                <p className="bb-st-rdesc">How dates are displayed</p>
              </div>
              <BtnGroup
                value={dateFormat}
                onChange={setDateFormat}
                options={[
                  { v: 'ddmm' as const, l: 'DD/MM/YYYY' },
                  { v: 'mmdd' as const, l: 'MM/DD/YYYY' },
                  { v: 'iso' as const, l: 'YYYY-MM-DD' },
                ]}
              />
            </div>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Currency</p>
                <p className="bb-st-rdesc">Default currency for transactions</p>
              </div>
              <select
                className="bb-st-sel"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Currency"
              >
                <option value="lkr">LKR — Sri Lankan rupee</option>
                <option value="usd">USD — US dollar</option>
                <option value="eur">EUR — Euro</option>
              </select>
            </div>
          </div>

          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Shop management</h3>
            <p className="bb-st-sec-sub">Configure shop-related settings</p>
            <ToggleRow
              id="st-sa"
              on={gen.autoApprove}
              onChange={(v) => setGen((g) => ({ ...g, autoApprove: v }))}
              label="Auto-approve new shops"
              desc="Automatically verify new shop registrations"
            />
            <ToggleRow
              id="st-rv"
              on={gen.requireVerify}
              onChange={(v) => setGen((g) => ({ ...g, requireVerify: v }))}
              label="Require shop verification"
              desc="Shops must be verified before going live"
            />
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Maximum bookings per shop</p>
                <p className="bb-st-rdesc">Daily booking limit per shop</p>
              </div>
              <input
                className="bb-st-input"
                type="number"
                min={10}
                max={200}
                value={maxBookings}
                onChange={(e) => setMaxBookings(Number(e.target.value) || 0)}
                style={{ maxWidth: 120 }}
                aria-label="Max bookings"
              />
            </div>
          </div>
        </>
      )}

      {tab === 'notifications' && (
        <>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Email notifications</h3>
            <p className="bb-st-sec-sub">Manage email notification preferences</p>
            <ToggleRow
              id="n1"
              on={notif.newBooking}
              onChange={(v) => setNotif((n) => ({ ...n, newBooking: v }))}
              label="New booking alerts"
              desc="Receive email when new bookings are made"
            />
            <ToggleRow
              id="n2"
              on={notif.newReport}
              onChange={(v) => setNotif((n) => ({ ...n, newReport: v }))}
              label="New report alerts"
              desc="Get notified about new complaints and reports"
            />
            <ToggleRow
              id="n3"
              on={notif.newUser}
              onChange={(v) => setNotif((n) => ({ ...n, newUser: v }))}
              label="New user registrations"
              desc="Email alerts for new user signups"
            />
            <ToggleRow
              id="n4"
              on={notif.daily}
              onChange={(v) => setNotif((n) => ({ ...n, daily: v }))}
              label="Daily summary report"
              desc="Receive daily activity summary"
            />
            <ToggleRow
              id="n5"
              on={notif.weekly}
              onChange={(v) => setNotif((n) => ({ ...n, weekly: v }))}
              label="Weekly analytics report"
              desc="Weekly performance and analytics digest"
            />
          </div>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Push notifications</h3>
            <p className="bb-st-sec-sub">Configure browser push notifications</p>
            <ToggleRow
              id="n6"
              on={notif.push}
              onChange={(v) => setNotif((n) => ({ ...n, push: v }))}
              label="Enable push notifications"
              desc="Allow browser notifications"
            />
            <ToggleRow
              id="n7"
              on={notif.pushCritical}
              onChange={(v) => setNotif((n) => ({ ...n, pushCritical: v }))}
              label="Critical alerts only"
              desc="Only show urgent notifications"
            />
            <ToggleRow
              id="n8"
              on={notif.sound}
              onChange={(v) => setNotif((n) => ({ ...n, sound: v }))}
              label="Sound effects"
              desc="Play sound for new notifications"
            />
          </div>
        </>
      )}

      {tab === 'security' && (
        <>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Password &amp; authentication</h3>
            <p className="bb-st-sec-sub">Manage your password and login security</p>
            <div className="bb-st-fgrid">
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-cp">
                  Current password
                </label>
                <input
                  id="st-cp"
                  className="bb-st-input"
                  type="password"
                  value={curPwd}
                  onChange={(e) => setCurPwd(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="bb-st-fg bb-st-fg-spacer" aria-hidden>
                <span className="bb-st-flab">&nbsp;</span>
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-np">
                  New password
                </label>
                <input
                  id="st-np"
                  className="bb-st-input"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="bb-st-fg">
                <label className="bb-st-flab" htmlFor="st-cf">
                  Confirm password
                </label>
                <input
                  id="st-cf"
                  className="bb-st-input"
                  type="password"
                  value={conPwd}
                  onChange={(e) => setConPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="bb-st-btns" style={{ marginTop: 8 }}>
              <button type="button" className="bb-st-btn is-on" onClick={updatePassword}>
                Update password
              </button>
              <button
                type="button"
                className="bb-st-btn"
                onClick={() => {
                  setCurPwd('')
                  setNewPwd('')
                  setConPwd('')
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'appearance' && (
        <>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Theme settings</h3>
            <p className="bb-st-sec-sub">Customize the look and feel of the dashboard</p>
            <div className="bb-st-row" style={{ alignItems: 'flex-start' }}>
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Theme mode</p>
                <p className="bb-st-rdesc">Choose your preferred color scheme</p>
              </div>
              <BtnGroup
                value={app.theme}
                onChange={(v) => setApp((a) => ({ ...a, theme: v }))}
                options={[
                  { v: 'light' as const, l: 'Light' },
                  { v: 'dark' as const, l: 'Dark' },
                  { v: 'auto' as const, l: 'Auto' },
                ]}
              />
            </div>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Primary color</p>
                <p className="bb-st-rdesc">Main accent color for the interface</p>
              </div>
              <div className="bb-st-color">
                <input
                  type="color"
                  value={app.primaryColor}
                  onChange={(e) => setApp((a) => ({ ...a, primaryColor: e.target.value }))}
                  aria-label="Primary color"
                />
                <code>{app.primaryColor}</code>
              </div>
            </div>
            <div className="bb-st-row" style={{ alignItems: 'flex-start' }}>
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Sidebar position</p>
                <p className="bb-st-rdesc">Choose sidebar placement</p>
              </div>
              <BtnGroup
                value={app.sidebar}
                onChange={(v) => setApp((a) => ({ ...a, sidebar: v }))}
                options={[
                  { v: 'left' as const, l: 'Left' },
                  { v: 'right' as const, l: 'Right' },
                ]}
              />
            </div>
            <ToggleRow
              id="a1"
              on={app.compact}
              onChange={(v) => setApp((a) => ({ ...a, compact: v }))}
              label="Compact mode"
              desc="Reduce spacing for more content"
            />
            <ToggleRow
              id="a2"
              on={app.anim}
              onChange={(v) => setApp((a) => ({ ...a, anim: v }))}
              label="Animations"
              desc="Enable interface animations and transitions"
            />
          </div>
          <div className="bb-st-card">
            <h3 className="bb-st-sec-title">Display settings</h3>
            <p className="bb-st-sec-sub">Configure how data is displayed</p>
            <div className="bb-st-row">
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Items per page</p>
                <p className="bb-st-rdesc">Number of items shown in lists</p>
              </div>
              <select
                className="bb-st-sel"
                value={itemsPage}
                onChange={(e) => setItemsPage(e.target.value)}
                aria-label="Items per page"
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
            <div className="bb-st-row" style={{ alignItems: 'flex-start' }}>
              <div className="bb-st-rinfo">
                <p className="bb-st-rlab">Default view mode</p>
                <p className="bb-st-rdesc">Preferred layout for data</p>
              </div>
              <BtnGroup
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { v: 'table' as const, l: 'Table' },
                  { v: 'cards' as const, l: 'Cards' },
                  { v: 'list' as const, l: 'List' },
                ]}
              />
            </div>
          </div>
        </>
      )}

    </div>
  )
}
