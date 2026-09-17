/**
 * Firestore and other service errors (not `auth/*`).
 */
export function mapServiceError(code: string | undefined): string {
  if (code?.startsWith('storage/')) {
    switch (code) {
      case 'storage/unauthorized':
        return 'Storage denied upload. Sign in as the shop owner and check Firebase Storage is enabled in this project.'
      case 'storage/canceled':
        return 'Upload was cancelled.'
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded. Use a smaller image or a link instead.'
      case 'storage/unauthenticated':
        return 'Sign in again, then try uploading the image.'
      default:
        return 'File upload failed. Try a smaller image, or paste an image URL below instead.'
    }
  }
  switch (code) {
    case 'permission-denied':
      return [
        'Firestore permission denied (Missing or insufficient permissions).',
        '',
        '(1) Publish this repo’s rules to the SAME project as your app: run `npm run firebase:deploy:firestore-rules` after `npx firebase login`. In Firebase Console → Project settings, Project ID must match `VITE_FIREBASE_PROJECT_ID` in `.env` (and `.firebaserc` default if you deploy from here).',
        '(2) Or paste the contents of `firestore.rules` from this repo into Console → Firestore → Rules → Publish.',
        '(3) Admin-only writes (e.g. admin “New booking”): your Firestore doc `users/{your Firebase Auth UID}` must include `role` exactly equal to the string `admin` (lowercase). If the Admin UI loads but writes fail, the cloud rules are usually outdated—repeat (1) or (2).',
        '(4) Shop owner writes: your user doc needs `role` "owner" and `ownerStatus` "approved" where rules require it.',
        '(5) If the project used Firestore “test mode” before, test rules expire; publish production rules as in (1)–(2).',
      ].join('\n')
    case 'unavailable':
      return 'Database is temporarily unavailable. Check your connection and try again.'
    case 'failed-precondition':
    case 'aborted':
      return 'Could not complete the request. If you just added a query with filter + sort, create the Firestore composite index (Firebase console → error link, or deploy firestore.indexes.json) and wait until it finishes building. Then try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function getErrorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code?: string }).code)
    : undefined
}

/** Normalize e.g. `firestore/permission-denied` → `permission-denied` for `mapServiceError`. */
export function normalizeServiceErrorCode(code: string | undefined): string | undefined {
  if (!code) return undefined
  return code.replace(/^firestore\//, '').replace(/^functions\//, '')
}

/** User-facing detail for Firestore/Storage failures (includes raw message when present). */
export function describeServiceError(err: unknown): string {
  const raw = getErrorCode(err)
  const code = normalizeServiceErrorCode(raw)
  const mapped = code ? mapServiceError(code) : ''
  const msg = err instanceof Error && err.message.trim() ? err.message.trim() : ''
  const base = mapped || msg || 'Something went wrong. Please try again.'
  if (msg && mapped && !mapped.includes(msg)) {
    return msg.length > 220 ? `${base}\n${msg.slice(0, 220)}…` : `${base}\n${msg}`
  }
  return base
}

export function mapFirebaseAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
