import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatPartsRevenueLkr } from '@/data/partsShopsSample'
import type { PartsShop, PartsShopStatus, PartsStockLevel } from '@/types/partsShop'
import { useAuth } from '@/hooks/useAuth'
import { useAdminHeaderSearch } from '@/hooks/useAdminHeaderSearch'
import { adminProvisionPartsShopOwner } from '@/services/auth'
import { loadAdminPartsShopsFromFirestore } from '@/services/adminPartsShops'
import { isFirebaseConfigured } from '@/services/firebase'
import {
  createPartsShop,
  createPartsShopAtOwnerUid,
  deletePartsShop,
  getPartsShopById,
  updatePartsShop,
} from '@/services/partsShops'
import { adminDeleteUserDocument } from '@/services/users'
import '@/styles/admin-parts-shops.css'
import { rowMatchesAdminQuery } from '@/utils/adminSearch'
import { getErrorCode, mapFirebaseAuthError, mapServiceError } from '@/utils/firebaseErrors'
import { SRI_LANKA_DISTRICTS } from '@/utils/sriLankaDistricts'

type SortKey = 'newest' | 'name' | 'parts' | 'revenue'

type PartsDetailState = null | { mode: 'view'; row: PartsShop } | { mode: 'edit'; row: PartsShop }

function stockSelectLabel(l: PartsStockLevel): string {
  if (l === 'high') return 'High Stock'
  if (l === 'low') return 'Low Stock'
  return 'Medium Stock'
}

function statusText(s: PartsShopStatus) {
  if (s === 'active') return '✓ Active'
  if (s === 'pending') return '⏳ Pending'
  return '⚠️ Inactive'
}

function stockBadgeText(l: PartsStockLevel) {
  if (l === 'high') return '📦 High Stock'
  if (l === 'medium') return '📊 Medium Stock'
  return '⚠️ Low Stock'
}

function parseStock(s: string): PartsStockLevel {
  const t = s.toLowerCase()
  if (t.includes('high')) return 'high'
  if (t.includes('low')) return 'low'
  return 'medium'
}

function computeStats(rows: PartsShop[]) {
  const total = rows.length
  const active = rows.filter((r) => r.status === 'active').length
  const totalParts = rows.reduce((a, r) => a + r.parts, 0)
  const totalOrders = rows.reduce((a, r) => a + r.orders, 0)
  const revenueK = rows.reduce((a, r) => a + r.revenueK, 0)
  const lowStock = rows.filter((r) => r.stockLevel === 'low').length
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0
  return { total, active, totalParts, totalOrders, revenueK, lowStock, activePct, revLabel: formatPartsRevenueLkr(revenueK) }
}

function partsShopSearchParts(r: PartsShop) {
  return [
    r.name,
    r.email,
    r.city,
    r.district,
    r.owner,
    r.phone,
    String(r.id),
    r.ownerUid ?? '',
    r.address,
    r.revenue,
  ] as const
}

