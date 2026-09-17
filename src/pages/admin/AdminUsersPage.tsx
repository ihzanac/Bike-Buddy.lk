import { zodResolver } from '@hookform/resolvers/zod'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { UserProfile } from '@/types'
import type { AdminPlatformUser, PlatformUserRole, PlatformUserStatus } from '@/types/platformUser'
import { useAuth } from '@/hooks/useAuth'
import { useAdminHeaderSearch } from '@/hooks/useAdminHeaderSearch'
import { isFirebaseConfigured } from '@/services/firebase'
import { adminProvisionCustomer } from '@/services/auth'
import {
  adminDeleteUserDocument,
  getUserProfileByIdForAdmin,
  listAllUsersForAdmin,
  updateCustomerProfile,
  updateOwnerShopProfile,
  updateOwnerStatus,
} from '@/services/users'
import { rowMatchesAdminQuery } from '@/utils/adminSearch'
import { createdAtMs } from '@/utils/shopDashboardMetrics'
import { getErrorCode, mapFirebaseAuthError, mapServiceError } from '@/utils/firebaseErrors'
import '@/styles/admin-users.css'

type SortKey = 'newest' | 'name' | 'active'
type DateFilter = 'all' | '7' | '30' | '90'

function roleLabel(r: PlatformUserRole) {
  if (r === 'admin') return '🔐 Admin'
  if (r === 'customer') return '👤 Customer'
  return '🏪 Shop Owner'
}

function statusText(s: PlatformUserStatus) {
  if (s === 'active') return '✓ Active'
  if (s === 'suspended') return '⚠️ Suspended'
  return '⚠️ Inactive'
}

function withinJoinedRange(joined: string, range: DateFilter): boolean {
  if (range === 'all') return true
  if (joined === '—') return false
  const j = new Date(joined).getTime()
  if (Number.isNaN(j)) return false
  const n = Date.now()
  const d = range === '7' ? 7 : range === '30' ? 30 : 90
  return j >= n - d * 24 * 60 * 60 * 1000
}

function ymdFromProfile(ts: unknown): string {
  const ms = createdAtMs(ts)
  if (!ms) return '—'
  return new Date(ms).toISOString().split('T')[0]
}

function profileToAdminUser(p: UserProfile): AdminPlatformUser {
  const display = (p.displayName || '').trim() || '—'
  const bits = display.split(/\s+/).filter(Boolean)
  const firstName = bits[0] || '—'
  const lastName = bits.slice(1).join(' ') || '—'
  const role: PlatformUserRole =
    p.role === 'admin' ? 'admin' : p.role === 'owner' ? 'shop-owner' : 'customer'
  let status: PlatformUserStatus = 'active'
  if (p.role === 'owner') {
    if (p.ownerStatus === 'rejected') status = 'suspended'
    else if (p.ownerStatus === 'pending') status = 'inactive'
    else status = 'active'
  }
  const city =
    (p.location || p.district || p.address || p.shopAddress || '—').toString().trim() || '—'
  const phone = (p.phone || p.whatsapp || '—').toString().trim() || '—'
  return {
    id: p.uid,
    firstName,
    lastName,
    email: (p.email || '—').trim() || '—',
    phone,
    role,
    city,
    status,
    joined: ymdFromProfile(p.createdAt),
    lastActive: ymdFromProfile(p.updatedAt ?? p.createdAt),
    ownerStatus: p.role === 'owner' ? p.ownerStatus : undefined,
  }
}

function computeStats(rows: AdminPlatformUser[]) {
  const total = rows.length
  const active = rows.filter((r) => r.status === 'active').length
  const customers = rows.filter((r) => r.role === 'customer').length
  const shopOwners = rows.filter((r) => r.role === 'shop-owner').length
  const admins = rows.filter((r) => r.role === 'admin').length
  const suspended = rows.filter((r) => r.status === 'suspended').length
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0
  return { total, active, customers, shopOwners, admins, suspended, activePct }
}

