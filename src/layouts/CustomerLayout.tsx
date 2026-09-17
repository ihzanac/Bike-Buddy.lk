import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'
import { logout } from '@/services/auth'
import { toast } from 'sonner'
import { CustomerLogoutModal } from '@/components/customer/CustomerLogoutModal'
import '@/styles/bikebuddyCustomerArea.css'

export function CustomerLayout() {
  const [logoutOpen, setLogoutOpen] = useState(false)

  async function handleConfirmLogout() {
    setLogoutOpen(false)
    await logout()
    toast.success('Signed out')
  }

  return (
    <div className="bbl-cust-layout-root">
      <header className="bbl-cust-topbar">
        <div className="bbl-cust-topbar-inner">
          <div className="bbl-cust-brand" aria-label="BikeBuddy.lk home">
            <span className="bbl-cust-brand-ico" aria-hidden>
              🏍️
            </span>
            <span className="bbl-cust-brand-text">BikeBuddy.lk</span>
          </div>
          <nav className="bbl-cust-topnav" aria-label="Customer account">
            <NavLink to={ROUTES.dashboard} className="bbl-cust-navlink" end>
              Home
            </NavLink>
            <NavLink to={ROUTES.bookService} className="bbl-cust-navlink">
              Bike service Bookings
            </NavLink>
            <NavLink to={ROUTES.customerBikes} className="bbl-cust-navlink">
              Bike sale
            </NavLink>
            <NavLink to={ROUTES.customerParts} className="bbl-cust-navlink">
              Bike parts
            </NavLink>
            <NavLink to={ROUTES.bookings} className="bbl-cust-navlink">
              My bookings
            </NavLink>
            <NavLink to={ROUTES.customerReportIssue} className="bbl-cust-navlink">
              Report a problem
            </NavLink>
            <NavLink to={ROUTES.shopLogin} className="bbl-cust-navlink bbl-cust-navlink--so">
              Shop owner login
            </NavLink>
            <div className="bbl-cust-top-actions" role="group" aria-label="Profile and sign out">
              <NavLink to={ROUTES.profile} className="bbl-cust-navlink">
                Profile
              </NavLink>
              <button className="bbl-cust-top-logout" type="button" onClick={() => setLogoutOpen(true)}>
                Log out
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="bbl-cust-main bbl-cust-main--wide bbl-cust-main--page">
        <Outlet />
      </main>

      <CustomerLogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </div>
  )
}
