import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import type { UserProfile } from '@/types'
import { AuthContext } from '@/context/auth-context'
import { auth, db, isFirebaseConfigured } from '@/services/firebase'
import { normalizeShopCategory, type ShopOwnerCategoryId } from '@/utils/shopOwnerCategory'

function mapProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const hoursRaw = data.operatingHours
  let operatingHours: UserProfile['operatingHours']
  if (hoursRaw && typeof hoursRaw === 'object' && !Array.isArray(hoursRaw)) {
    const h = hoursRaw as Record<string, unknown>
    const out: NonNullable<UserProfile['operatingHours']> = {}
    for (const k of Object.keys(h)) {
      const row = h[k]
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const e = row as Record<string, unknown>
        out[k] = {
          enabled: Boolean(e.enabled),
          start: String(e.start ?? '09:00'),
          end: String(e.end ?? '17:00'),
        }
      }
    }
    operatingHours = Object.keys(out).length ? out : undefined
  }
  const yb = data.yearsInBusiness
  let shopCategories: UserProfile['shopCategories']
  if (Array.isArray(data.shopCategories)) {
    const out: ShopOwnerCategoryId[] = []
    for (const x of data.shopCategories) {
      const n = normalizeShopCategory(String(x))
      if (n) out.push(n)
    }
    if (out.length) shopCategories = out
  }
  return {
    uid,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role: data.role as UserProfile['role'],
    ownerStatus: data.ownerStatus as UserProfile['ownerStatus'],
    shopName: data.shopName ? String(data.shopName) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    location: data.location ? String(data.location) : undefined,
    address: data.address ? String(data.address) : undefined,
    dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
    gender: data.gender ? String(data.gender) : undefined,
    shopCategory: data.shopCategory ? String(data.shopCategory) : undefined,
    shopCategories,
    shopAddress: data.shopAddress ? String(data.shopAddress) : undefined,
    district: data.district ? String(data.district) : undefined,
    whatsapp: data.whatsapp ? String(data.whatsapp) : undefined,
    shopDescription: data.shopDescription ? String(data.shopDescription) : undefined,
    website: data.website ? String(data.website) : undefined,
    postalCode: data.postalCode ? String(data.postalCode) : undefined,
    province: data.province ? String(data.province) : undefined,
    shopLogoUrl: data.shopLogoUrl ? String(data.shopLogoUrl) : undefined,
    yearsInBusiness: typeof yb === 'number' && yb >= 0 ? yb : undefined,
    operatingHours,
    adminTier: data.adminTier as UserProfile['adminTier'],
    adminSettings:
      data.adminSettings && typeof data.adminSettings === 'object' && !Array.isArray(data.adminSettings)
        ? (data.adminSettings as UserProfile['adminSettings'])
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(() => !(isFirebaseConfigured && auth))
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u)
      setAuthReady(true)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !firebaseUser) {
      startTransition(() => {
        setProfile(null)
        setProfileLoading(false)
      })
      return
    }

    startTransition(() => setProfileLoading(true))

    const ref = doc(db, 'users', firebaseUser.uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null)
        } else {
          setProfile(mapProfile(snap.id, snap.data() as Record<string, unknown>))
        }
        setProfileLoading(false)
      },
      (err) => {
        console.error('[AuthProvider] users doc listener', err)
        setProfileLoading(false)
      },
    )
    return unsub
  }, [firebaseUser])

  const loading = !authReady || (!!firebaseUser && profileLoading)

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      profileLoading,
    }),
    [firebaseUser, profile, loading, profileLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
