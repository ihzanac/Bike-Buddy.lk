import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminCounts } from '@/services/adminMetrics'
import { listAllUsers, updateOwnerStatus } from '@/services/users'
import { ROUTES } from '@/utils/constants'
import type { UserProfile } from '@/types'
import { toast } from 'sonner'
import {
  DUMMY_PENDING_OWNERS,
  isAdminDummyDataEnabled,
  isDemoRecordId,
  mergeAdminCounts,
} from '@/data/adminDummyData'
import { SampleBadge } from '@/components/admin/AdminDemoBanner'

type Counts = Awaited<ReturnType<typeof getAdminCounts>>

const statIcon = ['blue', 'green', 'purple', 'orange', 'pink', 'red'] as const

export function AdminDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [pendingOwners, setPendingOwners] = useState<UserProfile[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setStatsLoading(true)
      try {
        const c = await getAdminCounts()
        if (!cancelled) setCounts(c)
      } catch {
        if (!cancelled) setCounts(null)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
      try {
        const users = await listAllUsers()
        if (!cancelled) {
          setPendingOwners(users.filter((u) => u.role === 'owner' && u.ownerStatus === 'pending').slice(0, 8))
        }
      } catch {
        if (!cancelled) setPendingOwners([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const displayCounts = statsLoading ? null : mergeAdminCounts(counts)

  const tiles = displayCounts
    ? [
        { label: 'Users', value: displayCounts.users, sub: 'Registered accounts', icon: '👥', to: ROUTES.adminUsers },
        { label: 'Bikes', value: displayCounts.bikes, sub: 'Listings', icon: '🏍️', to: ROUTES.adminSaleShops },
        { label: 'Accessories', value: displayCounts.accessories, sub: 'Listings', icon: '🔩', to: ROUTES.adminPartsShops },
        { label: 'Bookings', value: displayCounts.bookings, sub: 'Reservations', icon: '📅', to: ROUTES.adminBookings },
        { label: 'Services', value: displayCounts.services, sub: 'Shop services', icon: '🔧', to: ROUTES.adminServiceShops },
        { label: 'Pending owners', value: displayCounts.ownersPending, sub: 'Awaiting approval', icon: '⏳', to: ROUTES.adminUsers },
      ]
    : []

  const pendingList = isAdminDummyDataEnabled()
    ? [
        ...pendingOwners,
        ...DUMMY_PENDING_OWNERS.filter((d) => !pendingOwners.some((p) => p.uid === d.uid)),
      ]
    : pendingOwners

  async function approve(uid: string) {
    if (isDemoRecordId(uid)) {
      toast.message('This is sample data — not saved to Firestore.')
      return
    }
    try {
      await updateOwnerStatus(uid, 'approved')
      toast.success('Owner approved')
      const users = await listAllUsers()
      setPendingOwners(users.filter((u) => u.role === 'owner' && u.ownerStatus === 'pending').slice(0, 8))
      const c = await getAdminCounts()
      setCounts(c)
    } catch {
      toast.error('Could not approve')
    }
  }

  async function reject(uid: string) {
    if (isDemoRecordId(uid)) {
      toast.message('This is sample data — not saved to Firestore.')
      return
    }
    try {
      await updateOwnerStatus(uid, 'rejected')
      toast.success('Owner rejected')
      const users = await listAllUsers()
      setPendingOwners(users.filter((u) => u.role === 'owner' && u.ownerStatus === 'pending').slice(0, 8))
      const c = await getAdminCounts()
      setCounts(c)
    } catch {
      toast.error('Could not reject')
    }
  }

  return (
    <>
      <div className="bb-welcome-banner">
        <div className="bb-welcome-title">
          <span className="bb-welcome-title-ic" aria-hidden>
            📊
          </span>
          Welcome back, Admin! 👋
        </div>
        <div className="bb-welcome-subtitle">Here&apos;s what&apos;s happening on the platform today</div>
      </div>

      {statsLoading ? (
        <p style={{ color: '#6b7280' }}>Loading stats…</p>
      ) : !displayCounts ? (
        <p style={{ color: '#b45309' }}>Could not load stats. Check Firestore rules and your network.</p>
      ) : (
        <div className="bb-stats-grid">
          {tiles.map((t, idx) => (
            <Link key={t.label} to={t.to} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="bb-stat-card">
                <div className="bb-stat-header">
                  <div className={`bb-stat-icon ${statIcon[idx % statIcon.length]}`}>
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                  </div>
                  <div className="bb-stat-value">{t.value}</div>
                </div>
                <div className="bb-stat-label">{t.label}</div>
                <div className="bb-stat-change">{t.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="bb-section">
        <div className="bb-section-header">
          <div className="bb-section-title">🕒 Pending shop approvals</div>
          {displayCounts != null ? (
            <span className="bb-badge warn">
              {displayCounts.ownersPending} pending
            </span>
          ) : null}
        </div>
        {pendingList.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No pending owner applications.</p>
        ) : (
          pendingList.map((u) => (
            <div key={u.uid} className="bb-approval-item">
              <div className="bb-approval-info">
                <div className="bb-approval-icon">🏪</div>
                <div className="bb-approval-details">
                  <h3>
                    {u.shopName || u.displayName}
                    {isDemoRecordId(u.uid) ? <SampleBadge /> : null}
                  </h3>
                  <div className="bb-approval-meta">
                    <span>{u.email}</span>
                    {u.phone ? <span> · {u.phone}</span> : null}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="bb-btn bb-btn-approve"
                  disabled={isDemoRecordId(u.uid)}
                  onClick={() => approve(u.uid)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="bb-btn bb-btn-reject"
                  disabled={isDemoRecordId(u.uid)}
                  onClick={() => reject(u.uid)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
        <p style={{ marginTop: 16 }}>
          <Link to={ROUTES.adminUsers} style={{ color: '#1e3a8a', fontWeight: 600 }}>
            Open full user management →
          </Link>
        </p>
      </div>
    </>
  )
}
