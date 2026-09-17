/**
 * Writes demo bikes, accessories, and services to Firestore as the signed-in owner.
 * Requires an approved shop owner account (same Firebase project as .env).
 *
 * Usage: set SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD in .env, then:
 *   npm run seed:firestore
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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
const email = env.SEED_OWNER_EMAIL
const password = env.SEED_OWNER_PASSWORD

if (!email || !password) {
  console.error(
    'Missing SEED_OWNER_EMAIL or SEED_OWNER_PASSWORD in .env. Use an approved shop owner account.',
  )
  process.exit(1)
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing VITE_FIREBASE_* keys in .env')
  process.exit(1)
}

const seed = JSON.parse(
  readFileSync(join(root, 'src', 'data', 'demo-seed.json'), 'utf8'),
)

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const cred = await signInWithEmailAndPassword(auth, email, password)
const uid = cred.user.uid

for (const b of seed.bikes) {
  await addDoc(collection(db, 'bikes'), {
    title: b.title,
    description: b.description,
    price: b.price,
    category: b.category,
    location: b.location ?? null,
    images: [b.image],
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  console.log('Added bike:', b.title)
}

for (const a of seed.accessories) {
  await addDoc(collection(db, 'accessories'), {
    title: a.title,
    description: a.description,
    price: a.price,
    category: a.category,
    images: [a.image],
    ownerId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  console.log('Added accessory:', a.title)
}

for (const s of seed.services) {
  await addDoc(collection(db, 'services'), {
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price,
    ownerId: uid,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  console.log('Added service:', s.name)
}

console.log('Seed complete for owner uid:', uid)
process.exit(0)
