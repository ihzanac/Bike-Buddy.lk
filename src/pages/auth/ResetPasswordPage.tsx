import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { confirmCustomerPasswordReset } from '@/services/auth'
import { resetPasswordWithOtpToken } from '@/services/passwordOtp'
import { ROUTES } from '@/utils/constants'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'
import '@/styles/bikebuddyAuthSplit.css'

const resetPasswordIllustration = 'https://www.rkdictionary.com/wp-content/uploads/2023/09/nm-min.png'

const schema = z
  .object({
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

type Form = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [search] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const oobCode = search.get('oobCode') ?? search.get('oobcode')
  const routeState = (location.state as
    | { fromCodeVerify?: boolean; email?: string; resetToken?: string }
    | null)
  const fromCodeVerify = Boolean(routeState?.fromCodeVerify)
  const otpEmail = routeState?.email ?? ''
  const otpResetToken = routeState?.resetToken ?? ''
  const [ready, setReady] = useState(Boolean(oobCode || fromCodeVerify))
  const form = useForm<Form>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!oobCode && !fromCodeVerify) {
      setReady(false)
    }
  }, [fromCodeVerify, oobCode])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (oobCode) {
        await confirmCustomerPasswordReset(oobCode, values.password)
      } else {
        if (!otpEmail || !otpResetToken) {
          toast.error('Reset session expired. Please verify OTP again.')
          navigate(ROUTES.forgotPassword, { replace: true })
          return
        }
        await resetPasswordWithOtpToken(otpEmail, values.password, otpResetToken)
      }
      toast.success('Password updated. You can sign in now.')
      navigate(ROUTES.login, { replace: true })
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e) {
        const code = String((e as { code?: string }).code)
        if (code.startsWith('auth/')) {
          toast.error(mapFirebaseAuthError(code))
          return
        }
        if (code === 'functions/internal') {
          toast.error('Password reset service is unavailable. Request a new OTP and try again.')
          return
        }
        if (code === 'functions/permission-denied') {
          toast.error('Invalid reset session. Verify OTP again and retry.')
          return
        }
        if (code === 'functions/deadline-exceeded') {
          toast.error('Reset session expired. Please request and verify a new OTP.')
          return
        }
        const message = e instanceof Error ? e.message : 'Could not update password.'
        toast.error(message)
        return
      }
      const message = e instanceof Error ? e.message : 'Could not update password.'
      toast.error(message)
    }
  })

  if (!ready) {
    return (
      <div className="bbl-split-page">
        <div className="bbl-container" style={{ maxWidth: 520 }}>
          <div
            className="bbl-card"
            style={{ display: 'block', padding: 32, textAlign: 'center', color: '#333' }}
          >
            <h2>Invalid link</h2>
            <p className="bbl-hint">Open the reset link from your email, or request a new one.</p>
            <Link to={ROUTES.forgotPassword} style={{ color: '#2f7d6d' }}>
              Forgot password
            </Link>
            {' · '}
            <Link to={ROUTES.login} style={{ color: '#2f7d6d' }}>
              Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bbl-split-page">
      <div className="bbl-container">
        <div className="bbl-card">
          <div className="bbl-image-box">
            <img src={resetPasswordIllustration} alt="Reset password illustration" />
          </div>
          <div className="bbl-form-box">
            <h2>Create New Password</h2>
            <p>Your new password must be strong and different from the old one.</p>
            <form onSubmit={onSubmit}>
              <label htmlFor="new-pw">New Password</label>
              <input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                placeholder="Enter new password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="bbl-hint" style={{ color: '#b91c1c', marginTop: -8 }}>
                  {form.formState.errors.password.message}
                </p>
              )}
              <label htmlFor="confirm-pw">Confirm Password</label>
              <input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="bbl-hint" style={{ color: '#b91c1c', marginTop: -8 }}>
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
              <button type="submit" className="bbl-primary" disabled={form.formState.isSubmitting}>
                Update Password
              </button>
            </form>
            <p className="bbl-back">
              <Link to={ROUTES.login}>Back to login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
