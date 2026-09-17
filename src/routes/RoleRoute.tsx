import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import type { UserRole } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

type Props = {
  allow: UserRole[]
}

export function RoleRoute({ allow }: Props) {
  const { firebaseUser, profile, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading || !firebaseUser) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!profile) {
    if (pathname.startsWith('/admin')) {
      return <Navigate to={ROUTES.adminRegister} replace />
    }
    return <Navigate to={ROUTES.register} replace />
  }

  if (!allow.includes(profile.role)) {
    if (profile.role === 'admin') return <Navigate to={ROUTES.admin} replace />
    if (profile.role === 'owner') return <Navigate to={ROUTES.shopDashboard} replace />
    return <Navigate to={ROUTES.home} replace />
  }

  return <Outlet />
}
