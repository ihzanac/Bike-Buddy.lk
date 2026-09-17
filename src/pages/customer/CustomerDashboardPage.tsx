import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'
import { CustomerAiChatbot } from '@/components/customer/CustomerAiChatbot'
import { CustomerMapEmbed } from '@/components/customer/CustomerMapEmbed'
import '@/styles/customerPortalHome.css'

const featureCopy = [
  {
    title: '🤖 AI-Assisted Smart Search',
    body: 'Our intelligent search automatically corrects spelling mistakes and understands context to give you the best results instantly.',
  },
  {
    title: '📍 Location-Based Discovery',
    body: 'Find the nearest shops, services, and parts using GPS-powered interactive maps with real-time updates.',
  },
  {
    title: '🎯 One Complete Platform',
    body: 'Services, bike sales, and spare parts unified in one seamless system — no need to visit multiple websites.',
  },
] as const

export function CustomerDashboardPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (q) {
      navigate(`${ROUTES.customerBikes}?q=${encodeURIComponent(q)}`)
      return
    }
    navigate(ROUTES.customerBikes)
  }

  return (
    <div className="bbl-cust-home">
      <section className="cph-hero">
        <div className="cph-hero-inner">
          <h1>Your Smart Motorcycle Companion</h1>
          <p className="cph-lead">
            Find bike services, bikes for sale, and genuine spare parts anywhere in Sri Lanka
          </p>
          <form className="cph-search" onSubmit={onSearch}>
            <input
              type="search"
              placeholder="Search bike, service, shop or part (ex: ktm duke)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search catalog"
            />
            <button type="submit">
              <span className="cph-search-ico" aria-hidden>
                🔍
              </span>{' '}
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="cph-actions" aria-label="Quick actions">
        <article className="cph-card">
          <h3>🛠️ Book a Service</h3>
          <p>Find trusted bike service centers near you with verified reviews and instant booking.</p>
          <Link to={ROUTES.bookService}>Book Now</Link>
        </article>
        <article className="cph-card">
          <h3>🏍️ Buy a Bike</h3>
          <p>Explore bikes for sale from verified shops with detailed specs and competitive pricing.</p>
          <Link to={ROUTES.customerBikes}>View All Bikes</Link>
        </article>
        <article className="cph-card">
          <h3>🧩 Buy Spare Parts</h3>
          <p>Search genuine parts with live price comparison and real-time availability across shops.</p>
          <Link to={ROUTES.customerParts}>Find Parts</Link>
        </article>
      </section>

      <section className="cph-location">
        <h2>📍 Nearby shops</h2>
        <p>Discover bike service, sale, and parts shops around your location with interactive maps</p>
        <CustomerMapEmbed />
      </section>

      <section className="cph-features">
        <h2>Why BikeBuddy.lk?</h2>
        <div className="cph-feature-grid">
          {featureCopy.map((f) => (
            <article key={f.title} className="cph-feature">
              <h4>{f.title}</h4>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <CustomerAiChatbot />

      <footer className="cph-foot">
        <p>© 2026 BikeBuddy.lk | Sri Lanka&apos;s Premier Smart Motorcycle Management System</p>
        <p className="cph-foot-tag">Empowering riders across the island 🏍️</p>
      </footer>
    </div>
  )
}
