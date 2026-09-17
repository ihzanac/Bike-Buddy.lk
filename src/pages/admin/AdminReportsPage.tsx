import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatDateLabel } from '@/utils/date'
import { useAuth } from '@/hooks/useAuth'
import type { AdminReportPriority, AdminReportRow, AdminReportStatus } from '@/data/adminReportsSample'
import {
  createPlatformReport,
  listAllPlatformReports,
  updatePlatformReportPriority,
  updatePlatformReportStatus,
} from '@/services/platformReports'
import { describeServiceError } from '@/utils/firebaseErrors'
import '@/styles/admin-reports.css'

const PRIORITY_LBL: Record<AdminReportPriority, string> = {
  critical: '🚨 Critical',
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '🔵 Low',
}

const STATUS_LBL: Record<AdminReportStatus, string> = {
  open: '📋 Open',
  investigating: '🔍 Investigating',
  resolved: '✓ Resolved',
  closed: '🔒 Closed',
}

const PRI_FILTER: { v: string; l: string }[] = [
  { v: 'all', l: 'All priorities' },
  { v: 'critical', l: 'Critical' },
  { v: 'high', l: 'High' },
  { v: 'medium', l: 'Medium' },
  { v: 'low', l: 'Low' },
]

const ST_FILTER: { v: string; l: string }[] = [
  { v: 'all', l: 'All status' },
  { v: 'open', l: 'Open' },
  { v: 'investigating', l: 'Investigating' },
  { v: 'resolved', l: 'Resolved' },
  { v: 'closed', l: 'Closed' },
]

const DT_FILTER: { v: string; l: string }[] = [
  { v: 'all', l: 'All time' },
  { v: 'today', l: 'Today' },
  { v: 'week', l: 'This week' },
  { v: 'month', l: 'This month' },
]

type CreateReportForm = {
  reporterUid: string
  reporter: string
  phone: string
  issue: string
  shop: string
  /** When set, that shop owner account gets this complaint in Shop → Notifications. */
  targetOwnerUid: string
  priority: AdminReportPriority
  status: AdminReportStatus
  description: string
  date: string
}

function shortRepId(id: string): string {
  if (id.length <= 14) return id
  return `${id.slice(0, 10)}…`
}

function nextPriority(p: AdminReportPriority): AdminReportPriority {
  if (p === 'low') return 'medium'
  if (p === 'medium') return 'high'
  if (p === 'high') return 'critical'
  return 'critical'
}

function shopPickMatches(key: string, shop: string): boolean {
  if (key === 'all') return true
  return shop.trim() === key.trim()
}

function isThisWeek(d: string): boolean {
  const t = new Date(d + 'T12:00:00')
  const n = new Date()
  if (n.getTime() < t.getTime()) return false
  return n.getTime() - t.getTime() < 7 * 86400000
}

function isThisMonth(d: string): boolean {
  const t = new Date(d + 'T12:00:00')
  const n = new Date()
  return t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear()
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '—'
}

