import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  createShopPart,
  deleteShopPart,
  subscribeShopPartsByOwner,
  updateShopPart,
  updateShopPartStock,
  type ShopPartInput,
} from '@/services/shopParts'
import type { PartBrand, PartCategory, ShopPart } from '@/types/shopPart'
import { PART_BRAND_OPTIONS, PART_CATEGORY_LABEL, PART_CATEGORY_OPTIONS, stockLevelForPart } from '@/types/shopPart'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { getErrorCode, mapServiceError } from '@/utils/firebaseErrors'
import { canUseLocalPartImageUpload, uploadPartImageToLocalServer } from '@/services/partImageUpload'
import '@/styles/shop-parts-management.css'

type Draft = ShopPartInput

const emptyDraft = (): Draft => ({
  name: '',
  category: 'accessories',
  brand: 'aftermarket',
  sku: '',
  stockQty: 0,
  unitPrice: 0,
  oldPrice: undefined,
  reorderLevel: 5,
  supplier: '',
  description: '',
  imageUrl: '',
  active: true,
})

function partToDraft(p: ShopPart): Draft {
  return {
    name: p.name,
    category: p.category,
    brand: p.brand,
    sku: p.sku,
    stockQty: p.stockQty,
    unitPrice: p.unitPrice,
    oldPrice: p.oldPrice,
    reorderLevel: p.reorderLevel,
    supplier: p.supplier,
    description: p.description,
    imageUrl: p.imageUrl,
    active: p.active,
  }
}

