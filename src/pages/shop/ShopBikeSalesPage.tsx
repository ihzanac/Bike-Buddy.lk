import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { createBike, deleteBike, subscribeBikesByOwner, updateBike, type BikeInput } from '@/services/bikes'
import {
  canUseLocalBikeImageUpload,
  uploadBikeImageToLocalServer,
} from '@/services/bikeImageUpload'
import type { Bike, BikeSaleColor, BikeSaleSpec } from '@/types'
import { mergeDisplaySpecs } from '@/utils/bikeSaleMappers'
import { ROUTES } from '@/utils/constants'
import { getOwnerShopCategories, SHOP_OWNER_CATEGORY } from '@/utils/shopOwnerCategory'
import type { SaleShop } from '@/types/saleShop'
import { subscribeMyBikeSaleShopDirectory, upsertMyBikeSaleShopDirectory } from '@/services/saleShops'
import { getErrorCode, mapServiceError } from '@/utils/firebaseErrors'
import '@/styles/shop-bike-inventory.css'

type StockKey = 'available' | 'low' | 'sold-out'
type SortKey = '' | 'price-low' | 'price-high' | 'stock-low' | 'stock-high' | 'name'
type ActiveModal = 'add' | 'edit' | 'view' | 'stock' | null

function normHex(raw: string): string {
  const t = raw.trim()
  if (!t) return '#64748b'
  if (t.startsWith('#')) return t.length >= 4 ? t.slice(0, 7) : '#64748b'
  return `#${t.replace(/^#/, '').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6) || '64748b'}`
}

function saleColorsFromRows(rows: BikeSaleColor[]): BikeSaleColor[] | undefined {
  const out = rows
    .map((r) => ({
      name: r.name.trim(),
      hex: normHex(r.hex),
    }))
    .filter((r) => r.name.length > 0)
  return out.length ? out : undefined
}

function parseSpecsText(text: string): BikeSaleSpec[] | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return undefined
  const out: BikeSaleSpec[] = []
  for (const line of lines) {
    const i = line.indexOf(':')
    if (i === -1) out.push({ label: 'Spec', value: line })
    else
      out.push({
        label: line.slice(0, i).trim() || 'Spec',
        value: line.slice(i + 1).trim() || '—',
      })
  }
  return out.length ? out : undefined
}

function emptyInput(): BikeInput {
  return {
    title: '',
    description: '',
    price: 0,
    category: 'Motorcycle',
    location: '',
    images: [],
    active: true,
    modalColorBlock: false,
    brand: '',
    year: new Date().getFullYear(),
    stockQty: 0,
    purchasePrice: 0,
    reorderLevel: 5,
    chassisNo: '',
    engineNo: '',
    supplier: '',
    fuelType: 'Petrol',
    bodyColor: '',
    engineCC: undefined,
    additionalNotes: '',
  }
}

function bikeToInput(b: Bike): BikeInput {
  return {
    title: b.title,
    description: b.description,
    price: b.price,
    category: b.category,
    location: b.location,
    images: b.images,
    saleColors: b.saleColors,
    saleSpecs: b.saleSpecs,
    modalColorBlock: b.modalColorBlock,
    active: b.active !== false,
    brand: b.brand,
    year: b.year,
    stockQty: b.stockQty,
    purchasePrice: b.purchasePrice,
    reorderLevel: b.reorderLevel,
    chassisNo: b.chassisNo,
    engineNo: b.engineNo,
    supplier: b.supplier,
    fuelType: b.fuelType,
    bodyColor: b.bodyColor,
    engineCC: b.engineCC,
    additionalNotes: b.additionalNotes,
  }
}

function getReorder(b: Bike): number {
  return b.reorderLevel != null && b.reorderLevel >= 0 ? b.reorderLevel : 5
}

function stockKey(b: Bike): StockKey {
  const s = b.stockQty ?? 0
  if (s <= 0) return 'sold-out'
  if (s <= getReorder(b)) return 'low'
  return 'available'
}

function lkr(n: number) {
  return `LKR ${Math.max(0, Math.round(n)).toLocaleString('en-LK')}`
}

function lkrCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(Math.round(n))
}

function specValue(b: Bike, labels: string[]): string {
  const low = new Set(labels.map((l) => l.trim().toLowerCase()))
  for (const s of b.saleSpecs ?? []) {
    if (low.has(s.label.trim().toLowerCase())) return s.value
  }
  return '—'
}

const MAX_BIKE_IMAGE_BYTES = 5 * 1024 * 1024
const BIKE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg'

