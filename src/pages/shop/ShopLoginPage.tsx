import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { loginWithEmail } from '@/services/auth'
import { ROUTES } from '@/utils/constants'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'
import { getPostLoginRoute } from '@/utils/postLoginRoute'
import '@/styles/bikebuddyAuth.css'
import '@/styles/shop-owner-auth.css'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})

type Form = z.infer<typeof schema>

export function ShopLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const form = useForm<Form>({ resolver: zodResolver(schema) })
  const [showPassword, setShowPassword] = useState(false)

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const cred = await loginWithEmail(values.email, values.password)
      const next = await getPostLoginRoute(cred.user.uid)
      if (next === ROUTES.shopDashboard) {
        toast.success('Welcome back')
        navigate(from && from.startsWith('/shop') ? from : next, { replace: true })
        return
      }
      if (next === ROUTES.admin) {
        toast.message('Signed in as admin', { description: 'Opening the admin console.' })
        navigate(ROUTES.admin, { replace: true })
        return
      }
      toast.message('Not a shop owner account', {
        description: 'Use the main login for customer access.',
      })
      navigate(ROUTES.login, { replace: true })
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : undefined
      toast.error(mapFirebaseAuthError(code))
    }
  })

  return (
    <div className="shop-auth-page shop-auth-page--login">
      <div className="bbl-auth-back">
        <Link to={ROUTES.home} aria-label="Return to BikeHub home page">
          <span className="bbl-auth-back-icon" aria-hidden>
            🏠
          </span>
          <span>Back to home</span>
        </Link>
      </div>
      <div className="shop-login-container">
        <div className="shop-login-card">
          <h2>Shop Owner Login</h2>
          <p>Access your BikeBuddy.lk dashboard</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="shop-input-group">
              <label htmlFor="shop-login-email">Email Address</label>
              <input
                id="shop-login-email"
                type="email"
                autoComplete="email"
                placeholder="shopowner@email.com"
                {...form.register('email')}
              />
              <span className="shop-error" role="alert">
                {form.formState.errors.email?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="shop-login-password">Password</label>
              <div className="shop-password-wrap">
                <input
                  id="shop-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="shop-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="shop-error" role="alert">
                {form.formState.errors.password?.message}
              </span>
            </div>
            <button type="submit" disabled={form.formState.isSubmitting}>
              Login
            </button>
            <div className="shop-links">
              <Link to={ROUTES.shopRegister}>Register Shop</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
