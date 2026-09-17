import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { listActiveShopPartsForCustomer } from '@/services/shopParts'
import { listApprovedOwnersForParts } from '@/services/users'
import type { UserProfile } from '@/types'
import type { CustomerPart, PartCategory, StockLevel } from '@/data/customerPartsShopData'
import { PART_BRAND_LABEL, PART_CATEGORY_LABEL, stockLevelForPart, type ShopPart } from '@/types/shopPart'
import { cn } from '@/utils/cn'
import '@/styles/customer-parts-shop.css'

const PLACEHOLDER_IMG =
  'https://placehold.co/400x300/f1f5f9/64748b?text=Part'

function mapQueryForShop(shop: UserProfile) {
  return (
    shop.shopAddress?.trim() ||
    shop.district?.trim() ||
    shop.location?.trim() ||
    'Batticaloa'
  )
}

function waDigits(shop: UserProfile) {
  const w = shop.whatsapp?.replace(/\D/g, '') ?? ''
  if (w.length >= 9) return w
  return (shop.phone ?? '').replace(/\D/g, '') ?? ''
}

function toCustomerPart(p: ShopPart): CustomerPart {
  const st: StockLevel =
    p.stockQty <= 0
      ? 'out-stock'
      : stockLevelForPart(p.stockQty, p.reorderLevel) === 'low-stock'
        ? 'low-stock'
        : 'in-stock'
  const features = p.description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
  return {
    id: p.id,
    name: p.name,
    price: p.unitPrice,
    oldPrice: p.oldPrice,
    category: p.category as PartCategory,
    brand: p.brand,
    stock: st,
    categoryLabel: PART_CATEGORY_LABEL[p.category],
    brandLabel: PART_BRAND_LABEL[p.brand],
    features: features.length ? features : ['Contact the shop for more details.'],
    image: p.imageUrl?.trim() || PLACEHOLDER_IMG,
  }
}

type PriceFilter = 'all' | '0-1000' | '1000-5000' | '5000-10000' | '10000+'

function matchPrice(p: number, f: PriceFilter) {
  if (f === 'all') return true
  if (f === '0-1000') return p < 1000
  if (f === '1000-5000') return p >= 1000 && p <= 5000
  if (f === '5000-10000') return p > 5000 && p <= 10000
  return p > 10000
}

type CartLine = { partId: string; name: string; price: number; qty: number; image: string }
type PartsAiMsg = { id: string; role: 'user' | 'ai'; text: string }

function mapEmbedSrc(q: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=14&output=embed`
}

function googleImagesLink(q: string) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`
}

function youtubeSearchLink(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

function renderTextWithLinks(text: string) {
  const urlRe = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRe)
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`lnk-${i}`} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      )
    }
    return <span key={`txt-${i}`}>{part}</span>
  })
}

