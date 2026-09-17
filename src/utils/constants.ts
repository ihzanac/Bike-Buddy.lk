export const ROUTES = {
  /** Public landing at `/`. */
  home: '/',
  bikes: '/bikes',
  accessories: '/accessories',
  bikeDetail: (id: string) => `/bikes/${id}`,
  accessoryDetail: (id: string) => `/accessories/${id}`,
  /** Hub: pick customer / admin / shop sign-in. */
  login: '/login',
  /** Customer email & password form (after choosing “Customer” on the login hub). */
  customerLogin: '/login/customer',
  register: '/register',
  forgotPassword: '/forgot-password',
  /** Shown after requesting reset; same look as static “Password Verification” page. */
  forgotPasswordCheck: '/forgot-password/check',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  bookings: '/bookings',
  profile: '/profile',
  bookService: '/book-service',
  /** Bikes catalog inside signed-in customer portal (keeps CustomerLayout shell). */
  customerBikes: '/customer/bikes',
  /** Parts / accessories catalog inside customer portal. */
  customerParts: '/customer/parts',
  /** File a complaint — Firestore `platformReports` for Admin → Reports. */
  customerReportIssue: '/report-issue',
  admin: '/admin',
  adminLogin: '/admin/login',
  adminRegister: '/admin/register',
  adminUsers: '/admin/users',
  adminBookings: '/admin/bookings',
  adminServiceShops: '/admin/service-shops',
  adminSaleShops: '/admin/sale-shops',
  adminPartsShops: '/admin/parts-shops',
  adminReports: '/admin/reports',
  adminSettings: '/admin/settings',
  /** Shop owner (vendor) portal */
  shopLogin: '/shop/login',
  shopRegister: '/shop/register',
  shopDashboard: '/shop',
  shopBookings: '/shop/bookings',
  shopServices: '/shop/services',
  shopProfile: '/shop/profile',
  shopFeedback: '/shop/feedback',
  shopParts: '/shop/parts',
  shopBikeSales: '/shop/bike-sales',
  shopNotifications: '/shop/notifications',
} as const
