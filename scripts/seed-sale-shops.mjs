/**
 * Seeds Firestore `saleShops` when the collection is empty (12 demo shops).
 * Requires an admin account (same project as .env).
 *
 * .env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (and VITE_FIREBASE_*)
 *   npm run seed:sale-shops
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  doc,
  getCountFromServer,
  getFirestore,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'

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
const email = env.SEED_ADMIN_EMAIL
const password = env.SEED_ADMIN_PASSWORD

if (!email || !password) {
  console.error('Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in .env')
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

const rows = JSON.parse(readFileSync(join(root, 'src', 'data', 'saleShopsSeed.json'), 'utf8'))

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

await signInWithEmailAndPassword(auth, email, password)

const col = collection(db, 'saleShops')
const { count } = (await getCountFromServer(col)).data()
if (count > 0) {
  console.log(`saleShops already has ${count} document(s). Skipping seed.`)
  process.exit(0)
}

const batch = writeBatch(db)
for (const s of rows) {
  const dRef = doc(db, 'saleShops', `seed-${s.id}`)
  batch.set(dRef, {
    name: s.name,
    owner: s.owner,
    phone: s.phone,
    email: s.email,
    district: s.district,
    city: s.city,
    address: s.address,
    listings: Math.max(0, Math.floor(Number(s.listings) || 0)),
    rating: Number(s.rating) || 4.5,
    status: s.status,
    established: String(s.established || '—'),
    createdAt: Timestamp.fromMillis(Number(s.createdAtMs) || Date.now()),
  })
}
await batch.commit()
console.log(`Seeded ${rows.length} sale shop document(s) into saleShops.`)
