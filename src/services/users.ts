import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import type { OwnerStatus, ShopDayHours, UserProfile } from '@/types'
import {
  normalizeShopCategory,
  ownerIsListedForPartsCatalog,
  ownerIsListedForServiceBooking,
  type ShopOwnerCategoryId,
} from '@/utils/shopOwnerCategory'
import { requireDb } from '@/services/firebase'
import { createdAtMs } from '@/utils/shopDashboardMetrics'

function mapUser(id: string, data: DocumentData): UserProfile {
  const tier = data.adminTier
  const hoursRaw = data.operatingHours
  let operatingHours: UserProfile['operatingHours']
  if (hoursRaw && typeof hoursRaw === 'object' && !Array.isArray(hoursRaw)) {
    const h = hoursRaw as Record<string, unknown>
    const out: Record<string, ShopDayHours> = {}
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
    uid: id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    role: data.role,
    ownerStatus: data.ownerStatus,
    shopName: data.shopName,
    phone: data.phone,
    location: data.location ? String(data.location) : undefined,
    address: data.address ? String(data.address) : undefined,
    dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
    gender: data.gender ? String(data.gender) : undefined,
    district: data.district ? String(data.district) : undefined,
    whatsapp: data.whatsapp ? String(data.whatsapp) : undefined,
    shopAddress: data.shopAddress ? String(data.shopAddress) : undefined,
    shopCategory: data.shopCategory ? String(data.shopCategory) : undefined,
    shopCategories,
    shopDescription: data.shopDescription ? String(data.shopDescription) : undefined,
    website: data.website ? String(data.website) : undefined,
    postalCode: data.postalCode ? String(data.postalCode) : undefined,
    province: data.province ? String(data.province) : undefined,
    shopLogoUrl: data.shopLogoUrl ? String(data.shopLogoUrl) : undefined,
    yearsInBusiness:
      typeof data.yearsInBusiness === 'number' ? data.yearsInBusiness : undefined,
    operatingHours,
    adminTier: tier === 'super' || tier === 'admin' ? tier : undefined,
    adminSettings:
      data.adminSettings && typeof data.adminSettings === 'object' && !Array.isArray(data.adminSettings)
        ? (data.adminSettings as UserProfile['adminSettings'])
        : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const database = requireDb()
  const q = query(collection(database, 'users'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => mapUser(d.id, d.data()))
}

/** Full `users` scan for admin UIs. No `orderBy` so profiles without `createdAt` still load; sorted in memory. */
export async function listAllUsersForAdmin(): Promise<UserProfile[]> {
  const database = requireDb()
  const snap = await getDocs(collection(database, 'users'))
  const rows = snap.docs.map((d) => mapUser(d.id, d.data()))
  rows.sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))
  return rows
}

/** Single `users/{uid}` read for admin modals (View/Edit shop owner). */
export async function getUserProfileByIdForAdmin(uid: string): Promise<UserProfile | null> {
  const database = requireDb()
  const snap = await getDoc(doc(database, 'users', uid))
  if (!snap.exists()) return null
  return mapUser(snap.id, snap.data())
}

/** Approved shop owners visible to signed-in customers for service booking. */
export async function listApprovedOwnersForBooking(): Promise<UserProfile[]> {
  const database = requireDb()
  // Must filter `ownerStatus` in the query (not only in app code). Otherwise the query
  // returns pending owners too; Firestore then denies the whole list because customers
  // may not read non-approved owner profiles (see firestore.rules).
  const q = query(
    collection(database, 'users'),
    where('role', '==', 'owner'),
    where('ownerStatus', '==', 'approved'),
  )
  const snap = await getDocs(q)
  let rows = snap.docs.map((d) => mapUser(d.id, d.data()))
  rows = rows.filter((u) => ownerIsListedForServiceBooking(u))
  rows.sort((a, b) => {
    const la = (a.shopName || a.displayName || '').toLowerCase()
    const lb = (b.shopName || b.displayName || '').toLowerCase()
    return la.localeCompare(lb)
  })
  return rows
}

/** Approved shop owners with a parts line — shown on the customer parts shop picker. */
export async function listApprovedOwnersForParts(): Promise<UserProfile[]> {
  const database = requireDb()
  const q = query(
    collection(database, 'users'),
    where('role', '==', 'owner'),
    where('ownerStatus', '==', 'approved'),
  )
  const snap = await getDocs(q)
  let rows = snap.docs.map((d) => mapUser(d.id, d.data()))
  rows = rows.filter((u) => ownerIsListedForPartsCatalog(u))
  rows.sort((a, b) => {
    const la = (a.shopName || a.displayName || '').toLowerCase()
    const lb = (b.shopName || b.displayName || '').toLowerCase()
    return la.localeCompare(lb)
  })
  return rows
}

export async function updateOwnerStatus(uid: string, status: OwnerStatus) {
  const database = requireDb()
  const ref = doc(database, 'users', uid)
  await updateDoc(ref, {
    ownerStatus: status,
    updatedAt: serverTimestamp(),
  })
}

