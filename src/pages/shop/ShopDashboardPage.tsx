import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type TooltipItem,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { toast } from 'sonner'
import { subscribeBikesByOwner } from '@/services/bikes'
import { subscribeBookingsForOwner } from '@/services/bookings'
import { subscribeShopReviewsForOwner } from '@/services/shopReviews'
import type { Bike, Booking, ShopReview } from '@/types'
import { ROUTES } from '@/utils/constants'
import { getErrorCode, mapServiceError } from '@/utils/firebaseErrors'
import { useAuth } from '@/hooks/useAuth'
import {
  activeBikeListings,
  addDaysYmd,
  averageReviewRating,
  bikesCreatedSinceMs,
  bookingsCreatedSinceMs,
  buildActivityLine,
  buildBikeCategoryChart,
  buildBookingStatusChart,
  buildListingTrendLine,
  countBookingsOnScheduleDate,
  formatDelta,
  localYmd,
  uniqueCustomerIds,
  type ChartRange,
} from '@/utils/shopDashboardMetrics'
import { canOwnerAccessShopPath, getOwnerShopCategories } from '@/utils/shopOwnerCategory'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
)

const topBikesDemo = [
  { name: 'Bajaj Pulsar 220', cat: 'Commuter', units: 14, price: 420000, rank: 'gold' as const },
  { name: 'Honda CBR 600', cat: 'Sport Bike', units: 9, price: 785000, rank: 'silver' as const },
  { name: 'Royal Enfield 350', cat: 'Cruiser', units: 7, price: 510000, rank: 'bronze' as const },
  { name: 'Zero SR/F', cat: 'Electric', units: 4, price: 1100000, rank: 'other' as const },
  { name: 'Husqvarna FR 450', cat: 'Off-Road', units: 5, price: 920000, rank: 'other' as const },
]

type Rank = 'gold' | 'silver' | 'bronze' | 'other'

function rankClass(r: Rank) {
  if (r === 'gold') return 'sp-rank sp-rank-gold'
  if (r === 'silver') return 'sp-rank sp-rank-silver'
  if (r === 'bronze') return 'sp-rank sp-rank-bronze'
  return 'sp-rank sp-rank-other'
}

function rankFromIndex(i: number): Rank {
  if (i === 0) return 'gold'
  if (i === 1) return 'silver'
  if (i === 2) return 'bronze'
  return 'other'
}

function shortListingId(id: string) {
  return id.length > 10 ? `#${id.slice(0, 8)}…` : `#${id}`
}

function bikeThumbBackground(b: Bike): string {
  const u = b.images?.[0]?.trim()
  if (u) return `url(${u}) center/cover no-repeat`
  return 'linear-gradient(135deg,#667eea,#764ba2)'
}

function stockStatus(b: Bike): { text: string; cls: string } {
  if (b.active === false) return { text: 'Hidden', cls: 'sp-status-processing' }
  const q = b.stockQty ?? 0
  if (q <= 0) return { text: 'Out of stock', cls: 'sp-status-pending' }
  const reorder = b.reorderLevel != null && b.reorderLevel >= 0 ? b.reorderLevel : 5
  if (q <= reorder) return { text: 'Low stock', cls: 'sp-status-pending' }
  return { text: 'In stock', cls: 'sp-status-completed' }
}

type QuickAction = {
  icon: string
  label: string
  cls: 'orange' | 'blue' | 'green' | 'purple'
  to: string
}

