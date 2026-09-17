/**
 * Writes real Firestore rows into `partsShops` as an admin user (shows in Admin → Parts Shops).
 * Uses non–seed-* document IDs so rows are visible (bulk seed-* ids are hidden in the UI).
 *
 * Prerequisites: deployed firestore.rules from this repo; admin account in .env:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 *   VITE_FIREBASE_* (same as the app)
 *
 *   npm run seed:parts-shops
 *
 * Idempotent: if `partsShops` already has at least one document, the script skips.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  addDoc,
  collection,
  getCountFromServer,
  getFirestore,
  serverTimestamp,
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

const rows = JSON.parse(readFileSync(join(root, 'src', 'data', 'partsShopsSeed.json'), 'utf8'))

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

await signInWithEmailAndPassword(auth, email, password)

const col = collection(db, 'partsShops')
const { count } = (await getCountFromServer(col)).data()
if (count > 0) {
  console.log(`partsShops already has ${count} document(s). Skipping seed (delete docs or use Firebase console to add rows).`)
  process.exit(0)
}

for (const s of rows) {
  await addDoc(col, {
    name: String(s.name ?? '').trim(),
    owner: String(s.owner ?? '').trim(),
    phone: String(s.phone ?? '').trim(),
    email: String(s.email ?? '').trim(),
    district: String(s.district ?? '').trim(),
    city: String(s.city ?? '').trim(),
    address: String(s.address ?? '').trim(),
    parts: Math.max(0, Math.floor(Number(s.parts) || 0)),
    orders: Math.max(0, Math.floor(Number(s.orders) || 0)),
    revenueK: Math.max(0, Number(s.revenueK) || 0),
    stockLevel: s.stockLevel,
    status: s.status,
    established: String(s.established ?? '—').trim() || '—',
    createdAt: serverTimestamp(),
  })
  console.log('Added parts shop:', s.name)
}

console.log(`Seeded ${rows.length} document(s) into partsShops. Open Admin → Parts Shops to view.`)