/** Removes the Firestore `users/{uid}` document. Requires admin rules; does not delete Firebase Auth. */
export async function adminDeleteUserDocument(uid: string) {
  const database = requireDb()
  await deleteDoc(doc(database, 'users', uid))
}

export async function updateUserRole(uid: string, role: UserProfile['role']) {
  const database = requireDb()
  const ref = doc(database, 'users', uid)
  await updateDoc(ref, {
    role,
    updatedAt: serverTimestamp(),
    ...(role !== 'owner' ? { ownerStatus: deleteField() } : {}),
  })
}

export type CustomerProfileUpdatePayload = {
  displayName: string
  phone?: string
  location?: string
  district?: string
  address?: string
  dateOfBirth?: string
  gender?: string
}

export type AdminSettingsUpdatePayload = {
  general: {
    platformName: string
    language: string
    timezone: string
    dateFormat: 'ddmm' | 'mmdd' | 'iso'
    currency: string
  }
  shopManagement: {
    autoApprove: boolean
    requireVerify: boolean
    maxBookings: number
  }
  security: {
    twoFa: boolean
    sms: boolean
    emailAuth: boolean
  }
  appearance: {
    theme: 'light' | 'dark' | 'auto'
    itemsPerPage: number
    viewMode: 'table' | 'cards' | 'list'
  }
}

export type OwnerShopProfileUpdatePayload = {
  shopName?: string
  displayName?: string
  phone?: string
  whatsapp?: string
  website?: string
  shopDescription?: string
  shopAddress?: string
  location?: string
  district?: string
  postalCode?: string
  province?: string
  shopLogoUrl?: string
  yearsInBusiness?: number | null
  operatingHours?: Record<string, ShopDayHours> | null
}

function clearStr(v: string | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function updateOwnerShopProfile(
  uid: string,
  patch: OwnerShopProfileUpdatePayload,
) {
  const database = requireDb()
  const ref = doc(database, 'users', uid)
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  if (patch.shopName !== undefined) payload.shopName = clearStr(patch.shopName)
  if (patch.displayName !== undefined) payload.displayName = String(patch.displayName ?? '').trim()
  if (patch.phone !== undefined) payload.phone = clearStr(patch.phone)
  if (patch.whatsapp !== undefined) payload.whatsapp = clearStr(patch.whatsapp)
  if (patch.website !== undefined) payload.website = clearStr(patch.website)
  if (patch.shopDescription !== undefined)
    payload.shopDescription = clearStr(patch.shopDescription)
  if (patch.shopAddress !== undefined) payload.shopAddress = clearStr(patch.shopAddress)
  if (patch.location !== undefined) payload.location = clearStr(patch.location)
  if (patch.district !== undefined) payload.district = clearStr(patch.district)
  if (patch.postalCode !== undefined) payload.postalCode = clearStr(patch.postalCode)
  if (patch.province !== undefined) payload.province = clearStr(patch.province)
  if (patch.shopLogoUrl !== undefined) payload.shopLogoUrl = clearStr(patch.shopLogoUrl)
  if (patch.yearsInBusiness !== undefined) {
    if (patch.yearsInBusiness === null) {
      payload.yearsInBusiness = deleteField()
    } else {
      const n = Number(patch.yearsInBusiness)
      payload.yearsInBusiness = Number.isFinite(n) && n >= 0 ? n : deleteField()
    }
  }
  if (patch.operatingHours !== undefined) {
    if (patch.operatingHours === null) {
      payload.operatingHours = deleteField()
    } else {
      payload.operatingHours = patch.operatingHours
    }
  }
  await updateDoc(ref, payload)
}

export async function updateCustomerProfile(
  uid: string,
  patch: CustomerProfileUpdatePayload,
) {
  const database = requireDb()
  const ref = doc(database, 'users', uid)
  const clear = (v: string | undefined) =>
    v != null && v.trim() !== '' ? v.trim() : null
  await updateDoc(ref, {
    displayName: patch.displayName.trim(),
    phone: clear(patch.phone ?? undefined),
    location: clear(patch.location),
    district: clear(patch.district),
    address: clear(patch.address),
    dateOfBirth: clear(patch.dateOfBirth),
    gender: clear(patch.gender),
    updatedAt: serverTimestamp(),
  })
}

export async function updateAdminSettings(uid: string, payload: AdminSettingsUpdatePayload) {
  const database = requireDb()
  const ref = doc(database, 'users', uid)
  await updateDoc(ref, {
    adminSettings: {
      general: {
        platformName: payload.general.platformName.trim(),
        language: payload.general.language,
        timezone: payload.general.timezone,
        dateFormat: payload.general.dateFormat,
        currency: payload.general.currency,
      },
      shopManagement: {
        autoApprove: payload.shopManagement.autoApprove,
        requireVerify: payload.shopManagement.requireVerify,
        maxBookings: payload.shopManagement.maxBookings,
      },
      security: {
        twoFa: payload.security.twoFa,
        sms: payload.security.sms,
        emailAuth: payload.security.emailAuth,
      },
      appearance: {
        theme: payload.appearance.theme,
        itemsPerPage: payload.appearance.itemsPerPage,
        viewMode: payload.appearance.viewMode,
      },
    },
    updatedAt: serverTimestamp(),
  })
}
