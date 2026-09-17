import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ShopCategoryGate } from '@/routes/ShopCategoryGate'
import { ROUTES } from '@/utils/constants'
import { logout } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { isFirebaseConfigured } from '@/services/firebase'
import { subscribeBookingsForOwner } from '@/services/bookings'
import { subscribeShopReviewsForOwner } from '@/services/shopReviews'
import { subscribeShopPartsByOwner } from '@/services/shopParts'
import {
  subscribePlatformReportsForTargetOwner,
  type PlatformReportShopInboxSlice,
} from '@/services/platformReports'
import { appendShopInboxDismissed, subscribeShopInboxDismissed } from '@/services/shopInboxState'
import type { Booking } from '@/types'
import type { ShopReview } from '@/types'
import type { ShopPart } from '@/types/shopPart'
import { buildShopInboxFeed, type ShopInboxItem } from '@/utils/shopInboxFeed'
import {
  SHOP_OWNER_CATEGORY,
  getOwnerShopCategories,
  shopCategoriesLine,
  type ShopOwnerCategoryId,
} from '@/utils/shopOwnerCategory'

const CS = SHOP_OWNER_CATEGORY

const nav = [
  { to: ROUTES.shopDashboard, icon: 'fa-home', label: 'Dashboard', end: true },
  {
    to: ROUTES.shopBookings,
    icon: 'fa-calendar-check',
    label: 'Bookings',
    categories: [CS.BIKE_SERVICE] as const,
  },
  {
    to: ROUTES.shopServices,
    icon: 'fa-tools',
    label: 'Services',
    categories: [CS.BIKE_SERVICE] as const,
  },
  { to: ROUTES.shopProfile, icon: 'fa-store', label: 'Shop Profile' },
  { to: ROUTES.shopFeedback, icon: 'fa-star', label: 'Customer Feedback' },
  {
    to: ROUTES.shopParts,
    icon: 'fa-boxes',
    label: 'Parts management',
    badge: '3',
    categories: [CS.BIKE_PARTS] as const,
  },
  {
    to: ROUTES.shopBikeSales,
    icon: 'fa-motorcycle',
    label: 'Bike sale management',
    categories: [CS.BIKE_SALE] as const,
  },
  { to: ROUTES.shopNotifications, icon: 'fa-bell', label: 'Notifications' },
] as const

export type ShopPortalOutletContext = {
  inboxLoading: boolean
  inboxItems: ShopInboxItem[]
  dismissInboxKey: (key: string) => Promise<void>
  dismissAllInboxKeys: () => Promise<void>
}

function navForOwnerCategories(cats: ShopOwnerCategoryId[]) {
  return nav.filter((item) => {
    if (!('categories' in item) || !item.categories?.length) return true
    if (cats.length === 0) return true
    const need = item.categories as readonly ShopOwnerCategoryId[]
    return need.some((c) => cats.includes(c))
  })
}

