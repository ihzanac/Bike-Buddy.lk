import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useAdminHeaderSearch } from '@/hooks/useAdminHeaderSearch'
import { formatTotalRevenueLkr } from '@/data/serviceShopsSample'
import type { ServiceShop, ServiceShopStatus } from '@/types/serviceShop'
import { isFirebaseConfigured } from '@/services/firebase'
import { loadAdminServiceShopsFromFirestore } from '@/services/adminServiceShops'
import { adminProvisionServiceShopOwner } from '@/services/auth'
import {
  adminDeleteUserDocument,
  getUserProfileByIdForAdmin,
  updateOwnerShopProfile,
  updateOwnerStatus,
} from '@/services/users'
import { getErrorCode, mapFirebaseAuthError, mapServiceError } from '@/utils/firebaseErrors'
import { rowMatchesAdminQuery } from '@/utils/adminSearch'
import { SRI_LANKA_DISTRICTS } from '@/utils/sriLankaDistricts'
import '@/styles/admin-service-shops.css'

type SortKey = 'newest' | 'name' | 'rating' | 'services'

type ShopDetailModal = { mode: 'view' | 'edit'; shop: ServiceShop }

type OwnerEditDraft = {
  shopName: string
  displayName: string
  phone: string
  whatsapp: string
  shopAddress: string
  location: string
  district: string
  website: string
  shopDescription: string
}

function statusLabel(s: ServiceShopStatus): string {
  if (s === 'active') return '✓ Active'
  if (s === 'pending') return '⏳ Pending'
  return '⚠️ Inactive'
}

function computeStats(list: ServiceShop[]) {
  const total = list.length
  const active = list.filter((s) => s.status === 'active').length
  const pending = list.filter((s) => s.status === 'pending').length
  const totalServices = list.reduce((a, s) => a + s.services, 0)
  const withRating = list.filter((s) => s.rating > 0)
  const avgRating =
    withRating.length > 0
      ? (withRating.reduce((a, s) => a + s.rating, 0) / withRating.length).toFixed(1)
      : '0'
  const revenueK = list.reduce((a, s) => a + s.revenueK, 0)
  const totalRev = formatTotalRevenueLkr(revenueK)
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0
  const monthAgo = Date.now() - 30 * 86400000
  const newLast30 = list.filter((s) => s.joinedMs >= monthAgo).length
  return { total, active, pending, totalServices, avgRating, totalRev, activePct, newLast30 }
}

function serviceShopSearchParts(s: ServiceShop) {
  return [s.name, s.city, s.district, s.owner, s.email, s.id, s.linesLabel, s.address, s.phone] as const
}

