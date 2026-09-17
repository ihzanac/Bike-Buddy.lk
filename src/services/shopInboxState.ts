import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { requireDb } from '@/services/firebase'

const COL = 'shopInboxState'

function parseDismissed(data: Record<string, unknown> | undefined): string[] {
  const raw = data?.dismissedKeys
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x)).filter(Boolean)
}

export function subscribeShopInboxDismissed(
  ownerId: string,
  onData: (keys: string[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const ref = doc(database, COL, ownerId)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) onData([])
      else onData(parseDismissed(snap.data() as Record<string, unknown>))
    },
    (err) => onError?.(err),
  )
}

/** Append dismissed notification keys (idempotent via Firestore arrayUnion). */
export async function appendShopInboxDismissed(ownerId: string, keys: string[]) {
  const uniq = [...new Set(keys.map(String).filter(Boolean))].slice(0, 200)
  if (!uniq.length) return
  const database = requireDb()
  await setDoc(
    doc(database, COL, ownerId),
    {
      ownerId,
      dismissedKeys: arrayUnion(...uniq),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