const BRAND_CHOICES = [
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Ducati',
  'BMW Motorrad',
  'Triumph',
  'Harley-Davidson',
  'Aprilia',
  'MV Agusta',
  'Moto Guzzi',
  'Benelli',
  'CFMOTO',
  'QJMotor',
  'Bimota',
  'Indian Motorcycle',
  'Can-Am',
  'Zero Motorcycles',
  'Energica',
  'LiveWire',
  'Norton',
  'Husqvarna',
  'GasGas',
  'Beta',
  'Sherco',
  'AJP',
  'SWM',
  'Fantic',
  'Keeway',
  'Kymco',
  'SYM',
  'Piaggio',
  'Vespa',
  'Gilera',
  'Malaguti',
  'Lambretta',
  'Peugeot Motocycles',
  'Scomadi',
  'Bajaj',
  'TVS',
  'Hero',
  'Suzuki',
  'KTM',
  'Royal Enfield',
  'Mahindra',
  'Jawa',
  'Yezdi',
  'Benling',
  'Ather',
  'Ola Electric',
  'Ultraviolette',
  'Simple Energy',
  'Tork',
  'Revolt',
  'Komaki',
  'PURE EV',
  'Oben',
  'Hop Electric',
  'Niu',
  'Horwin',
  'Vmoto',
  'Super Soco',
  'Zontes',
  'Lifan',
  'Loncin',
  'Zongshen',
  'Haojue',
  'Cleveland CycleWerks',
  'Rieju',
  'Derbi',
  'Sena',
] as const

function BikeCardImage({ src }: { src?: string }) {
  const [bad, setBad] = useState(!src)
  useEffect(() => {
    setBad(!src)
  }, [src])
  return (
    <>
      {src && !bad ? (
        <img src={src} alt="" onError={() => setBad(true)} />
      ) : (
        <i className="fas fa-motorcycle" aria-hidden />
      )}
    </>
  )
}

function filterAndSort(
  items: Bike[],
  q: string,
  brand: string,
  st: string,
  sort: SortKey,
) {
  const t = q.trim().toLowerCase()
  let out = items.filter((b) => {
    if (t) {
      const blob = [b.title, b.brand, b.category, b.chassisNo, b.description, b.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!blob.includes(t)) return false
    }
    if (brand) {
      const bname = (b.brand || b.category || '').trim()
      if (bname !== brand) return false
    }
    if (st) {
      if (stockKey(b) !== (st as StockKey)) return false
    }
    return true
  })
  if (sort === 'price-low') out = [...out].sort((a, b) => a.price - b.price)
  else if (sort === 'price-high') out = [...out].sort((a, b) => b.price - a.price)
  else if (sort === 'stock-low') out = [...out].sort((a, b) => (a.stockQty ?? 0) - (b.stockQty ?? 0))
  else if (sort === 'stock-high') out = [...out].sort((a, b) => (b.stockQty ?? 0) - (a.stockQty ?? 0))
  else if (sort === 'name') out = [...out].sort((a, b) => a.title.localeCompare(b.title))
  return out
}

