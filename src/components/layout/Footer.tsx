import { Link } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'

export function Footer() {
  return (
    <footer className="border-t border-surface-200 bg-surface-900 text-surface-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="font-display text-lg font-semibold text-white">BikeBuddy.lk</div>
          <p className="mt-2 text-sm text-surface-300">
            Book trusted service appointments and shop curated bikes and accessories from
            verified shop owners.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Explore</div>
          <ul className="mt-3 space-y-2 text-sm text-surface-300">
            <li>
              <Link className="hover:text-white" to={ROUTES.bikes}>
                Bikes
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to={ROUTES.accessories}>
                Accessories
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Contact</div>
          <ul className="mt-3 space-y-2 text-sm text-surface-300">
            <li>support@BikeBUddy.lk.example</li>
            <li>+1 (555) 010-2040</li>
            <li>Mon–Sat · 9:00–18:00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-surface-400">
        © {new Date().getFullYear()} BikeBuddy.lk. All rights reserved.
      </div>
    </footer>
  )
}
