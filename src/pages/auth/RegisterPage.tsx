import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { registerCustomer } from '@/services/auth'
import { ROUTES } from '@/utils/constants'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'
import '@/styles/bikebuddyAuth.css'

const schema = z
  .object({
    displayName: z.string().min(2, 'Please enter your name'),
    email: z.string().email(),
    phone: z.string().min(7, 'Enter a valid phone number'),
    location: z.string().min(2, 'Please enter your location'),
    password: z.string().min(6, 'Use at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type Form = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const form = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerCustomer({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        phone: values.phone.trim(),
        location: values.location.trim(),
      })
      toast.success('Account created')
      navigate(ROUTES.dashboard, { replace: true })
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : undefined
      toast.error(mapFirebaseAuthError(code))
    }
  })

  return (
    <div className="bbl-auth-page bbl-auth-page--register">
      <div className="bbl-auth-back">
        <Link to={ROUTES.home} aria-label="Return to BikeHub home page">
          <span className="bbl-auth-back-icon" aria-hidden>
            🏠
          </span>
          <span>Back to home</span>
        </Link>
      </div>
      <div className="register-container">
        <div className="register-box">
          <h2>Create Account</h2>
          <p>Join BikeBuddy.lk</p>
          <form onSubmit={onSubmit} noValidate>
            <input type="text" autoComplete="name" placeholder="Full Name" {...form.register('displayName')} />
            <span className="error" id="nameError" role="alert">
              {form.formState.errors.displayName?.message}
            </span>
            <input type="email" autoComplete="email" placeholder="Email" {...form.register('email')} />
            <span className="error" id="emailError" role="alert">
              {form.formState.errors.email?.message}
            </span>
            <input type="text" autoComplete="tel" placeholder="Phone Number" {...form.register('phone')} />
            <span className="error" id="phoneError" role="alert">
              {form.formState.errors.phone?.message}
            </span>
            <input type="password" autoComplete="new-password" placeholder="Password" {...form.register('password')} />
            <span className="error" id="passwordError" role="alert">
              {form.formState.errors.password?.message}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Create Password (confirm)"
              {...form.register('confirmPassword')}
            />
            <span className="error" id="createPasswordError" role="alert">
              {form.formState.errors.confirmPassword?.message}
            </span>
            <input
              type="text"
              autoComplete="address-line2"
              placeholder="Location (Eg: Batticaloa)"
              {...form.register('location')}
            />
            <span className="error" id="locationError" role="alert">
              {form.formState.errors.location?.message}
            </span>
            <button type="submit" disabled={form.formState.isSubmitting}>
              Register
            </button>
          </form>
          <p className="login-link">
            Already have an account? <Link to={ROUTES.login}>Back Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
