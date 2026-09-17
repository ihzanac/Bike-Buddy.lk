import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { registerAdmin } from '@/services/auth'
import { ROUTES } from '@/utils/constants'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'

const schema = z
  .object({
    name: z.string().min(2, 'Enter your name'),
    email: z.string().email('Valid email required'),
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
    role: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.role === 'super' || d.role === 'admin', {
    path: ['role'],
    message: 'Select a role',
  })

type Form = z.infer<typeof schema>

const defaultKey = import.meta.env.VITE_FIREBASE_ADMIN_PROVISIONING_KEY ?? ''

export function AdminRegisterPage() {
  const navigate = useNavigate()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const key = defaultKey.trim()
    if (!key) {
      toast.error('Admin provisioning is not configured', {
        description:
          'Set VITE_FIREBASE_ADMIN_PROVISIONING_KEY in your .env to match firestore.rules, then restart the dev server.',
      })
      return
    }
    try {
      await registerAdmin({
        email: values.email,
        password: values.password,
        displayName: values.name.trim(),
        provisioningKey: key,
        adminTier: values.role === 'super' ? 'super' : 'admin',
      })
      toast.success('Admin account created. You are signed in.')
      navigate(ROUTES.admin, { replace: true })
    } catch (e) {
      const code =
        typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : undefined
      if (code === 'permission-denied') {
        toast.error('Registration blocked', {
          description:
            'Wrong provisioning key, or Firestore rules are not deployed. The provisioning key must match `firestore.rules` and VITE_FIREBASE_ADMIN_PROVISIONING_KEY. In `.firebaserc`, set your real Firebase project id (not a placeholder), then run: npm run firebase:deploy:firestore-rules',
        })
        return
      }
      toast.error(mapFirebaseAuthError(code))
    }
  })

  return (
    <div className="bb-admin-register">
      <div className="register-container">
        <div className="register-box">
          <h2>Admin Registration</h2>
          <p>Create a new admin account</p>

          <form onSubmit={onSubmit}>
            <div className="input-group">
              <label htmlFor="ar-name">Full Name</label>
              <input id="ar-name" type="text" placeholder="Admin name" autoComplete="name" {...form.register('name')} />
              <small className="error">{form.formState.errors.name?.message}</small>
            </div>

            <div className="input-group">
              <label htmlFor="ar-email">Email</label>
              <input id="ar-email" type="email" placeholder="Admin email" autoComplete="email" {...form.register('email')} />
              <small className="error">{form.formState.errors.email?.message}</small>
            </div>

            <div className="input-group">
              <label htmlFor="ar-pw">Password</label>
              <input
                id="ar-pw"
                type="password"
                placeholder="Password"
                autoComplete="new-password"
                {...form.register('password')}
              />
              <small className="error">{form.formState.errors.password?.message}</small>
            </div>

            <div className="input-group">
              <label htmlFor="ar-pw2">Confirm Password</label>
              <input
                id="ar-pw2"
                type="password"
                placeholder="Confirm Password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              <small className="error">{form.formState.errors.confirmPassword?.message}</small>
            </div>

            <div className="input-group">
              <label htmlFor="ar-role">Admin Role</label>
              <select id="ar-role" {...form.register('role')}>
                <option value="">-- Select Role --</option>
                <option value="super">Super Admin</option>
                <option value="admin">System Admin</option>
              </select>
              <small className="error">{form.formState.errors.role?.message}</small>
            </div>

            <button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating account…' : 'Register Admin'}
            </button>
          </form>

          <div className="extra-links">
            <Link to={ROUTES.adminLogin}>Back to Admin Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