export function ShopPartsManagementPage() {
  const { firebaseUser, profile, profileLoading } = useAuth()
  const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
  /** Avoid treating "not loaded yet" as "not approved" — that kept Save disabled and blocked adds. */
  const canSaveParts = !profileLoading && profile?.ownerStatus === 'approved'

  const [rows, setRows] = useState<ShopPart[]>([])
  const [partsLoadError, setPartsLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState<PartCategory | 'all'>('all')
  const [stockF, setStockF] = useState<'all' | 'good' | 'low' | 'out'>('all')

  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  /** Picked in the browser; on Save we POST to the local Vite server, which stores under `public/uploads/parts/`. */
  const [partImageFile, setPartImageFile] = useState<File | null>(null)
  const [partImagePreview, setPartImagePreview] = useState<string | null>(null)
  const partFileInputRef = useRef<HTMLInputElement>(null)

  const [stockPart, setStockPart] = useState<ShopPart | null>(null)
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add')
  const [adjQty, setAdjQty] = useState(1)
  const [stockSaving, setStockSaving] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    const unsub = subscribeShopPartsByOwner(
      ownerId,
      (data) => {
        setRows(data)
        setPartsLoadError(null)
      },
      (err) => {
        console.error('[shopParts] subscribe', err)
        const msg = mapServiceError(getErrorCode(err))
        setPartsLoadError(msg)
        toast.error(msg)
      },
    )
    return () => unsub()
  }, [ownerId])

  const stats = useMemo(() => {
    const total = rows.length
    let inC = 0
    let low = 0
    let out = 0
    for (const p of rows) {
      const s = stockLevelForPart(p.stockQty, p.reorderLevel)
      if (s === 'in-stock') inC++
      else if (s === 'low-stock') low++
      else out++
    }
    return { total, inC, low, out }
  }, [rows])

  const lowList = useMemo(
    () => rows.filter((p) => stockLevelForPart(p.stockQty, p.reorderLevel) === 'low-stock'),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((p) => {
      if (catF !== 'all' && p.category !== catF) return false
      const st = stockLevelForPart(p.stockQty, p.reorderLevel)
      if (stockF === 'good' && st !== 'in-stock') return false
      if (stockF === 'low' && st !== 'low-stock') return false
      if (stockF === 'out' && st !== 'out-stock') return false
      if (q) {
        const blob = `${p.name} ${p.sku} ${p.supplier}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [rows, search, catF, stockF])

  const clearPartImagePick = useCallback(() => {
    setPartImageFile(null)
    setPartImagePreview(null)
    if (partFileInputRef.current) partFileInputRef.current.value = ''
  }, [])

  const onPartImageInput = (file: File | null) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, GIF, WebP)')
      return
    }
    setPartImageFile(file)
    const r = new FileReader()
    r.onload = () => {
      setPartImagePreview(r.result as string)
    }
    r.readAsDataURL(file)
  }

  const openAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    clearPartImagePick()
    setModal('add')
  }

  const openEdit = (p: ShopPart) => {
    setEditingId(p.id)
    setDraft(partToDraft(p))
    setPartImageFile(null)
    setPartImagePreview(p.imageUrl?.trim() ? p.imageUrl : null)
    if (partFileInputRef.current) partFileInputRef.current.value = ''
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    clearPartImagePick()
  }

  const savePart = async () => {
    if (!ownerId) return
    if (!draft.name.trim()) {
      toast.error('Enter a part name')
      return
    }
    if (profileLoading) {
      toast.error('Account is still loading — wait a moment, then try Save again.')
      return
    }
    if (profile?.ownerStatus !== 'approved') {
      toast.error('Only an approved shop account can save parts. If you just registered, wait for admin approval.')
      return
    }
    setSaving(true)
    try {
      let imageUrl = draft.imageUrl.trim()
      if (partImageFile) {
        if (!canUseLocalPartImageUpload) {
          toast.error(
            'File upload is off in this build. Paste a full image URL, or set VITE_ENABLE_PART_FILE_UPLOAD=true and point VITE_PART_IMAGE_UPLOAD_PATH at your Vite or PHP upload endpoint (see .env.example).',
          )
          setSaving(false)
          return
        }
        try {
          imageUrl = await uploadPartImageToLocalServer(partImageFile, ownerId)
        } catch (upErr) {
          console.error(upErr)
          toast.error(upErr instanceof Error ? upErr.message : 'Could not save the image to the project folder.')
          setSaving(false)
          return
        }
      }
      const payload: ShopPartInput = { ...draft, imageUrl }
      if (modal === 'add') {
        await createShopPart(ownerId, payload)
        toast.success('Part added')
      } else if (modal === 'edit' && editingId) {
        await updateShopPart(editingId, payload)
        toast.success('Part updated')
      }
      closeModal()
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    } finally {
      setSaving(false)
    }
  }

  const del = async (p: ShopPart) => {
    if (!canSaveParts) {
      toast.error('Only an approved shop account can delete parts.')
      return
    }
    if (!window.confirm(`Delete “${p.name}”?`)) return
    try {
      await deleteShopPart(p.id)
      toast.success('Part removed')
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    }
  }

  const openStock = (p: ShopPart) => {
    setStockPart(p)
    setAdjType('add')
    setAdjQty(1)
  }

  const applyStock = useCallback(async () => {
    if (!stockPart) return
    if (!canSaveParts) {
      toast.error('Only an approved shop account can adjust stock.')
      return
    }
    const d = adjType === 'add' ? adjQty : -adjQty
    const next = Math.max(0, stockPart.stockQty + d)
    setStockSaving(true)
    try {
      await updateShopPartStock(stockPart.id, next)
      toast.success('Stock updated')
      setStockPart(null)
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    } finally {
      setStockSaving(false)
    }
  }, [stockPart, adjType, adjQty, canSaveParts])

  const setField = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  if (!ownerId) {
    return <p className="spm-blk">Sign in as a shop owner to manage parts.</p>
  }

  return (
    <>
      <div
        className="sp-top-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1>Parts management</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Dashboard</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>Parts</span>
          </div>
        </div>
        <button type="button" className="spm-add-btn" onClick={openAdd} disabled={!canSaveParts}>
          <i className="fas fa-plus-circle" aria-hidden /> Add part
        </button>
      </div>

      {profile?.ownerStatus === 'pending' ? (
        <p className="sp-panel" style={{ marginBottom: 16 }}>
          <strong>Pending approval.</strong> You can build this screen, but you must be an approved parts shop
          to publish inventory to customers.
        </p>
      ) : null}
      {partsLoadError ? (
        <p className="spm-blk" role="alert" style={{ whiteSpace: 'pre-line', lineHeight: 1.5, maxWidth: 720 }}>
          {partsLoadError}
        </p>
      ) : null}

      <div className="spm-stats">
        <div className="spm-stat">
          <h4>Total parts</h4>
          <p>{stats.total}</p>
        </div>
        <div className="spm-stat spm-stat--ok">
          <h4>In stock (OK)</h4>
          <p>{stats.inC}</p>
        </div>
        <div className="spm-stat spm-stat--warn">
          <h4>Low stock</h4>
          <p>{stats.low}</p>
        </div>
        <div className="spm-stat spm-stat--bad">
          <h4>Out of stock</h4>
          <p>{stats.out}</p>
        </div>
      </div>

      {lowList.length > 0 ? (
        <div className="spm-alert" role="status">
          <i className="fas fa-exclamation-triangle" style={{ fontSize: 20 }} aria-hidden />
          <div>
            <strong>Low stock: {lowList.length}</strong>
            {lowList.length <= 3
              ? ` — ${lowList.map((p) => p.name).join(', ')}`
              : '. Review the table and reorder or adjust quantities.'}
          </div>
        </div>
      ) : null}

      <div className="sp-panel" style={{ marginBottom: 0 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '18px', color: 'var(--sp-dark, #0f172a)' }}>Inventory</h2>
        <div className="spm-filters">
          <div className="spm-fg">
            <label htmlFor="spm-q">Search</label>
            <input
              id="spm-q"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, SKU, supplier…"
            />
          </div>
          <div className="spm-fg">
            <label htmlFor="spm-cat">Category</label>
            <select id="spm-cat" value={catF} onChange={(e) => setCatF((e.target.value as PartCategory | 'all') || 'all')}>
              <option value="all">All</option>
              {PART_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="spm-fg">
            <label htmlFor="spm-st">Stock</label>
            <select id="spm-st" value={stockF} onChange={(e) => setStockF((e.target.value as typeof stockF) || 'all')}>
              <option value="all">All</option>
              <option value="good">In stock</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
            </select>
          </div>
        </div>

        <div className="spm-table-wrap">
          <table className="spm-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Price (LKR)</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    {rows.length === 0
                      ? 'No parts yet. Add your first part — it will show on the customer “Bike parts” page for your shop.'
                      : 'No rows match the filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const st = stockLevelForPart(p.stockQty, p.reorderLevel)
                  return (
                    <tr key={p.id}>
                      <td className="spm-n">{p.name}</td>
                      <td>{PART_CATEGORY_LABEL[p.category]}</td>
                      <td style={{ color: '#64748b' }}>{p.sku || '—'}</td>
                      <td>
                        <span
                          className={cn(
                            'spm-badg',
                            st === 'in-stock' && 'spm-badg--g',
                            st === 'low-stock' && 'spm-badg--l',
                            st === 'out-stock' && 'spm-badg--o',
                          )}
                        >
                          {p.stockQty} units
                        </span>
                      </td>
                      <td>
                        <strong>LKR {p.unitPrice.toLocaleString()}</strong>
                        {p.oldPrice ? (
                          <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginLeft: 6 }}>
                            {p.oldPrice}
                          </span>
                        ) : null}
                      </td>
                      <td>{p.supplier || '—'}</td>
                      <td>
                        <div className="spm-actions">
                          <button
                            type="button"
                            className="spm-ibtn spm-ibtn--adj"
                            onClick={() => openStock(p)}
                            disabled={!canSaveParts}
                            title="Adjust stock"
                          >
                            <i className="fas fa-exchange-alt" />
                          </button>
                          <button
                            type="button"
                            className="spm-ibtn spm-ibtn--ed"
                            onClick={() => openEdit(p)}
                            title="Edit"
                          >
                            <i className="fas fa-edit" />
                          </button>
                          <button
                            type="button"
                            className="spm-ibtn spm-ibtn--dl"
                            onClick={() => del(p)}
                            title="Delete"
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal ? (
        <div className="spm-modal-back" role="dialog" aria-modal onClick={closeModal}>
          <div className="spm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'add' ? 'Add part' : 'Edit part'}</h3>
            <p>
              {canUseLocalPartImageUpload
                ? 'The server (Vite in dev, or your PHP public/api/upload-part-image.php) saves the file into public/uploads/parts. Only the returned image URL is saved in Firestore. You can also paste a URL for images already on the web.'
                : 'Paste a public image URL. Firestore stores only the string. For “Choose image” + your own host folder, enable VITE_ENABLE_PART_FILE_UPLOAD and VITE_PART_IMAGE_UPLOAD_PATH (Vite or PHP; see .env.example).'}
            </p>
            <div className="spm-form">
              <div className="spm-form-row2">
                <div className="spm-field">
                  <label>Part name *</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setField({ name: e.target.value })}
                    placeholder="e.g. Brake pads (front)"
                  />
                </div>
                <div className="spm-field">
                  <label>Category *</label>
                  <select value={draft.category} onChange={(e) => setField({ category: e.target.value as PartCategory })}>
                    {PART_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="spm-form-row2">
                <div className="spm-field">
                  <label>Brand *</label>
                  <select value={draft.brand} onChange={(e) => setField({ brand: e.target.value as PartBrand })}>
                    {PART_BRAND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="spm-field">
                  <label>SKU</label>
                  <input value={draft.sku} onChange={(e) => setField({ sku: e.target.value })} placeholder="e.g. BP-F001" />
                </div>
              </div>
              <div className="spm-form-row2">
                <div className="spm-field">
                  <label>Stock quantity *</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.stockQty}
                    onChange={(e) => setField({ stockQty: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="spm-field">
                  <label>Unit price (LKR) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.unitPrice}
                    onChange={(e) => setField({ unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
              </div>
              <div className="spm-form-row2">
                <div className="spm-field">
                  <label>Old price (LKR, optional)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.oldPrice ?? ''}
                    onChange={(e) =>
                      setField({ oldPrice: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })
                    }
                    placeholder="Strike-through on customer site"
                  />
                </div>
                <div className="spm-field">
                  <label>Low-stock threshold *</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.reorderLevel}
                    onChange={(e) => setField({ reorderLevel: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </div>
              </div>
              <div className="spm-field">
                <label>Supplier</label>
                <input value={draft.supplier} onChange={(e) => setField({ supplier: e.target.value })} />
              </div>
              {canUseLocalPartImageUpload ? (
                <div className="spm-field spm-field--image">
                  <span className="spm-label">Part image</span>
                  <div className="spm-part-image-block">
                    <div className="spm-part-image-preview">
                      {partImagePreview || draft.imageUrl.trim() ? (
                        <img src={partImagePreview || draft.imageUrl} alt="" />
                      ) : (
                        <i className="fas fa-image" aria-hidden />
                      )}
                    </div>
                    <div>
                      <input
                        ref={partFileInputRef}
                        type="file"
                        id="spm-part-image-file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sp-profile-file-input"
                        onChange={(e) => onPartImageInput(e.target.files?.[0] ?? null)}
                      />
                      <label htmlFor="spm-part-image-file" className="sp-profile-upload-btn">
                        <i className="fas fa-upload" aria-hidden />
                        Choose image
                      </label>
                      {partImageFile || partImagePreview || draft.imageUrl.trim() ? (
                        <button
                          type="button"
                          className="spm-remove-img"
                          onClick={() => {
                            clearPartImagePick()
                            setField({ imageUrl: '' })
                          }}
                        >
                          Remove image
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="spm-field" style={{ marginTop: 12 }}>
                    <label>Or image URL (optional)</label>
                    <input
                      value={draft.imageUrl}
                      onChange={(e) => setField({ imageUrl: e.target.value })}
                      placeholder="https://… (skip if you use Choose image)"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : (
                <div className="spm-field">
                  <label>Part image URL (optional)</label>
                  <input
                    value={draft.imageUrl}
                    onChange={(e) => setField({ imageUrl: e.target.value })}
                    placeholder="https://…"
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="spm-field">
                <label>Description</label>
                <textarea value={draft.description} onChange={(e) => setField({ description: e.target.value })} />
              </div>
              <label className="spm-blk" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setField({ active: e.target.checked })}
                />
                Active (show on customer parts shop)
              </label>
            </div>
            <div className="spm-m-actions">
              <button
                type="button"
                className="spm-btn spm-btn--p"
                onClick={savePart}
                disabled={saving || profileLoading || !canSaveParts}
                title={profileLoading ? 'Loading account…' : !canSaveParts ? 'Approved shop accounts only' : undefined}
              >
                {saving ? 'Saving…' : profileLoading ? 'Loading…' : 'Save'}
              </button>
              <button type="button" className="spm-btn spm-btn--s" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stockPart ? (
        <div className="spm-modal-back" role="dialog" aria-modal onClick={() => setStockPart(null)}>
          <div className="spm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Adjust stock</h3>
            <p>
              <strong>{stockPart.name}</strong> — current: {stockPart.stockQty} units
            </p>
            <div className="spm-form">
              <div className="spm-field">
                <label>Adjustment</label>
                <select value={adjType} onChange={(e) => setAdjType((e.target.value as 'add' | 'remove') || 'add')}>
                  <option value="add">Add stock</option>
                  <option value="remove">Remove stock</option>
                </select>
              </div>
              <div className="spm-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={adjQty}
                  onChange={(e) => setAdjQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />
              </div>
              <p className="spm-blk" style={{ margin: 0 }}>
                New total: <strong>{Math.max(0, stockPart.stockQty + (adjType === 'add' ? adjQty : -adjQty))}</strong> units
              </p>
            </div>
            <div className="spm-m-actions">
              <button type="button" className="spm-btn spm-btn--p" onClick={applyStock} disabled={stockSaving || !canSaveParts}>
                {stockSaving ? '…' : 'Update stock'}
              </button>
              <button type="button" className="spm-btn spm-btn--s" onClick={() => setStockPart(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
