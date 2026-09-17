/**
 * Creates three demo Firebase Auth users + Firestore profiles (customer, approved owner, admin),
 * then inserts demo bikes, accessories, and services into Firestore for the demo owner (once).
 *
 * Idempotent: safe to run again if accounts / catalog already exist.
 *
 * Prerequisites: VITE_FIREBASE_* in .env, and updated firestore.rules deployed (admin@bikehub.demo create rule).
 *
 *   npm run bootstrap:demo-users
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const DEMO = {
  customer: {
    email: 'customer@bikehub.demo',
    password: 'DemoPass123!',
    displayName: 'Demo Customer',
    role: 'customer',
  },
  owner: {
    email: 'owner@bikehub.demo',
    password: 'DemoPass123!',
    displayName: 'Demo Shop Owner',
    role: 'owner',
    shopName: 'Demo Cycle Shop',
  },
  admin: {
    email: 'admin@bikehub.demo',
    password: 'DemoPass123!',
    displayName: 'Demo Admin',
    role: 'admin',
  },
}

function loadDotEnv() {
  const p = join(root, '.env')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const env = loadDotEnv()

function trimEnv(key) {
  const v = env[key]
  return typeof v === 'string' ? v.trim() : ''
}

const firebaseConfig = {
  apiKey: trimEnv('VITE_FIREBASE_API_KEY'),
  authDomain: trimEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: trimEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: trimEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: trimEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: trimEnv('VITE_FIREBASE_APP_ID'),
}

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function printConfigHint() {
  const missing = requiredKeys.filter((k) => !trimEnv(k))
  if (missing.length) {
    console.error('Missing or empty in .env:', missing.join(', '))
  }
}

function printFirestorePermissionHelp() {
  console.error(`
Firestore returned "permission-denied" during bootstrap. Typical causes:

1) Rules in Firebase Console do not match this repo. Open firestore.rules in the
   project root, copy the entire file into Firebase Console → Firestore → Rules,
   click Publish, wait a few seconds, then run npm run bootstrap:demo-users again.

2) App Check is enforced on Firestore for this app. The Node bootstrap script does
   not send an App Check token. For local/dev: Firebase Console → App Check →
   your app → turn off enforcement for Firestore, or register a debug token flow
   for scripts.

3) If only the "approve owner" step fails, you can set users/<ownerUid>
   ownerStatus to "approved" manually in the Console, then rerun bootstrap
   (catalog seed is skipped when the owner already has a bike).
`)
}

function printAuthConfigurationHelp() {
  console.error(`
Firebase Auth returned "auth/configuration-not-found". Common fixes:

1) Firebase Console → Build → Authentication → Get started → Sign-in method →
   enable "Email/Password" (Email link optional).

2) Google Cloud Console → APIs & Services → Credentials → open your Browser API key
   (the same key as VITE_FIREBASE_API_KEY). Under "Application restrictions":
   - For local Node scripts, "HTTP referrers" blocks requests (no browser referrer).
   - Use "None" for development, OR "IP addresses" and add your PC's IP,
   OR create a second key with no referrer restriction for scripts only.

3) Confirm Project settings → General → Your apps → Web app config matches .env
   exactly (projectId, authDomain like YOUR_PROJECT.firebaseapp.com).

4) If you use multiple Firebase projects, ensure .env matches the project where
   Authentication is enabled.
`)
}

let auth
let db

async function writeProfile(uid, data) {
  await setDoc(
    doc(db, 'users', uid),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  )
}

async function ensureAccount({ email, password, displayName, role, extra = {} }) {
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    uid = cred.user.uid
    if (displayName) await updateProfile(cred.user, { displayName })
    await writeProfile(uid, {
      email,
      displayName,
      role,
      ...extra,
    })
    console.log('Created:', email, '→', uid)
  } catch (e) {
    if (e?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      uid = cred.user.uid
      const snap = await getDoc(doc(db, 'users', uid))
      if (!snap.exists()) {
        if (displayName) await updateProfile(cred.user, { displayName })
        await writeProfile(uid, {
          email,
          displayName,
          role,
          ...extra,
        })
        console.log('Linked profile for existing auth user:', email)
      } else {
        console.log('Already exists:', email)
      }
    } else {
      throw e
    }
  }
  await signOut(auth)
  return uid
}

/** Writes demo-seed.json documents as the demo owner (skipped if owner already has a bike). */
async function seedFirestoreCatalogIfEmpty(ownerUid) {
  await signInWithEmailAndPassword(auth, DEMO.owner.email, DEMO.owner.password)
  const existing = await getDocs(
    query(collection(db, 'bikes'), where('ownerId', '==', ownerUid), limit(1)),
  )
  if (!existing.empty) {
    console.log('Firestore catalog already present for demo owner; skipping catalog seed.')
    await signOut(auth)
    return
  }

  const seedPath = join(root, 'src', 'data', 'demo-seed.json')
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'))

  for (const b of seed.bikes) {
    await addDoc(collection(db, 'bikes'), {
      title: b.title,
      description: b.description,
      price: b.price,
      category: b.category,
      location: b.location ?? null,
      images: [b.image],
      ownerId: ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log('Seeded bike:', b.title)
  }
  for (const a of seed.accessories) {
    await addDoc(collection(db, 'accessories'), {
      title: a.title,
      description: a.description,
      price: a.price,
      category: a.category,
      images: [a.image],
      ownerId: ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log('Seeded accessory:', a.title)
  }
  for (const s of seed.services) {
    await addDoc(collection(db, 'services'), {
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price,
      ownerId: ownerUid,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log('Seeded service:', s.name)
  }
  await signOut(auth)
  console.log('Firestore demo catalog complete (bikes, accessories, services).')
}

async function main() {
  const missing = requiredKeys.filter((k) => !trimEnv(k))
  if (missing.length) {
    console.error('Missing or empty Firebase env vars in .env:')
    for (const k of missing) console.error('  -', k)
    process.exit(1)
  }

  const app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  const ownerUid = await ensureAccount({
    email: DEMO.owner.email,
    password: DEMO.owner.password,
    displayName: DEMO.owner.displayName,
    role: 'owner',
    extra: { ownerStatus: 'pending', shopName: DEMO.owner.shopName },
  })

  await ensureAccount({
    email: DEMO.customer.email,
    password: DEMO.customer.password,
    displayName: DEMO.customer.displayName,
    role: 'customer',
  })

  await ensureAccount({
    email: DEMO.admin.email,
    password: DEMO.admin.password,
    displayName: DEMO.admin.displayName,
    role: 'admin',
  })

  console.log('Signing in as demo admin to approve owner in Firestore…')
  await signInWithEmailAndPassword(auth, DEMO.admin.email, DEMO.admin.password)
  try {
    await updateDoc(doc(db, 'users', ownerUid), {
      ownerStatus: 'approved',
      updatedAt: serverTimestamp(),
    })
    console.log('Approved demo owner:', ownerUid)
  } catch (e) {
    if (e?.code === 'permission-denied') {
      console.error('\nFailed while approving demo owner (admin update on users/' + ownerUid + ').')
    }
    throw e
  }
  await signOut(auth)

  console.log('Seeding demo catalog as approved owner (if empty)…')
  try {
    await seedFirestoreCatalogIfEmpty(ownerUid)
  } catch (e) {
    if (e?.code === 'permission-denied') {
      console.error('\nFailed while writing bikes/accessories/services (owner must be approved).')
    }
    throw e
  }

  console.log('\nDone. Log in at /login with:')
  console.log('  Admin:   ', DEMO.admin.email, '/', DEMO.admin.password)
  console.log('  Customer:', DEMO.customer.email, '/', DEMO.customer.password)
  console.log('  Owner:   ', DEMO.owner.email, '/', DEMO.owner.password)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    printConfigHint()
    if (e?.code === 'auth/configuration-not-found') {
      console.error('\n' + e.message)
      printAuthConfigurationHelp()
      process.exit(1)
    }
    if (e?.code === 'permission-denied') {
      printFirestorePermissionHelp()
    }
    console.error(e)
    process.exit(1)
  })
