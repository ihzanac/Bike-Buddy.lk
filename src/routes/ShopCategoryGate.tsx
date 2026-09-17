import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { canOwnerAccessShopPath, getOwnerShopCategories } from '@/utils/shopOwnerCategory'

/** Redirects shop owners away from modules that do not match their registered shop type(s). */
export function ShopCategoryGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const cats = getOwnerShopCategories(profile)
  if (profile?.role === 'owner' && !canOwnerAccessShopPath(pathname, cats)) {
    return <Navigate to={ROUTES.shopDashboard} replace />
  }
  return <>{children}</>
}