export function AdminReportsPage() {
  const { profile, firebaseUser } = useAuth()
  const [reports, setReports] = useState<AdminReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewRow, setViewRow] = useState<AdminReportRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState<CreateReportForm>({
    reporterUid: '',
    reporter: '',
    phone: '',
    issue: '',
    shop: '',
    targetOwnerUid: '',
    priority: 'medium',
    status: 'open',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const [headerQ, setHeaderQ] = useState('')
  const [fSearch, setFSearch] = useState('')
  const [fPriority, setFPriority] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fShop, setFShop] = useState('all')
  const [fDate, setFDate] = useState('all')
  const [applied, setApplied] = useState({
    search: '',
    priority: 'all',
    status: 'all',
    shop: 'all',
    date: 'all',
  })

  const applyFilters = useCallback(() => {
    setApplied({
      search: fSearch,
      priority: fPriority,
      status: fStatus,
      shop: fShop,
      date: fDate,
    })
  }, [fSearch, fPriority, fStatus, fShop, fDate])

  const refresh = useCallback(async () => {
    const data = await listAllPlatformReports()
    setReports(data)
  }, [])

  const openCreateModal = useCallback(() => {
    setViewRow(null)
    setCreateOpen(true)
    setCreateForm({
      reporterUid: firebaseUser?.uid ?? '',
      reporter: '',
      phone: '',
      issue: '',
      shop: '',
      targetOwnerUid: '',
      priority: 'medium',
      status: 'open',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    })
  }, [firebaseUser?.uid])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        await refresh()
      } catch (e) {
        if (!c) {
          toast.error('Could not load reports', { description: describeServiceError(e) })
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [refresh])

  const shopFilterOptions = useMemo(() => {
    const shops = new Set<string>()
    for (const r of reports) {
      const s = r.shop.trim()
      if (s) shops.add(s)
    }
    const sorted = [...shops].sort((a, b) => a.localeCompare(b))
    return [{ v: 'all', l: 'All shops' }, ...sorted.map((s) => ({ v: s, l: s }))]
  }, [reports])

  useEffect(() => {
    if (fShop === 'all') return
    if (shopFilterOptions.some((o) => o.v === fShop)) return
    setFShop('all')
  }, [fShop, shopFilterOptions])

  const todayStr = new Date().toISOString().slice(0, 10)

  const matchesDate = useCallback(
    (d: string) => {
      if (applied.date === 'all') return true
      if (applied.date === 'today') return d === todayStr
      if (applied.date === 'week') return isThisWeek(d)
      if (applied.date === 'month') return isThisMonth(d)
      return true
    },
    [applied.date, todayStr],
  )

  const stats = useMemo(() => {
    const total = reports.length
    const critical = reports.filter((r) => r.priority === 'critical').length
    const openC = reports.filter((r) => r.status === 'open').length
    const inv = reports.filter((r) => r.status === 'investigating').length
    const resolved = reports.filter((r) => r.status === 'resolved').length
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
    const thisWeek = reports.filter((r) => isThisWeek(r.date)).length
    return { total, critical, openC, inv, resolved, rate, thisWeek }
  }, [reports])

  const filtered = useMemo(() => {
    const h = headerQ.trim().toLowerCase()
    const a = applied.search.trim().toLowerCase()
    return reports.filter((r) => {
      if (h) {
        const blob = [r.id, r.reporter, r.issue, r.shop, r.phone, r.description]
          .join(' ')
          .toLowerCase()
        if (!blob.includes(h)) return false
      }
      if (a) {
        const t2 = [r.id, r.reporter, r.issue, r.description].join(' ').toLowerCase()
        if (!t2.includes(a)) return false
      }
      if (applied.priority !== 'all' && r.priority !== applied.priority) return false
      if (applied.status !== 'all' && r.status !== applied.status) return false
      if (!shopPickMatches(applied.shop, r.shop)) return false
      if (!matchesDate(r.date)) return false
      return true
    })
  }, [reports, headerQ, applied, matchesDate])

  const onResolve = async (id: string) => {
    if (!window.confirm(`Mark report ${id} as resolved?`)) return
    try {
      await updatePlatformReportStatus(id, 'resolved')
      toast.success(`Report ${id} marked as resolved`)
      await refresh()
    } catch (e) {
      toast.error('Could not update report', { description: describeServiceError(e) })
    }
  }

  const onClose = async (id: string) => {
    if (!window.confirm(`Close report ${id}?`)) return
    try {
      await updatePlatformReportStatus(id, 'closed')
      toast.message(`Report ${id} closed`)
      await refresh()
    } catch (e) {
      toast.error('Could not update report', { description: describeServiceError(e) })
    }
  }

  const onEscalate = async (r: AdminReportRow) => {
    if (r.priority === 'critical' || r.priority === 'high') return
    if (!window.confirm(`Escalate report ${r.id} to a higher priority?`)) return
    const n = nextPriority(r.priority)
    try {
      await updatePlatformReportPriority(r.id, n)
      toast.warning(`Report ${r.id} escalated to ${PRIORITY_LBL[n]}`)
      await refresh()
    } catch (e) {
      toast.error('Could not escalate report', { description: describeServiceError(e) })
    }
  }

  const onInvestigate = async (id: string) => {
    try {
      await updatePlatformReportStatus(id, 'investigating')
      toast.success(`Report ${shortRepId(id)} marked investigating`)
      await refresh()
    } catch (e) {
      toast.error('Could not update status', { description: describeServiceError(e) })
    }
  }

  async function submitCreateReport(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser) {
      toast.error('Sign in required')
      return
    }
    const reporterUid = createForm.reporterUid.trim() || firebaseUser.uid
    if (
      !createForm.reporter.trim() ||
      !createForm.issue.trim() ||
      !createForm.shop.trim() ||
      !createForm.description.trim()
    ) {
      toast.error('Reporter name, issue, shop, and description are required')
      return
    }
    setCreateSaving(true)
    try {
      const targetShopOwner = createForm.targetOwnerUid.trim()
      await createPlatformReport({
        reporterUid,
        reporter: createForm.reporter.trim(),
        phone: createForm.phone.trim(),
        issue: createForm.issue.trim(),
        shop: createForm.shop.trim(),
        priority: createForm.priority,
        status: createForm.status,
        description: createForm.description.trim(),
        date: createForm.date.slice(0, 10),
        ...(targetShopOwner ? { targetOwnerUid: targetShopOwner } : {}),
      })
      toast.success(
        targetShopOwner
          ? 'Report saved; that shop owner will see it under Shop → Notifications'
          : 'Report saved to Firestore',
      )
      setCreateOpen(false)
      await refresh()
    } catch (err) {
      toast.error('Could not create report', { description: describeServiceError(err) })
    } finally {
      setCreateSaving(false)
    }
  }

  const exportCsv = () => {
    const head =
      'Id,Reporter,Phone,Issue,Shop,NotifyShopOwnerUid,Priority,Status,Date,Description\n'
    const body = filtered
      .map((r) =>
        [
          r.id,
          r.reporter,
          r.phone,
          r.issue,
          r.shop,
          r.targetOwnerUid ?? '',
          r.priority,
          r.status,
          r.date,
          r.description,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n')
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bikebuddy-reports.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.message('Download started')
  }

  if (loading) {
    return (
      <div className="bb-rp">
        <p className="bb-rp-loading">Loading reports…</p>
      </div>
    )
  }

  return (
    <div className="bb-rp">
      <div className="bb-rp-topbar">
        <div className="bb-rp-topbar-left">
          <h1 className="bb-rp-topbar-title">Reports &amp; complaints</h1>
          <div className="bb-rp-search-bar">
            <span className="bb-rp-search-icon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder="Search reports, issues, users…"
              value={headerQ}
              onChange={(e) => setHeaderQ(e.target.value)}
              aria-label="Search reports"
            />
          </div>
        </div>
        <div className="bb-rp-topbar-right">
          <button type="button" className="bb-rp-btn bb-rp-btn-pri" onClick={openCreateModal}>
            <span>➕</span>
            <span>New report</span>
          </button>
          <button
            type="button"
            className="bb-rp-notify"
            aria-label="Jump to reports list"
            title="Jump to reports list"
            onClick={() =>
              document.getElementById('rp-all-reports')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          >
            🔔
            <span className="bb-rp-notify-badge" aria-hidden>
              {stats.openC + stats.inv}
            </span>
          </button>
        </div>
      </div>

      <div className="bb-rp-hero">
        <div className="bb-rp-hero-inner">
          <div className="bb-rp-hero-title">
            <span>⚠️</span>
            <span>Reports &amp; complaints management</span>
          </div>
          <p className="bb-rp-hero-sub">
            Monitor user complaints, track reported issues, investigate problems, escalate critical cases, and
            resolve disputes across the platform
          </p>
        </div>
      </div>

      <div className="bb-rp-stats">
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon red">⚠️</div>
          </div>
          <div className="bb-rp-stat-num">{stats.total}</div>
          <div className="bb-rp-stat-lbl">Total reports</div>
          <div className="bb-rp-trend warn">
            <span>↑</span>
            <span>{stats.thisWeek > 0 ? `${stats.thisWeek} this week` : 'No new this week'}</span>
          </div>
        </div>
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon rose">🚨</div>
          </div>
          <div className="bb-rp-stat-num">{stats.critical}</div>
          <div className="bb-rp-stat-lbl">Critical priority</div>
          <div className="bb-rp-trend warn">
            <span>⚠️</span>
            <span>Needs attention</span>
          </div>
        </div>
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon orange">📋</div>
          </div>
          <div className="bb-rp-stat-num">{stats.openC}</div>
          <div className="bb-rp-stat-lbl">Open cases</div>
          <div className="bb-rp-trend warn">
            <span>→</span>
            <span>Under review</span>
          </div>
        </div>
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon amber">🔍</div>
          </div>
          <div className="bb-rp-stat-num">{stats.inv}</div>
          <div className="bb-rp-stat-lbl">Investigating</div>
          <div className="bb-rp-trend">
            <span>→</span>
            <span>In progress</span>
          </div>
        </div>
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon emerald">✓</div>
          </div>
          <div className="bb-rp-stat-num">{stats.resolved}</div>
          <div className="bb-rp-stat-lbl">Resolved</div>
          <div className="bb-rp-trend ok">
            <span>↓</span>
            <span>This week</span>
          </div>
        </div>
        <div className="bb-rp-stat">
          <div className="bb-rp-stat-head">
            <div className="bb-rp-stat-icon slate">📊</div>
          </div>
          <div className="bb-rp-stat-num">{stats.rate}%</div>
          <div className="bb-rp-stat-lbl">Resolution rate</div>
          <div className="bb-rp-trend ok">
            <span>↓</span>
            <span>Good rate</span>
          </div>
        </div>
      </div>

      <div className="bb-rp-section" id="rp-all-reports">
        <div className="bb-rp-section-h">
          <h2 className="bb-rp-sec-title">All reports &amp; complaints</h2>
          <div className="bb-rp-section-actions">
            <button type="button" className="bb-rp-btn bb-rp-btn-sec" onClick={exportCsv}>
              <span>📥</span>
              <span>Export</span>
            </button>
            <button type="button" className="bb-rp-btn bb-rp-btn-pri" onClick={openCreateModal}>
              <span>➕</span>
              <span>New report</span>
            </button>
          </div>
        </div>

        <div className="bb-rp-filters">
          <div className="bb-rp-fg">
            <span className="bb-rp-flb">Search</span>
            <input
              className="bb-rp-fin"
              value={fSearch}
              onChange={(e) => setFSearch(e.target.value)}
              placeholder="Report ID, user…"
            />
          </div>
          <div className="bb-rp-fg">
            <span className="bb-rp-flb">Priority</span>
            <select
              className="bb-rp-fsel"
              value={fPriority}
              onChange={(e) => setFPriority(e.target.value)}
            >
              {PRI_FILTER.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-rp-fg">
            <span className="bb-rp-flb">Status</span>
            <select className="bb-rp-fsel" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              {ST_FILTER.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-rp-fg">
            <span className="bb-rp-flb">Shop</span>
            <select className="bb-rp-fsel" value={fShop} onChange={(e) => setFShop(e.target.value)}>
              {shopFilterOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-rp-fg">
            <span className="bb-rp-flb">Date</span>
            <select className="bb-rp-fsel" value={fDate} onChange={(e) => setFDate(e.target.value)}>
              {DT_FILTER.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <div className="bb-rp-fg bb-rp-apply">
            <button type="button" className="bb-rp-btn bb-rp-btn-pri" onClick={applyFilters}>
              Apply
            </button>
          </div>
        </div>

        <div className="bb-rp-table-wrap">
          <table className="bb-rp-tbl">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Reporter</th>
                <th>Issue type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Reported on</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="bb-rp-empty">
                      <div className="bb-rp-empty-ico" aria-hidden>
                        ⚠️
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: 'var(--rp-dark, #0f172a)',
                          marginBottom: 6,
                        }}
                      >
                        No reports found
                      </div>
                      <div>
                        {reports.length === 0
                          ? 'No rows in Firestore yet — use New report above (requires deployed `platformReports` rules), or add documents in the Console.'
                          : 'Try adjusting your filters'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="bb-rp-id" title={r.id}>
                        {shortRepId(r.id)}
                      </span>
                    </td>
                    <td>
                      <div className="bb-rp-cust">
                        <div className="bb-rp-cust-av">{initials(r.reporter)}</div>
                        <div>
                          <div className="bb-rp-cust-name">{r.reporter}</div>
                          <div className="bb-rp-cust-phone">{r.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="bb-rp-issue">{r.issue}</div>
                      <div className="bb-rp-shop">{r.shop}</div>
                    </td>
                    <td>
                      <span className={`bb-rp-bdg-pri ${r.priority}`}>
                        {PRIORITY_LBL[r.priority]}
                      </span>
                    </td>
                    <td>
                      <span className={`bb-rp-bdg-st ${r.status}`}>{STATUS_LBL[r.status]}</span>
                    </td>
                    <td className="bb-rp-dt">
                      {formatDateLabel(r.date.length === 10 ? `${r.date}T12:00:00` : r.date)}
                    </td>
                    <td>
                      <div className="bb-rp-act">
                        <button
                          type="button"
                          className="bb-rp-a view"
                          title="View"
                          onClick={() => {
                            setCreateOpen(false)
                            setViewRow(r)
                          }}
                        >
                          👁
                        </button>
                        {r.status === 'open' ? (
                          <button
                            type="button"
                            className="bb-rp-a investigate"
                            title="Mark investigating"
                            onClick={() => void onInvestigate(r.id)}
                          >
                            🔍
                          </button>
                        ) : null}
                        {r.status !== 'resolved' && r.status !== 'closed' ? (
                          <button
                            type="button"
                            className="bb-rp-a resolve"
                            title="Mark resolved"
                            onClick={() => void onResolve(r.id)}
                          >
                            ✓
                          </button>
                        ) : null}
                        {r.priority === 'low' || r.priority === 'medium' ? (
                          <button
                            type="button"
                            className="bb-rp-a escalate"
                            title="Escalate"
                            onClick={() => void onEscalate(r)}
                          >
                            ⚠️
                          </button>
                        ) : null}
                        {r.status !== 'closed' ? (
                          <button
                            type="button"
                            className="bb-rp-a close"
                            title="Close"
                            onClick={() => void onClose(r.id)}
                          >
                            🔒
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <div
          className="bb-rp-mdl"
          role="dialog"
          aria-modal
          aria-labelledby="rp-create-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false)
          }}
        >
          <div className="bb-rp-mdl-in">
            <div className="bb-rp-mdl-h">
              <h3 className="bb-rp-mdl-t" id="rp-create-title">
                New report / complaint
              </h3>
              <button
                type="button"
                className="bb-rp-mdl-x"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form className="bb-rp-mdl-form" onSubmit={(e) => void submitCreateReport(e)}>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Reporter user ID (Firebase UID)</span>
                <input
                  className="bb-rp-fin"
                  value={createForm.reporterUid}
                  onChange={(e) => setCreateForm((f) => ({ ...f, reporterUid: e.target.value }))}
                  placeholder={firebaseUser?.uid ?? 'Customer Firebase Auth UID'}
                  autoComplete="off"
                />
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Reporter name *</span>
                <input
                  className="bb-rp-fin"
                  required
                  value={createForm.reporter}
                  onChange={(e) => setCreateForm((f) => ({ ...f, reporter: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Phone</span>
                <input
                  className="bb-rp-fin"
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+94 …"
                />
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Shop / subject *</span>
                <input
                  className="bb-rp-fin"
                  required
                  value={createForm.shop}
                  onChange={(e) => setCreateForm((f) => ({ ...f, shop: e.target.value }))}
                  placeholder="Shop name or location"
                />
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Notify shop owner (Firebase UID)</span>
                <input
                  className="bb-rp-fin"
                  value={createForm.targetOwnerUid}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, targetOwnerUid: e.target.value }))
                  }
                  placeholder="Optional — paste the shop owner’s UID from Admin → Users"
                  autoComplete="off"
                  aria-describedby="rp-target-owner-hint"
                />
                <p className="bb-rp-mdl-hint" id="rp-target-owner-hint">
                  If set, that approved shop account receives this complaint in{' '}
                  <strong>Shop → Notifications</strong>. Leave blank for admin-only tracking.
                </p>
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Issue type *</span>
                <input
                  className="bb-rp-fin"
                  required
                  value={createForm.issue}
                  onChange={(e) => setCreateForm((f) => ({ ...f, issue: e.target.value }))}
                  placeholder="Short summary"
                />
              </div>
              <div className="bb-rp-filters" style={{ margin: 0, padding: 16 }}>
                <div className="bb-rp-fg">
                  <span className="bb-rp-flb">Priority</span>
                  <select
                    className="bb-rp-fsel"
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        priority: e.target.value as AdminReportPriority,
                      }))
                    }
                  >
                    {(Object.keys(PRIORITY_LBL) as AdminReportPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LBL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bb-rp-fg">
                  <span className="bb-rp-flb">Status</span>
                  <select
                    className="bb-rp-fsel"
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        status: e.target.value as AdminReportStatus,
                      }))
                    }
                  >
                    {(Object.keys(STATUS_LBL) as AdminReportStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LBL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bb-rp-fg">
                  <span className="bb-rp-flb">Report date</span>
                  <input
                    className="bb-rp-fin"
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="bb-rp-fg">
                <span className="bb-rp-flb">Description *</span>
                <textarea
                  className="bb-rp-fin"
                  required
                  rows={5}
                  maxLength={8000}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What happened?"
                />
              </div>
              <div className="bb-rp-mdl-actions">
                <button
                  type="button"
                  className="bb-rp-btn bb-rp-btn-sec"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="bb-rp-btn bb-rp-btn-pri" disabled={createSaving}>
                  {createSaving ? 'Saving…' : 'Save report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewRow ? (
        <div
          className="bb-rp-mdl"
          role="dialog"
          aria-modal
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewRow(null)
          }}
        >
          <div className="bb-rp-mdl-in">
            <div className="bb-rp-mdl-h">
              <div>
                <h3 className="bb-rp-mdl-t">Report {viewRow.id}</h3>
                <p className="bb-rp-mdl-p">
                  {viewRow.reporter} · {viewRow.phone} · {viewRow.shop}
                </p>
                <p className="bb-rp-mdl-p" style={{ marginTop: 8 }}>
                  <span className={`bb-rp-bdg-pri ${viewRow.priority}`}>
                    {PRIORITY_LBL[viewRow.priority]}
                  </span>{' '}
                  <span className={`bb-rp-bdg-st ${viewRow.status}`}>
                    {STATUS_LBL[viewRow.status]}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="bb-rp-mdl-x"
                onClick={() => setViewRow(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p style={{ fontWeight: 600, color: 'var(--rp-dark)', marginBottom: 8 }}>{viewRow.issue}</p>
            {viewRow.targetOwnerUid ? (
              <p className="bb-rp-mdl-hint" style={{ marginBottom: 12 }}>
                Sent to shop owner UID <code>{viewRow.targetOwnerUid}</code> (their Shop → Notifications).
              </p>
            ) : null}
            <div className="bb-rp-mdl-body">{viewRow.description}</div>
            <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
              Reported:{' '}
              {formatDateLabel(
                viewRow.date.length === 10 ? `${viewRow.date}T12:00:00` : viewRow.date,
              )}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
