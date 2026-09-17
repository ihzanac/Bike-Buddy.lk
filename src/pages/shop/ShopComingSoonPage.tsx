import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'

const SECTIONS: Record<string, { title: string; body: string }> = {
  [ROUTES.shopBookings]: {
    title: 'Booking Management',
    body: 'Accept, schedule, and complete customer service bookings. This screen will connect to your live Firestore bookings collection.',
  },
  [ROUTES.shopServices]: {
    title: 'Service Management',
    body: 'List services, durations, and prices customers can book. Wire this to your `services` documents when you enable the catalog API.',
  },
  [ROUTES.shopProfile]: {
    title: 'Shop Profile',
    body: 'Update branding, address, hours, and contact channels shown to riders on BikeBuddy.lk.',
  },
  [ROUTES.shopFeedback]: {
    title: 'Customer Feedback',
    body: 'Read and reply to reviews. Moderation tools can hook into the same flows you use on the public site.',
  },
  [ROUTES.shopParts]: {
    title: 'Parts Management',
    body: 'Track SKUs, stock levels, and suppliers for spare parts inventory.',
  },
  [ROUTES.shopBikeSales]: {
    title: 'Bike Sale Management',
    body: 'Manage showroom inventory, pricing, and chassis records for bikes you sell.',
  },
}

export function ShopComingSoonPage() {
  const { pathname } = useLocation()
  const section = SECTIONS[pathname] ?? {
    title: 'Shop portal',
    body: 'This area is under construction.',
  }

  return (
    <>
      <div className="sp-top-bar">
        <div>
          <h1>{section.title}</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Dashboard</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>{section.title}</span>
          </div>
        </div>
      </div>
      <div className="sp-panel">
        <h2 style={{ fontSize: '22px', color: 'var(--sp-dark)' }}>Coming next</h2>
        <p>{section.body}</p>
      </div>
    </>
  )
}