export function AdminServiceShopsPage() {
  const { firebaseUser } = useAuth()
  const adminHeaderSearch = useAdminHeaderSearch()
  const adminUid = firebaseUser?.uid ?? ''
  const [shops, setShops] = useState<ServiceShop[]>([])
  const [loading, setLoading] = useState(true)
  /** Re-fetch without blanking the grid (manual Refresh + after saves). */
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [topQuery, setTopQuery] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [district, setDistrict] = useState('all')
  const [status, setStatus] = useState('all')
  const [rating, setRating] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [modalOpen, setModalOpen] = useState(false)
  const [addingShop, setAddingShop] = useState(false)
  const [approvingUid, setApprovingUid] = useState<string | null>(null)
  const [deletingUid, setDeletingUid] = useState<string | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const notifyWrapRef = useRef<HTMLDivElement>(null)
  const [detailModal, setDetailModal] = useState<ShopDetailModal | null>(null)
  const [editDraft, setEditDraft] = useState<OwnerEditDraft | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  const reload = useCallback(async (options?: { notify?: boolean; soft?: boolean }) => {
    if (!isFirebaseConfigured) {
      setLoadError('Firebase is not configured.')
      setShops([])
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

    setLoadError(null)
    try {
      const rows = await loadAdminServiceShopsFromFirestore()
      setShops(rows)
      if (options?.notify) {
        toast.success('Refreshed')
      }
    } catch (e) {
      console.error(e)
      setLoadError('Could not load owners from Firestore.')
      toast.error('Could not load service shops.')
      if (!soft) {
        setShops([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const districtOptions = useMemo(() => {
    const u = new Set<string>(SRI_LANKA_DISTRICTS)
    for (const s of shops) {
      if (s.district && s.district !== '—') u.add(s.district)
    }
    return [...u].sort((a, b) => a.localeCompare(b))
  }, [shops])

  const stats = useMemo(() => computeStats(shops), [shops])
  const pendingShops = useMemo(() => shops.filter((s) => s.status === 'pending'), [shops])
  const pendingInboxCount = pendingShops.length

  useEffect(() => {
    if (!notifyOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (notifyWrapRef.current && !notifyWrapRef.current.contains(e.target as Node)) {
        setNotifyOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifyOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [notifyOpen])

  const filtered = useMemo(() => {
    let list = [...shops]
    const parts = (s: ServiceShop) => serviceShopSearchParts(s)
    list = list.filter(
      (s) =>
        rowMatchesAdminQuery(parts(s), adminHeaderSearch) && rowMatchesAdminQuery(parts(s), topQuery),
    )
    const fq = filterSearch.trim().toLowerCase()
    if (fq) {
      list = list.filter((s) => s.name.toLowerCase().includes(fq) || s.address.toLowerCase().includes(fq))
    }
    if (district !== 'all') {
      list = list.filter((s) => s.district === district)
    }
    if (status !== 'all') {
      list = list.filter((s) => s.status === (status as ServiceShopStatus))
    }
    if (rating !== 'all') {
      if (rating === '5') list = list.filter((s) => s.rating >= 4.8)
      else if (rating === '4') list = list.filter((s) => s.rating >= 4)
      else if (rating === '3') list = list.filter((s) => s.rating >= 3)
    }
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating)
    else if (sort === 'services') sorted.sort((a, b) => b.services - a.services)
    else sorted.sort((a, b) => b.joinedMs - a.joinedMs)
    return sorted
  }, [shops, adminHeaderSearch, topQuery, filterSearch, district, status, rating, sort])

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const closeDetailModal = useCallback(() => {
    setDetailModal(null)
    setEditDraft(null)
    setEditLoading(false)
    setEditSaving(false)
  }, [])

  const openViewShop = useCallback((shop: ServiceShop) => {
    setDetailModal({ mode: 'view', shop })
  }, [])

  const openEditShop = useCallback(async (shop: ServiceShop) => {
    if (!isFirebaseConfigured) {
      toast.error('Firebase is not configured.')
      return
    }
    setDetailModal({ mode: 'edit', shop })
    setEditDraft(null)
    setEditLoading(true)
    try {
      const p = await getUserProfileByIdForAdmin(shop.id)
      if (!p) {
        toast.error('User profile not found.')
        setDetailModal(null)
        return
      }
      setEditDraft({
        shopName: p.shopName ?? '',
        displayName: p.displayName ?? '',
        phone: p.phone ?? '',
        whatsapp: p.whatsapp ?? '',
        shopAddress: (p.shopAddress || p.address || '').trim(),
        location: p.location ?? '',
        district: p.district ?? '',
        website: p.website ?? '',
        shopDescription: p.shopDescription ?? '',
      })
    } catch {
      toast.error('Could not load profile.')
      setDetailModal(null)
    } finally {
      setEditLoading(false)
    }
  }, [])

  const saveOwnerEdit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!detailModal || detailModal.mode !== 'edit' || !editDraft) return
      const dn = editDraft.displayName.trim()
      if (!dn) {
        toast.error('Owner display name is required.')
        return
      }
      if (!isFirebaseConfigured) return
      setEditSaving(true)
      try {
        await updateOwnerShopProfile(detailModal.shop.id, {
          shopName: editDraft.shopName.trim() || undefined,
          displayName: dn,
          phone: editDraft.phone.trim() || undefined,
          whatsapp: editDraft.whatsapp.trim() || undefined,
          shopAddress: editDraft.shopAddress.trim() || undefined,
          location: editDraft.location.trim() || undefined,
          district: editDraft.district.trim() || undefined,
          website: editDraft.website.trim() || undefined,
          shopDescription: editDraft.shopDescription.trim() || undefined,
        })
        toast.success('Shop profile updated.')
        closeDetailModal()
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error('Could not save changes.')
      } finally {
        setEditSaving(false)
      }
    },
    [closeDetailModal, detailModal, editDraft, reload],
  )

  useEffect(() => {
    if (!detailModal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDetailModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [detailModal, closeDetailModal])

  const applyFilters = useCallback(() => {
    toast.success('Filters applied')
  }, [])

  const exportCsv = useCallback(() => {
    const header = 'uid,name,lines,email,district,city,status,rating,services,reviews,revenueK'
    const lines = filtered.map(
      (s) =>
        `"${s.id}","${s.name.replace(/"/g, '""')}","${s.linesLabel.replace(/"/g, '""')}",${s.email},${s.district},${s.city},${s.status},${s.rating},${s.services},${s.reviews},${s.revenueK}`,
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'service-shops-firestore.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Export started')
  }, [filtered])

  const addShop = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!isFirebaseConfigured) {
        toast.error('Firebase is not configured.')
        return
      }
      const fd = new FormData(e.currentTarget)
      const shopName = String(fd.get('shopName') ?? '').trim()
      const ownerName = String(fd.get('ownerName') ?? '').trim()
      const phone = String(fd.get('phone') ?? '').trim()
      const email = String(fd.get('email') ?? '').trim()
      const district = String(fd.get('district') ?? '').trim()
      const city = String(fd.get('city') ?? '').trim()
      const address = String(fd.get('address') ?? '').trim()
      const password = String(fd.get('password') ?? '')
      const confirmPassword = String(fd.get('confirmPassword') ?? '')
      if (!shopName || !ownerName || !phone || !email || !district || !address) {
        toast.error('Fill in all required fields.')
        return
      }
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.')
        return
      }
      setAddingShop(true)
      try {
        await adminProvisionServiceShopOwner({
          email,
          password,
          ownerName,
          phone,
          shopName,
          shopAddress: address,
          district,
          city: city || undefined,
        })
        toast.success('Service shop account created — pending approval like self-registrations.')
        e.currentTarget.reset()
        closeModal()
        await reload({ soft: true })
      } catch (err) {
        const code = getErrorCode(err)
        const msg = code?.startsWith('auth/') ? mapFirebaseAuthError(code) : mapServiceError(code)
        toast.error(msg)
      } finally {
        setAddingShop(false)
      }
    },
    [closeModal, reload],
  )

  const approveOwner = useCallback(
    async (uid: string, name: string) => {
      if (!isFirebaseConfigured) return
      setApprovingUid(uid)
      try {
        await updateOwnerStatus(uid, 'approved')
        toast.success(`${name} approved`)
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error('Could not approve owner.')
      } finally {
        setApprovingUid(null)
      }
    },
    [reload],
  )

  const deleteOwnerShop = useCallback(
    async (uid: string, name: string) => {
      if (!isFirebaseConfigured) return
      if (uid === adminUid) {
        toast.error('You cannot delete your own account.')
        return
      }
      if (
        !window.confirm(
          `Delete Firestore profile for “${name}”?\n\nUID: ${uid}\n\nThis removes the users document only. Remove the Firebase Auth user separately in the console if needed.`,
        )
      ) {
        return
      }
      setDeletingUid(uid)
      try {
        await adminDeleteUserDocument(uid)
        toast.success(`Removed ${name} from users.`)
        await reload({ soft: true })
      } catch (err) {
        console.error(err)
        toast.error('Could not delete user document.')
      } finally {
        setDeletingUid(null)
      }
    },
    [adminUid, reload],
  )

  return (
    <div className="bb-svc-shops">
      <div className="ss-header">
        <div className="ss-header-left">
          <h1 className="ss-header-title">Service Shops</h1>
          <div className="ss-search-bar">
            <span className="ss-search-icon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder="Search shops, owners, email, uid…"
              value={topQuery}
              onChange={(e) => setTopQuery(e.target.value)}
              aria-label="Search service shops"
              disabled={loading}
            />
          </div>
        </div>
        <div className="ss-header-right">
          <button
            type="button"
            className={`ss-quick-add${refreshing ? ' ss-quick-add--refreshing' : ''}`}
            onClick={() => void reload({ notify: true })}
            disabled={loading || refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing service shops' : 'Refresh service shops list'}
          >
            <span className={refreshing ? 'ss-refresh-icon' : undefined} aria-hidden>
              ↻
            </span>
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button type="button" className="ss-quick-add" onClick={openModal}>
            <span>➕</span>
            <span>Add Shop</span>
          </button>
          <div className="ss-notify-wrap" ref={notifyWrapRef}>
            <button
              type="button"
              className="ss-notify"
              aria-label="Pending shop approvals"
              aria-expanded={notifyOpen}
              aria-haspopup="dialog"
              aria-controls="ss-notify-panel"
              onClick={() => setNotifyOpen((o) => !o)}
            >
              🔔
              <span className="ss-notify-badge" aria-hidden>
                {pendingInboxCount > 99 ? '99+' : pendingInboxCount}
              </span>
            </button>
            {notifyOpen ? (
              <div
                id="ss-notify-panel"
                className="ss-notify-panel"
                role="dialog"
                aria-label="Pending approvals"
              >
                <div className="ss-notify-panel-head">
                  <span className="ss-notify-panel-title">Pending approvals</span>
                  <button type="button" className="ss-notify-panel-close" onClick={() => setNotifyOpen(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                {pendingShops.length === 0 ? (
                  <p className="ss-notify-empty">No shops waiting for approval.</p>
                ) : (
                  <ul className="ss-notify-list">
                    {pendingShops.map((s) => (
                      <li key={s.id} className="ss-notify-item">
                        <div className="ss-notify-item-main">
                          <div className="ss-notify-item-name">{s.name}</div>
                          <div className="ss-notify-item-meta">
                            {s.owner} · {s.email}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ss-btn ss-btn-primary ss-notify-approve"
                          disabled={approvingUid === s.id}
                          onClick={() => {
                            void approveOwner(s.id, s.name)
                            setNotifyOpen(false)
                          }}
                        >
                          {approvingUid === s.id ? '…' : 'Approve'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ss-notify-panel-foot">
                  <button
                    type="button"
                    className="ss-btn ss-btn-secondary ss-notify-foot-btn"
                    onClick={() => {
                      setStatus('pending')
                      setNotifyOpen(false)
                      document.getElementById('ss-all-shops')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    Show pending in list
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loadError ? (
        <p className="ss-hero-sub" style={{ color: '#c0392b', marginBottom: 16 }}>
          {loadError}
        </p>
      ) : null}

      <div className="ss-hero">
        <div className="ss-hero-content">
          <div className="ss-hero-title">
            <span className="ss-hero-title-ic" aria-hidden>
              🔧
            </span>
            Service Shops Management
          </div>
          <p className="ss-hero-sub">
            Manage bike service centers, track maintenance services, monitor shop performance, and ensure quality
            standards across all service locations.
          </p>
        </div>
      </div>

      <div className="ss-stats-grid">
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon orange">🔧</div>
          </div>
          <div className="ss-stat-number">{stats.total}</div>
          <div className="ss-stat-label">Total Service Shops</div>
          <div className="ss-stat-trend">
            <span>↑</span> <span>{stats.newLast30} joined (30 days)</span>
          </div>
        </div>
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon green">✓</div>
          </div>
          <div className="ss-stat-number">{stats.active}</div>
          <div className="ss-stat-label">Active Shops</div>
          <div className="ss-stat-trend">
            <span>↑</span> <span>{stats.activePct}% approved</span>
          </div>
        </div>
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon blue">📋</div>
          </div>
          <div className="ss-stat-number">{stats.totalServices.toLocaleString()}</div>
          <div className="ss-stat-label">Total Services</div>
          <div className="ss-stat-trend">
            <span>→</span> <span>Service offers in Firestore</span>
          </div>
        </div>
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon yellow">⭐</div>
          </div>
          <div className="ss-stat-number">{stats.avgRating}</div>
          <div className="ss-stat-label">Average Rating</div>
          <div className="ss-stat-trend muted">
            <span>→</span> <span>From reviews only</span>
          </div>
        </div>
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon purple">💰</div>
          </div>
          <div className="ss-stat-number">{stats.totalRev}</div>
          <div className="ss-stat-label">Total Revenue (LKR)</div>
          <div className="ss-stat-trend muted">
            <span>→</span> <span>Completed bookings (est.)</span>
          </div>
        </div>
        <div className="ss-stat-card">
          <div className="ss-stat-header">
            <div className="ss-stat-icon red">⏳</div>
          </div>
          <div className="ss-stat-number">{stats.pending}</div>
          <div className="ss-stat-label">Pending Approval</div>
          <div className="ss-stat-trend muted">
            <span>→</span> <span>ownerStatus pending</span>
          </div>
        </div>
      </div>

      <div className="ss-section" id="ss-all-shops">
        <div className="ss-section-head">
          <h2 className="ss-section-title">All Service Shops</h2>
          <div className="ss-section-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="ss-btn ss-btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
              <span>📥</span> Export Data
            </button>
            <button type="button" className="ss-btn ss-btn-primary" onClick={openModal}>
              <span>➕</span> Add Service Shop
            </button>
          </div>
        </div>

        <div className="ss-filters">
          <div className="ss-fg">
            <span className="ss-fl">🔍 Search</span>
            <input
              className="ss-fi"
              id="filterSearch"
              placeholder="Shop name…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="ss-fg">
            <span className="ss-fl">📍 District</span>
            <select
              className="ss-fs"
              id="filterDistrict"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={loading}
            >
              <option value="all">All Districts</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="ss-fg">
            <span className="ss-fl">⚡ Status</span>
            <select className="ss-fs" value={status} onChange={(e) => setStatus(e.target.value)} disabled={loading}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="ss-fg">
            <span className="ss-fl">⭐ Rating</span>
            <select className="ss-fs" value={rating} onChange={(e) => setRating(e.target.value)} disabled={loading}>
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
            </select>
          </div>
          <div className="ss-fg">
            <span className="ss-fl">📊 Sort By</span>
            <select
              className="ss-fs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              disabled={loading}
            >
              <option value="newest">Newest First</option>
              <option value="name">Name A–Z</option>
              <option value="rating">Highest Rated</option>
              <option value="services">Most Services</option>
            </select>
          </div>
          <div className="ss-fg" style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="ss-btn ss-btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>

        <div className="ss-grid">
          {loading ? (
            <p className="ss-empty-text" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0' }}>
              Loading Firestore data…
            </p>
          ) : filtered.length === 0 ? (
            <div className="ss-empty">
              <div className="ss-empty-ico">🔧</div>
              <div className="ss-empty-title">No Service Shops Found</div>
              <p className="ss-empty-text">
                No shop owners match the current filters, or Firestore returned none. Try Refresh or clear search /
                filters.
              </p>
              <button type="button" className="ss-btn ss-btn-primary" onClick={() => void reload({ soft: true })}>
                <span>↻</span> Refresh
              </button>
            </div>
          ) : (
            filtered.map((shop) => (
            <div key={shop.id} className="ss-card">
              <div className="ss-card-head">
                <div className="ss-card-name">{shop.name}</div>
                <div className="ss-card-lines" title="Business lines from profile">
                  {shop.linesLabel}
                </div>
                <div className="ss-card-addr">📍 {shop.address}</div>
              </div>
              <div className="ss-card-body">
                <div className={`ss-status ${shop.status}`}>{statusLabel(shop.status)}</div>
                <div className="ss-rating">
                  {shop.rating > 0 ? (
                    <>
                      <span className="ss-stars" aria-hidden>
                        {'⭐'.repeat(Math.min(5, Math.max(1, Math.round(shop.rating))))}
                      </span>
                      <span className="ss-rating-num">{shop.rating.toFixed(1)}</span>
                    </>
                  ) : (
                    <span className="ss-rating-num" style={{ color: '#94a3b8' }}>
                      No reviews
                    </span>
                  )}
                </div>
                <div className="ss-info">
                  <div className="ss-info-row">
                    <div className="ss-info-ico" aria-hidden>
                      👤
                    </div>
                    <div>
                      <div className="ss-info-l">Owner</div>
                      <div className="ss-info-v">{shop.owner}</div>
                    </div>
                  </div>
                  <div className="ss-info-row">
                    <div className="ss-info-ico" aria-hidden>
                      📇
                    </div>
                    <div>
                      <div className="ss-info-l">UID</div>
                      <div className="ss-info-v" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                        {shop.id}
                      </div>
                    </div>
                  </div>
                  <div className="ss-info-row">
                    <div className="ss-info-ico" aria-hidden>
                      📞
                    </div>
                    <div>
                      <div className="ss-info-l">Contact</div>
                      <div className="ss-info-v">{shop.phone}</div>
                    </div>
                  </div>
                  <div className="ss-info-row">
                    <div className="ss-info-ico" aria-hidden>
                      📧
                    </div>
                    <div>
                      <div className="ss-info-l">Email</div>
                      <div className="ss-info-v">{shop.email}</div>
                    </div>
                  </div>
                  <div className="ss-info-row">
                    <div className="ss-info-ico" aria-hidden>
                      📍
                    </div>
                    <div>
                      <div className="ss-info-l">Location</div>
                      <div className="ss-info-v">
                        {shop.city}, {shop.district}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ss-mini">
                  <div style={{ textAlign: 'center' }}>
                    <span className="ss-mini-val">{shop.services}</span>
                    <span className="ss-mini-subl">Services</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className="ss-mini-val">{shop.reviews}</span>
                    <span className="ss-mini-subl">Reviews</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className="ss-mini-val" style={{ fontSize: 18 }}>
                      LKR {shop.revenue}
                    </span>
                    <span className="ss-mini-subl">Revenue</span>
                  </div>
                </div>
                <div className="ss-actions">
                  {shop.status === 'pending' ? (
                    <button
                      type="button"
                      className="ss-btn ss-btn-primary"
                      disabled={approvingUid === shop.id}
                      onClick={() => void approveOwner(shop.id, shop.name)}
                    >
                      <span>✓</span> {approvingUid === shop.id ? 'Approving…' : 'Approve'}
                    </button>
                  ) : null}
                  <button type="button" className="ss-btn ss-btn-view" onClick={() => openViewShop(shop)}>
                    <span>👁</span> View
                  </button>
                  <button type="button" className="ss-btn ss-btn-edit" onClick={() => void openEditShop(shop)}>
                    <span>✏️</span> Edit
                  </button>
                  <button
                    type="button"
                    className="ss-btn ss-btn-del"
                    disabled={deletingUid === shop.id || shop.id === adminUid}
                    title={shop.id === adminUid ? 'Cannot delete your own account' : 'Delete users document'}
                    onClick={() => void deleteOwnerShop(shop.id, shop.name)}
                  >
                    <span>🗑</span> {deletingUid === shop.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          className="ss-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ss-modal-h"
          onClick={closeModal}
        >
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-head">
              <h2 id="ss-modal-h" className="ss-modal-title">
                <span>➕</span> Add New Service Shop
              </h2>
              <button type="button" className="ss-modal-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>
            <form
              onSubmit={(ev) => {
                void addShop(ev)
              }}
            >
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
                Creates a Firebase login for the shop (bike service line only) and a pending owner profile. Deploy
                updated Firestore rules if creation is denied.
              </p>
              <div className="ss-form-grid">
                <div className="ss-fg full">
                  <div className="lbl">Shop name</div>
                  <input
                    className="ss-inp"
                    name="shopName"
                    placeholder="e.g., Rajapaksa Motors"
                    required
                    disabled={addingShop}
                  />
                </div>
                <div className="ss-fg">
                  <div className="lbl">Owner name</div>
                  <input className="ss-inp" name="ownerName" placeholder="Owner" required disabled={addingShop} />
                </div>
                <div className="ss-fg">
                  <div className="lbl">Contact</div>
                  <input
                    className="ss-inp"
                    name="phone"
                    type="tel"
                    placeholder="+94 77 …"
                    required
                    disabled={addingShop}
                  />
                </div>
                <div className="ss-fg">
                  <div className="lbl">Email (login)</div>
                  <input
                    className="ss-inp"
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="shop@example.com"
                    required
                    disabled={addingShop}
                  />
                </div>
                <div className="ss-fg">
                  <div className="lbl">Password</div>
                  <input
                    className="ss-inp"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    disabled={addingShop}
                  />
                </div>
                <div className="ss-fg">
                  <div className="lbl">Confirm password</div>
                  <input
                    className="ss-inp"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    minLength={6}
                    required
                    disabled={addingShop}
                  />
                </div>
                <div className="ss-fg">
                  <div className="lbl">District</div>
                  <select className="ss-inp" name="district" defaultValue="" required disabled={addingShop}>
                    <option value="" disabled>
                      Select district
                    </option>
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ss-fg">
                  <div className="lbl">City</div>
                  <input className="ss-inp" name="city" placeholder="e.g., Colombo 07" disabled={addingShop} />
                </div>
                <div className="ss-fg full" style={{ gridColumn: '1 / -1' }}>
                  <div className="lbl">Full address</div>
                  <input
                    className="ss-inp"
                    name="address"
                    placeholder="Street, building"
                    required
                    disabled={addingShop}
                  />
                </div>
              </div>
              <div className="ss-modal-foot">
                <button type="button" className="ss-btn ss-btn-ghost" onClick={closeModal} disabled={addingShop}>
                  Cancel
                </button>
                <button type="submit" className="ss-btn ss-btn-primary" disabled={addingShop}>
                  {addingShop ? 'Creating…' : 'Create shop account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailModal ? (
        <div
          className="ss-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ss-detail-title"
          onClick={closeDetailModal}
        >
          <div className="ss-modal ss-modal-detail" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-head">
              <h2 id="ss-detail-title" className="ss-modal-title">
                {detailModal.mode === 'view' ? (
                  <>
                    <span>👁</span> {detailModal.shop.name}
                  </>
                ) : (
                  <>
                    <span>✏️</span> Edit — {detailModal.shop.name}
                  </>
                )}
              </h2>
              <button type="button" className="ss-modal-close" onClick={closeDetailModal} aria-label="Close">
                ×
              </button>
            </div>

            {detailModal.mode === 'view' ? (
              <>
                <div className="ss-detail-body">
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>
                    Read-only snapshot from the list. Email / sign-in is managed in Firebase Auth.
                  </p>
                  <dl className="ss-detail-dl">
                    <dt>UID</dt>
                    <dd>
                      <code style={{ wordBreak: 'break-all' }}>{detailModal.shop.id}</code>{' '}
                      <button
                        type="button"
                        className="ss-btn ss-btn-secondary"
                        style={{ marginTop: 6, fontSize: 12, padding: '6px 12px' }}
                        onClick={() => {
                          void navigator.clipboard.writeText(detailModal.shop.id).then(
                            () => toast.success('UID copied'),
                            () => toast.message(detailModal.shop.id),
                          )
                        }}
                      >
                        Copy UID
                      </button>
                    </dd>
                    <dt>Business lines</dt>
                    <dd>{detailModal.shop.linesLabel}</dd>
                    <dt>Email</dt>
                    <dd>{detailModal.shop.email}</dd>
                    <dt>Owner</dt>
                    <dd>{detailModal.shop.owner}</dd>
                    <dt>Phone</dt>
                    <dd>{detailModal.shop.phone}</dd>
                    <dt>Address</dt>
                    <dd>{detailModal.shop.address}</dd>
                    <dt>City / area</dt>
                    <dd>{detailModal.shop.city}</dd>
                    <dt>District</dt>
                    <dd>{detailModal.shop.district}</dd>
                    <dt>Status</dt>
                    <dd>{statusLabel(detailModal.shop.status)}</dd>
                    <dt>Services</dt>
                    <dd>{detailModal.shop.services}</dd>
                    <dt>Reviews</dt>
                    <dd>{detailModal.shop.reviews}</dd>
                    <dt>Rating</dt>
                    <dd>{detailModal.shop.rating > 0 ? detailModal.shop.rating.toFixed(1) : '—'}</dd>
                    <dt>Revenue (est.)</dt>
                    <dd>LKR {detailModal.shop.revenue}</dd>
                    <dt>Established</dt>
                    <dd>{detailModal.shop.established}</dd>
                  </dl>
                </div>
                <div className="ss-modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="ss-btn ss-btn-ghost" onClick={closeDetailModal}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="ss-btn ss-btn-primary"
                    onClick={() => {
                      const s = detailModal.shop
                      closeDetailModal()
                      void openEditShop(s)
                    }}
                  >
                    Edit profile…
                  </button>
                </div>
              </>
            ) : editLoading ? (
              <p style={{ padding: 24, color: '#64748b' }}>Loading profile…</p>
            ) : editDraft ? (
              <form
                onSubmit={(ev) => {
                  void saveOwnerEdit(ev)
                }}
              >
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
                  Updates Firestore <code>users/{detailModal.shop.id}</code>. Email is not changed here.
                </p>
                <div className="ss-form-grid">
                  <div className="ss-fg full">
                    <div className="lbl">Shop name</div>
                    <input
                      className="ss-inp"
                      value={editDraft.shopName}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, shopName: e.target.value } : d))}
                      disabled={editSaving}
                    />
                  </div>
                  <div className="ss-fg full">
                    <div className="lbl">Owner display name</div>
                    <input
                      className="ss-inp"
                      value={editDraft.displayName}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, displayName: e.target.value } : d))}
                      disabled={editSaving}
                      required
                    />
                  </div>
                  <div className="ss-fg">
                    <div className="lbl">Phone</div>
                    <input
                      className="ss-inp"
                      value={editDraft.phone}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
                      disabled={editSaving}
                    />
                  </div>
                  <div className="ss-fg">
                    <div className="lbl">WhatsApp</div>
                    <input
                      className="ss-inp"
                      value={editDraft.whatsapp}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, whatsapp: e.target.value } : d))}
                      disabled={editSaving}
                    />
                  </div>
                  <div className="ss-fg full" style={{ gridColumn: '1 / -1' }}>
                    <div className="lbl">Shop address</div>
                    <input
                      className="ss-inp"
                      value={editDraft.shopAddress}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, shopAddress: e.target.value } : d))}
                      disabled={editSaving}
                    />
                  </div>
                  <div className="ss-fg">
                    <div className="lbl">City / area</div>
                    <input
                      className="ss-inp"
                      value={editDraft.location}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                      disabled={editSaving}
                    />
                  </div>
                  <div className="ss-fg">
                    <div className="lbl">District</div>
                    <select
                      className="ss-inp"
                      value={editDraft.district || ''}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, district: e.target.value } : d))}
                      disabled={editSaving}
                    >
                      <option value="">—</option>
                      {SRI_LANKA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-fg full" style={{ gridColumn: '1 / -1' }}>
                    <div className="lbl">Website</div>
                    <input
                      className="ss-inp"
                      value={editDraft.website}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, website: e.target.value } : d))}
                      disabled={editSaving}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="ss-fg full" style={{ gridColumn: '1 / -1' }}>
                    <div className="lbl">Shop description</div>
                    <textarea
                      className="ss-inp"
                      rows={3}
                      value={editDraft.shopDescription}
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, shopDescription: e.target.value } : d))}
                      disabled={editSaving}
                      style={{ resize: 'vertical', minHeight: 72 }}
                    />
                  </div>
                </div>
                <div className="ss-modal-foot">
                  <button type="button" className="ss-btn ss-btn-ghost" onClick={closeDetailModal} disabled={editSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="ss-btn ss-btn-primary" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ padding: 24, color: '#b45309' }}>Could not load profile for editing.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