export function ShopBikeSalesPage() {
  const { firebaseUser, profile, profileLoading } = useAuth()
  const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
  const canEdit = !profileLoading && profile?.ownerStatus === 'approved'
  const shopCategories = useMemo(() => getOwnerShopCategories(profile), [profile])
  const sellsBikes = shopCategories.includes(SHOP_OWNER_CATEGORY.BIKE_SALE)

  const [rows, setRows] = useState<Bike[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [modal, setModal] = useState<ActiveModal>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewBike, setViewBike] = useState<Bike | null>(null)
  const [stockTarget, setStockTarget] = useState<Bike | null>(null)
  const [draft, setDraft] = useState<BikeInput>(emptyInput)
  const [colorRows, setColorRows] = useState<BikeSaleColor[]>([
    { name: 'As shown', hex: '#64748B' },
  ])
  const [specsText, setSpecsText] = useState('Engine: 200cc\nMileage: 35 km/l\n')
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const bikeImageInputRef = useRef<HTMLInputElement | null>(null)

  const [search, setSearch] = useState('')
  const [brandF, setBrandF] = useState('')
  const [stockF, setStockF] = useState('')
  const [sort, setSort] = useState<SortKey>('')

  const [stockForm, setStockForm] = useState({
    type: 'add' as 'add' | 'remove',
    qty: 1,
    reason: 'purchase' as string,
  })

  const [directoryShop, setDirectoryShop] = useState<SaleShop | null>(null)
  const [directoryListenReady, setDirectoryListenReady] = useState(false)
  const [directorySaving, setDirectorySaving] = useState(false)

  useEffect(() => {
    if (!ownerId || !sellsBikes) {
      setDirectoryShop(null)
      setDirectoryListenReady(false)
      return
    }
    setDirectoryListenReady(false)
    const unsub = subscribeMyBikeSaleShopDirectory(
      ownerId,
      (row) => {
        setDirectoryShop(row)
        setDirectoryListenReady(true)
      },
      () => {
        setDirectoryListenReady(true)
      },
    )
    return () => unsub()
  }, [ownerId, sellsBikes])

  useEffect(() => {
    if (!ownerId) return
    const unsub = subscribeBikesByOwner(
      ownerId,
      (data) => {
        setRows(data)
        setLoadErr(null)
      },
      (e) => {
        console.error(e)
        const c = getErrorCode(e)
        setLoadErr(mapServiceError(c))
        toast.error(mapServiceError(c))
      },
    )
    return () => unsub()
  }, [ownerId])

  useEffect(() => {
    if (!imageFile) {
      setFilePreviewUrl(null)
      return
    }
    const u = URL.createObjectURL(imageFile)
    setFilePreviewUrl(u)
    return () => {
      URL.revokeObjectURL(u)
    }
  }, [imageFile])

  const brandOptions = useMemo(() => {
    const s = new Set<string>()
    for (const b of rows) {
      const x = (b.brand || b.category || '').trim()
      if (x) s.add(x)
    }
    return [...s].sort()
  }, [rows])

  const mainImagePreview = filePreviewUrl ?? (imageUrl.trim() || null)

  const list = useMemo(
    () => filterAndSort(rows, search, brandF, stockF, sort),
    [rows, search, brandF, stockF, sort],
  )

  const stats = useMemo(() => {
    let available = 0
    let low = 0
    let value = 0
    for (const b of rows) {
      const k = stockKey(b)
      if (k === 'available') available += 1
      if (k === 'low') low += 1
      const s = b.stockQty ?? 0
      if (s > 0) value += b.price * s
    }
    return { total: rows.length, available, low, value }
  }, [rows])

  const openAdd = useCallback(() => {
    setEditingId(null)
    setDraft(emptyInput())
    setColorRows([{ name: 'As shown', hex: '#64748B' }])
    setSpecsText('Engine: 200cc\nMileage: 35 km/l\n')
    setImageUrl('')
    setImageFile(null)
    if (bikeImageInputRef.current) bikeImageInputRef.current.value = ''
    setModal('add')
  }, [])

  const openEdit = useCallback((b: Bike) => {
    setEditingId(b.id)
    setDraft(bikeToInput(b))
    setColorRows(
      b.saleColors?.length
        ? b.saleColors.map((c) => ({ name: c.name, hex: normHex(c.hex) }))
        : [{ name: 'As shown', hex: '#64748B' }],
    )
    setSpecsText(
      b.saleSpecs?.map((s) => `${s.label}: ${s.value}`).join('\n') ?? 'Engine: 200cc\nMileage: 35 km/l\n',
    )
    setImageUrl(b.images[0] ?? '')
    setImageFile(null)
    if (bikeImageInputRef.current) bikeImageInputRef.current.value = ''
    setModal('edit')
  }, [])

  const openView = useCallback((b: Bike) => {
    setViewBike(b)
    setModal('view')
  }, [])

  const openStock = useCallback((b: Bike) => {
    setStockTarget(b)
    setStockForm({ type: 'add', qty: 1, reason: 'purchase' })
    setModal('stock')
  }, [])

  const closeAll = useCallback(() => {
    setModal(null)
    setEditingId(null)
    setViewBike(null)
    setStockTarget(null)
    setImageFile(null)
    if (bikeImageInputRef.current) bikeImageInputRef.current.value = ''
  }, [])

  const onPickBikeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    if (file.size > MAX_BIKE_IMAGE_BYTES) {
      toast.error('Image is too large. Maximum size is 5MB.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      toast.error('Please use JPG, PNG, or WebP.')
      return
    }
    setImageUrl('')
    setImageFile(file)
  }

  const clearBikeImage = () => {
    setImageFile(null)
    setImageUrl('')
    if (bikeImageInputRef.current) bikeImageInputRef.current.value = ''
  }

  const setField = (patch: Partial<BikeInput>) => setDraft((d) => ({ ...d, ...patch }))

  const buildPayload = (): BikeInput | null => {
    if (!draft.title.trim()) {
      toast.error('Enter a model name (title).')
      return null
    }
    if (!draft.category.trim()) {
      toast.error('Enter a category (or use brand in filters).')
      return null
    }
    if (!((draft.supplier || '').trim())) {
      toast.error('Enter a supplier name.')
      return null
    }
    if (!((draft.brand || '').trim())) {
      toast.error('Enter a brand.')
      return null
    }
    const images =
      imageFile != null
        ? []
        : imageUrl.trim()
          ? [imageUrl.trim()]
          : []
    const saleColors = saleColorsFromRows(colorRows)
    const saleSpecs = parseSpecsText(specsText)
    return {
      ...draft,
      images,
      saleColors,
      saleSpecs,
      price: Math.max(0, Number(draft.price) || 0),
      stockQty: Math.max(0, Math.floor(Number(draft.stockQty) || 0)),
      reorderLevel: Math.max(0, Math.floor(Number(draft.reorderLevel) || 0)),
      purchasePrice: Math.max(0, Number(draft.purchasePrice) || 0),
      year: draft.year != null ? Math.max(2000, Math.floor(Number(draft.year))) : undefined,
      engineCC: draft.engineCC != null && draft.engineCC !== 0 ? Math.max(0, Number(draft.engineCC)) : undefined,
      additionalNotes: (draft.additionalNotes || '').trim() || undefined,
    }
  }

  const save = async () => {
    if (!ownerId) return
    if (profile?.ownerStatus !== 'approved') {
      toast.error('Only approved shops can save bike listings.')
      return
    }
    const payload = buildPayload()
    if (!payload) return
    setSaving(true)
    try {
      let finalImages = payload.images
      if (imageFile) {
        if (!canUseLocalBikeImageUpload) {
          toast.error(
            'File upload is off in this build. Paste a full image URL, or set VITE_ENABLE_BIKE_FILE_UPLOAD=true and VITE_BIKE_IMAGE_UPLOAD_PATH (Vite or PHP; see .env.example).',
          )
          return
        }
        try {
          const url = await uploadBikeImageToLocalServer(imageFile, ownerId)
          finalImages = [url]
        } catch (upErr) {
          console.error(upErr)
          toast.error(
            upErr instanceof Error ? upErr.message : 'Could not save the image to the project folder.',
          )
          return
        }
      }

      const patchCommon = {
        title: payload.title,
        description: payload.description,
        price: payload.price,
        category: payload.category,
        location: payload.location,
        images: finalImages,
        saleColors: payload.saleColors,
        saleSpecs: payload.saleSpecs,
        modalColorBlock: payload.modalColorBlock,
        active: payload.active,
        brand: payload.brand,
        year: payload.year,
        stockQty: payload.stockQty,
        purchasePrice: payload.purchasePrice,
        reorderLevel: payload.reorderLevel,
        chassisNo: payload.chassisNo,
        engineNo: payload.engineNo,
        supplier: payload.supplier,
        fuelType: payload.fuelType,
        bodyColor: payload.bodyColor,
        engineCC: payload.engineCC,
        additionalNotes: payload.additionalNotes,
      } as const

      if (modal === 'add') {
        await createBike(ownerId, { ...payload, images: finalImages })
        toast.success('Bike listing added')
      } else if (modal === 'edit' && editingId) {
        await updateBike(editingId, { ...patchCommon, images: finalImages })
        toast.success('Bike listing updated')
      }
      closeAll()
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    } finally {
      setSaving(false)
    }
  }

  const saveStock = async () => {
    if (!stockTarget || !canEdit) return
    const q = Math.max(1, Math.floor(stockForm.qty))
    const cur = stockTarget.stockQty ?? 0
    let next =
      stockForm.type === 'add' ? cur + q : cur - q
    next = Math.max(0, next)
    setSaving(true)
    try {
      await updateBike(stockTarget.id, { stockQty: next })
      toast.success('Stock updated')
      closeAll()
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    } finally {
      setSaving(false)
    }
  }

  const del = async (b: Bike) => {
    if (!canEdit) {
      toast.error('Only approved accounts can delete listings.')
      return
    }
    if (!window.confirm(`Remove “${b.title}” from the catalogue?`)) return
    try {
      await deleteBike(b.id)
      toast.success('Removed')
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    }
  }

  const publishDirectory = useCallback(async () => {
    if (!profile || !ownerId) return
    setDirectorySaving(true)
    try {
      const listings = rows.filter((b) => b.active !== false).length
      await upsertMyBikeSaleShopDirectory({
        uid: ownerId,
        shopName: profile.shopName ?? '',
        ownerDisplayName: profile.displayName ?? '',
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        district: profile.district ?? '',
        city: profile.location ?? '',
        address: profile.shopAddress || profile.address || '',
        listings,
      })
      toast.success(
        'Directory listing saved. It stays pending until an admin verifies it under Admin → Sale shops (verified shops stay verified when you refresh).',
      )
    } catch (e) {
      console.error(e)
      toast.error(mapServiceError(getErrorCode(e)))
    } finally {
      setDirectorySaving(false)
    }
  }, [profile, ownerId, rows])

  if (!ownerId) {
    return (
      <p className="sbi-page sbi-help" style={{ padding: '0.5rem' }}>
        Sign in as a shop owner to manage bike sales.
      </p>
    )
  }

  return (
    <div className="sbi-page">
      <div
        className="sp-top-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div>
          <h1>Bike sale management</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Dashboard</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>Bike sales</span>
          </div>
        </div>
      </div>

      {profile?.ownerStatus === 'pending' ? (
        <p className="sp-panel" style={{ marginBottom: 12 }} role="status">
          <strong>Pending approval.</strong> You can view this screen, but you must be approved to publish inventory.
          Registering as a bike sale shop does not add you to <code>saleShops</code> yet—after approval, return here and
          use <strong>Publish my shop to directory</strong> so admins see your shop under <strong>Admin → Sale shops</strong>{' '}
          and you can go live on the customer bike sale page once verified.
        </p>
      ) : null}

      {loadErr ? <div className="sbi-err" role="alert">{loadErr}</div> : null}

      <div className="sbi-hero">
        <div>
          <h1>
            <i className="fas fa-motorcycle" aria-hidden /> Inventory overview
          </h1>
          <p className="sbi-help" style={{ margin: 0 }}>
            Manage your bike listings here. Keep images, pricing, stock, and specs up to date so customers always see
            accurate details.
          </p>
        </div>
        <button type="button" className="sbi-btn-add" onClick={openAdd} disabled={!canEdit}>
          <i className="fas fa-plus-circle" />
          Add bike
        </button>
      </div>

      {stats.low > 0 ? (
        <div className="sbi-alert" role="status">
          <i className="fas fa-exclamation-triangle" aria-hidden />
          <div>
            <strong>Low stock</strong> — {stats.low} listing{stats.low === 1 ? '' : 's'} at or below reorder. Review
            and restock.
          </div>
        </div>
      ) : null}

      <div className="sbi-stats">
        <div className="sbi-stat">
          <div className="sbi-stat-label">Total models</div>
          <div className="sbi-stat-value">{stats.total}</div>
        </div>
        <div className="sbi-stat sbi-stat--green">
          <div className="sbi-stat-label">In stock (good)</div>
          <div className="sbi-stat-value">{stats.available}</div>
        </div>
        <div className="sbi-stat sbi-stat--orange">
          <div className="sbi-stat-label">Low stock</div>
          <div className="sbi-stat-value">{stats.low}</div>
        </div>
        <div className="sbi-stat sbi-stat--blue">
          <div className="sbi-stat-label">Stock value (sell price × qty)</div>
          <div className="sbi-stat-value">{lkrCompact(stats.value)}</div>
        </div>
      </div>

      <div className="sbi-filters">
        <div className="sbi-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand, model, chassis, description…"
            aria-label="Search bikes"
          />
          <i className="fas fa-search" aria-hidden />
        </div>
        <select className="sbi-select" value={brandF} onChange={(e) => setBrandF(e.target.value)} aria-label="Filter brand">
          <option value="">All brands</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className="sbi-select"
          value={stockF}
          onChange={(e) => setStockF(e.target.value)}
          aria-label="Filter stock"
        >
          <option value="">All stock</option>
          <option value="available">Available</option>
          <option value="low">Low</option>
          <option value="sold-out">Sold out</option>
        </select>
        <select className="sbi-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="">Sort: recent (default)</option>
          <option value="name">Name A–Z</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="stock-low">Stock: low to high</option>
          <option value="stock-high">Stock: high to low</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="sbi-empty">
          {rows.length === 0 ? 'No bikes yet. Add a listing to show it on the customer site.' : 'No matches for these filters.'}
        </div>
      ) : (
        <div className="sbi-grid">
          {list.map((b) => {
            const sk = stockKey(b)
            const purchase = b.purchasePrice
            const profit = b.price - (purchase ?? 0)
            const firstImg = b.images[0]
            return (
              <article key={b.id} className="sbi-card">
                <div className="sbi-card-img">
                  <BikeCardImage src={firstImg} />
                  <span
                    className={`sbi-card-badge ${
                      sk === 'available' ? 'sbi-card-badge--ok' : sk === 'low' ? 'sbi-card-badge--low' : 'sbi-card-badge--out'
                    }`}
                  >
                    {sk === 'available' ? 'In stock' : sk === 'low' ? 'Low' : 'Sold out'}
                  </span>
                </div>
                <div className="sbi-card-body">
                  <div className="sbi-card-brand">{b.brand || b.category}</div>
                  <h3 className="sbi-card-name">{b.title}</h3>
                  <div className="sbi-card-specs">
                    <span>
                      <i className="fas fa-calendar" aria-hidden />
                      {b.year ?? specValue(b, ['year', 'model year'])}
                    </span>
                    <span>
                      <i className="fas fa-palette" aria-hidden />
                      {b.bodyColor || specValue(b, ['color', 'colour'])}
                    </span>
                    <span>
                      <i className="fas fa-gas-pump" aria-hidden />
                      {b.fuelType || specValue(b, ['fuel'])}
                    </span>
                    <span>
                      <i className="fas fa-cog" aria-hidden />
                      {b.engineCC != null ? `${b.engineCC}cc` : specValue(b, ['engine', 'engine cc', 'cc'])}
                    </span>
                  </div>

                  {(b.saleSpecs && b.saleSpecs.length > 0) || b.description ? (
                    <div className="sbi-spec-block">
                      <h4>
                        <i className="fas fa-cogs" /> Specifications
                      </h4>
                      <div className="sbi-spec-grid">
                        {(b.saleSpecs ?? [])
                          .slice(0, 4)
                          .map((s) => (
                            <div key={s.label + s.value} className="sbi-spec-item">
                              <small>{s.label}</small>
                              <b>{s.value}</b>
                            </div>
                          ))}
                        {(!b.saleSpecs || b.saleSpecs.length === 0) && b.description ? (
                          <div className="sbi-spec-item" style={{ gridColumn: '1 / -1' }}>
                            <b style={{ fontWeight: 500 }}>{b.description.slice(0, 160)}{b.description.length > 160 ? '…' : ''}</b>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="sbi-prices">
                    <div>
                      <small>Buy</small>
                      <b className="sbi-muted">LKR {lkrCompact(purchase ?? 0)}</b>
                    </div>
                    <div>
                      <small>Sell</small>
                      <b>{lkr(b.price)}</b>
                    </div>
                    <div>
                      <small>Est. margin</small>
                      <b className="sbi-profit">LKR {lkrCompact(profit)}</b>
                    </div>
                  </div>

                  <div className="sbi-stock-row">
                    <span>Stock</span>
                    <span
                      className={`sbi-stock-val ${
                        sk === 'available' ? 'sbi-stock-val--good' : sk === 'low' ? 'sbi-stock-val--low' : 'sbi-stock-val--out'
                      }`}
                    >
                      {b.stockQty ?? 0} units
                    </span>
                  </div>

                  <div className="sbi-card-actions">
                    <button type="button" className="sbi-ia sbi-ia--v" onClick={() => openView(b)} title="View" aria-label="View">
                      <i className="fas fa-eye" />
                      View
                    </button>
                    <button
                      type="button"
                      className="sbi-ia sbi-ia--e"
                      onClick={() => openEdit(b)}
                      disabled={!canEdit}
                    >
                      <i className="fas fa-edit" />
                      Edit
                    </button>
                    <button type="button" className="sbi-ia sbi-ia--d" onClick={() => del(b)} disabled={!canEdit}>
                      <i className="fas fa-trash" />
                      Del
                    </button>
                    <button
                      type="button"
                      className="sbi-ia sbi-ia-full"
                      onClick={() => openStock(b)}
                      disabled={!canEdit}
                    >
                      <i className="fas fa-exchange-alt" />
                      Adjust stock
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modal === 'add' || modal === 'edit' ? (
        <div className="sbi-m-back" role="dialog" aria-modal onClick={closeAll}>
          <div className="sbi-m sbi-m--wide" onClick={(e) => e.stopPropagation()}>
            <div className="sbi-m-h">
              <h2>{modal === 'add' ? 'Add new bike' : 'Edit bike'}</h2>
              <button type="button" className="sbi-m-x" onClick={closeAll} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sbi-m-body">
              <div className="sbi-m-imgrow">
                <div className={`sbi-m-prev ${mainImagePreview ? 'has-img' : ''}`} aria-hidden>
                  {mainImagePreview ? (
                    <img src={mainImagePreview} alt="" />
                  ) : (
                    <i className="fas fa-motorcycle" />
                  )}
                </div>
                <div>
                  {canUseLocalBikeImageUpload ? (
                    <>
                      <p className="sbi-m-hint" style={{ marginTop: 0 }}>
                        <strong>Bike image</strong> — Vite/PHP saves files under <code>public/uploads/bikes/</code> on
                        this machine or host. <strong>Firestore stores only the image URL</strong> (not the file). Max
                        5MB, JPG/PNG/WebP. You can also paste a URL.
                      </p>
                      <div className="sbi-m-upload-btns">
                        <input
                          ref={bikeImageInputRef}
                          type="file"
                          accept={BIKE_IMAGE_ACCEPT}
                          onChange={onPickBikeImage}
                          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                          tabIndex={-1}
                        />
                        <button
                          type="button"
                          className="sbi-m-btn sbi-m-btn--blue"
                          onClick={() => bikeImageInputRef.current?.click()}
                          aria-label="Choose image from your device"
                        >
                          <i className="fas fa-cloud-upload-alt" aria-hidden />
                          Choose image
                        </button>
                        {mainImagePreview ? (
                          <button type="button" className="sbi-m-btn sbi-m-btn--red" onClick={clearBikeImage}>
                            <i className="fas fa-trash" />
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <div className="sbi-m-field sbi-m-fw" style={{ marginTop: 8 }}>
                        <label>Or image URL (https or same-site path)</label>
                        <input
                          value={imageUrl}
                          onChange={(e) => {
                            const v = e.target.value
                            setImageUrl(v)
                            if (v.trim()) setImageFile(null)
                          }}
                          placeholder="https://… or /uploads/bikes/…"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="sbi-m-hint" style={{ marginTop: 0 }}>
                        <strong>Bike image URL only</strong> — paste a public <code>https</code> or site path. Firestore
                        stores only the string. For &quot;Choose image&quot; + local folder, set{' '}
                        <code>VITE_ENABLE_BIKE_FILE_UPLOAD=true</code> and <code>VITE_BIKE_IMAGE_UPLOAD_PATH</code> (see
                        .env.example).
                      </p>
                      <div className="sbi-m-field sbi-m-fw">
                        <label>Image URL *</label>
                        <input
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://… or /uploads/…"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="sbi-m-grid">
                <div className="sbi-m-field">
                  <label>
                    Brand <span className="sbi-req">*</span>
                  </label>
                  <input
                    list="sbi-brand-suggestions"
                    value={draft.brand ?? ''}
                    onChange={(e) => setField({ brand: e.target.value })}
                    placeholder="e.g. Honda"
                    required
                  />
                  <datalist id="sbi-brand-suggestions">
                    {BRAND_CHOICES.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="sbi-m-field">
                  <label>
                    Model (title) <span className="sbi-req">*</span>
                  </label>
                  <input
                    value={draft.title}
                    onChange={(e) => setField({ title: e.target.value })}
                    placeholder="e.g. CB Shine 125"
                    required
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Category</label>
                  <input
                    value={draft.category}
                    onChange={(e) => setField({ category: e.target.value })}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Year</label>
                  <input
                    type="number"
                    value={draft.year ?? ''}
                    onChange={(e) =>
                      setField({ year: e.target.value === '' ? undefined : Math.max(2000, Number(e.target.value)) })
                    }
                    min={2000}
                    max={2040}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Color</label>
                  <input
                    value={draft.bodyColor ?? ''}
                    onChange={(e) => setField({ bodyColor: e.target.value })}
                    placeholder="e.g. Black"
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Engine CC</label>
                  <input
                    type="number"
                    value={draft.engineCC ?? ''}
                    onChange={(e) =>
                      setField({
                        engineCC: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                      })
                    }
                    min={0}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Fuel</label>
                  <select
                    value={draft.fuelType ?? 'Petrol'}
                    onChange={(e) => setField({ fuelType: e.target.value })}
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Electric">Electric</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>
                <div className="sbi-m-field">
                  <label>Shop / location</label>
                  <input
                    value={draft.location ?? ''}
                    onChange={(e) => setField({ location: e.target.value })}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>
                    Purchase (LKR) <span className="sbi-req">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={draft.purchasePrice ?? ''}
                    onChange={(e) =>
                      setField({ purchasePrice: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
                <div className="sbi-m-field">
                  <label>
                    Sell price (LKR) <span className="sbi-req">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={draft.price || ''}
                    onChange={(e) => setField({ price: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Stock qty</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.stockQty ?? 0}
                    onChange={(e) => setField({ stockQty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Reorder at</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.reorderLevel ?? 5}
                    onChange={(e) =>
                      setField({ reorderLevel: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Chassis #</label>
                  <input
                    value={draft.chassisNo ?? ''}
                    onChange={(e) => setField({ chassisNo: e.target.value })}
                  />
                </div>
                <div className="sbi-m-field">
                  <label>Engine #</label>
                  <input
                    value={draft.engineNo ?? ''}
                    onChange={(e) => setField({ engineNo: e.target.value })}
                  />
                </div>
                <div className="sbi-m-field sbi-m-fw">
                  <label>
                    Supplier <span className="sbi-req">*</span>
                  </label>
                  <input
                    value={draft.supplier ?? ''}
                    onChange={(e) => setField({ supplier: e.target.value })}
                    required
                    placeholder="e.g. ABC Motors"
                  />
                </div>
                <div className="sbi-m-field sbi-m-fw">
                  <label>Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setField({ description: e.target.value })}
                    rows={2}
                    placeholder="Short public description for customers"
                  />
                </div>
                <div className="sbi-m-field sbi-m-fw">
                  <label>Additional notes (optional)</label>
                  <textarea
                    value={draft.additionalNotes ?? ''}
                    onChange={(e) => setField({ additionalNotes: e.target.value })}
                    rows={3}
                    placeholder="Extra info for customers (also appears in their View Details modal, below the main description)"
                    autoComplete="off"
                  />
                </div>
                <div className="sbi-m-field sbi-m-fw">
                  <p className="sbi-sec">
                    <i className="fas fa-swatchbook" /> Colours (same style as the customer page — name + swatch)
                  </p>
                  <div className="sbi-color-editor" role="group" aria-label="Sale colours">
                    {colorRows.map((c, i) => (
                      <div key={i} className="sbi-color-row">
                        <span
                          className="sbi-color-dot"
                          style={{ background: normHex(c.hex) }}
                          title={c.name}
                          aria-hidden
                        />
                        <input
                          className="sbi-color-name"
                          aria-label={`Colour name ${i + 1}`}
                          value={c.name}
                          onChange={(e) => {
                            const v = e.target.value
                            setColorRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: v } : r)))
                          }}
                          placeholder="e.g. Pearl White"
                        />
                        <input
                          type="color"
                          className="sbi-color-pick"
                          aria-label={`Pick colour ${i + 1}`}
                          value={(() => {
                            const h = normHex(c.hex)
                            return h.length === 7 ? h : '#64748b'
                          })()}
                          onChange={(e) => {
                            const h = e.target.value
                            setColorRows((rows) => rows.map((r, j) => (j === i ? { ...r, hex: h } : r)))
                          }}
                        />
                        <input
                          className="sbi-color-hex"
                          aria-label={`Hex ${i + 1}`}
                          value={c.hex}
                          onChange={(e) =>
                            setColorRows((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, hex: e.target.value } : r)),
                            )
                          }
                          placeholder="#FF6600"
                          spellCheck={false}
                        />
                        {colorRows.length > 1 ? (
                          <button
                            type="button"
                            className="sbi-color-rm"
                            onClick={() =>
                              setColorRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== i)))
                            }
                            aria-label={`Remove colour ${i + 1}`}
                          >
                            <i className="fas fa-times" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="sbi-color-add"
                      onClick={() =>
                        setColorRows((rows) => [
                          ...rows,
                          { name: `Colour ${rows.length + 1}`, hex: '#94a3b8' },
                        ])
                      }
                    >
                      <i className="fas fa-plus" aria-hidden /> Add colour
                    </button>
                  </div>
                </div>
                <div className="sbi-m-field sbi-m-fw">
                  <label>More specs (Label: value per line)</label>
                  <textarea value={specsText} onChange={(e) => setSpecsText(e.target.value)} rows={4} />
                </div>
                <label className="sbi-m-field sbi-m-fw sbi-cb">
                  <input
                    type="checkbox"
                    checked={draft.modalColorBlock ?? false}
                    onChange={(e) => setField({ modalColorBlock: e.target.checked })}
                  />
                  Show big colour swatches in customer “View Details”
                </label>
                <label className="sbi-m-field sbi-m-fw sbi-cb">
                  <input
                    type="checkbox"
                    checked={draft.active !== false}
                    onChange={(e) => setField({ active: e.target.checked })}
                  />
                  Active (visible to customers)
                </label>
              </div>
              <div className="sbi-m-foot">
                <button
                  type="button"
                  className="sbi-m-bt"
                  onClick={save}
                  disabled={saving || profileLoading || !canEdit}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="sbi-m-bt-s" onClick={closeAll}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'view' && viewBike ? (
        <div className="sbi-m-back" role="dialog" aria-modal onClick={closeAll}>
          <div className="sbi-m sbi-m--wide" onClick={(e) => e.stopPropagation()}>
            <div className="sbi-m-h">
              <h2>Bike details</h2>
              <button type="button" className="sbi-m-x" onClick={closeAll} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sbi-m-body">
              <div className="sbi-m-imgrow">
                <div className={`sbi-m-prev ${viewBike.images[0] ? 'has-img' : ''}`}>
                  {viewBike.images[0] ? (
                    <img src={viewBike.images[0]} alt="" />
                  ) : (
                    <i className="fas fa-motorcycle" />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 0.3rem' }}>
                    {(viewBike.brand || viewBike.category) + ' '}
                    {viewBike.title}
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Year: <strong>{viewBike.year ?? '—'}</strong> · {viewBike.active === false ? 'Hidden' : 'Active'}
                  </p>
                </div>
              </div>
              {viewBike.description?.trim() ? (
                <p
                  className="sbi-m-hint"
                  style={{ margin: '0 0 1rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                >
                  {viewBike.description}
                </p>
              ) : null}
              {viewBike.additionalNotes?.trim() ? (
                <div className="sbi-addl-notes" role="note">
                  <strong className="sbi-addl-notes__title">Additional notes (same as customer View Details)</strong>
                  <p className="sbi-addl-notes__text">{viewBike.additionalNotes}</p>
                </div>
              ) : null}
              <p className="sbi-sec" style={{ border: 'none', paddingTop: 0, marginBottom: 8 }}>
                All details (same as customer view)
              </p>
              <div className="sbi-detail-grid" style={{ marginBottom: 12 }}>
                {mergeDisplaySpecs(viewBike).map((s) => (
                  <div key={s.label + s.value} className="sbi-d-item">
                    <div className="sbi-d-l">{s.label}</div>
                    <div className="sbi-d-v">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="sbi-m-foot" style={{ marginTop: 16, border: 'none', paddingTop: 0 }}>
                <button type="button" className="sbi-m-bt" onClick={closeAll}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'stock' && stockTarget ? (
        <div className="sbi-m-back" role="dialog" aria-modal onClick={closeAll}>
          <div className="sbi-m" onClick={(e) => e.stopPropagation()}>
            <div className="sbi-m-h">
              <h2>Adjust stock</h2>
              <button type="button" className="sbi-m-x" onClick={closeAll} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sbi-m-body">
              <div className="sbi-m-field">
                <label>Bike</label>
                <input readOnly value={stockTarget.title} />
              </div>
              <div className="sbi-m-field">
                <label>Current</label>
                <input readOnly value={`${stockTarget.stockQty ?? 0} units`} />
              </div>
              <div className="sbi-m-field">
                <label>Type</label>
                <select
                  value={stockForm.type}
                  onChange={(e) => setStockForm((f) => ({ ...f, type: e.target.value as 'add' | 'remove' }))}
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </div>
              <div className="sbi-m-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={stockForm.qty}
                  onChange={(e) =>
                    setStockForm((f) => ({ ...f, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))
                  }
                />
              </div>
              <div className="sbi-m-foot">
                <button type="button" className="sbi-m-bt" onClick={saveStock} disabled={saving || !canEdit}>
                  Confirm
                </button>
                <button type="button" className="sbi-m-bt-s" onClick={closeAll}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