function platformUserSearchParts(r: AdminPlatformUser) {
  return [r.firstName, r.lastName, r.email, r.phone, r.city, r.role, r.id] as const
}

const addCustomerSchema = z
  .object({
    displayName: z.string().min(2, "Please enter the customer's name"),
    email: z.string().email(),
    phone: z.string().min(7, 'Enter a valid phone number'),
    location: z.string().min(2, 'Please enter a location'),
    password: z.string().min(6, 'Use at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type AddCustomerFormValues = z.infer<typeof addCustomerSchema>
type ProfileModalMode = 'view' | 'edit'

const fieldErrStyle: CSSProperties = {
  color: '#ef4444',
  fontSize: 13,
  marginTop: -4,
  marginBottom: 6,
  display: 'block',
}

export function AdminUsersPage() {
  const { firebaseUser } = useAuth()
  const adminUid = firebaseUser?.uid ?? ''
  const adminHeaderSearch = useAdminHeaderSearch()
  const [rows, setRows] = useState<AdminPlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  /** True while re-fetching without blanking the list (manual Refresh + after mutations). */
  const [refreshing, setRefreshing] = useState(false)
  const [mutatingUid, setMutatingUid] = useState<string | null>(null)
  const [topQuery, setTopQuery] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [role, setRole] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [modalOpen, setModalOpen] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState<ProfileModalMode | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminPlatformUser | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const pendingListAnchorRef = useRef<HTMLDivElement>(null)

  const addCustomerForm = useForm<AddCustomerFormValues>({
    resolver: zodResolver(addCustomerSchema),
  })

  const stats = useMemo(() => computeStats(rows), [rows])

  const pendingOwnerApprovals = useMemo(() => {
    return rows.filter((r) => r.role === 'shop-owner' && r.ownerStatus === 'pending').length
  }, [rows])

  const reload = useCallback(async (options?: { notify?: boolean; soft?: boolean }) => {
    if (!isFirebaseConfigured) {
      setRows([])
      setLoading(false)
      setRefreshing(false)
      if (options?.notify) {
        toast.error('Firebase is not configured.')
      }
      return
    }

    const soft = Boolean(options?.soft) || Boolean(options?.notify)
    if (soft) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const profiles = await listAllUsersForAdmin()
      setRows(profiles.map(profileToAdminUser))
      if (options?.notify) {
        toast.success('Refreshed')
      }
    } catch (err) {
      console.error(err)
      toast.error(mapServiceError(getErrorCode(err)))
      if (!soft) {
        setRows([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    let list = [...rows]
    const parts = (r: AdminPlatformUser) => platformUserSearchParts(r)
    list = list.filter(
      (r) =>
        rowMatchesAdminQuery(parts(r), adminHeaderSearch) && rowMatchesAdminQuery(parts(r), topQuery),
    )
    const fq = filterSearch.trim().toLowerCase()
    if (fq) {
      list = list.filter(
        (r) =>
          r.firstName.toLowerCase().includes(fq) ||
          r.lastName.toLowerCase().includes(fq) ||
          r.email.toLowerCase().includes(fq),
      )
    }
    if (role !== 'all') list = list.filter((r) => r.role === (role as PlatformUserRole))
    if (status !== 'all') list = list.filter((r) => r.status === (status as PlatformUserStatus))
    if (dateRange !== 'all') {
      list = list.filter((r) => withinJoinedRange(r.joined, dateRange))
    }
    const out = [...list]
    const ts = (d: string) => (d === '—' ? 0 : new Date(d).getTime())
    if (sort === 'name') out.sort((a, b) => a.firstName.localeCompare(b.firstName))
    else if (sort === 'active') out.sort((a, b) => ts(b.lastActive) - ts(a.lastActive))
    else out.sort((a, b) => ts(b.joined) - ts(a.joined))
    return out
  }, [rows, adminHeaderSearch, topQuery, filterSearch, role, status, dateRange, sort])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    addCustomerForm.reset()
  }, [addCustomerForm])

  const closeProfileModal = useCallback(() => {
    setProfileModalMode(null)
    setSelectedUser(null)
    setSelectedProfile(null)
    setProfileLoading(false)
    setProfileSaving(false)
  }, [])

  const openProfileModal = useCallback(
    async (u: AdminPlatformUser, mode: ProfileModalMode) => {
      setSelectedUser(u)
      setProfileModalMode(mode)
      setProfileLoading(true)
      try {
        const profile = await getUserProfileByIdForAdmin(u.id)
        setSelectedProfile(profile)
        const displayName = (profile?.displayName || `${u.firstName} ${u.lastName}`).trim()
        setEditDisplayName(displayName)
        setEditPhone((profile?.phone || '').trim())
        setEditLocation((profile?.location || profile?.district || '').trim())
        setEditDistrict((profile?.district || '').trim())
      } catch (err) {
        console.error(err)
        toast.error(mapServiceError(getErrorCode(err)))
      } finally {
        setProfileLoading(false)
      }
    },
    [],
  )

  const saveProfileEdits = useCallback(async () => {
    if (!selectedUser) return
    const displayName = editDisplayName.trim()
    if (displayName.length < 2) {
      toast.error('Please enter a valid name.')
      return
    }
    setProfileSaving(true)
    try {
      if (selectedUser.role === 'shop-owner') {
        await updateOwnerShopProfile(selectedUser.id, {
          displayName,
          phone: editPhone,
          location: editLocation,
          district: editDistrict,
        })
      } else {
        await updateCustomerProfile(selectedUser.id, {
          displayName,
          phone: editPhone,
          location: editLocation,
          district: editDistrict,
        })
      }
      toast.success('User profile updated.')
      closeProfileModal()
      await reload({ soft: true })
    } catch (err) {
      console.error(err)
      toast.error(mapServiceError(getErrorCode(err)))
    } finally {
      setProfileSaving(false)
    }
  }, [
    closeProfileModal,
    editDisplayName,
    editDistrict,
    editLocation,
    editPhone,
    reload,
    selectedUser,
  ])

  const openAddModal = useCallback(() => {
    addCustomerForm.reset()
    setModalOpen(true)
  }, [addCustomerForm])

  const onCreateCustomer = addCustomerForm.handleSubmit(async (values) => {
    if (!isFirebaseConfigured) {
      toast.error('Firebase is not configured.')
      return
    }
    try {
      await adminProvisionCustomer({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        phone: values.phone.trim(),
        location: values.location.trim(),
      })
      toast.success('Customer account created')
      closeModal()
      await reload({ soft: true })
    } catch (err) {
      console.error(err)
      const code = getErrorCode(err)
      toast.error(
        code?.startsWith('auth/') ? mapFirebaseAuthError(code) : mapServiceError(code),
      )
    }
  })

  const applyFilters = useCallback(() => {
    toast.success('Filters applied')
  }, [])

  const exportCsv = useCallback(() => {
    const h = 'firstName,lastName,email,phone,role,city,status,joined,lastActive,uid'
    const lines = filtered.map(
      (r) =>
        `"${r.firstName.replace(/"/g, '""')}","${r.lastName.replace(/"/g, '""')}",${r.email},${r.phone},${r.role},${r.city},${r.status},${r.joined},${r.lastActive},${r.id}`,
    )
    const blob = new Blob([[h, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'users.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Export started')
  }, [filtered])

  const remove = useCallback(
    async (u: AdminPlatformUser) => {
      if (!isFirebaseConfigured) {
        toast.error('Firebase is not configured.')
        return
      }
      if (u.id === adminUid) {
        toast.error('You cannot delete your own account.')
        return
      }
      if (!window.confirm(`Delete Firestore profile for “${u.firstName} ${u.lastName}”?\n\nUID: ${u.id}\n\nThis removes the users document only.`)) {
        return
      }
      setMutatingUid(u.id)
      try {
        await adminDeleteUserDocument(u.id)
        toast.success(`Removed ${u.firstName} ${u.lastName} from users.`)
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error(mapServiceError(getErrorCode(err)))
      } finally {
        setMutatingUid(null)
      }
    },
    [adminUid, reload],
  )

  const approve = useCallback(
    async (u: AdminPlatformUser) => {
      if (u.role !== 'shop-owner' || u.ownerStatus !== 'pending') return
      if (
        !window.confirm(
          `Approve “${u.firstName} ${u.lastName}” as a shop owner? They will appear as an approved shop for bookings and listings.`,
        )
      ) {
        return
      }
      setMutatingUid(u.id)
      try {
        await updateOwnerStatus(u.id, 'approved')
        toast.success('Shop owner approved.')
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error(mapServiceError(getErrorCode(err)))
      } finally {
        setMutatingUid(null)
      }
    },
    [reload],
  )

  const suspend = useCallback(
    async (u: AdminPlatformUser) => {
      if (u.role !== 'shop-owner') {
        toast.message('Suspend applies to shop owners only — set owner status to rejected.')
        return
      }
      if (u.ownerStatus === 'rejected' || u.status === 'suspended') return
      if (
        !window.confirm(
          `Set owner status to rejected for “${u.firstName} ${u.lastName}”? They will no longer appear as an approved shop.`,
        )
      ) {
        return
      }
      setMutatingUid(u.id)
      try {
        await updateOwnerStatus(u.id, 'rejected')
        toast.success('Owner status updated.')
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error(mapServiceError(getErrorCode(err)))
      } finally {
        setMutatingUid(null)
      }
    },
    [reload],
  )

  const onBellShowPending = useCallback(() => {
    setRole('shop-owner')
    setStatus('inactive')
    setDateRange('all')
    setFilterSearch('')
    setTopQuery('')
    if (pendingOwnerApprovals > 0) {
      toast.success(`${pendingOwnerApprovals} pending — use Approve or Suspend on each card.`)
    }
    requestAnimationFrame(() => {
      pendingListAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [pendingOwnerApprovals])

  return (
    <div className="bb-admin-users">
      <header className="au-hd">
        <div className="au-hl">
          <h1 className="au-ht">Users Management</h1>
          <div className="au-search">
            <span className="au-si" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder="Search users, emails, roles…"
              value={topQuery}
              onChange={(e) => setTopQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
        </div>
        <div className="au-hr">
          <button
            type="button"
            className={`au-add${refreshing ? ' au-add--refreshing' : ''}`}
            onClick={() => void reload({ notify: true })}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing users' : 'Refresh user list'}
          >
            <span className={refreshing ? 'au-refresh-icon' : undefined} aria-hidden>
              ↻
            </span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="au-add" onClick={openAddModal}>
            <span>➕</span> Add User
          </button>
          <button
            type="button"
            className="au-bell"
            onClick={onBellShowPending}
            aria-label="Show pending shop owner approvals in the list below"
          >
            🔔
            <span className="au-bb" aria-hidden>
              {pendingOwnerApprovals > 99 ? '99+' : pendingOwnerApprovals}
            </span>
          </button>
        </div>
      </header>

      <div className="au-hero">
        <div className="au-hero-in">
          <h2 className="au-ht2">
            <span aria-hidden>👥</span> Users Management
          </h2>
          <p className="au-hsub">
            Manage all platform users, track activity, assign roles and permissions, monitor
            engagement, and ensure secure access control.
          </p>
        </div>
      </div>

      <div className="au-stats">
        <div className="au-st">
          <div className="au-ic2 tl" aria-hidden>
            👥
          </div>
          <div className="au-snum">{stats.total}</div>
          <div className="au-slbl">Total Users</div>
          <div className="au-str">
            <span>●</span> Live from Firestore
          </div>
        </div>
        <div className="au-st">
          <div className="au-ic2 em" aria-hidden>
            ✓
          </div>
          <div className="au-snum">{stats.active}</div>
          <div className="au-slbl">Active Users</div>
          <div className="au-str">
            <span>●</span> {stats.total > 0 ? `${stats.activePct}% active` : '—'}
          </div>
        </div>
        <div className="au-st">
          <div className="au-ic2 cy" aria-hidden>
            👤
          </div>
          <div className="au-snum">{stats.customers}</div>
          <div className="au-slbl">Customers</div>
          <div className="au-str">
            <span>●</span> role = customer
          </div>
        </div>
        <div className="au-st">
          <div className="au-ic2 am" aria-hidden>
            🏪
          </div>
          <div className="au-snum">{stats.shopOwners}</div>
          <div className="au-slbl">Shop Owners</div>
          <div className="au-str">
            <span>●</span> role = owner
          </div>
        </div>
        <div className="au-st">
          <div className="au-ic2 bl" aria-hidden>
            🔐
          </div>
          <div className="au-snum">{stats.admins}</div>
          <div className="au-slbl">Administrators</div>
          <div className="au-str n">
            <span>●</span> role = admin
          </div>
        </div>
        <div className="au-st">
          <div className="au-ic2 ro" aria-hidden>
            ⚠️
          </div>
          <div className="au-snum">{stats.suspended}</div>
          <div className="au-slbl">Rejected owners</div>
          <div className="au-str n">
            <span>●</span> ownerStatus rejected
          </div>
        </div>
      </div>

      <div className="au-sec">
        <div className="au-sh">
          <h2 className="au-sti">All Platform Users</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="au-bt au-b2" onClick={exportCsv} disabled={!rows.length}>
              <span>📥</span> Export Data
            </button>
            <button type="button" className="au-bt au-b1" onClick={openAddModal}>
              <span>➕</span> Add New User
            </button>
          </div>
        </div>

        <div className="au-fil">
          <div className="au-fg">
            <span className="au-fl">🔍 Search</span>
            <input
              className="au-fi"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Name or email…"
            />
          </div>
          <div className="au-fg">
            <span className="au-fl">👤 User Role</span>
            <select className="au-fs" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="customer">Customer</option>
              <option value="shop-owner">Shop Owner</option>
            </select>
          </div>
          <div className="au-fg">
            <span className="au-fl">⚡ Status</span>
            <select className="au-fs" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="au-fg">
            <span className="au-fl">📅 Joined</span>
            <select
              className="au-fs"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateFilter)}
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
          <div className="au-fg">
            <span className="au-fl">📊 Sort</span>
            <select className="au-fs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="newest">Newest First</option>
              <option value="name">Name A–Z</option>
              <option value="active">Most Active</option>
            </select>
          </div>
          <div className="au-fg" style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="au-bt au-b1" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>

        <div className="au-grid" ref={pendingListAnchorRef}>
          {!isFirebaseConfigured ? (
            <div className="au-empty">
              <div className="au-ei" aria-hidden>
                👥
              </div>
              <div className="au-et">Firebase not configured</div>
              <p className="au-ep">
                Set <code style={{ fontSize: '0.9em' }}>VITE_FIREBASE_*</code> in{' '}
                <code style={{ fontSize: '0.9em' }}>.env</code> to load users from Firestore.
              </p>
            </div>
          ) : loading ? (
            <div className="au-empty">
              <div className="au-ei" aria-hidden>
                ⏳
              </div>
              <div className="au-et">Loading users…</div>
              <p className="au-ep">Reading the users collection</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="au-empty">
              <div className="au-ei" aria-hidden>
                👥
              </div>
              <div className="au-et">
                {role === 'shop-owner' && status === 'inactive'
                  ? 'No shop owners awaiting approval'
                  : 'No Users Found'}
              </div>
              <p className="au-ep">
                {role === 'shop-owner' && status === 'inactive'
                  ? 'New shop registrations with “pending” status will show here. If someone is missing, clear the admin header search or widen filters.'
                  : 'Try adjusting filters or clear the Admin header search'}
              </p>
            </div>
          ) : (
            filtered.map((u) => {
              const initials = `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase()
              const busy = mutatingUid === u.id
              return (
                <div key={u.id} className="au-card">
                  <div className="au-uh">
                    <div className="au-ava" aria-hidden>
                      {initials}
                    </div>
                    <div className="au-un">
                      {u.firstName} {u.lastName}
                    </div>
                    <p className="au-ue">{u.email}</p>
                  </div>
                  <div className="au-ub">
                    <div className="au-igrid">
                      <div className="au-ir">
                        <span className="au-ilb">UID</span>
                        <span className="au-iv" style={{ wordBreak: 'break-all', fontSize: 12 }}>
                          {u.id}
                        </span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">Phone</span>
                        <span className="au-iv">{u.phone}</span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">City</span>
                        <span className="au-iv">{u.city}</span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">Role</span>
                        <span className={`au-ur ${u.role}`}>{roleLabel(u.role)}</span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">Status</span>
                        <span className={`au-us ${u.status}`}>{statusText(u.status)}</span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">Joined</span>
                        <span className="au-iv">
                          {u.joined === '—' ? '—' : new Date(u.joined).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="au-ir">
                        <span className="au-ilb">Last Active</span>
                        <span className="au-iv">
                          {u.lastActive === '—' ? '—' : new Date(u.lastActive).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="au-act">
                      <button
                        type="button"
                        className="au-bt au-bv"
                        onClick={() => void openProfileModal(u, 'view')}
                      >
                        👁 View
                      </button>
                      <button
                        type="button"
                        className="au-bt au-be"
                        onClick={() => void openProfileModal(u, 'edit')}
                      >
                        ✏️ Edit
                      </button>
                      {u.role === 'shop-owner' && u.ownerStatus === 'pending' ? (
                        <button
                          type="button"
                          className="au-bt au-b1"
                          disabled={busy}
                          onClick={() => void approve(u)}
                        >
                          ✓ Approve
                        </button>
                      ) : null}
                      {u.role === 'shop-owner' && u.ownerStatus !== 'rejected' ? (
                        <button
                          type="button"
                          className="au-bt au-bs"
                          disabled={busy}
                          onClick={() => void suspend(u)}
                        >
                          ⚠️ Suspend
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="au-bt au-bd"
                        disabled={busy}
                        onClick={() => void remove(u)}
                      >
                        {busy ? '…' : '🗑 Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="au-md-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="au-mtitle"
          onClick={closeModal}
        >
          <div className="au-md" onClick={(e) => e.stopPropagation()}>
            <div className="au-mh">
              <h2 className="au-mt" id="au-mtitle">
                <span>➕</span> Add New User
              </h2>
              <button type="button" className="au-x" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 15, lineHeight: 1.5 }}>
              Creates a <strong>customer</strong> account (same as public registration): Firebase Auth user plus a{' '}
              <code style={{ fontSize: '0.9em' }}>users</code> profile. Shop owners should still use Add Parts Shop /
              Add Sale Shop / service shop flows.
            </p>
            <form onSubmit={onCreateCustomer} noValidate>
              <div className="au-fg2">
                <div className="au-ffg full">
                  <span className="lab">Full name</span>
                  <input
                    className="inp"
                    type="text"
                    autoComplete="name"
                    placeholder="Full name"
                    {...addCustomerForm.register('displayName')}
                  />
                  {addCustomerForm.formState.errors.displayName ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.displayName.message}
                    </span>
                  ) : null}
                </div>
                <div className="au-ffg full">
                  <span className="lab">Email</span>
                  <input
                    className="inp"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    {...addCustomerForm.register('email')}
                  />
                  {addCustomerForm.formState.errors.email ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.email.message}
                    </span>
                  ) : null}
                </div>
                <div className="au-ffg">
                  <span className="lab">Phone</span>
                  <input
                    className="inp"
                    type="text"
                    autoComplete="tel"
                    placeholder="Phone number"
                    {...addCustomerForm.register('phone')}
                  />
                  {addCustomerForm.formState.errors.phone ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.phone.message}
                    </span>
                  ) : null}
                </div>
                <div className="au-ffg">
                  <span className="lab">Location</span>
                  <input
                    className="inp"
                    type="text"
                    autoComplete="address-line2"
                    placeholder="e.g. Batticaloa"
                    {...addCustomerForm.register('location')}
                  />
                  {addCustomerForm.formState.errors.location ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.location.message}
                    </span>
                  ) : null}
                </div>
                <div className="au-ffg full">
                  <span className="lab">Password</span>
                  <input
                    className="inp"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Password"
                    {...addCustomerForm.register('password')}
                  />
                  {addCustomerForm.formState.errors.password ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.password.message}
                    </span>
                  ) : null}
                </div>
                <div className="au-ffg full">
                  <span className="lab">Confirm password</span>
                  <input
                    className="inp"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    {...addCustomerForm.register('confirmPassword')}
                  />
                  {addCustomerForm.formState.errors.confirmPassword ? (
                    <span role="alert" style={fieldErrStyle}>
                      {addCustomerForm.formState.errors.confirmPassword.message}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="au-mf">
                <button type="button" className="au-bt au-b2" onClick={closeModal}>
                  Close
                </button>
                <button type="submit" className="au-bt au-b1" disabled={addCustomerForm.formState.isSubmitting}>
                  {addCustomerForm.formState.isSubmitting ? 'Creating…' : 'Create customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {profileModalMode && selectedUser ? (
        <div className="au-md-bg" role="dialog" aria-modal="true" onClick={closeProfileModal}>
          <div className="au-md" onClick={(e) => e.stopPropagation()}>
            <div className="au-mh">
              <h2 className="au-mt">
                {profileModalMode === 'view' ? '👁 User Details' : '✏️ Edit User'}
              </h2>
              <button type="button" className="au-x" onClick={closeProfileModal} aria-label="Close">
                ×
              </button>
            </div>
            {profileLoading ? (
              <p style={{ margin: 0, color: '#64748b' }}>Loading user profile…</p>
            ) : profileModalMode === 'view' ? (
              <div className="au-igrid" style={{ marginTop: 8 }}>
                <div className="au-ir">
                  <span className="au-ilb">Name</span>
                  <span className="au-iv">
                    {selectedProfile?.displayName || `${selectedUser.firstName} ${selectedUser.lastName}`}
                  </span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">Email</span>
                  <span className="au-iv">{selectedProfile?.email || selectedUser.email}</span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">Phone</span>
                  <span className="au-iv">{selectedProfile?.phone || selectedUser.phone || '—'}</span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">Role</span>
                  <span className="au-iv">{roleLabel(selectedUser.role)}</span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">Status</span>
                  <span className="au-iv">{statusText(selectedUser.status)}</span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">Location</span>
                  <span className="au-iv">
                    {selectedProfile?.location || selectedProfile?.district || selectedUser.city || '—'}
                  </span>
                </div>
                <div className="au-ir">
                  <span className="au-ilb">UID</span>
                  <span className="au-iv" style={{ wordBreak: 'break-all' }}>
                    {selectedUser.id}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="au-ffg full">
                  <span className="lab">Full name</span>
                  <input
                    className="inp"
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="au-ffg full">
                  <span className="lab">Phone</span>
                  <input
                    className="inp"
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div className="au-ffg full">
                  <span className="lab">Location</span>
                  <input
                    className="inp"
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Location"
                  />
                </div>
                <div className="au-ffg full">
                  <span className="lab">District</span>
                  <input
                    className="inp"
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    placeholder="District"
                  />
                </div>
                <div className="au-mf" style={{ marginTop: 0 }}>
                  <button type="button" className="au-bt au-b2" onClick={closeProfileModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="au-bt au-b1"
                    disabled={profileSaving}
                    onClick={() => void saveProfileEdits()}
                  >
                    {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