export function CustomerPartsShopView() {
  const [shops, setShops] = useState<UserProfile[]>([])
  const [shopsLoading, setShopsLoading] = useState(true)
  const [shopId, setShopId] = useState('')

  const [rawParts, setRawParts] = useState<ShopPart[]>([])
  const [partsLoading, setPartsLoading] = useState(false)

  const [category, setCategory] = useState<PartCategory | 'all'>('all')
  const [brand, setBrand] = useState<'all' | 'genuine' | 'oem' | 'aftermarket'>('all')
  const [priceF, setPriceF] = useState<PriceFilter>('all')
  const [search, setSearch] = useState('')

  const [qty, setQty] = useState<Record<string, number>>({})
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [detail, setDetail] = useState<CustomerPart | null>(null)
  const [partsByShop, setPartsByShop] = useState<Record<string, ShopPart[]>>({})
  const [aiOpen, setAiOpen] = useState(true)
  const [aiInput, setAiInput] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [aiMsgs, setAiMsgs] = useState<PartsAiMsg[]>([
    {
      id: 'p-ai-0',
      role: 'ai',
      text: 'Ask me about parts availability. Example: "What shops have engine oil?"',
    },
  ])

  useEffect(() => {
    let ok = true
    setShopsLoading(true)
    listApprovedOwnersForParts()
      .then((rows) => {
        if (ok) setShops(rows)
      })
      .catch((e) => {
        console.error(e)
        toast.error('Could not load parts shops')
      })
      .finally(() => {
        if (ok) setShopsLoading(false)
      })
    return () => {
      ok = false
    }
  }, [])

  useEffect(() => {
    if (!shopId) {
      setRawParts([])
      return
    }
    let ok = true
    setPartsLoading(true)
    listActiveShopPartsForCustomer(shopId)
      .then((rows) => {
        if (ok) setRawParts(rows)
      })
      .catch((e) => {
        console.error(e)
        toast.error('Could not load parts for this shop')
        if (ok) setRawParts([])
      })
      .finally(() => {
        if (ok) setPartsLoading(false)
      })
    return () => {
      ok = false
    }
  }, [shopId])

  useEffect(() => {
    if (!shopId) return
    setPartsByShop((prev) => ({ ...prev, [shopId]: rawParts }))
  }, [rawParts, shopId])

  const catalog: CustomerPart[] = useMemo(() => rawParts.map(toCustomerPart), [rawParts])

  const shop = useMemo(
    () => (shopId ? shops.find((s) => s.uid === shopId) : undefined),
    [shops, shopId],
  )

  const mapSrc = shop ? mapEmbedSrc(mapQueryForShop(shop)) : ''
  const mapTitle = shop ? `🗺️ ${shop.shopName || shop.displayName} — ${mapQueryForShop(shop)}` : '🗺️ Shop location'
  const hoursText = 'See shop profile for hours' // optional: from operatingHours later

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (brand !== 'all' && p.brand !== brand) return false
      if (!matchPrice(p.price, priceF)) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalog, category, brand, priceF, search])

  useEffect(() => {
    setQty((prev) => {
      const next = { ...prev }
      for (const p of filtered) {
        if (next[p.id] == null) next[p.id] = 1
      }
      return next
    })
  }, [filtered])

  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.qty, 0), [cart])

  const bumpQty = useCallback((id: string, d: number) => {
    setQty((m) => {
      const n = (m[id] ?? 1) + d
      return { ...m, [id]: Math.min(20, Math.max(1, n)) }
    })
  }, [])

  const addToCart = useCallback(
    (p: CustomerPart) => {
      if (p.stock === 'out-stock') {
        toast.error('This part is out of stock')
        return
      }
      if (!shopId) {
        toast.error('Select a parts shop first')
        return
      }
      const q0 = Math.min(qty[p.id] ?? 1, p.stock === 'low-stock' ? 5 : 99)
      setCart((list) => {
        const i = list.findIndex((l) => l.partId === p.id)
        if (i === -1) {
          return [...list, { partId: p.id, name: p.name, price: p.price, qty: q0, image: p.image }]
        }
        const next = [...list]
        next[i] = { ...next[i]!, qty: next[i]!.qty + q0 }
        return next
      })
      setJustAdded(p.id)
      window.setTimeout(() => setJustAdded((x) => (x === p.id ? null : x)), 1500)
    },
    [shopId, qty],
  )

  const removeLine = (idx: number) => {
    setCart((c) => c.filter((_, i) => i !== idx))
  }

  const waOrder = useCallback(() => {
    if (!shop) {
      toast.error('Select a shop first')
      return
    }
    const w = waDigits(shop)
    if (!w || w.length < 9) {
      toast.error('This shop has no WhatsApp number on file')
      return
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty')
      return
    }
    const owner = shop.displayName || 'there'
    let text = `Hi ${owner},\n\nI want to order these bike parts from ${shop.shopName || 'your shop'}:\n\n`
    for (const l of cart) {
      const t = l.price * l.qty
      text += `• ${l.name}\n  Qty: ${l.qty} × LKR ${l.price.toLocaleString()} = LKR ${t.toLocaleString()}\n\n`
    }
    text += `Total: LKR ${cartTotal.toLocaleString()}\n\nPlease confirm availability and delivery. Thank you!`
    const url = `https://wa.me/${w}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [shop, cart, cartTotal])

  const checkout = useCallback(() => {
    if (cart.length === 0) {
      toast.error('Your cart is empty')
      return
    }
    if (!shop) {
      toast.error('Select a parts shop first')
      setCartOpen(false)
      return
    }
    const lines = cart
      .map(
        (l) =>
          `${l.name} — Qty: ${l.qty} × LKR ${l.price.toLocaleString()} = LKR ${(l.price * l.qty).toLocaleString()}`,
      )
      .join('\n')
    if (
      window.confirm(
        `Order total: LKR ${cartTotal.toLocaleString()}\n\nShop: ${shop.shopName || shop.displayName}\n\n${lines}\n\nRequest this order?`,
      )
    ) {
      toast.success('Request saved locally — the shop will confirm via phone or WhatsApp.')
      setCart([])
      setCartOpen(false)
    }
  }, [cart, cartTotal, shop])

  const ensureShopPartsLoaded = useCallback(
    async (shopIds: string[]) => {
      const missing = shopIds.filter((id) => partsByShop[id] == null)
      if (missing.length === 0) return partsByShop
      const rows = await Promise.all(
        missing.map(async (id) => {
          try {
            const parts = await listActiveShopPartsForCustomer(id)
            return [id, parts] as const
          } catch {
            return [id, []] as const
          }
        }),
      )
      const merged: Record<string, ShopPart[]> = { ...partsByShop }
      for (const [id, parts] of rows) merged[id] = parts
      setPartsByShop(merged)
      return merged
    },
    [partsByShop],
  )

  const askPartsAi = useCallback(async () => {
    const q = aiInput.trim()
    if (!q) return
    setAiMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: q }])
    setAiInput('')
    setAiThinking(true)
    try {
      if (shops.length === 0) {
        setAiMsgs((m) => [
          ...m,
          { id: crypto.randomUUID(), role: 'ai', text: 'No approved parts shops are available right now.' },
        ])
        return
      }
      const ql = q.toLowerCase()
      const wantsAllShops = /shop|available|where|which/.test(ql)
      const oilIntent = /oil|engine oil|lubricant/.test(ql)
      const tokens = ql
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !['what', 'which', 'shop', 'have', 'with', 'for', 'and', 'the'].includes(t))

      const targetShopIds = wantsAllShops || !shopId ? shops.map((s) => s.uid) : [shopId]
      const loaded = await ensureShopPartsLoaded(targetShopIds)

      const hits: Array<{ shopName: string; partName: string; price: number; brand: string; details: string }> = []
      for (const sid of targetShopIds) {
        const s = shops.find((x) => x.uid === sid)
        const list = loaded[sid] ?? []
        for (const part of list) {
          const hay = `${part.name} ${part.description} ${PART_CATEGORY_LABEL[part.category]} ${PART_BRAND_LABEL[part.brand]}`.toLowerCase()
          const tokenMatch = tokens.length === 0 || tokens.every((t) => hay.includes(t))
          const oilMatch = !oilIntent || /oil|lubricant|engine oil/.test(hay)
          if (tokenMatch && oilMatch) {
            hits.push({
              shopName: s?.shopName?.trim() || s?.displayName || 'Unknown shop',
              partName: part.name,
              price: part.unitPrice,
              brand: PART_BRAND_LABEL[part.brand],
              details: part.description.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 1).join(' '),
            })
          }
        }
      }

      if (hits.length === 0) {
        setAiMsgs((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: 'No matching parts found in current approved shops. Try a broader term like "oil", "brake", or "battery".',
          },
        ])
        return
      }

      hits.sort((a, b) => a.price - b.price)
      const byShop = new Map<string, typeof hits>()
      for (const h of hits) {
        const arr = byShop.get(h.shopName) ?? []
        arr.push(h)
        byShop.set(h.shopName, arr)
      }
      const sections = Array.from(byShop.entries())
        .slice(0, 4)
        .map(([shopName, arr]) => {
          const top = arr.slice(0, 3)
          const lines = top.map(
            (x) =>
              `• ${x.partName} — LKR ${x.price.toLocaleString('en-LK')} (${x.brand})${x.details ? `\n  ${x.details}` : ''}`,
          )
          return `🏪 ${shopName}\n${lines.join('\n')}`
        })
      const topNames = Array.from(new Set(hits.map((h) => h.partName))).slice(0, 3)
      const extLinks = topNames
        .map((name) => {
          const img = googleImagesLink(`${name} motorcycle part sri lanka`)
          const yt = youtubeSearchLink(`${name} bike part review`)
          return `🔗 ${name}\n  Images: ${img}\n  YouTube: ${yt}`
        })
        .join('\n\n')
      const reply = `Found ${hits.length} matching part(s) across ${byShop.size} shop(s):\n\n${sections.join(
        '\n\n',
      )}\n\nGoogle/YouTube for matched results:\n${extLinks}\n\nTip: select a shop above, then add the part to cart or order via WhatsApp.`
      setAiMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: reply }])
    } finally {
      setAiThinking(false)
    }
  }, [aiInput, ensureShopPartsLoaded, shopId, shops])

  useEffect(() => {
    if (!detail) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [detail])

  return (
    <div className="cps-page">
      <header className="cps-header">
        <h1>🔧 BikeBuddy.lk</h1>
        <p>Premium bike parts from approved local shops</p>
      </header>

      <section className="cps-section" aria-label="Select parts shop">
        <h2>📍 Select parts shop</h2>
        <select
          className="cps-shop-select"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          disabled={shopsLoading}
        >
          <option value="">{shopsLoading ? 'Loading shops…' : '-- Choose shop --'}</option>
          {shops.map((s) => (
            <option key={s.uid} value={s.uid}>
              {s.shopName?.trim() || s.displayName} — {s.district || s.location || 'Sri Lanka'}
            </option>
          ))}
        </select>
        {!shopsLoading && shops.length === 0 ? (
          <p style={{ color: '#64748b', marginTop: 12 }}>
            No parts shops are listed yet. A shop must register with <strong>bike parts</strong>, be approved, and
            add inventory under <strong>Shop portal → Parts management</strong>.
          </p>
        ) : null}
        {shop ? (
          <div className="cps-shop-card">
            <h3>{shop.shopName || shop.displayName}</h3>
            <div className="cps-shop-info">
              {shop.phone ? (
                <div className="cps-info-item">
                  <span aria-hidden>📞</span> <span>{shop.phone}</span>
                </div>
              ) : null}
              <div className="cps-info-item">
                <span aria-hidden>👤</span> <span>{shop.displayName}</span>
              </div>
              <div className="cps-info-item">
                <span aria-hidden>📍</span>{' '}
                <span>{[shop.shopAddress, shop.district, shop.location].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              <div className="cps-info-item">
                <span aria-hidden>⏰</span> <span>{hoursText}</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {shop ? (
        <section className="cps-section" aria-label="Map">
          <h2 className="cps-map-h">{mapTitle}</h2>
          {mapSrc ? (
            <div className="cps-map-wrap">
              <iframe title="Shop map" src={mapSrc} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="cps-section" aria-label="Filters">
        <h2>🔍 Filter parts</h2>
        <div className="cps-filters">
          <div className="cps-fg">
            <label htmlFor="cps-cat">Category</label>
            <select
              id="cps-cat"
              value={category}
              onChange={(e) => setCategory((e.target.value as PartCategory | 'all') || 'all')}
            >
              <option value="all">All categories</option>
              <option value="engine">Engine parts</option>
              <option value="brake">Brake system</option>
              <option value="electrical">Electrical</option>
              <option value="body">Body parts</option>
              <option value="accessories">Accessories</option>
            </select>
          </div>
          <div className="cps-fg">
            <label htmlFor="cps-br">Brand</label>
            <select
              id="cps-br"
              value={brand}
              onChange={(e) => setBrand((e.target.value as typeof brand) || 'all')}
            >
              <option value="all">All brands</option>
              <option value="genuine">Genuine</option>
              <option value="oem">OEM</option>
              <option value="aftermarket">Aftermarket</option>
            </select>
          </div>
          <div className="cps-fg">
            <label htmlFor="cps-pr">Price range</label>
            <select id="cps-pr" value={priceF} onChange={(e) => setPriceF((e.target.value as PriceFilter) || 'all')}>
              <option value="all">All prices</option>
              <option value="0-1000">Under LKR 1,000</option>
              <option value="1000-5000">LKR 1,000 - 5,000</option>
              <option value="5000-10000">LKR 5,000 - 10,000</option>
              <option value="10000+">Above LKR 10,000</option>
            </select>
          </div>
          <div className="cps-fg">
            <label htmlFor="cps-sq">Search</label>
            <input
              id="cps-sq"
              className="cps-filter-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts…"
            />
          </div>
        </div>
      </section>

      <section className="cps-section" aria-label="Parts AI assistant">
        <div className="cps-ai-head">
          <h2>🤖 Parts AI assistant</h2>
          <button type="button" className="cps-ai-toggle" onClick={() => setAiOpen((v) => !v)}>
            {aiOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        {aiOpen ? (
          <>
            <div className="cps-ai-msgs">
              {aiMsgs.map((m) => (
                <div key={m.id} className={cn('cps-ai-msg', m.role === 'user' ? 'cps-ai-msg--user' : 'cps-ai-msg--ai')}>
                  {renderTextWithLinks(m.text)}
                </div>
              ))}
              {aiThinking ? <div className="cps-ai-thinking">Checking shops and prices…</div> : null}
            </div>
            <div className="cps-ai-input-row">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void askPartsAi()
                  }
                }}
                placeholder='Ask: "what are the shops available in oil?"'
                aria-label="Ask parts AI"
              />
              <button type="button" onClick={() => void askPartsAi()} disabled={aiThinking}>
                Send
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="cps-section" aria-label="Parts list">
        <h2>
          🛒 {partsLoading && shopId ? 'Loading…' : `Available parts (${filtered.length})`}
        </h2>
        {!shopId ? (
          <p style={{ color: '#64748b' }}>Choose a shop to see live inventory.</p>
        ) : !partsLoading && rawParts.length === 0 ? (
          <p style={{ color: '#64748b' }}>
            This shop has not added any active parts yet. The owner can publish them under <strong>Shop → Parts</strong>
            in their portal.
          </p>
        ) : null}
        <div className="cps-parts-grid">
          {filtered.map((p) => (
            <article key={p.id} className="cps-part-card">
              <span
                className={cn(
                  'cps-part-badge',
                  p.stock === 'low-stock' && 'cps-part-badge--low',
                  p.stock === 'in-stock' && 'cps-part-badge--in',
                  p.stock === 'out-stock' && 'cps-part-badge--out',
                )}
              >
                {p.stock === 'out-stock' ? 'Out of stock' : p.stock === 'low-stock' ? 'Low stock' : 'In stock'}
              </span>
              <div className="cps-part-image-container">
                <img src={p.image} alt="" loading="lazy" />
              </div>
              <div className="cps-part-info">
                <span className="cps-part-category">{p.categoryLabel}</span>
                <h3>{p.name}</h3>
                <p className="cps-part-brand">🏷️ {p.brandLabel}</p>
                <p className="cps-part-price">
                  LKR {p.price.toLocaleString()}
                  {p.oldPrice ? <span className="cps-old-price">LKR {p.oldPrice.toLocaleString()}</span> : null}
                </p>
                <div className="cps-part-details">
                  {p.features.map((line) => (
                    <span key={line}>
                      ✓ {line}
                      {'\n'}
                    </span>
                  ))}
                </div>
                <div className="cps-qty">
                  <button type="button" onClick={() => bumpQty(p.id, -1)} aria-label="Decrease quantity">
                    -
                  </button>
                  <input
                    type="text"
                    readOnly
                    value={qty[p.id] ?? 1}
                    title="Quantity"
                    aria-label="Quantity"
                  />
                  <button type="button" onClick={() => bumpQty(p.id, 1)} aria-label="Increase quantity">
                    +
                  </button>
                </div>
                <div className="cps-btn-group">
                  <button
                    type="button"
                    className={cn('cps-add-btn', justAdded === p.id && 'cps-add-btn--ok')}
                    onClick={() => addToCart(p)}
                    disabled={!shopId || p.stock === 'out-stock'}
                  >
                    {p.stock === 'out-stock' ? 'Unavailable' : justAdded === p.id ? '✅ Added!' : '🛒 Add'}
                  </button>
                  <button type="button" className="cps-details-link" onClick={() => setDetail(p)}>
                    View details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="cps-cart-fab"
        onClick={() => setCartOpen(true)}
        aria-label="Open cart"
      >
        <span aria-hidden>🛒</span>
        <span className="cps-cart-badg">{cartCount}</span>
      </button>

      <div
        className={cn('cps-cart-back', cartOpen && 'cps-cart-back--on')}
        role="presentation"
        onClick={() => setCartOpen(false)}
      />
      <aside
        className={cn('cps-cart-side', cartOpen && 'cps-cart-side--on')}
        aria-hidden={!cartOpen}
        aria-label="Shopping cart"
      >
        <div className="cps-cart-hd">
          <h2>🛒 Your cart</h2>
          <button type="button" className="cps-cart-x" onClick={() => setCartOpen(false)} aria-label="Close cart">
            ×
          </button>
        </div>
        <div className="cps-cart-list">
          {cart.length === 0 ? (
            <div className="cps-empty">
              <p style={{ fontSize: '2.5rem' }}>🛒</p>
              <p>Your cart is empty</p>
              <p style={{ fontSize: '0.9em' }}>Add some parts to get started</p>
            </div>
          ) : (
            cart.map((l, i) => (
              <div key={`${l.partId}-${i}`} className="cps-cart-item">
                <img src={l.image} alt="" />
                <div className="cps-cart-mid">
                  <h4>{l.name}</h4>
                  <p>
                    LKR {l.price.toLocaleString()} × {l.qty}
                  </p>
                  <p className="cps-line-tot">LKR {(l.price * l.qty).toLocaleString()}</p>
                </div>
                <button type="button" className="cps-rm" onClick={() => removeLine(i)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
        <div className="cps-cart-foot">
          <div className="cps-total-row">
            <span>Total</span>
            <span>LKR {cartTotal.toLocaleString()}</span>
          </div>
          <button type="button" className="cps-ck" onClick={checkout}>
            Request order
          </button>
          <button type="button" className="cps-wa-ord" onClick={waOrder}>
            Order via WhatsApp
          </button>
        </div>
      </aside>

      {detail ? (
        <div className="cps-pmod-back" role="presentation" onClick={() => setDetail(null)}>
          <div className="cps-pmod" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cps-pmod-x" onClick={() => setDetail(null)} aria-label="Close">
              ×
            </button>
            <div className="cps-pmod-top">
              <div className="cps-pmod-fig">
                <img src={detail.image} alt={detail.name} />
              </div>
              <div>
                <h2>{detail.name}</h2>
                <p className="cps-pmod-p">
                  LKR {detail.price.toLocaleString()}
                  {detail.oldPrice ? (
                    <span className="cps-old-price"> LKR {detail.oldPrice.toLocaleString()}</span>
                  ) : null}
                </p>
                <p>
                  {detail.categoryLabel} · {detail.brandLabel}
                </p>
                <p style={{ marginTop: 12 }}>{detail.features.map((f) => `• ${f}`).join(' ')}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
