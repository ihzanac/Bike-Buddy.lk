import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { loginWithEmail } from '@/services/auth'
import { ROUTES } from '@/utils/constants'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'
import { getPostLoginRoute } from '@/utils/postLoginRoute'
import '@/styles/bikebuddyAuth.css'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})

type Form = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const form = useForm<Form>({ resolver: zodResolver(schema) })
  const [showPassword, setShowPassword] = useState(false)

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const cred = await loginWithEmail(values.email, values.password)
      const next = await getPostLoginRoute(cred.user.uid)
      toast.success('Welcome back')
      navigate(next, { replace: true })
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : undefined
      toast.error(mapFirebaseAuthError(code))
    }
  })

  return (
    <div className="bbl-auth-page">
      <div className="bbl-auth-back">
        <Link to={ROUTES.login} aria-label="Return to sign-in options">
          <span className="bbl-auth-back-icon" aria-hidden>
            ←
          </span>
          <span>Choose account type</span>
        </Link>
      </div>
      <div className="login-container">
        <div className="login-box">
          <h2>Customer Login</h2>
          <p>Welcome back to BikeBuddy.lk</p>
          <form onSubmit={onSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                {...form.register('email')}
              />
              <span className="error" id="emailError" role="alert">
                {form.formState.errors.email?.message}
              </span>
            </div>
            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <div className="bbl-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="bbl-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="error" id="passwordError" role="alert">
                {form.formState.errors.password?.message}
              </span>
            </div>
            <button type="submit" disabled={form.formState.isSubmitting}>
              Login
            </button>
          </form>
          <div className="extra-links">
            <Link to={ROUTES.forgotPassword}>Forgot Password?</Link>
            <span>|</span>
            <Link to={ROUTES.register}>Register</Link>
          </div>
          <p className="bbl-aux-links">
            <Link to={ROUTES.login}>Other sign-in options</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
