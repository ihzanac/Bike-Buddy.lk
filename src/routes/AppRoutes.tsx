import { Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminAuthLayout } from '@/layouts/AdminAuthLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RoleRoute } from '@/routes/RoleRoute'
import { ROUTES } from '@/utils/constants'
import { PublicIndexPage } from '@/pages/public/PublicIndexPage'
import { BikesPage } from '@/pages/public/BikesPage'
import { AccessoriesPage } from '@/pages/public/AccessoriesPage'
import { BikeDetailPage } from '@/pages/public/BikeDetailPage'
import { AccessoryDetailPage } from '@/pages/public/AccessoryDetailPage'
import { LoginSelectPage } from '@/pages/auth/LoginSelectPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { AdminLoginPage } from '@/pages/auth/AdminLoginPage'
import { AdminRegisterPage } from '@/pages/auth/AdminRegisterPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ForgotPasswordCheckPage } from '@/pages/auth/ForgotPasswordCheckPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { BookingsPage } from '@/pages/customer/BookingsPage'
import { ProfilePage } from '@/pages/customer/ProfilePage'
import { BookServicePage } from '@/pages/customer/BookServicePage'
import { CustomerDashboardPage } from '@/pages/customer/CustomerDashboardPage'
import { CustomerBikesPage } from '@/pages/customer/CustomerBikesPage'
import { CustomerPartsPage } from '@/pages/customer/CustomerPartsPage'
import { CustomerReportIssuePage } from '@/pages/customer/CustomerReportIssuePage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminBookingsPage } from '@/pages/admin/AdminBookingsPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { AdminServiceShopsPage } from '@/pages/admin/AdminServiceShopsPage'
import { AdminSaleShopsPage } from '@/pages/admin/AdminSaleShopsPage'
import { AdminPartsShopsPage } from '@/pages/admin/AdminPartsShopsPage'
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage'
import { ShopLayout } from '@/layouts/ShopLayout'
import { ShopLoginPage } from '@/pages/shop/ShopLoginPage'
import { ShopRegisterPage } from '@/pages/shop/ShopRegisterPage'
import { ShopDashboardPage } from '@/pages/shop/ShopDashboardPage'
import { ShopBikeSalesPage } from '@/pages/shop/ShopBikeSalesPage'
import { ShopNotificationsPage } from '@/pages/shop/ShopNotificationsPage'
import { ShopPartsManagementPage } from '@/pages/shop/ShopPartsManagementPage'
import { ShopProfilePage } from '@/pages/shop/ShopProfilePage'
import { ShopFeedbackPage } from '@/pages/shop/ShopFeedbackPage'
import { ShopServicesPage } from '@/pages/shop/ShopServicesPage'
import { ShopBookingsPage } from '@/pages/shop/ShopBookingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { FirebaseMissingPage } from '@/pages/FirebaseMissingPage'
import { isFirebaseConfigured } from '@/services/firebase'

export function AppRoutes() {
  if (!isFirebaseConfigured) {
    return (
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="*" element={<FirebaseMissingPage />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path={ROUTES.home} element={<PublicIndexPage />} />
        <Route path={ROUTES.bikes} element={<BikesPage />} />
        <Route path={ROUTES.accessories} element={<AccessoriesPage />} />
        <Route path="/bikes/:id" element={<BikeDetailPage />} />
        <Route path="/accessories/:id" element={<AccessoryDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path={ROUTES.login} element={<LoginSelectPage />} />
        <Route path={ROUTES.customerLogin} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.forgotPasswordCheck} element={<ForgotPasswordCheckPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
        <Route path={ROUTES.shopLogin} element={<ShopLoginPage />} />
        <Route path={ROUTES.shopRegister} element={<ShopRegisterPage />} />
      </Route>

      <Route element={<AdminAuthLayout />}>
        <Route path={ROUTES.adminLogin} element={<AdminLoginPage />} />
        <Route path={ROUTES.adminRegister} element={<AdminRegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allow={['customer']} />}>
          <Route element={<CustomerLayout />}>
            <Route path={ROUTES.dashboard} element={<CustomerDashboardPage />} />
            <Route path={ROUTES.bookings} element={<BookingsPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />
            <Route path={ROUTES.bookService} element={<BookServicePage />} />
            <Route path={ROUTES.customerBikes} element={<CustomerBikesPage />} />
            <Route path={ROUTES.customerParts} element={<CustomerPartsPage />} />
            <Route path={ROUTES.customerReportIssue} element={<CustomerReportIssuePage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allow={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.admin} element={<AdminDashboardPage />} />
            <Route path={ROUTES.adminUsers} element={<AdminUsersPage />} />
            <Route path={ROUTES.adminBookings} element={<AdminBookingsPage />} />
            <Route path={ROUTES.adminServiceShops} element={<AdminServiceShopsPage />} />
            <Route path={ROUTES.adminSaleShops} element={<AdminSaleShopsPage />} />
            <Route path={ROUTES.adminPartsShops} element={<AdminPartsShopsPage />} />
            <Route path={ROUTES.adminReports} element={<AdminReportsPage />} />
            <Route path={ROUTES.adminSettings} element={<AdminSettingsPage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allow={['owner']} />}>
          <Route element={<ShopLayout />}>
            <Route path={ROUTES.shopDashboard} element={<ShopDashboardPage />} />
            <Route path={ROUTES.shopBookings} element={<ShopBookingsPage />} />
            <Route path={ROUTES.shopServices} element={<ShopServicesPage />} />
            <Route path={ROUTES.shopProfile} element={<ShopProfilePage />} />
            <Route path={ROUTES.shopFeedback} element={<ShopFeedbackPage />} />
            <Route path={ROUTES.shopParts} element={<ShopPartsManagementPage />} />
            <Route path={ROUTES.shopBikeSales} element={<ShopBikeSalesPage />} />
            <Route path={ROUTES.shopNotifications} element={<ShopNotificationsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
