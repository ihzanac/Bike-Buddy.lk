import { Link } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'
import '@/styles/bikebuddyAuth.css'

type PortalChoice = {
  id: string
  title: string
  description: string
  to: string
  icon: string
}

const choices: PortalChoice[] = [
  {
    id: 'customer',
    title: 'Customer',
    description: 'Book service, browse bikes & parts, and manage your bookings.',
    to: ROUTES.customerLogin,
    icon: '👤',
  },
  {
    id: 'admin',
    title: 'Administrator',
    description: 'Platform console for users, listings, shops, and reports.',
    to: ROUTES.adminLogin,
    icon: '🛡️',
  },
  {
    id: 'owner',
    title: 'Shop owner',
    description: 'Vendor dashboard for your workshop or store on BikeHub.',
    to: ROUTES.shopLogin,
    icon: '🏪',
  },
]

/** Landing step before email/password: pick account type, then open the right sign-in screen. */
export function LoginSelectPage() {
  return (
    <div className="bbl-auth-page bbl-auth-page--login-select">
      <div className="bbl-auth-back">
        <Link to={ROUTES.home} aria-label="Return to BikeHub home page">
          <span className="bbl-auth-back-icon" aria-hidden>
            🏠
          </span>
          <span>Back to home</span>
        </Link>
      </div>

      <div className="bbl-login-select-wrap">
        <header className="bbl-login-select-head">
          <h1>Sign in</h1>
          <p>Choose how you use BikeHub — you will be taken to the correct login screen.</p>
        </header>

        <ul className="bbl-login-select-list" role="list">
          {choices.map((c) => (
            <li key={c.id}>
              <Link to={c.to} className="bbl-login-select-card">
                <span className="bbl-login-select-icon" aria-hidden>
                  {c.icon}
                </span>
                <span className="bbl-login-select-text">
                  <span className="bbl-login-select-title">{c.title}</span>
                  <span className="bbl-login-select-desc">{c.description}</span>
                </span>
                <span className="bbl-login-select-arrow" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="bbl-login-select-footer">
          Need an account? <Link to={ROUTES.register}>Register as a customer</Link>
        </p>
      </div>
    </div>
  )
}
