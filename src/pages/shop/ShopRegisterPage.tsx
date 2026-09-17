import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { registerShopOwner } from '@/services/auth'
import { ROUTES } from '@/utils/constants'
import {
  SHOP_OWNER_CATEGORY,
  SHOP_OWNER_CATEGORY_OPTIONS,
  SHOP_REGISTER_ALL_TYPES_VALUE,
  shopCategoriesFromRegisterChoice,
} from '@/utils/shopOwnerCategory'
import { mapFirebaseAuthError } from '@/utils/firebaseErrors'
import { SRI_LANKA_DISTRICTS } from '@/utils/sriLankaDistricts'
import '@/styles/bikebuddyAuth.css'
import '@/styles/shop-owner-auth.css'

const schema = z
  .object({
    ownerName: z.string().min(2, 'Enter owner name'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(8, 'Enter a valid mobile number'),
    password: z.string().min(6, 'At least 6 characters'),
    confirmPassword: z.string(),
    shopName: z.string().min(2, 'Enter shop name'),
    shopCategory: z
      .string()
      .refine(
        (s) =>
          s === SHOP_REGISTER_ALL_TYPES_VALUE ||
          s === SHOP_OWNER_CATEGORY.BIKE_SERVICE ||
          s === SHOP_OWNER_CATEGORY.BIKE_PARTS ||
          s === SHOP_OWNER_CATEGORY.BIKE_SALE,
        { message: 'Select a shop type' },
      ),
    shopAddress: z.string().min(8, 'Enter shop address'),
    district: z.string().min(1, 'Select district'),
    whatsapp: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormIn = z.input<typeof schema>
type Form = z.infer<typeof schema>

export function ShopRegisterPage() {
  const navigate = useNavigate()
  const form = useForm<FormIn, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      ownerName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      shopName: '',
      shopCategory: '',
      shopAddress: '',
      district: '',
      whatsapp: '',
    },
  })
  const regCat = form.watch('shopCategory')

  const onSubmit = form.handleSubmit(async (values) => {
    const shopCategories = shopCategoriesFromRegisterChoice(values.shopCategory)
    try {
      await registerShopOwner({
        email: values.email,
        password: values.password,
        ownerName: values.ownerName,
        phone: values.phone,
        shopName: values.shopName,
        shopCategories,
        shopAddress: values.shopAddress,
        district: values.district,
        whatsapp: values.whatsapp?.trim() || undefined,
      })
      toast.success('Shop registered — pending admin approval')
      navigate(ROUTES.shopDashboard, { replace: true })
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : undefined
      toast.error(mapFirebaseAuthError(code))
    }
  })

  return (
    <div className="shop-auth-page shop-auth-page--register">
      <div className="bbl-auth-back">
        <Link to={ROUTES.home} aria-label="Return to BikeHub home page">
          <span className="bbl-auth-back-icon" aria-hidden>
            🏠
          </span>
          <span>Back to home</span>
        </Link>
      </div>
      <div className="shop-register-container">
        <div className="shop-register-card">
          <h2>Register Your Shop</h2>
          <p>Create a shop account to start selling &amp; servicing</p>

          <form onSubmit={onSubmit} noValidate>
            <h4>Owner Details</h4>
            <div className="shop-input-group">
              <label htmlFor="reg-owner">Owner Full Name</label>
              <input id="reg-owner" type="text" placeholder="Enter owner name" {...form.register('ownerName')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.ownerName?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-email">Email Address</label>
              <input id="reg-email" type="email" autoComplete="email" placeholder="shop@email.com" {...form.register('email')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.email?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-phone">Mobile Number</label>
              <input id="reg-phone" type="tel" autoComplete="tel" placeholder="+94XXXXXXXXX" {...form.register('phone')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.phone?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-pass">Password</label>
              <input id="reg-pass" type="password" autoComplete="new-password" placeholder="Create password" {...form.register('password')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.password?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-pass2">Confirm Password</label>
              <input
                id="reg-pass2"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                {...form.register('confirmPassword')}
              />
              <span className="shop-error" role="alert">
                {form.formState.errors.confirmPassword?.message}
              </span>
            </div>

            <h4>Shop Details</h4>
            <div className="shop-input-group">
              <label htmlFor="reg-shop">Shop Name</label>
              <input id="reg-shop" type="text" placeholder="Your shop name" {...form.register('shopName')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.shopName?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-cat">Shop type</label>
              <select id="reg-cat" {...form.register('shopCategory')}>
                <option value="" disabled>
                  Select shop type
                </option>
                <option value={SHOP_REGISTER_ALL_TYPES_VALUE}>
                  All shop types — service, parts &amp; sale
                </option>
                {SHOP_OWNER_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="shop-error" role="alert">
                {form.formState.errors.shopCategory?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-addr">Shop Address</label>
              <textarea id="reg-addr" placeholder="Enter full shop address" {...form.register('shopAddress')} />
              <span className="shop-error" role="alert">
                {form.formState.errors.shopAddress?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-dist">District</label>
              <select id="reg-dist" {...form.register('district')}>
                <option value="" disabled>
                  Select District
                </option>
                {SRI_LANKA_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              <span className="shop-error" role="alert">
                {form.formState.errors.district?.message}
              </span>
            </div>
            <div className="shop-input-group">
              <label htmlFor="reg-wa">WhatsApp Number (optional)</label>
              <input id="reg-wa" type="tel" placeholder="+94XXXXXXXXX" {...form.register('whatsapp')} />
            </div>

            <button type="submit" disabled={form.formState.isSubmitting}>
              Register Shop
            </button>
            <div className="shop-links">
              <Link to={ROUTES.shopLogin}>Already have an account? Login</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
