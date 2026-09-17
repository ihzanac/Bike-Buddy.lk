import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADMIN_SALE_BIKES, type AdminBike, type AdminBikeColor } from '@/data/adminBikeSaleData'
import { useBikeSaleCatalog } from '@/hooks/useBikeSaleCatalog'
import {
  askBikeAssistant,
  compareTwoBikesWithAi,
  fetchExternalBikeResources,
  rankBestValueBikes,
  type ExternalResource,
} from '@/services/bikeAiAssistant'
import { cn } from '@/utils/cn'
import '@/styles/admin-bike-sale.css'

function mapEmbedUrl(q: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=14&output=embed`
}

function waLink(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
}

function getChatFallback(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('compare') || m.includes('comparison')) {
    return `Here's a quick comparison of our bikes:

🏍️ Budget (under 800K):
• Yamaha FZ V3 — LKR 780,000
  Best mileage: 45 km/l

💪 Mid (800K–1.2M):
• KTM Duke 200 — LKR 950,000
• Yamaha MT15 — LKR 1,110,000
• Bajaj NS200 — LKR 1,100,000

🚀 Premium:
• KTM Duke 390 — LKR 2,200,000

Which range interests you?`
  }
  if (m.includes('under') && m.includes('million')) {
    return `Bikes under 1 million LKR:

1️⃣ Yamaha FZ V3 — LKR 780,000
2️⃣ KTM Duke 200 — LKR 950,000

Both are great — FZ for economy, Duke 200 for sportier feel.`
  }
  if (m.includes('mileage') || m.includes('fuel') || m.includes('efficient')) {
    return `🌟 Best mileage:

1. Yamaha MT15 — 48 km/l
2. Yamaha FZ V3 — 45 km/l
3. Bajaj NS200 — 36 km/l
4. KTM Duke 200 — 35 km/l
5. KTM Duke 390 — 25 km/l`
  }
  if (m.includes('power') || m.includes('fast') || m.includes('performance')) {
    return `🚀 Power ranking:

1. KTM Duke 390 — 43 HP
2. KTM Duke 200 — 25 HP
3. Bajaj NS200 — 24.5 HP
4. Yamaha MT15 — 18.6 HP
5. Yamaha FZ V3 — 12.4 HP`
  }
  if (m.includes('ktm')) {
    return `KTM: Duke 200 (950K) and Duke 390 (2.2M). Both have strong brakes and sporty character.`
  }
  if (m.includes('yamaha')) {
    return `Yamaha: FZ V3 (780K) and MT15 (1.11M) — both efficient; MT15 edges on mileage.`
  }
  if (m.includes('bajaj')) {
    return `Bajaj NS200 — 1,100,000 LKR. 199cc, 24.5 HP, dual ABS, street-fighter style.`
  }
  if (m.includes('price') || m.includes('cheap') || m.includes('budget')) {
    return `Price order: FZ V3 → Duke 200 → NS200 / MT15 → Duke 390.`
  }
  if (m.includes('contact') || m.includes('visit') || m.includes('location')) {
    return `Pick a shop in the dropdown, then use WhatsApp from the bike details to reach the seller.`
  }
  return `Try: “Compare all bikes”, “Under 1M”, “Best mileage”, or a brand name (KTM, Yamaha, Bajaj).`
}

type ChatMsg = {
  id: string
  role: 'user' | 'ai'
  text: string
  resources?: ExternalResource[]
}

export type BikeSaleLayout = 'admin' | 'customer'

type Props = { layout: BikeSaleLayout }

export function BikeSaleShopView({ layout }: Props) {
  const { loading, useDemo, shopOptions, getDisplayBikes, getShop } = useBikeSaleCatalog()
  const [shopId, setShopId] = useState('')
  const displayBikes = useMemo(() => getDisplayBikes(shopId), [getDisplayBikes, shopId])
  const [cardColor, setCardColor] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const b of ADMIN_SALE_BIKES) o[b.id] = b.colors[0]!.name
    return o
  })
  const [modalColor, setModalColor] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const b of ADMIN_SALE_BIKES) o[b.id] = b.colors[0]!.name
    return o
  })
  const [openBike, setOpenBike] = useState<AdminBike | null>(null)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'ai',
      text: "Hi! I'm your AI bike expert. I can help you compare bikes, find the best deal, or answer questions! 🏍️",
    },
  ])
  const [typing, setTyping] = useState(false)
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')
  const [budgetInput, setBudgetInput] = useState('1000000')

  useEffect(() => {
    if (shopOptions.length === 0) return
    if (!shopId || !shopOptions.some((s) => s.id === shopId)) {
      setShopId(shopOptions[0]!.id)
    }
  }, [shopId, shopOptions])

  const bikeIdsKey = displayBikes.map((b) => b.id).join(',')
  useEffect(() => {
    setCardColor((prev) => {
      const n = { ...prev }
      for (const b of displayBikes) {
        if (n[b.id] === undefined) n[b.id] = b.colors[0]!.name
      }
      for (const k of Object.keys(n)) {
        if (!displayBikes.some((b) => b.id === k)) delete n[k]
      }
      return n
    })
    setModalColor((prev) => {
      const n = { ...prev }
      for (const b of displayBikes) {
        if (n[b.id] === undefined) n[b.id] = b.colors[0]!.name
      }
      for (const k of Object.keys(n)) {
        if (!displayBikes.some((b) => b.id === k)) delete n[k]
      }
      return n
    })
  }, [bikeIdsKey, displayBikes])

  const shop = shopId ? getShop(shopId) : null
  const mapSrc = shop ? mapEmbedUrl(shop.mapQ) : ''
  const mapTitle = shop
    ? `🗺️ ${shop.name} - ${shop.location}`
    : '🗺️ Shop Location'

  const defaultWa = '94771234567'

  const setColorOnCard = useCallback((bikeId: string, color: AdminBikeColor) => {
    setCardColor((c) => ({ ...c, [bikeId]: color.name }))
  }, [])

  const openModal = (bike: AdminBike) => {
    setModalColor((m) => ({ ...m, [bike.id]: cardColor[bike.id] ?? bike.colors[0]!.name }))
    setOpenBike(bike)
  }

  const setModalColorPick = useCallback(
    (bikeId: string, color: AdminBikeColor) => {
      setModalColor((s) => ({ ...s, [bikeId]: color.name }))
    },
    [],
  )

  const activePhone = shop?.whatsapp ?? defaultWa

  const waForBike = useCallback(
    (bike: AdminBike, colorName: string) => {
      return waLink(
        activePhone,
        `Hi, I'm interested in ${bike.name} (${colorName} colour). Please provide more details.`,
      )
    },
    [activePhone],
  )

  const shopWa = useMemo(() => {
    if (!shop) return '#'
    return waLink(shop.whatsapp, `Hi ${shop.owner}, I want to know about bikes at ${shop.name}`)
  }, [shop])

  const showDemoNote = useDemo
  const bikeById = useMemo(() => {
    const out: Record<string, AdminBike> = {}
    for (const b of displayBikes) out[b.id] = b
    return out
  }, [displayBikes])
  useEffect(() => {
    if (!openBike) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenBike(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openBike])

  const sendChat = useCallback(async (raw: string) => {
    const t = raw.trim()
    if (!t) return
    setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: t }])
    setChatInput('')
    setTyping(true)
    try {
      const resources = await fetchExternalBikeResources(t)
      const aiText = await askBikeAssistant({
        question: t,
        bikes: displayBikes,
        shop: shop ? { name: shop.name, location: shop.location } : null,
      })
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: aiText, resources: resources.items }])
    } catch {
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: getChatFallback(t) }])
    } finally {
      setTyping(false)
    }
  }, [displayBikes, shop])

  const runBestValue = useCallback(async () => {
    const budget = Number.parseInt(budgetInput.replace(/[^\d]/g, ''), 10)
    setChatMsgs((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: Number.isFinite(budget) ? `Best value bikes under LKR ${budget.toLocaleString('en-LK')}` : 'Best value bikes',
      },
    ])
    setTyping(true)
    try {
      const text = await rankBestValueBikes({
        bikes: displayBikes,
        budgetLkr: Number.isFinite(budget) ? budget : undefined,
        shop: shop ? { name: shop.name, location: shop.location } : null,
      })
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not rank bikes right now.'
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: msg }])
    } finally {
      setTyping(false)
    }
  }, [budgetInput, displayBikes, shop])

  const runAiCompare = useCallback(async () => {
    if (!cmpA || !cmpB) {
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: 'Please select two bikes to compare.' }])
      return
    }
    if (cmpA === cmpB) {
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: 'Choose two different bikes.' }])
      return
    }
    const a = bikeById[cmpA]
    const b = bikeById[cmpB]
    if (!a || !b) {
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: 'Selected bike data is unavailable.' }])
      return
    }
    setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: `Compare ${a.name} vs ${b.name}` }])
    setTyping(true)
    try {
      const resources = await fetchExternalBikeResources(`${a.name} vs ${b.name}`)
      const text = await compareTwoBikesWithAi({
        bikeA: a,
        bikeB: b,
        allBikes: displayBikes,
        shop: shop ? { name: shop.name, location: shop.location } : null,
      })
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text, resources: resources.items }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI compare failed.'
      setChatMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: msg }])
    } finally {
      setTyping(false)
    }
  }, [bikeById, cmpA, cmpB, displayBikes, shop])

  return (
    <div
      className={cn('abs-bike-page', layout === 'admin' ? 'abs-bike-page--admin' : 'abs-bike-page--customer')}
    >
      <header className="abs-header">
        <h1>BikeBuddy.lk</h1>
        <p>Find &amp; Compare Bikes Near You</p>
      </header>

      {showDemoNote ? (
        <p className="abs-hero-note">
          Demo sample bikes — no live listings in Firestore yet. Verified sale shops from the directory still
          appear in the list; choose one with linked inventory to see real bikes.
        </p>
      ) : null}

      <section className="abs-shop-section" aria-label="Select shop">
        <h2>📍 Select Bike Sale Shop</h2>
        <select
          id="abs-shopSelect"
          value={shopId}
          onChange={(e) => setShopId(e.target.value || '')}
        >
          <option value="">-- Choose Shop --</option>
          {shopOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.location ? ` – ${s.location}` : ''}
            </option>
          ))}
        </select>

        {shop ? (
          <div className="abs-shop-details">
            <h3 id="abs-selectedShopName">{shop.name}</h3>
            <p>
              <strong>📞 Phone:</strong> {shop.phone}
            </p>
            <p>
              <strong>👤 Owner:</strong> {shop.owner}
            </p>
            <p>
              <strong>📍 Location:</strong> {shop.location}
            </p>
            <a href={shopWa} className="abs-whatsapp-btn" target="_blank" rel="noopener noreferrer">
              💬 Contact Shop via WhatsApp
            </a>
          </div>
        ) : null}
      </section>

      <section className="abs-map-section" aria-label="Map">
        <h3>{mapTitle}</h3>
        {mapSrc ? (
          <iframe title="Shop map" className="abs-map-frame" src={mapSrc} />
        ) : (
          <div className="abs-map-empty" role="img" aria-label="Map placeholder">
            Choose a shop to load the map
          </div>
        )}
      </section>

      <section className="abs-bike-list" aria-label="Bikes for sale">
        {loading ? (
          <p className="abs-bike-hint" style={{ padding: '20px' }}>
            Loading shops and bike listings…
          </p>
        ) : !shopId ? (
          <p className="abs-bike-hint" style={{ padding: '20px' }}>Choose a shop to see bikes for sale.</p>
        ) : !useDemo && displayBikes.length === 0 ? (
          <p className="abs-bike-hint" style={{ padding: '20px' }}>
            This shop has not published any bikes yet. Check back soon.
          </p>
        ) : null}
        {!loading && displayBikes.map((bike) => {
          const sel = cardColor[bike.id] ?? bike.colors[0]!.name
          return (
            <div key={bike.id} className="abs-bike-card">
              <div className="abs-bike-image-container">
                <img src={bike.image} alt={bike.name} loading="lazy" />
              </div>
              <div className="abs-bike-info">
                <h3>{bike.name}</h3>
                <p className="abs-price">{bike.price}</p>
                <div className="abs-color-row">
                  <label>🎨 Choose Colour:</label>
                  <div className="abs-color-dots">
                    {bike.colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        className={sel === c.name ? 'abs-color-option abs-color-option--on' : 'abs-color-option'}
                        style={{ background: c.hex }}
                        title={c.name}
                        onClick={() => setColorOnCard(bike.id, c)}
                        aria-pressed={sel === c.name}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                  <span className="abs-selected-color">Selected: {sel}</span>
                </div>
                <button type="button" className="abs-details-btn" onClick={() => openModal(bike)}>
                  View Details
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {openBike ? (
        <div
          className="abs-modal-overlay"
          role="presentation"
          onClick={() => setOpenBike(null)}
        >
          <div
            className="abs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`abs-mod-title-${openBike.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="abs-modal-content">
              <button
                type="button"
                className="abs-modal-close"
                onClick={() => setOpenBike(null)}
                aria-label="Close"
              >
                ×
              </button>
              <div className="abs-modal-header">
                <img src={openBike.image} alt={openBike.name} />
              </div>
              <div className="abs-modal-body">
                <h2 id={`abs-mod-title-${openBike.id}`}>{openBike.name}</h2>
                {openBike.metaLine ? <p className="abs-modal-meta">{openBike.metaLine}</p> : null}
                <div className="abs-modal-price">{openBike.price}</div>
                {openBike.description ? (
                  <p className="abs-modal-desc">{openBike.description}</p>
                ) : null}
                {openBike.additionalNotes?.trim() ? (
                  <div className="abs-modal-addl">
                    <div className="abs-modal-addl-title">Additional notes</div>
                    <p className="abs-modal-addl-text">{openBike.additionalNotes}</p>
                  </div>
                ) : null}

                <div className="abs-specs-grid">
                  {openBike.specs.map((s, i) => (
                    <div key={`${s.label}-${i}-${s.value.slice(0, 24)}`} className="abs-spec-item">
                      <div className="abs-spec-label">{s.label}</div>
                      <div className="abs-spec-value">{s.value}</div>
                    </div>
                  ))}
                </div>

                {openBike.modalColorBlock ? (
                  <div className="abs-modal-colors">
                    <label>🎨 Choose Your Colour:</label>
                    <div className="abs-modal-color-dots">
                      {openBike.colors.map((c) => {
                        const active = (modalColor[openBike.id] ?? openBike.colors[0]!.name) === c.name
                        return (
                          <button
                            key={c.name}
                            type="button"
                            className={active ? 'abs-mcolor abs-mcolor--on' : 'abs-mcolor'}
                            style={{ background: c.hex }}
                            onClick={() => setModalColorPick(openBike.id, c)}
                            title={c.name}
                            aria-pressed={active}
                          >
                            {active ? '✓' : null}
                          </button>
                        )
                      })}
                    </div>
                    <span className="abs-modal-selected">
                      Selected Colour: {modalColor[openBike.id] ?? openBike.colors[0]!.name}
                    </span>
                  </div>
                ) : openBike.colors.length > 0 ? (
                  <div className="abs-modal-colors abs-modal-colors--compact">
                    <label>🎨 Colours</label>
                    <div className="abs-modal-color-dots">
                      {openBike.colors.map((c) => {
                        const active = (modalColor[openBike.id] ?? openBike.colors[0]!.name) === c.name
                        return (
                          <button
                            key={c.name}
                            type="button"
                            className={active ? 'abs-mcolor abs-mcolor--on' : 'abs-mcolor'}
                            style={{ background: c.hex }}
                            onClick={() => setModalColorPick(openBike.id, c)}
                            title={c.name}
                            aria-pressed={active}
                            aria-label={c.name}
                          />
                        )
                      })}
                    </div>
                    <span className="abs-modal-selected">Selected: {modalColor[openBike.id] ?? openBike.colors[0]!.name}</span>
                  </div>
                ) : null}

                <a
                  className="abs-whatsapp-btn"
                  href={waForBike(
                    openBike,
                    openBike.modalColorBlock
                      ? modalColor[openBike.id] ?? openBike.colors[0]!.name
                      : cardColor[openBike.id] ?? openBike.colors[0]!.name,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Contact via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="abs-ai-chat-button"
        onClick={() => setChatOpen((o) => !o)}
        aria-expanded={chatOpen}
        aria-label="Open AI bike assistant"
      >
        <span className="abs-ai-chat-icon" aria-hidden>
          ✦
        </span>
        <span className="abs-chat-badge">AI</span>
      </button>

      {chatOpen ? (
        <div className="abs-ai-chat-modal" role="dialog" aria-label="AI bike assistant">
          <div className="abs-chat-header">
            <h3>
              <span className="abs-chat-title-icon" aria-hidden>
                ✦
              </span>
              AI Bike Assistant
            </h3>
            <button type="button" className="abs-close-chat" onClick={() => setChatOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="abs-chat-messages">
            {chatMsgs.map((m) => (
              <div
                key={m.id}
                className={m.role === 'ai' ? 'abs-message abs-message--ai' : 'abs-message abs-message--user'}
              >
                <div className="abs-message-avatar" aria-hidden>
                  {m.role === 'ai' ? 'AI' : 'YOU'}
                </div>
                <div className="abs-message-content">
                  {m.text}
                  {m.role === 'ai' && m.resources?.length ? (
                    <div className="abs-ai-resources">
                      {m.resources.map((r) => (
                        <a
                          key={`${m.id}-${r.url}`}
                          className={`abs-ai-resource abs-ai-resource--${r.source}`}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt={r.title} loading="lazy" /> : null}
                          <span>{r.title}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {typing ? <div className="abs-typing">AI is thinking…</div> : null}
          </div>
          <div className="abs-chat-input-area">
            <div className="abs-quick-actions">
              <button type="button" className="abs-quick-btn" onClick={runAiCompare}>
                Compare 2 Bikes
              </button>
              <button type="button" className="abs-quick-btn" onClick={runBestValue}>
                Best Value Ranking
              </button>
              <button type="button" className="abs-quick-btn" onClick={() => sendChat('Compare all bikes')}>
                Compare All
              </button>
              <button
                type="button"
                className="abs-quick-btn"
                onClick={() => sendChat('Best bike under 1 million')}
              >
                Under 1M
              </button>
              <button type="button" className="abs-quick-btn" onClick={() => sendChat('Most fuel efficient')}>
                Best Mileage
              </button>
            </div>
            <div className="abs-chat-input-box" style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="Budget in LKR (e.g. 1000000)"
                aria-label="Budget in rupees"
              />
              <button type="button" className="abs-send-btn" onClick={runBestValue} disabled={typing}>
                Rank
              </button>
            </div>
            <div className="abs-chat-input-box" style={{ marginBottom: 8 }}>
              <select value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Select bike A">
                <option value="">Bike A</option>
                {displayBikes.map((b) => (
                  <option key={`cmp-a-${b.id}`} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Select bike B">
                <option value="">Bike B</option>
                {displayBikes.map((b) => (
                  <option key={`cmp-b-${b.id}`} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button type="button" className="abs-send-btn" onClick={runAiCompare} disabled={typing}>
                Compare
              </button>
            </div>
            <div className="abs-chat-input-box">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat(chatInput)
                }}
                placeholder="Ask anything about bikes…"
                aria-label="Message"
              />
              <button
                type="button"
                className="abs-send-btn"
                onClick={() => sendChat(chatInput)}
                disabled={typing}
                aria-label="Send"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
