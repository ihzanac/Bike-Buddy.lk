import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { AdminLayoutOutletContext } from '@/hooks/useAdminHeaderSearch'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { logout } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { AdminDemoBanner } from '@/components/admin/AdminDemoBanner'

const nav = [
  { to: ROUTES.admin, icon: '📊', label: 'Dashboard' },
  { to: ROUTES.adminServiceShops, icon: '🔧', label: 'Service Shops' },
  { to: ROUTES.adminSaleShops, icon: '🏪', label: 'Sale Shops' },
  { to: ROUTES.adminPartsShops, icon: '📦', label: 'Parts Shops' },
  { to: ROUTES.adminUsers, icon: '👥', label: 'Users' },
  { to: ROUTES.adminBookings, icon: '📅', label: 'Bookings' },
  { to: ROUTES.adminReports, icon: '⚠️', label: 'Reports' },
  { to: ROUTES.adminSettings, icon: '⚙️', label: 'Settings' },
] as const

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [savedTheme, setSavedTheme] = useState<'light' | 'dark' | 'auto'>('light')
  const [savedItemsPerPage, setSavedItemsPerPage] = useState(50)
  const [savedViewMode, setSavedViewMode] = useState<'table' | 'cards' | 'list'>('table')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const { profile, firebaseUser } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const displayName = profile?.displayName?.trim() || firebaseUser?.displayName || 'Admin'
  const email = profile?.email || firebaseUser?.email || ''
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A'
  const profileTheme = profile?.adminSettings?.appearance?.theme
  const effectiveSavedTheme: 'light' | 'dark' | 'auto' =
    profileTheme === 'light' || profileTheme === 'dark' || profileTheme === 'auto' ? profileTheme : savedTheme
  const resolvedTheme = effectiveSavedTheme === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : effectiveSavedTheme
  const profileItemsPerPage = profile?.adminSettings?.appearance?.itemsPerPage
  const effectiveItemsPerPage =
    typeof profileItemsPerPage === 'number' && Number.isFinite(profileItemsPerPage) ? profileItemsPerPage : savedItemsPerPage
  const profileViewMode = profile?.adminSettings?.appearance?.viewMode
  const effectiveViewMode: 'table' | 'cards' | 'list' =
    profileViewMode === 'table' || profileViewMode === 'cards' || profileViewMode === 'list'
      ? profileViewMode
      : savedViewMode

  useEffect(() => {
    if (typeof window === 'undefined') return
    const local = window.localStorage.getItem('bb-admin-theme')
    if (local === 'light' || local === 'dark' || local === 'auto') {
      setSavedTheme(local)
    }
    const localItems = Number(window.localStorage.getItem('bb-admin-items-per-page'))
    if (Number.isFinite(localItems) && [10, 25, 50, 100].includes(localItems)) {
      setSavedItemsPerPage(localItems)
    }
    const localViewMode = window.localStorage.getItem('bb-admin-view-mode')
    if (localViewMode === 'table' || localViewMode === 'cards' || localViewMode === 'list') {
      setSavedViewMode(localViewMode)
    }
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<{
        theme?: 'light' | 'dark' | 'auto'
        itemsPerPage?: number
        viewMode?: 'table' | 'cards' | 'list'
      }>).detail
      if (next?.theme === 'light' || next?.theme === 'dark' || next?.theme === 'auto') {
        setSavedTheme(next.theme)
      }
      if (typeof next?.itemsPerPage === 'number' && [10, 25, 50, 100].includes(next.itemsPerPage)) {
        setSavedItemsPerPage(next.itemsPerPage)
      }
      if (next?.viewMode === 'table' || next?.viewMode === 'cards' || next?.viewMode === 'list') {
        setSavedViewMode(next.viewMode)
      }
    }
    window.addEventListener('bb-admin-theme-change', onThemeChange as EventListener)
    return () => window.removeEventListener('bb-admin-theme-change', onThemeChange as EventListener)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemPrefersDark(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return (
    <div className={cn('bb-admin', resolvedTheme === 'dark' && 'bb-admin-theme-dark')}>
      <div className="bb-dashboard">
        <aside className={cn('bb-sidebar', collapsed && 'bb-collapsed')} id="bb-sidebar">
          <div className="bb-sidebar-header">
            <div className="bb-logo">
              <div className="bb-logo-icon">🏍️</div>
              {!collapsed ? <div className="bb-logo-text">BikeBuddy.lk</div> : null}
            </div>
            <button
              type="button"
              className="bb-toggle-btn"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((c) => !c)}
            >
              ☰
            </button>
          </div>

          <nav className="bb-menu">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === ROUTES.admin}>
                <span className="bb-menu-icon">{item.icon}</span>
                <span className="bb-menu-text">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="bb-admin-profile">
            <div className="bb-profile-info">
              <div className="bb-profile-avatar" aria-hidden>
                {initials}
              </div>
              <div className="bb-profile-details">
                <div className="bb-profile-name">{displayName}</div>
                <div className="bb-profile-email">{email || '—'}</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="bb-main">
          <header className="bb-header">
            <div className="bb-header-left">
              <span className="bb-header-title">Admin</span>
              <div className="bb-search-bar">
                <span className="bb-search-icon" aria-hidden>
                  🔍
                </span>
                <input
                  type="search"
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="Search shops, users, bookings…"
                  aria-label="Search shops, users, and bookings"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="bb-header-right">
              <div className="bb-date-info">
                <div className="bb-date-label">Today</div>
                <div className="bb-date-value">{today}</div>
              </div>
              <button
                type="button"
                className="bb-logout-btn"
                onClick={async () => {
                  await logout()
                  toast.success('Signed out')
                }}
              >
                Log out
              </button>
            </div>
          </header>

          <div
            className="bb-content"
            data-admin-items-per-page={effectiveItemsPerPage}
            data-admin-view-mode={effectiveViewMode}
          >
            <AdminDemoBanner />
            <Outlet
              context={
                {
                  adminSearchQuery,
                  adminItemsPerPage: effectiveItemsPerPage,
                  adminViewMode: effectiveViewMode,
                } satisfies AdminLayoutOutletContext
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