export function ShopDashboardPage() {
  const { profile, firebaseUser } = useAuth()
  const firstName = profile?.displayName?.split(/\s+/)[0] ?? 'there'
  const [saleQuery, setSaleQuery] = useState('')
  const [chartRange, setChartRange] = useState<ChartRange>('Month')
  const [inventoryBikes, setInventoryBikes] = useState<Bike[]>([])
  const [invLoading, setInvLoading] = useState(true)
  const [invError, setInvError] = useState<string | null>(null)
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([])
  const [ownerReviews, setOwnerReviews] = useState<ShopReview[]>([])

  const ownerCats = useMemo(() => getOwnerShopCategories(profile), [profile])
  const canShopPath = useCallback((path: string) => canOwnerAccessShopPath(path, ownerCats), [ownerCats])
  const canBikeListings = canOwnerAccessShopPath(ROUTES.shopBikeSales, ownerCats)
  const canBookings = canOwnerAccessShopPath(ROUTES.shopBookings, ownerCats)

  useEffect(() => {
    if (!firebaseUser?.uid || !canBikeListings) {
      setInventoryBikes([])
      setInvLoading(false)
      setInvError(null)
      return
    }
    setInvLoading(true)
    const unsub = subscribeBikesByOwner(
      firebaseUser.uid,
      (rows) => {
        setInventoryBikes(rows)
        setInvError(null)
        setInvLoading(false)
      },
      (e) => {
        setInvError(mapServiceError(getErrorCode(e)))
        setInvLoading(false)
      },
    )
    return () => {
      unsub()
    }
  }, [firebaseUser?.uid, canBikeListings])

  useEffect(() => {
    if (!firebaseUser?.uid || !canBookings) {
      setOwnerBookings([])
      return
    }
    const unsub = subscribeBookingsForOwner(
      firebaseUser.uid,
      (rows) => setOwnerBookings(rows),
      () => setOwnerBookings([]),
    )
    return () => unsub()
  }, [firebaseUser?.uid, canBookings])

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setOwnerReviews([])
      return
    }
    const unsub = subscribeShopReviewsForOwner(
      firebaseUser.uid,
      (rows) => setOwnerReviews(rows),
      () => setOwnerReviews([]),
    )
    return () => unsub()
  }, [firebaseUser?.uid])

  const dashMetrics = useMemo(() => {
    const today = localYmd()
    const yesterday = addDaysYmd(today, -1)
    const weekAgoMs = Date.now() - 7 * 86_400_000
    const bookingsToday = canBookings ? countBookingsOnScheduleDate(ownerBookings, today) : 0
    const bookingsYesterday = canBookings ? countBookingsOnScheduleDate(ownerBookings, yesterday) : 0
    const bookingsTrend = canBookings ? formatDelta(bookingsToday, bookingsYesterday) : { text: '—', up: null as boolean | null }

    const activeList = canBikeListings ? activeBikeListings(inventoryBikes) : 0
    const newListings7d = canBikeListings ? bikesCreatedSinceMs(inventoryBikes, weekAgoMs) : 0

    const totalBookings = canBookings ? ownerBookings.length : 0
    const bookings7d = canBookings ? bookingsCreatedSinceMs(ownerBookings, weekAgoMs) : 0

    const uniqueCustomers = canBookings ? uniqueCustomerIds(ownerBookings) : 0

    const avgRating = averageReviewRating(ownerReviews.map((r) => r.rating))
    const reviewCount = ownerReviews.length

    return {
      bookingsToday,
      bookingsTrend,
      activeList,
      newListings7d,
      totalBookings,
      bookings7d,
      uniqueCustomers,
      avgRating,
      reviewCount,
    }
  }, [canBookings, canBikeListings, ownerBookings, ownerReviews, inventoryBikes])

  const quickActions = useMemo(() => {
    const all: QuickAction[] = [
      { icon: 'fa-calendar-plus', label: 'Add Booking', cls: 'orange', to: ROUTES.shopBookings },
      { icon: 'fa-tools', label: 'Manage Services', cls: 'blue', to: ROUTES.shopServices },
      { icon: 'fa-boxes', label: 'Inventory', cls: 'green', to: ROUTES.shopParts },
      { icon: 'fa-chart-bar', label: 'Bike sales', cls: 'purple', to: ROUTES.shopBikeSales },
    ]
    return all.filter((q) => canShopPath(q.to))
  }, [canShopPath])

  const filteredInventory = useMemo(() => {
    const q = saleQuery.toLowerCase().trim()
    let rows = inventoryBikes
    if (q) {
      rows = rows.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.title.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          String(b.stockQty ?? '').includes(q) ||
          (b.brand?.toLowerCase().includes(q) ?? false),
      )
    }
    return rows.slice(0, 100)
  }, [inventoryBikes, saleQuery])

  const topBikesView = useMemo(() => {
    if (canBikeListings && inventoryBikes.length > 0) {
      return [...inventoryBikes]
        .filter((b) => b.active !== false)
        .sort((a, b) => (b.stockQty ?? 0) - (a.stockQty ?? 0))
        .slice(0, 5)
        .map((b, i) => ({
          key: b.id,
          name: b.title,
          cat: b.category,
          units: b.stockQty ?? 0,
          price: b.price,
          rank: rankFromIndex(i),
        }))
    }
    return topBikesDemo.map((b) => ({
      key: b.name,
      name: b.name,
      cat: b.cat,
      units: b.units,
      price: b.price,
      rank: b.rank,
    }))
  }, [canBikeListings, inventoryBikes])

  const lineChartModel = useMemo(() => {
    if (canBookings) {
      const built = buildActivityLine(chartRange, ownerBookings, inventoryBikes)
      return {
        labels: built.labels,
        secondIsRevenue: built.secondIsRevenue,
        datasets: [
          {
            label: 'New bookings',
            data: built.bookingsPerBucket,
            borderColor: '#FF6B35',
            backgroundColor: 'rgba(255, 107, 53, 0.12)',
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#FF6B35',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
          {
            label: built.secondLabel,
            data: built.secondPerBucket,
            borderColor: '#3498DB',
            backgroundColor: 'transparent',
            tension: 0.35,
            fill: false,
            borderDash: [6, 3],
            pointRadius: 4,
            pointBackgroundColor: '#3498DB',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      }
    }
    if (canBikeListings) {
      const { labels, counts } = buildListingTrendLine(chartRange, inventoryBikes)
      return {
        labels,
        secondIsRevenue: false,
        datasets: [
          {
            label: 'New bike listings',
            data: counts,
            borderColor: '#FF6B35',
            backgroundColor: 'rgba(255, 107, 53, 0.12)',
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#FF6B35',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      }
    }
    return {
      labels: ['—'],
      secondIsRevenue: false,
      datasets: [
        {
          label: 'No data',
          data: [0],
          borderColor: '#cbd5e1',
          backgroundColor: 'rgba(203, 213, 225, 0.2)',
          tension: 0.2,
          fill: true,
          pointRadius: 3,
        },
      ],
    }
  }, [chartRange, canBookings, canBikeListings, ownerBookings, inventoryBikes])

  const lineData = useMemo(
    () => ({
      labels: lineChartModel.labels,
      datasets: lineChartModel.datasets,
    }),
    [lineChartModel],
  )

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: { usePointStyle: true, pointStyle: 'circle' as const, padding: 18, font: { size: 13 } },
        },
        tooltip: {
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          padding: 12,
          callbacks: {
            label(tooltipItem: TooltipItem<'line'>) {
              const y = tooltipItem.parsed.y
              if (y == null) return ''
              const idx = tooltipItem.datasetIndex ?? 0
              const ds = lineChartModel.datasets[idx]
              if (idx === 1 && lineChartModel.datasets[1]) {
                return lineChartModel.secondIsRevenue
                  ? `Revenue: LKR ${(Number(y) * 1000).toLocaleString()}`
                  : `${ds?.label ?? 'Series'}: ${y}`
              }
              return `${ds?.label ?? 'Value'}: ${y}`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 12 } },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
      },
    }),
    [lineChartModel],
  )

  const doughnutChart = useMemo(() => {
    if (canBikeListings && inventoryBikes.length > 0) {
      return buildBikeCategoryChart(inventoryBikes)
    }
    if (canBookings && ownerBookings.length > 0) {
      return buildBookingStatusChart(ownerBookings)
    }
    if (canBikeListings) {
      return buildBikeCategoryChart([])
    }
    if (canBookings) {
      return buildBookingStatusChart([])
    }
    return { labels: ['No data'], data: [1], colors: ['#e2e8f0'] }
  }, [canBikeListings, canBookings, inventoryBikes, ownerBookings])

  const doughnutData = useMemo(
    () => ({
      labels: doughnutChart.labels,
      datasets: [
        {
          data: doughnutChart.data,
          backgroundColor: doughnutChart.colors,
          borderWidth: 3,
          borderColor: '#fff',
        },
      ],
    }),
    [doughnutChart],
  )

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    }),
    [],
  )

  function StatLink({ to, children }: { to?: string; children: ReactNode }) {
    if (to && canShopPath(to)) {
      return (
        <Link to={to} className="sp-stat-card">
          {children}
        </Link>
      )
    }
    return <div className="sp-stat-card">{children}</div>
  }

  return (
    <>
      <div className="sp-top-bar">
        <div className="sp-welcome">
          <h1>Welcome back, {firstName}!</h1>
          <p className="sp-breadcrumb" style={{ margin: 0 }}>
            Here&apos;s what&apos;s happening with your bike shop today
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {canShopPath(ROUTES.shopBookings) ? (
            <Link to={ROUTES.shopBookings} className="sp-btn-quick sp-btn-quick-primary">
              <i className="fas fa-plus-circle" aria-hidden />
              New Booking
            </Link>
          ) : null}
          <Link to={ROUTES.shopProfile} className="sp-btn-quick sp-btn-quick-secondary">
            <i className="fas fa-cog" aria-hidden />
            Settings
          </Link>
        </div>
      </div>

      <div className="sp-stats-grid">
        <StatLink to={ROUTES.shopBookings}>
          <div className="sp-stat-header">
            <div className="sp-stat-icon orange">
              <i className="fas fa-calendar-check" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">Today&apos;s bookings (scheduled)</div>
          <div className="sp-stat-value">{canBookings ? dashMetrics.bookingsToday : '—'}</div>
          <div className="sp-stat-trend">
            {canBookings && dashMetrics.bookingsTrend.up === true ? (
              <i className="fas fa-arrow-up" aria-hidden />
            ) : null}
            {canBookings && dashMetrics.bookingsTrend.up === false ? (
              <i className="fas fa-arrow-down" aria-hidden />
            ) : null}{' '}
            {canBookings ? dashMetrics.bookingsTrend.text : 'Service bookings not enabled for this shop type'}
          </div>
        </StatLink>
        <StatLink to={ROUTES.shopBikeSales}>
          <div className="sp-stat-header">
            <div className="sp-stat-icon blue">
              <i className="fas fa-motorcycle" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">
            {canBikeListings ? 'Active bike listings' : canBookings ? 'All service bookings' : 'Bike sale'}
          </div>
          <div className="sp-stat-value">
            {canBikeListings
              ? dashMetrics.activeList
              : canBookings
                ? dashMetrics.totalBookings
                : '—'}
          </div>
          <div className="sp-stat-trend">
            {canBikeListings
              ? `${dashMetrics.newListings7d} new listing(s) in last 7 days (by created date)`
              : canBookings
                ? `${dashMetrics.bookings7d} booking record(s) created in last 7 days`
                : 'Add bike sale to your shop type to track inventory here'}
          </div>
        </StatLink>
        <StatLink to={ROUTES.shopFeedback}>
          <div className="sp-stat-header">
            <div className="sp-stat-icon green">
              <i className="fas fa-users" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">{canBookings ? 'Unique customers (bookings)' : 'Customer reviews'}</div>
          <div className="sp-stat-value">
            {canBookings ? dashMetrics.uniqueCustomers : dashMetrics.reviewCount}
          </div>
          <div className="sp-stat-trend">
            {canBookings
              ? `${dashMetrics.bookings7d} booking events (7d) · Firestore`
              : `${dashMetrics.reviewCount} review(s) in Firestore`}
          </div>
        </StatLink>
        <StatLink to={ROUTES.shopFeedback}>
          <div className="sp-stat-header">
            <div className="sp-stat-icon purple">
              <i className="fas fa-star" aria-hidden />
            </div>
          </div>
          <div className="sp-stat-label">Average rating</div>
          <div className="sp-stat-value">
            {dashMetrics.reviewCount > 0 ? dashMetrics.avgRating.toFixed(1) : '—'}
          </div>
          <div className="sp-stat-trend">
            {dashMetrics.reviewCount > 0
              ? `${dashMetrics.reviewCount} review(s) · Firestore`
              : 'No reviews yet — ask customers to leave feedback'}
          </div>
        </StatLink>
      </div>

      <div className="sp-quick-grid">
        {quickActions.map((q) => (
          <Link key={q.label} to={q.to} className="sp-quick-card">
            <div className={`sp-quick-icon ${q.cls}`}>
              <i className={`fas ${q.icon}`} aria-hidden />
            </div>
            <h4>{q.label}</h4>
          </Link>
        ))}
      </div>

      <div className="sp-charts-row">
        <div className="sp-chart-card">
          <div className="sp-chart-header">
            <h3>
              <i className="fas fa-chart-line" aria-hidden />{' '}
              {canBookings
                ? 'Bookings & revenue / listings'
                : canBikeListings
                  ? 'New bike listings over time'
                  : 'Activity'}
            </h3>
            <div className="sp-chart-filter">
              {(['Week', 'Month', 'Year'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sp-filter-btn${chartRange === r ? ' active' : ''}`}
                  onClick={() => {
                    setChartRange(r)
                    toast.message(`${r} range`, { description: 'Buckets built from Firestore timestamps.' })
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-chart-box">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>

        <div className="sp-chart-card">
          <div className="sp-chart-header">
            <h3>
              <i className="fas fa-chart-pie" aria-hidden />{' '}
              {canBikeListings ? 'Listings by category' : canBookings ? 'Bookings by status' : 'Breakdown'}
            </h3>
          </div>
          <div className="sp-doughnut-wrap">
            <div className="sp-doughnut-canvas">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="sp-doughnut-legend">
              {doughnutChart.labels.map((lbl, i) => (
                <div key={`${lbl}-${i}`} className="sp-legend-row">
                  <span className="sp-legend-dot" style={{ background: doughnutChart.colors[i] }} />
                  <span className="sp-legend-label">{lbl}</span>
                  <span className="sp-legend-val">{doughnutChart.data[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sp-activity-row">
        <div className="sp-activity-card">
          <div className="sp-activity-header">
            <h3>
              <i className="fas fa-motorcycle" aria-hidden />{' '}
              {canBikeListings ? 'Recent bike listings' : 'Bike listings'}
            </h3>
            {canBikeListings ? (
              <input
                type="search"
                className="sp-sale-search"
                placeholder="Search by title, ID, category…"
                value={saleQuery}
                onChange={(e) => setSaleQuery(e.target.value)}
                aria-label="Search bike listings"
              />
            ) : null}
          </div>
          {!canBikeListings ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--sp-gray)', lineHeight: 1.6 }}>
              This table shows your <strong>bike inventory</strong> from Firestore when your account includes the{' '}
              <strong>Bike sale</strong> business line. Use the sidebar to open modules for your shop type.
            </p>
          ) : invError ? (
            <p style={{ margin: 0, fontSize: 14, color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{invError}</p>
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Bike</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-gray)' }}>
                        Loading inventory from Firestore…
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--sp-gray)' }}>
                        No bike listings yet.{' '}
                        <Link to={ROUTES.shopBikeSales} style={{ color: 'var(--sp-primary)', fontWeight: 600 }}>
                          Add bikes in Bike sale management
                        </Link>
                        .
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((b) => {
                      const st = stockStatus(b)
                      return (
                        <tr key={b.id}>
                          <td>
                            <span className="sp-sale-id" title={b.id}>
                              {shortListingId(b.id)}
                            </span>
                          </td>
                          <td>
                            <div className="sp-bike-cell">
                              <div
                                className="sp-bike-thumb"
                                style={{ background: bikeThumbBackground(b) }}
                                role="img"
                                aria-label=""
                              >
                                {!b.images?.[0]?.trim() ? <i className="fas fa-motorcycle" aria-hidden /> : null}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{b.title || '—'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--sp-gray)' }}>
                                  {b.brand ? `${b.brand} · ` : ''}
                                  {b.year ? `${b.year}` : 'Listing'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{b.category}</td>
                          <td>
                            <span className="sp-amount">LKR {Math.max(0, b.price).toLocaleString()}</span>
                          </td>
                          <td>{b.stockQty ?? 0}</td>
                          <td>
                            <span className={`sp-status-badge ${st.cls}`}>{st.text}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sp-activity-card">
          <div className="sp-activity-header">
            <h3>
              <i className="fas fa-trophy" aria-hidden />{' '}
              {canBikeListings && inventoryBikes.length > 0 ? 'Top stock' : 'Top selling (demo)'}
            </h3>
            {canShopPath(ROUTES.shopBikeSales) ? (
              <Link to={ROUTES.shopBikeSales} style={{ color: 'var(--sp-primary)', fontWeight: 600, fontSize: '14px' }}>
                View all <i className="fas fa-arrow-right" aria-hidden />
              </Link>
            ) : (
              <span style={{ color: 'var(--sp-gray)', fontSize: '14px' }}>Demo snapshot</span>
            )}
          </div>
          <div>
            {topBikesView.map((b, i) => (
              <div key={b.key} className="sp-top-bike-item">
                <div className={rankClass(b.rank)}>{i + 1}</div>
                <div className="sp-top-bike-mid">
                  <h4>{b.name}</h4>
                  <p>
                    {b.cat} · {b.units} in stock
                  </p>
                </div>
                <div className="sp-top-bike-right">
                  <div className="sp-tbr-price">LKR {b.price.toLocaleString()}</div>
                  <div className="sp-tbr-units">
                    {canBikeListings && inventoryBikes.length > 0 ? 'Stock on hand' : 'Demo rank'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
