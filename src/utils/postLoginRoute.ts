import { doc, getDoc } from 'firebase/firestore'
import { requireDb } from '@/services/firebase'
import { ROUTES } from '@/utils/constants'

/** Resolves the first screen after email/password sign-in from the Firestore user profile. */
export async function getPostLoginRoute(uid: string): Promise<string> {
  const snap = await getDoc(doc(requireDb(), 'users', uid))
  const data = snap.data() as Record<string, unknown> | undefined
  const role = data?.role as string | undefined
  if (role === 'admin') return ROUTES.admin
  if (role === 'owner') return ROUTES.shopDashboard
  /** Customer portal home (`CustomerDashboardPage` + layout from `Customer/` mockups). */
  return ROUTES.dashboard
}
