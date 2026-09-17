import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { requestPasswordOtp } from '@/services/passwordOtp'
import { ROUTES } from '@/utils/constants'
import '@/styles/bikebuddyAuth.css'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})

type Form = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const form = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = form.handleSubmit(async (values) => {
    navigate(ROUTES.forgotPasswordCheck, { replace: true, state: { email: values.email, otpSent: false } })
    try {
      await requestPasswordOtp(values.email)
      toast.success('If that email is registered, you will receive a verification code shortly.')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not send verification code.'
      toast.error(message)
    }
  })

  return (
    <div className="bbl-auth-page">
      <div className="bbl-auth-back">
        <Link to={ROUTES.customerLogin} aria-label="Return to customer login">
          <span className="bbl-auth-back-icon" aria-hidden>
            ←
          </span>
          <span>Back to customer login</span>
        </Link>
      </div>
      <div className="forgot-container">
        <div className="forgot-box">
          <h2>Forgot Password</h2>
          <p>Enter your registered email to receive a verification code</p>
          <form onSubmit={onSubmit}>
            <div className="input-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                {...form.register('email')}
              />
              <span className="error" id="emailError" role="alert">
                {form.formState.errors.email?.message}
              </span>
            </div>
            <button type="submit" disabled={form.formState.isSubmitting}>
              Send Verification Code
            </button>
          </form>
          <p className="back-link">
            <Link to={ROUTES.customerLogin}>Back to customer login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
