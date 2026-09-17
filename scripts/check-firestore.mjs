/**
 * Verifies Firebase app init + Firestore reachability (reads up to 1 bike; public read in rules).
 *
 *   npm run check:firebase
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore'

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

function trimEnv(env, key) {
  const v = env[key]
  return typeof v === 'string' ? v.trim() : ''
}

const env = loadDotEnv()
const firebaseConfig = {
  apiKey: trimEnv(env, 'VITE_FIREBASE_API_KEY'),
  authDomain: trimEnv(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: trimEnv(env, 'VITE_FIREBASE_PROJECT_ID'),
  storageBucket: trimEnv(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: trimEnv(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: trimEnv(env, 'VITE_FIREBASE_APP_ID'),
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missing = required.filter((k) => !trimEnv(env, k))
if (missing.length) {
  console.error('Missing or empty in .env:', missing.join(', '))
  process.exit(1)
}

try {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const snap = await getDocs(query(collection(db, 'bikes'), limit(1)))
  console.log('OK — Firestore is reachable.')
  console.log('  Project:', firebaseConfig.projectId)
  console.log('  Sample query (bikes, limit 1):', snap.size, 'document(s) in this page.')
  if (snap.docs[0]) {
    console.log('  Example id:', snap.docs[0].id)
  }
  process.exit(0)
} catch (e) {
  console.error('FAILED — could not use Firestore.')
  console.error('  Message:', e?.message || e)
  if (e?.code) console.error('  Code:', e.code)
  console.error('\nCheck: .env values, internet, Firestore enabled in console, and firestore.rules allow public read on bikes.')
  process.exit(1)
}
