import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'

import { getAuth, type Auth } from 'firebase/auth'

import { getFirestore, type Firestore } from 'firebase/firestore'

import { getStorage, type FirebaseStorage } from 'firebase/storage'

import { getFunctions, type Functions } from 'firebase/functions'



const firebaseConfig = {

  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,

  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,

  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,

  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,

  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,

  appId: import.meta.env.VITE_FIREBASE_APP_ID,

}



export const isFirebaseConfigured = Boolean(

  firebaseConfig.apiKey && firebaseConfig.projectId,

)



let app: FirebaseApp | undefined



function getOrInitApp(): FirebaseApp {

  if (!isFirebaseConfigured) {

    throw new Error(

      'Firebase is not configured. Add VITE_FIREBASE_* keys to a .env file (see .env.example).',

    )

  }

  if (!app) {

    app = getApps().length ? getApp() : initializeApp(firebaseConfig)

  }

  return app

}



export const firebaseApp: FirebaseApp | null = isFirebaseConfigured

  ? getOrInitApp()

  : null



export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null

export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null

export const storage: FirebaseStorage | null = firebaseApp

  ? getStorage(firebaseApp)

  : null

export const functions: Functions | null = firebaseApp
  ? getFunctions(firebaseApp, 'asia-south1')
  : null

const OWNER_PROVISION_APP_NAME = 'owner-provision'

/**
 * Secondary Auth instance: `createUserWithEmailAndPassword` here signs in only this app,
 * so the primary session (e.g. admin) stays on the default `auth` export.
 */
export function getOwnerProvisionAuth(): Auth {
  if (!isFirebaseConfigured || !firebaseApp) {
    throw new Error('Firebase is not configured.')
  }
  try {
    return getAuth(getApp(OWNER_PROVISION_APP_NAME))
  } catch {
    return getAuth(initializeApp(firebaseApp.options, OWNER_PROVISION_APP_NAME))
  }
}

export function requireDb(): Firestore {

  if (!db) throw new Error('Firestore is not available.')

  return db

}



export function requireAuth() {

  if (!auth) throw new Error('Firebase Auth is not available.')

  return auth

}



export function requireStorage(): FirebaseStorage {

  if (!storage) throw new Error('Firebase Storage is not available.')

  return storage

}

