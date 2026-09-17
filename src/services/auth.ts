import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth'
import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { OwnerStatus, UserRole } from '@/types'
import { ROUTES } from '@/utils/constants'
import { getOwnerProvisionAuth, requireAuth, requireDb } from '@/services/firebase'
import { SHOP_OWNER_CATEGORY } from '@/utils/shopOwnerCategory'

async function writeUserProfile(params: {
  uid: string
  email: string
  displayName: string
  role: UserRole
  ownerStatus?: OwnerStatus
  shopName?: string
  phone?: string
  location?: string
  shopCategory?: string
  shopCategories?: string[]
  shopAddress?: string
  district?: string
  whatsapp?: string
}) {
  const database = requireDb()
  const ref = doc(database, 'users', params.uid)
  await setDoc(ref, {
    email: params.email,
    displayName: params.displayName,
    role: params.role,
    ...(params.ownerStatus ? { ownerStatus: params.ownerStatus } : {}),
    ...(params.shopName ? { shopName: params.shopName } : {}),
    ...(params.phone ? { phone: params.phone } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.shopCategories?.length
      ? { shopCategories: params.shopCategories, shopCategory: params.shopCategories[0] }
      : params.shopCategory
        ? { shopCategory: params.shopCategory }
        : {}),
    ...(params.shopAddress ? { shopAddress: params.shopAddress } : {}),
    ...(params.district ? { district: params.district } : {}),
    ...(params.whatsapp ? { whatsapp: params.whatsapp } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function registerCustomer(input: {
  email: string
  password: string
  displayName: string
  phone?: string
  location?: string
}): Promise<User> {
  const a = requireAuth()
  const cred = await createUserWithEmailAndPassword(
    a,
    input.email,
    input.password,
  )
  if (input.displayName) {
    await updateProfile(cred.user, { displayName: input.displayName })
  }
  await writeUserProfile({
    uid: cred.user.uid,
    email: input.email,
    displayName: input.displayName,
    role: 'customer',
    phone: input.phone,
    location: input.location,
  })
  return cred.user
}

/**
 * Self-serve admin signup. Requires Firestore rules to allow this path and matching
 * `adminProvisioningCode` (see firestore.rules + VITE_FIREBASE_ADMIN_PROVISIONING_KEY).
 * The code is removed from the user document immediately after create.
 */
export async function registerAdmin(input: {
  email: string
  password: string
  displayName: string
  provisioningKey: string
  adminTier: 'super' | 'admin'
}): Promise<User> {
  const a = requireAuth()
  const cred = await createUserWithEmailAndPassword(a, input.email, input.password)
  if (input.displayName) {
    await updateProfile(cred.user, { displayName: input.displayName })
  }
  const database = requireDb()
  const ref = doc(database, 'users', cred.user.uid)
  const payload = {
    email: input.email,
    displayName: input.displayName,
    role: 'admin' as const,
    adminTier: input.adminTier,
    adminProvisioningCode: input.provisioningKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  try {
    await setDoc(ref, payload)
    await updateDoc(ref, {
      adminProvisioningCode: deleteField(),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    try {
      await deleteUser(cred.user)
    } catch {
      /* ignore */
    }
    throw e
  }
  return cred.user
}

/** Self-serve shop registration. Creates `role: owner` with `ownerStatus: pending` (admin approves in console). */
export async function registerShopOwner(input: {
  email: string
  password: string
  ownerName: string
  phone: string
  shopName: string
  /** One or more: `shopCategory` in Firestore is set to the first for legacy. */
  shopCategories: string[]
  shopAddress: string
  district: string
  whatsapp?: string
}): Promise<User> {
  const a = requireAuth()
  const cred = await createUserWithEmailAndPassword(a, input.email, input.password)
  if (input.ownerName) {
    await updateProfile(cred.user, { displayName: input.ownerName })
  }
  await writeUserProfile({
    uid: cred.user.uid,
    email: input.email,
    displayName: input.ownerName,
    role: 'owner',
    ownerStatus: 'pending',
    shopName: input.shopName,
    phone: input.phone,
    location: input.district,
    shopCategories: input.shopCategories,
    shopAddress: input.shopAddress,
    district: input.district,
    whatsapp: input.whatsapp?.trim() || undefined,
  })
  return cred.user
}

/**
 * Admin-only: create a bike-service shop owner (Auth + `users/{uid}`) without logging the admin out.
 * Uses a secondary Firebase Auth app; requires Firestore rules that allow admins to create owner profiles.
 */
export async function adminProvisionServiceShopOwner(input: {
  email: string
  password: string
  ownerName: string
  phone: string
  shopName: string
  shopAddress: string
  district: string
  city?: string
  whatsapp?: string
}): Promise<{ uid: string }> {
  const provisionAuth = getOwnerProvisionAuth()
  const cred = await createUserWithEmailAndPassword(
    provisionAuth,
    input.email.trim(),
    input.password,
  )
  try {
    const ownerName = input.ownerName.trim()
    if (ownerName) {
      await updateProfile(cred.user, { displayName: ownerName })
    }
    const city = input.city?.trim() ?? ''
    const district = input.district.trim()
    const location = city ? `${city}, ${district}` : district
    await writeUserProfile({
      uid: cred.user.uid,
      email: input.email.trim(),
      displayName: ownerName,
      role: 'owner',
      ownerStatus: 'pending',
      shopName: input.shopName.trim(),
      phone: input.phone.trim(),
      location,
      shopCategories: [SHOP_OWNER_CATEGORY.BIKE_SERVICE],
      shopAddress: input.shopAddress.trim(),
      district,
      whatsapp: input.whatsapp?.trim() || undefined,
    })
    return { uid: cred.user.uid }
  } catch (e) {
    try {
      await deleteUser(cred.user)
    } catch {
      /* ignore — orphan Auth user may need manual cleanup */
    }
    throw e
  } finally {
    await signOut(provisionAuth)
  }
}

/**
 * Admin-only: create a bike-sale shop owner (Auth + `users/{uid}`), pending approval — same pattern as service shops.
 */
export async function adminProvisionBikeSaleShopOwner(input: {
  email: string
  password: string
  ownerName: string
  phone: string
  shopName: string
  shopAddress: string
  district: string
  city?: string
  whatsapp?: string
}): Promise<{ uid: string }> {
  const provisionAuth = getOwnerProvisionAuth()
  const cred = await createUserWithEmailAndPassword(
    provisionAuth,
    input.email.trim(),
    input.password,
  )
  try {
    const ownerName = input.ownerName.trim()
    if (ownerName) {
      await updateProfile(cred.user, { displayName: ownerName })
    }
    const city = input.city?.trim() ?? ''
    const district = input.district.trim()
    const location = city ? `${city}, ${district}` : district
    await writeUserProfile({
      uid: cred.user.uid,
      email: input.email.trim(),
      displayName: ownerName,
      role: 'owner',
      ownerStatus: 'pending',
      shopName: input.shopName.trim(),
      phone: input.phone.trim(),
      location,
      shopCategories: [SHOP_OWNER_CATEGORY.BIKE_SALE],
      shopAddress: input.shopAddress.trim(),
      district,
      whatsapp: input.whatsapp?.trim() || undefined,
    })
    return { uid: cred.user.uid }
  } catch (e) {
    try {
      await deleteUser(cred.user)
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    await signOut(provisionAuth)
  }
}

/**
 * Admin-only: create a bike-parts shop owner (Auth + `users/{uid}`), pending approval — same pattern as sale/service.
 */
export async function adminProvisionPartsShopOwner(input: {
  email: string
  password: string
  ownerName: string
  phone: string
  shopName: string
  shopAddress: string
  district: string
  city?: string
  whatsapp?: string
}): Promise<{ uid: string }> {
  const provisionAuth = getOwnerProvisionAuth()
  const cred = await createUserWithEmailAndPassword(
    provisionAuth,
    input.email.trim(),
    input.password,
  )
  try {
    const ownerName = input.ownerName.trim()
    if (ownerName) {
      await updateProfile(cred.user, { displayName: ownerName })
    }
    const city = input.city?.trim() ?? ''
    const district = input.district.trim()
    const location = city ? `${city}, ${district}` : district
    await writeUserProfile({
      uid: cred.user.uid,
      email: input.email.trim(),
      displayName: ownerName,
      role: 'owner',
      ownerStatus: 'pending',
      shopName: input.shopName.trim(),
      phone: input.phone.trim(),
      location,
      shopCategories: [SHOP_OWNER_CATEGORY.BIKE_PARTS],
      shopAddress: input.shopAddress.trim(),
      district,
      whatsapp: input.whatsapp?.trim() || undefined,
    })
    return { uid: cred.user.uid }
  } catch (e) {
    try {
      await deleteUser(cred.user)
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    await signOut(provisionAuth)
  }
}

/**
 * Admin-only: create a customer (Auth + `users/{uid}`) without logging the admin out.
 * Same secondary Auth pattern as shop-owner provisioning.
 */
export async function adminProvisionCustomer(input: {
  email: string
  password: string
  displayName: string
  phone: string
  location: string
}): Promise<{ uid: string }> {
  const provisionAuth = getOwnerProvisionAuth()
  const cred = await createUserWithEmailAndPassword(
    provisionAuth,
    input.email.trim(),
    input.password,
  )
  try {
    const displayName = input.displayName.trim()
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    await writeUserProfile({
      uid: cred.user.uid,
      email: input.email.trim(),
      displayName,
      role: 'customer',
      phone: input.phone.trim(),
      location: input.location.trim(),
    })
    return { uid: cred.user.uid }
  } catch (e) {
    try {
      await deleteUser(cred.user)
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    await signOut(provisionAuth)
  }
}

export async function loginWithEmail(email: string, password: string) {
  const a = requireAuth()
  return signInWithEmailAndPassword(a, email, password)
}

export async function logout() {
  const a = requireAuth()
  await signOut(a)
}

/**
 * Send Firebase password reset email. User finishes on `/reset-password` with `oobCode` from the link.
 * Add your domain under Firebase Console → Auth → Settings → Authorized domains.
 */
export async function sendCustomerPasswordResetEmail(email: string) {
  const a = requireAuth()
  return sendPasswordResetEmail(a, email, {
    url: `${window.location.origin}${ROUTES.resetPassword}`,
  })
}

export async function verifyPasswordResetOobCode(oobCode: string) {
  const a = requireAuth()
  return verifyPasswordResetCode(a, oobCode)
}

export async function confirmCustomerPasswordReset(oobCode: string, newPassword: string) {
  const a = requireAuth()
  return confirmPasswordReset(a, oobCode, newPassword)
}
