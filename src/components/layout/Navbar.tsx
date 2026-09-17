import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200',
    'after:absolute after:bottom-1 after:left-3.5 after:right-3.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-cyan-300 after:transition-transform',
    isActive
      ? 'bg-white/14 text-white shadow-[0_10px_24px_-14px_rgba(56,189,248,0.65)] ring-1 ring-cyan-300/35 after:scale-x-100'
      : 'text-slate-200 hover:bg-white/10 hover:text-white hover:shadow-[0_8px_20px_-14px_rgba(56,189,248,0.5)] hover:after:scale-x-100',
  )

export function Navbar() {
  const { firebaseUser, profile, loading } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-200/20 bg-slate-950/55 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between gap-4 border border-cyan-200/25 bg-gradient-to-r from-slate-900/70 via-blue-900/45 to-indigo-900/50 px-4 py-3 shadow-[0_18px_34px_-24px_rgba(37,99,235,0.8)] ring-1 ring-cyan-300/20 sm:px-6">
        <Link to={ROUTES.home} className="group flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-sm font-black text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.7)] transition group-hover:scale-[1.03]">
            BS
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold tracking-tight text-white">
              BikeBuddy.lk
            </div>
            <div className="text-[11px] font-medium text-sky-100/80">Service & marketplace</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1.5 rounded-2xl border border-cyan-200/25 bg-white/5 p-1.5 ring-1 ring-cyan-300/15 md:flex">
          <NavLink to={ROUTES.home} className={navClass} end>
            Home
          </NavLink>
          <NavLink to={ROUTES.bikes} className={navClass}>
            Bikes
          </NavLink>
          <NavLink to={ROUTES.accessories} className={navClass}>
            Accessories
          </NavLink>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <span className="text-sm text-surface-500">Loading…</span>
          ) : firebaseUser ? (
            <>
              {profile?.role === 'customer' ? (
                <>
                  <Link to={ROUTES.login}>
                    <Button variant="ghost" className="rounded-xl px-3 py-2 text-slate-100 hover:bg-white/10 hover:text-white">
                      Login
                    </Button>
                  </Link>
                  <Link to={ROUTES.bookService}>
                    <Button className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 shadow-[0_12px_24px_-14px_rgba(37,99,235,0.8)]">
                      Book service
                    </Button>
                  </Link>
                </>
              ) : null}
              {profile?.role === 'admin' ? (
                <Link to={ROUTES.admin}>
                  <Button className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 shadow-[0_12px_24px_-14px_rgba(37,99,235,0.8)]">
                    Admin
                  </Button>
                </Link>
              ) : null}
              {profile?.role === 'owner' ? (
                <>
                  <Link to={ROUTES.shopBikeSales}>
                    <Button
                      variant="ghost"
                      className="rounded-xl px-3 py-2 text-slate-100 hover:bg-white/10 hover:text-white"
                    >
                      Bike listings
                    </Button>
                  </Link>
                  <Link to={ROUTES.shopDashboard}>
                    <Button className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 shadow-[0_12px_24px_-14px_rgba(37,99,235,0.8)]">
                      Shop portal
                    </Button>
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Link to={ROUTES.login}>
                <Button variant="ghost" className="rounded-xl px-3 py-2 hover:bg-white/80">
                  Login
                </Button>
              </Link>
              <Link to={ROUTES.register}>
                <Button className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 shadow-[0_12px_24px_-14px_rgba(37,99,235,0.8)]">
                  Register
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-cyan-200/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_-16px_rgba(37,99,235,0.8)] md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          Menu
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-cyan-200/25 bg-slate-900/90 backdrop-blur md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              <NavLink to={ROUTES.home} className={navClass} end onClick={() => setOpen(false)}>
                Home
              </NavLink>
              <NavLink to={ROUTES.bikes} className={navClass} onClick={() => setOpen(false)}>
                Bikes
              </NavLink>
              <NavLink
                to={ROUTES.accessories}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                Accessories
              </NavLink>
              {!firebaseUser ? (
                <div className="flex flex-col gap-2 pt-2">
                  <Link to={ROUTES.login} onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link to={ROUTES.register} onClick={() => setOpen(false)}>
                    <Button className="w-full">Register</Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-2">
                  {profile?.role === 'customer' ? (
                    <>
                      <Link to={ROUTES.login} onClick={() => setOpen(false)}>
                        <Button variant="secondary" className="w-full">
                          Login
                        </Button>
                      </Link>
                      <Link to={ROUTES.bookService} onClick={() => setOpen(false)}>
                        <Button className="w-full">Book service</Button>
                      </Link>
                    </>
                  ) : null}
                  {profile?.role === 'admin' ? (
                    <Link to={ROUTES.admin} onClick={() => setOpen(false)}>
                      <Button className="w-full">Admin</Button>
                    </Link>
                  ) : null}
                  {profile?.role === 'owner' ? (
                    <>
                      <Link to={ROUTES.shopBikeSales} onClick={() => setOpen(false)}>
                        <Button variant="secondary" className="w-full">
                          Bike listings
                        </Button>
                      </Link>
                      <Link to={ROUTES.shopDashboard} onClick={() => setOpen(false)}>
                        <Button className="w-full">Shop portal</Button>
                      </Link>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