export function ShopLayout() {
  const { profile, firebaseUser } = useAuth()
  const ownerId =
    profile?.role === 'owner' && profile.uid ? profile.uid.trim() : ''
  const ownerHasParts = getOwnerShopCategories(profile).includes(CS.BIKE_PARTS)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<ShopReview[]>([])
  const [parts, setParts] = useState<ShopPart[]>([])
  const [platformReports, setPlatformReports] = useState<PlatformReportShopInboxSlice[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([])

  useEffect(() => {
    if (!ownerId || !isFirebaseConfigured) {
      setBookings([])
      setReviews([])
      setParts([])
      setDismissedKeys([])
      setPlatformReports([])
      return
    }

    const u0 = subscribeShopInboxDismissed(
      ownerId,
      (keys) => setDismissedKeys(keys),
      () => setDismissedKeys([]),
    )

    const u1 = subscribeBookingsForOwner(
      ownerId,
      (rows) => setBookings(rows),
      () => setBookings([]),
    )

    const u2 = subscribeShopReviewsForOwner(
      ownerId,
      (rows) => setReviews(rows),
      () => setReviews([]),
    )

    const u3 = ownerHasParts
      ? subscribeShopPartsByOwner(
          ownerId,
          (rows) => setParts(rows),
          () => setParts([]),
        )
      : (() => {
          setParts([])
          return () => {}
        })()

    const u4 = subscribePlatformReportsForTargetOwner(
      ownerId,
      (rows) => setPlatformReports(rows),
      () => setPlatformReports([]),
    )

    return () => {
      u0()
      u1()
      u2()
      u3()
      u4()
    }
  }, [ownerId, ownerHasParts])

  const dismissedSet = useMemo(() => new Set(dismissedKeys), [dismissedKeys])

  const inboxItems = useMemo(
    () => buildShopInboxFeed(bookings, reviews, parts, dismissedSet, platformReports),
    [bookings, reviews, parts, dismissedSet, platformReports],
  )

  const unreadNotifCount = useMemo(() => inboxItems.filter((n) => !n.read).length, [inboxItems])

  const dismissInboxKey = useCallback(
    async (key: string) => {
      if (!ownerId || !isFirebaseConfigured || !key) return
      try {
        await appendShopInboxDismissed(ownerId, [key])
      } catch (e) {
        console.error(e)
        toast.error('Could not mark notification dismissed.')
      }
    },
    [ownerId],
  )

  const dismissAllInboxKeys = useCallback(async () => {
    if (!ownerId || !isFirebaseConfigured) return
    const keys = inboxItems.map((i) => i.id)
    if (!keys.length) return
    try {
      await appendShopInboxDismissed(ownerId, keys)
    } catch (e) {
      console.error(e)
      toast.error('Could not update notifications.')
      throw e
    }
  }, [ownerId, inboxItems])

  const outletContext = useMemo<ShopPortalOutletContext>(
    () => ({
      inboxLoading: false,
      inboxItems,
      dismissInboxKey,
      dismissAllInboxKeys,
    }),
    [inboxItems, dismissInboxKey, dismissAllInboxKeys],
  )

  const shopName = profile?.shopName?.trim() || 'Your shop'
  const district = profile?.district || profile?.location || '—'
  const ownerCats = getOwnerShopCategories(profile)
  const sidebarNav = navForOwnerCategories(ownerCats)
  const typeLine = profile?.role === 'owner' ? shopCategoriesLine(ownerCats) : null

  return (
    <div className="sp-root">
      <div className="sp-dashboard">
        <aside className="sp-sidebar" aria-label="Shop navigation">
          <div className="sp-sidebar-header">
            <div className="sp-sidebar-logo">
              <i className="fas fa-motorcycle" aria-hidden />
              <span>BikeShop Pro</span>
            </div>
            <div className="sp-shop-info">
              <h4>{shopName}</h4>
              <p>{district}</p>
              {typeLine ? (
                <p className="sp-shop-type" title="Registered shop type">
                  {typeLine}
                </p>
              ) : null}
            </div>
          </div>

          <nav className="sp-sidebar-nav">
            {sidebarNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) => `sp-nav-item${isActive ? ' active' : ''}`}
              >
                <i className={`fas ${item.icon}`} aria-hidden />
                <span>{item.label}</span>
                {item.to === ROUTES.shopNotifications && unreadNotifCount > 0 ? (
                  <span className="sp-nav-badge">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                ) : 'badge' in item && item.badge ? (
                  <span className="sp-nav-badge">{item.badge}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="sp-sidebar-out"
            onClick={async () => {
              await logout()
              toast.success('Signed out')
            }}
          >
            Log out
            {firebaseUser?.email ? ` · ${firebaseUser.email}` : ''}
          </button>
        </aside>

        <div className="sp-main">
          {profile?.role === 'owner' && profile.ownerStatus === 'pending' ? (
            <div className="sp-pending-banner" role="status">
              <strong>Account pending approval</strong>
              An administrator still needs to approve your shop before you can publish listings or
              accept live bookings. You can explore the dashboard in the meantime.
            </div>
          ) : null}
          <ShopCategoryGate>
            <Outlet context={outletContext} />
          </ShopCategoryGate>
        </div>
      </div>
    </div>
  )
}
