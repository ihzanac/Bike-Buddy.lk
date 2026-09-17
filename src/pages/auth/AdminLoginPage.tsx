import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { doc, getDoc } from 'firebase/firestore'
import { loginWithEmail, logout } from '@/services/auth'
import { requireDb } from '@/services/firebase'
import { ROUTES } from '@/utils/constants'
import { getErrorCode, mapFirebaseAuthError, mapServiceError } from '@/utils/firebaseErrors'

const schema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').min(6, 'Password must be at least 6 characters'),
})

type Form = z.infer<typeof schema>

async function routeAfterLogin(uid: string) {
  const snap = await getDoc(doc(requireDb(), 'users', uid))
  if (!snap.exists()) {
    return { kind: 'no_profile' as const }
  }
  const data = snap.data() as Record<string, unknown> | undefined
  const role = data?.role as string | undefined
  if (role === 'admin') return { kind: 'ok' as const, path: ROUTES.admin }
  return { kind: 'ok' as const, path: ROUTES.home }
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const email = values.email.trim()
      const cred = await loginWithEmail(email, values.password)
      const next = await routeAfterLogin(cred.user.uid)
      if (next.kind === 'no_profile') {
        await logout()
        toast.error('No user profile in the database', {
          description: 'This email signed in, but there is no Firestore user document. Use Admin Register first, or run the demo bootstrap script.',
        })
        return
      }
      if (next.path !== ROUTES.admin) {
        await logout()
        toast.error('This account is not an admin', {
          description: 'Use the main site login for customers.',
        })
        return
      }
      toast.success('Welcome back')
      if (
        typeof from === 'string' &&
        from.startsWith('/') &&
        from !== ROUTES.adminLogin &&
        from.startsWith(ROUTES.admin)
      ) {
        navigate(from, { replace: true })
      } else {
        navigate(ROUTES.admin, { replace: true })
      }
    } catch (e) {
      const code = getErrorCode(e)
      if (code === 'permission-denied') {
        try {
          await logout()
        } catch {
          /* ignore */
        }
        toast.error(mapServiceError(code))
        return
      }
      if (code === 'unavailable') {
        toast.error(mapServiceError(code))
        return
      }
      if (code?.startsWith('auth/')) {
        toast.error(mapFirebaseAuthError(code))
        return
      }
      toast.error(mapServiceError(code))
    }
  })

  return (
    <div className="bb-admin-login">
      <div className="login-container">
        <div className="login-card">
          <h1>BikeBuddy.lk</h1>
          <p className="subtitle">Admin Control Panel</p>

          <form noValidate onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="bb-admin-email">Email Address</label>
              <input
                id="bb-admin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="admin@bikebuddy.lk"
                disabled={form.formState.isSubmitting}
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="bb-admin-field-error" role="alert">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="bb-admin-password">Password</label>
              <div className="password-field-wrap">
                <input
                  id="bb-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={form.formState.isSubmitting}
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="password-toggle"
                  disabled={form.formState.isSubmitting}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden />
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="bb-admin-field-error" role="alert">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <button className="login-btn" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Signing in…' : 'Login'}
            </button>

            <p className="register-link">
              Don&apos;t have an admin account? <Link to={ROUTES.adminRegister}>Register</Link>
            </p>
          </form>

          <p className="footer-text">© {new Date().getFullYear()} BikeBuddy.lk | Secure Admin Access</p>
          <p className="register-link" style={{ marginTop: 8 }}>
            <Link to={ROUTES.login}>Main site login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
