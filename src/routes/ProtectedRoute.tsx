import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { Skeleton } from '@/components/ui/Skeleton'

export function ProtectedRoute() {
  const { firebaseUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!firebaseUser) {
    const adminEntry =
      location.pathname.startsWith('/admin') &&
      location.pathname !== ROUTES.adminLogin &&
      location.pathname !== ROUTES.adminRegister
    const shopEntry = location.pathname.startsWith('/shop')
    return (
      <Navigate
        to={shopEntry ? ROUTES.shopLogin : adminEntry ? ROUTES.adminLogin : ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <Outlet />
}