export function AdminPartsShopsPage() {
  const { firebaseUser } = useAuth()
  const adminUid = firebaseUser?.uid ?? ''
  const adminHeaderSearch = useAdminHeaderSearch()
  const [shops, setShops] = useState<PartsShop[]>([])
  const [listMeta, setListMeta] = useState({ excludedSeeds: 0, excludedInvalidShape: 0 })
  const [shopsLoading, setShopsLoading] = useState(true)
  /** Re-fetch without blanking the grid (manual Refresh + after saves). */
  const [shopsRefreshing, setShopsRefreshing] = useState(false)
  const [shopMutating, setShopMutating] = useState(false)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [topQuery, setTopQuery] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [district, setDistrict] = useState('all')
  const [status, setStatus] = useState('all')
  const [stock, setStock] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [modalOpen, setModalOpen] = useState(false)
  const [partsDetail, setPartsDetail] = useState<PartsDetailState>(null)
  const [editDoc, setEditDoc] = useState<PartsShop | null>(null)
  const [editLoadError, setEditLoadError] = useState(false)

  const stats = useMemo(() => computeStats(shops), [shops])

  const pendingApprovalCount = useMemo(() => {
    return shops.filter((r) => {
      if (r.ownerStatus !== undefined) return r.ownerStatus === 'pending'
      return r.status === 'pending'
    }).length
  }, [shops])

  const reload = useCallback(async (options?: { notify?: boolean; soft?: boolean }) => {
    if (!isFirebaseConfigured) {
      setShops([])
      setShopsLoading(false)
      setShopsRefreshing(false)
      if (options?.notify) {
        toast.error('Firebase is not configured.')
      }
      return
    }

    const soft = Boolean(options?.soft) || Boolean(options?.notify)
    if (soft) {
      setShopsRefreshing(true)
    } else {
      setShopsLoading(true)
    }

    try {
      const { rows, meta } = await loadAdminPartsShopsFromFirestore()
      setShops(rows)
      setListMeta(meta)
      if (options?.notify) {
        toast.success('Refreshed')
      }
    } catch (err) {
      console.error(err)
      toast.error(mapServiceError(getErrorCode(err)))
      if (!soft) {
        setShops([])
      }
    } finally {
      setShopsLoading(false)
      setShopsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!partsDetail || partsDetail.mode !== 'edit') {
      setEditDoc(null)
      setEditLoadError(false)
      return
    }
    const dirId = partsDetail.row.directoryDocId
    if (!dirId) {
      setEditLoadError(false)
      setEditDoc({ ...partsDetail.row })
      return
    }
    let cancelled = false
    setEditDoc(null)
    setEditLoadError(false)
    void getPartsShopById(dirId).then((d) => {
      if (cancelled) return
      if (!d) setEditLoadError(true)
      else setEditDoc(d)
    })
    return () => {
      cancelled = true
    }
  }, [partsDetail])

  const closePartsDetail = useCallback(() => setPartsDetail(null), [])

  const filtered = useMemo(() => {
    let list = [...shops]
    const parts = (r: PartsShop) => partsShopSearchParts(r)
    list = list.filter(
      (r) =>
        rowMatchesAdminQuery(parts(r), adminHeaderSearch) && rowMatchesAdminQuery(parts(r), topQuery),
    )
    const fq = filterSearch.trim().toLowerCase()
    if (fq) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(fq) || r.address.toLowerCase().includes(fq),
      )
    }
    if (district !== 'all') list = list.filter((r) => r.district === district)
    if (status !== 'all') list = list.filter((r) => r.status === (status as PartsShopStatus))
    if (stock !== 'all') {
      list = list.filter((r) => r.stockLevel === (stock as PartsStockLevel))
    }
    const out = [...list]
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'parts') out.sort((a, b) => b.parts - a.parts)
    else if (sort === 'revenue') out.sort((a, b) => b.revenueK - a.revenueK)
    else
      out.sort(
        (a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || b.id.localeCompare(a.id),
      )
    return out
  }, [shops, adminHeaderSearch, topQuery, filterSearch, district, status, stock, sort])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const applyFilters = useCallback(() => {
    toast.success('Filters applied')
  }, [])

  const exportCsv = useCallback(() => {
    const h = 'name,email,district,parts,orders,status,stock'
    const lines = filtered.map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}",${r.email},${r.district},${r.parts},${r.orders},${r.status},${r.stockLevel}`,
    )
    const blob = new Blob([[h, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'parts-shops.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Export started')
  }, [filtered])

  const onAdd = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!isFirebaseConfigured) {
        toast.error('Firebase is not configured.')
        return
      }
      const form = e.currentTarget
      const fd = new FormData(form)
      const shopName = String(fd.get('shopName') ?? '').trim()
      const owner = String(fd.get('ownerName') ?? '')
      const phone = String(fd.get('phone') ?? '')
      const email = String(fd.get('email') ?? '').trim()
      const password = String(fd.get('password') ?? '')
      const confirmPassword = String(fd.get('confirmPassword') ?? '')
      const districtVal = String(fd.get('district') ?? '')
      const city = String(fd.get('city') ?? '')
      const address = String(fd.get('address') ?? '')
      const st = String(fd.get('status') ?? 'pending') as PartsShopStatus
      const statusVal: PartsShopStatus =
        st === 'active' || st === 'inactive' || st === 'pending' ? st : 'pending'
      const sk = parseStock(String(fd.get('stockLevel') ?? 'medium'))
      const p = Math.max(0, parseInt(String(fd.get('parts') ?? '0'), 10) || 0)
      const desc = String(fd.get('description') ?? '').trim()

      if (!shopName || !owner.trim() || !phone || !email || !districtVal || !address.trim()) {
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

      setShopMutating(true)
      try {
        const { uid } = await adminProvisionPartsShopOwner({
          email,
          password,
          ownerName: owner.trim(),
          phone: phone.trim(),
          shopName,
          shopAddress: address.trim(),
          district: districtVal,
          city: city.trim() || undefined,
        })
        await createPartsShopAtOwnerUid(uid, {
          name: shopName,
          owner: owner.trim(),
          phone: phone.trim(),
          email,
          district: districtVal,
          city: city.trim(),
          address: address.trim(),
          parts: p,
          orders: 0,
          revenueK: 0,
          stockLevel: sk,
          status: statusVal,
          established: String(fd.get('established') ?? '').trim() || '—',
          description: desc || undefined,
          ownerId: uid,
        })
        form.reset()
        closeModal()
        toast.success(
          'Parts shop owner account created — pending approval like self-registrations.',
        )
        await reload({ soft: true })
      } catch (err) {
        const code = getErrorCode(err)
        const msg = code?.startsWith('auth/')
          ? mapFirebaseAuthError(code)
          : mapServiceError(code)
        toast.error(msg)
      } finally {
        setShopMutating(false)
      }
    },
    [closeModal, reload],
  )

  const remove = useCallback(
    async (row: PartsShop, shopName: string) => {
      if (!isFirebaseConfigured) {
        toast.error('Firebase is not configured.')
        return
      }
      const docId = row.directoryDocId?.trim() || ''
      const ownerUid = (row.ownerUid ?? row.ownerId ?? '').trim()
      const isOwnerListRow = Boolean(ownerUid && row.id === ownerUid)

      if (docId) {
        if (!window.confirm(`Delete the partsShops directory document for “${shopName}”?`)) return
        setDeletingRowId(row.id)
        try {
          await deletePartsShop(docId)
          toast.success(`🗑 Directory removed for ${shopName}`)
          await reload({ soft: true })
        } catch (err) {
          toast.error(mapServiceError(getErrorCode(err)))
        } finally {
          setDeletingRowId(null)
        }
        return
      }

      if (isOwnerListRow && ownerUid) {
        if (ownerUid === adminUid) {
          toast.error('You cannot delete your own account.')
          return
        }
        if (
          !window.confirm(
            `No partsShops document exists for this owner. Delete the Firestore user profile for “${shopName}”?\n\nUID: ${ownerUid}\n\nThis removes the users document only. Remove the Firebase Auth user separately in the console if needed.`,
          )
        ) {
          return
        }
        setDeletingRowId(row.id)
        try {
          await adminDeleteUserDocument(ownerUid)
          toast.success(`Removed ${shopName} from users.`)
          await reload({ soft: true })
        } catch (err) {
          console.error(err)
          toast.error('Could not delete user document.')
        } finally {
          setDeletingRowId(null)
        }
        return
      }

      toast.warning('Nothing to delete — this row has no directory document and no owner uid.')
    },
    [reload, adminUid],
  )

  const onEditSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!isFirebaseConfigured) {
        toast.error('Firebase is not configured.')
        return
      }
      const row = partsDetail?.mode === 'edit' ? partsDetail.row : null
      const docId = row?.directoryDocId ?? null
      if (!editDoc || !row) return
      const ownerUid = (row.ownerUid ?? row.ownerId ?? '').trim()
      if (!docId && !ownerUid) {
        toast.error('Cannot save directory without an owner uid.')
        return
      }
      const form = e.currentTarget
      const fd = new FormData(form)
      const st = String(fd.get('status') ?? 'pending') as PartsShopStatus
      const statusVal: PartsShopStatus =
        st === 'active' || st === 'inactive' || st === 'pending' ? st : 'pending'
      const sk = parseStock(String(fd.get('stockLevel') ?? 'medium'))
      const partsNum = Math.max(0, parseInt(String(fd.get('parts') ?? '0'), 10) || 0)
      const ordersNum = Math.max(0, parseInt(String(fd.get('orders') ?? '0'), 10) || 0)
      const revenueNum = Math.max(0, parseFloat(String(fd.get('revenueK') ?? '0')) || 0)
      const desc = String(fd.get('description') ?? '').trim()
      const payload = {
        name: String(fd.get('shopName') ?? '').trim(),
        owner: String(fd.get('ownerName') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        email: String(fd.get('email') ?? ''),
        district: String(fd.get('district') ?? ''),
        city: String(fd.get('city') ?? ''),
        address: String(fd.get('address') ?? ''),
        parts: partsNum,
        orders: ordersNum,
        revenueK: revenueNum,
        stockLevel: sk,
        status: statusVal,
        established: String(fd.get('established') ?? '').trim() || '—',
        description: desc || undefined,
      }
      setShopMutating(true)
      try {
        if (docId) {
          await updatePartsShop(docId, payload)
          toast.success('Shop updated')
        } else {
          await createPartsShop({ ...payload, ownerId: ownerUid })
          toast.success('Directory created and linked to owner')
        }
        closePartsDetail()
        await reload({ soft: true })
      } catch (err) {
        toast.error(mapServiceError(getErrorCode(err)))
      } finally {
        setShopMutating(false)
      }
    },
    [partsDetail, editDoc, reload, closePartsDetail],
  )

  return (
    <div className="bb-parts-shops">
      <header className="pp-header">
        <div className="pp-hl">
          <h1 className="pp-ht">Parts Shops</h1>
          <div className="pp-search">
            <span className="pp-si" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder="Search parts shops, inventory…"
              value={topQuery}
              onChange={(e) => setTopQuery(e.target.value)}
              aria-label="Search"
            />
          </div>
        </div>
        <div className="pp-hr">
          <button
            type="button"
            className={`pp-add${shopsRefreshing ? ' pp-add--refreshing' : ''}`}
            onClick={() => void reload({ notify: true })}
            disabled={shopsLoading || shopsRefreshing}
            aria-busy={shopsRefreshing}
            aria-label={shopsRefreshing ? 'Refreshing parts shops' : 'Refresh parts shops list'}
          >
            <span className={shopsRefreshing ? 'pp-refresh-icon' : undefined} aria-hidden>
              ↻
            </span>
            {shopsRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="pp-add" onClick={() => setModalOpen(true)}>
            <span>➕</span> Add Shop
          </button>
          <button
            type="button"
            className="pp-bell"
            onClick={() =>
              pendingApprovalCount > 0
                ? toast.message(`${pendingApprovalCount} shop(s) pending approval`)
                : toast.message('No pending approvals')
            }
            aria-label="Pending parts shop approvals"
          >
            🔔
            <span className="pp-bb" aria-hidden>
              {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
            </span>
          </button>
        </div>
      </header>

      <div className="pp-hero">
        <div className="pp-hero-in">
          <h2 className="pp-ht2">
            <span className="pp-ht2-ic" aria-hidden>
              📦
            </span>
            Parts Shops Management
          </h2>
          <p className="pp-hsub">
            Manage bike parts inventory, track stock levels, monitor supplier networks, and ensure quality parts
            availability across all locations.
          </p>
        </div>
      </div>

      <div className="pp-stats">
        <div className="pp-st">
          <div className="pp-sic pu" aria-hidden>
            📦
          </div>
          <div className="pp-snum">{stats.total}</div>
          <div className="pp-slbl">Rows (owners + extras)</div>
          <div className="pp-str">
            <span>●</span> Live from Firestore
          </div>
        </div>
        <div className="pp-st">
          <div className="pp-sic gr" aria-hidden>
            ✓
          </div>
          <div className="pp-snum">{stats.active}</div>
          <div className="pp-slbl">Active Shops</div>
          <div className="pp-str">
            <span>●</span> {stats.total > 0 ? `${stats.activePct}% active` : '—'}
          </div>
        </div>
        <div className="pp-st">
          <div className="pp-sic cy" aria-hidden>
            📋
          </div>
          <div className="pp-snum">{stats.totalParts.toLocaleString()}</div>
          <div className="pp-slbl">Parts in Stock</div>
          <div className="pp-str">
            <span>●</span> Sum of accessory rows per owner
          </div>
        </div>
        <div className="pp-st">
          <div className="pp-sic pi" aria-hidden>
            🛒
          </div>
          <div className="pp-snum">{stats.totalOrders.toLocaleString()}</div>
          <div className="pp-slbl">Orders (sum)</div>
          <div className="pp-str">
            <span>●</span> Stored on each shop doc
          </div>
        </div>
        <div className="pp-st">
          <div className="pp-sic am" aria-hidden>
            💰
          </div>
          <div className="pp-snum">{stats.revLabel}</div>
          <div className="pp-slbl">Total Revenue (LKR)</div>
          <div className="pp-str">
            <span>●</span> From <code className="pp-hcode">revenueK</code>
          </div>
        </div>
        <div className="pp-st">
          <div className="pp-sic re" aria-hidden>
            ⚠️
          </div>
          <div className="pp-snum">{stats.lowStock}</div>
          <div className="pp-slbl">Low Stock Shops</div>
          <div className="pp-str m">
            <span>●</span> stockLevel = low
          </div>
        </div>
      </div>

      <div className="pp-sec">
        <div className="pp-sh">
          <h2 className="pp-sti">All Parts Shops</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="pp-bt pp-b2" onClick={exportCsv}>
              <span>📥</span> Export Data
            </button>
            <button type="button" className="pp-bt pp-b1" onClick={() => setModalOpen(true)}>
              <span>➕</span> Add Parts Shop
            </button>
          </div>
        </div>

        <div className="pp-fil">
          <div className="pp-fg">
            <span className="pp-fl">🔍 Search</span>
            <input
              className="pp-fi"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Shop name…"
            />
          </div>
          <div className="pp-fg">
            <span className="pp-fl">📍 District</span>
            <select
              className="pp-fs"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="all">All Districts</option>
              {SRI_LANKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="pp-fg">
            <span className="pp-fl">⚡ Status</span>
            <select className="pp-fs" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="pp-fg">
            <span className="pp-fl">📦 Stock</span>
            <select className="pp-fs" value={stock} onChange={(e) => setStock(e.target.value)}>
              <option value="all">All Levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="pp-fg">
            <span className="pp-fl">📊 Sort</span>
            <select
              className="pp-fs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">Newest First</option>
              <option value="name">Name A–Z</option>
              <option value="parts">Most Parts</option>
              <option value="revenue">Highest Revenue</option>
            </select>
          </div>
          <div className="pp-fg" style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="pp-bt pp-b1" onClick={applyFilters}>
              Apply Filters
            </button>
          </div>
        </div>

        <div className="pp-grid">
          {isFirebaseConfigured && shopsLoading ? (
            <div className="pp-empty">
              <div className="pp-ei" aria-hidden>
                ⏳
              </div>
              <div className="pp-et">Loading shops…</div>
              <p className="pp-ep">Syncing from Firestore</p>
            </div>
          ) : !isFirebaseConfigured ? (
            <div className="pp-empty">
              <div className="pp-ei" aria-hidden>
                📦
              </div>
              <div className="pp-et">Firebase not configured</div>
              <p className="pp-ep">Set VITE_FIREBASE_* in <code className="pp-hcode">.env</code> to load real data.</p>
            </div>
          ) : shops.length === 0 ? (
            <div className="pp-empty">
              <div className="pp-ei" aria-hidden>
                📦
              </div>
              <div className="pp-et">No shop owners loaded</div>
              <p className="pp-ep">
                This list is built from <code className="pp-hcode">users</code> (role owner). If Firestore has no
                owners yet, register one or run your bootstrap script. Extra rows come from{' '}
                <code className="pp-hcode">partsShops</code> directory docs.
              </p>
              {listMeta.excludedSeeds > 0 ? (
                <p className="pp-ep">
                  Firestore currently has <strong>{listMeta.excludedSeeds}</strong> hidden{' '}
                  <code className="pp-hcode">seed-*</code> doc{listMeta.excludedSeeds === 1 ? '' : 's'}.
                </p>
              ) : null}
              {listMeta.excludedInvalidShape > 0 ? (
                <p className="pp-ep">
                  <strong>{listMeta.excludedInvalidShape}</strong> other doc
                  {listMeta.excludedInvalidShape === 1 ? '' : 's'} in <code className="pp-hcode">partsShops</code>{' '}
                  could not be shown (check fields and enums).
                </p>
              ) : null}
              <button type="button" className="pp-bt pp-b1" onClick={() => setModalOpen(true)}>
                ➕ Add Parts Shop
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="pp-empty">
              <div className="pp-ei" aria-hidden>
                🔍
              </div>
              <div className="pp-et">No shops match</div>
              <p className="pp-ep">
                Clear filters, this page&apos;s search, and the <strong>Admin</strong> header search—they all filter
                this grid.
              </p>
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="pp-card">
                <div className="pp-crh">
                  <h3 className="pp-cn">{r.name}</h3>
                  <p className="pp-ca">📍 {r.address}</p>
                </div>
                <div className="pp-cb">
                  <div>
                    <span className={`pp-sta ${r.status}`}>{statusText(r.status)}</span>
                  </div>
                  <div>
                    <span className={`pp-stk ${r.stockLevel}`}>{stockBadgeText(r.stockLevel)}</span>
                  </div>
                  <div className="pp-rows">
                    {(
                      [
                        ['👤', 'Owner', r.owner],
                        ['📞', 'Contact', r.phone],
                        ['📧', 'Email', r.email],
                        ['📍', 'Location', `${r.city}, ${r.district}`],
                      ] as const
                    ).map(([ico, lab, val]) => (
                      <div key={lab} className="pp-row">
                        <span className="pp-ic" aria-hidden>
                          {ico}
                        </span>
                        <div>
                          <div className="pp-rl">{lab}</div>
                          <div className="pp-rv">{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pp-mini">
                    <div>
                      <span className="pp-mn">{r.parts}</span>
                      <span className="pp-ms">Parts</span>
                    </div>
                    <div>
                      <span className="pp-mn">{r.orders}</span>
                      <span className="pp-ms">Orders</span>
                    </div>
                    <div>
                      <span className="pp-mn" style={{ fontSize: 17, color: '#7c3aed' }}>
                        LKR {r.revenue}
                      </span>
                      <span className="pp-ms">Revenue</span>
                    </div>
                  </div>
                  <div className="pp-act">
                    <button
                      type="button"
                      className="pp-bt pp-bv"
                      onClick={() => setPartsDetail({ mode: 'view', row: r })}
                    >
                      👁 View
                    </button>
                    <button
                      type="button"
                      className="pp-bt pp-be"
                      onClick={() => setPartsDetail({ mode: 'edit', row: r })}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="pp-bt pp-bd"
                      disabled={deletingRowId === r.id}
                      title={
                        r.directoryDocId
                          ? 'Remove this partsShops document'
                          : r.ownerUid && r.id === r.ownerUid
                            ? 'Remove users profile (no partsShops doc yet)'
                            : undefined
                      }
                      onClick={() => remove(r, r.name)}
                    >
                      {deletingRowId === r.id ? '…' : '🗑 Delete'}
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
          className="pp-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pp-modt"
          onClick={closeModal}
        >
          <div className="pp-mod" onClick={(e) => e.stopPropagation()}>
            <div className="pp-mh">
              <h2 className="pp-mt" id="pp-modt">
                <span>➕</span> Add New Parts Shop
              </h2>
              <button type="button" className="pp-x" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={onAdd}>
              <div className="pp-fgrid">
                <div className="pp-ffg full">
                  <span className="lab">Shop name</span>
                  <input
                    className="inp"
                    name="shopName"
                    required
                    placeholder="e.g., ABC Bike Parts"
                  />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Owner</span>
                  <input className="inp" name="ownerName" required />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Contact</span>
                  <input className="inp" name="phone" type="tel" required />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Email</span>
                  <input className="inp" name="email" type="email" required />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Password</span>
                  <input
                    className="inp"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Confirm password</span>
                  <input
                    className="inp"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="pp-ffg">
                  <span className="lab">District</span>
                  <select className="inp" name="district" required defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pp-ffg">
                  <span className="lab">City</span>
                  <input className="inp" name="city" required />
                </div>
                <div className="pp-ffg full">
                  <span className="lab">Full address</span>
                  <input className="inp" name="address" required />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Total parts in stock</span>
                  <input
                    className="inp"
                    name="parts"
                    type="number"
                    min={0}
                    defaultValue={100}
                  />
                </div>
                <div className="pp-ffg">
                  <span className="lab">Stock level</span>
                  <select className="inp" name="stockLevel" defaultValue="High Stock">
                    <option>High Stock</option>
                    <option>Medium Stock</option>
                    <option>Low Stock</option>
                  </select>
                </div>
                <div className="pp-ffg">
                  <span className="lab">Status</span>
                  <select className="inp" name="status" required defaultValue="pending">
                    <option value="active">Active</option>
                    <option value="pending">Pending approval</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="pp-ffg">
                  <span className="lab">Established</span>
                  <input className="inp" name="established" type="number" min={1990} max={2030} />
                </div>
                <div className="pp-ffg full">
                  <span className="lab">Specialties (optional)</span>
                  <textarea
                    className="inp"
                    name="specialties"
                    rows={2}
                    placeholder="Engine parts, brakes…"
                  />
                </div>
                <div className="pp-ffg full">
                  <span className="lab">Description (optional)</span>
                  <textarea
                    className="inp"
                    name="description"
                    rows={2}
                    placeholder="About the shop…"
                  />
                </div>
              </div>
              <div className="pp-mf">
                <button type="button" className="pp-bt pp-b2" onClick={closeModal} disabled={shopMutating}>
                  Cancel
                </button>
                <button type="submit" className="pp-bt pp-b1" disabled={shopMutating}>
                  ✓ Add Parts Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {partsDetail?.mode === 'view' ? (
        <div
          className="pp-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pp-view-title"
          onClick={closePartsDetail}
        >
          <div className="pp-mod" onClick={(e) => e.stopPropagation()}>
            <div className="pp-mh">
              <h2 className="pp-mt" id="pp-view-title">
                <span>👁</span> {partsDetail.row.name}
              </h2>
              <button type="button" className="pp-x" onClick={closePartsDetail} aria-label="Close">
                ×
              </button>
            </div>
            <div className="pp-fgrid" style={{ marginBottom: 8 }}>
              {(
                [
                  ['Row id', partsDetail.row.id],
                  ['Owner uid', partsDetail.row.ownerUid ?? '—'],
                  [
                    'Directory doc',
                    partsDetail.row.directoryDocId ?? '— (owner row only; no partsShops doc)',
                  ],
                  ['Status (list)', statusText(partsDetail.row.status)],
                  ['Stock level', stockBadgeText(partsDetail.row.stockLevel)],
                  ['Accessories (live count)', String(partsDetail.row.parts)],
                  ['Orders (directory)', String(partsDetail.row.orders)],
                  ['Revenue label', partsDetail.row.revenue],
                  ['Established', partsDetail.row.established],
                  ['Description', partsDetail.row.description ?? '—'],
                ] as const
              ).map(([lab, val]) => (
                <div key={lab} className="pp-ffg full">
                  <span className="lab">{lab}</span>
                  <div className="inp" style={{ cursor: 'default', background: '#f8fafc' }}>
                    {val}
                  </div>
                </div>
              ))}
              <div className="pp-ffg full">
                <span className="lab">Contact block</span>
                <div className="inp" style={{ cursor: 'default', background: '#f8fafc', lineHeight: 1.5 }}>
                  {partsDetail.row.owner} · {partsDetail.row.phone}
                  <br />
                  {partsDetail.row.email}
                  <br />
                  {partsDetail.row.address}, {partsDetail.row.city}, {partsDetail.row.district}
                </div>
              </div>
            </div>
            <div className="pp-mf">
              <button type="button" className="pp-bt pp-b2" onClick={closePartsDetail}>
                Close
              </button>
              {partsDetail.row.directoryDocId ? (
                <button
                  type="button"
                  className="pp-bt pp-b1"
                  onClick={() => setPartsDetail({ mode: 'edit', row: partsDetail.row })}
                >
                  ✏️ Edit directory
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {partsDetail?.mode === 'edit' ? (
        <div
          className="pp-mod-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pp-edit-title"
          onClick={closePartsDetail}
        >
          <div className="pp-mod" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="pp-mh">
              <h2 className="pp-mt" id="pp-edit-title">
                <span>✏️</span>{' '}
                {partsDetail.row.directoryDocId ? 'Edit directory' : 'Create directory (link owner)'}
              </h2>
              <button type="button" className="pp-x" onClick={closePartsDetail} aria-label="Close">
                ×
              </button>
            </div>
            {editLoadError ? (
              <p style={{ padding: '16px 0', color: '#b91c1c' }}>
                Could not load this directory document. It may have been deleted — close and refresh.
              </p>
            ) : !editDoc ? (
              <p style={{ padding: '16px 0' }}>Loading Firestore document…</p>
            ) : (
              <form key={editDoc.id} onSubmit={onEditSubmit}>
                <div className="pp-fgrid">
                  <div className="pp-ffg full">
                    <span className="lab">Shop name</span>
                    <input
                      className="inp"
                      name="shopName"
                      required
                      defaultValue={editDoc.name}
                    />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Owner</span>
                    <input className="inp" name="ownerName" required defaultValue={editDoc.owner} />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Contact</span>
                    <input className="inp" name="phone" type="tel" required defaultValue={editDoc.phone} />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Email</span>
                    <input className="inp" name="email" type="email" required defaultValue={editDoc.email} />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">District</span>
                    <select className="inp" name="district" required defaultValue={editDoc.district}>
                      {!(SRI_LANKA_DISTRICTS as readonly string[]).includes(editDoc.district) &&
                      editDoc.district ? (
                        <option value={editDoc.district}>{editDoc.district}</option>
                      ) : null}
                      {SRI_LANKA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">City</span>
                    <input className="inp" name="city" required defaultValue={editDoc.city} />
                  </div>
                  <div className="pp-ffg full">
                    <span className="lab">Full address</span>
                    <input className="inp" name="address" required defaultValue={editDoc.address} />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Parts count (stored on doc)</span>
                    <input
                      className="inp"
                      name="parts"
                      type="number"
                      min={0}
                      defaultValue={editDoc.parts}
                    />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Orders</span>
                    <input
                      className="inp"
                      name="orders"
                      type="number"
                      min={0}
                      defaultValue={editDoc.orders}
                    />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Revenue (LKR thousands)</span>
                    <input
                      className="inp"
                      name="revenueK"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={editDoc.revenueK}
                    />
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Stock level</span>
                    <select
                      className="inp"
                      name="stockLevel"
                      defaultValue={stockSelectLabel(editDoc.stockLevel)}
                    >
                      <option>High Stock</option>
                      <option>Medium Stock</option>
                      <option>Low Stock</option>
                    </select>
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Directory status</span>
                    <select className="inp" name="status" required defaultValue={editDoc.status}>
                      <option value="active">Active</option>
                      <option value="pending">Pending approval</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="pp-ffg">
                    <span className="lab">Established</span>
                    <input
                      className="inp"
                      name="established"
                      defaultValue={editDoc.established}
                      placeholder="Year or label"
                    />
                  </div>
                  <div className="pp-ffg full">
                    <span className="lab">Description (optional)</span>
                    <textarea className="inp" name="description" rows={2} defaultValue={editDoc.description} />
                  </div>
                </div>
                <div className="pp-mf">
                  <button type="button" className="pp-bt pp-b2" onClick={closePartsDetail} disabled={shopMutating}>
                    Cancel
                  </button>
                  <button type="submit" className="pp-bt pp-b1" disabled={shopMutating || !editDoc}>
                    {partsDetail.row.directoryDocId ? '✓ Save changes' : '✓ Create & link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
