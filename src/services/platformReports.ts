import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { AdminReportPriority, AdminReportRow, AdminReportStatus } from '@/data/adminReportsSample'
import { requireAuth, requireDb } from '@/services/firebase'

const COL = 'platformReports'

function createdAtMillis(createdAt: unknown): number {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (createdAt as { toMillis: () => number }).toMillis()
  }
  if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
    const s = (createdAt as { seconds: unknown }).seconds
    return typeof s === 'number' ? s * 1000 : 0
  }
  return 0
}

function normalizePriority(p: unknown): AdminReportPriority {
  if (p === 'critical' || p === 'high' || p === 'medium' || p === 'low') return p
  return 'medium'
}

function normalizeStatus(s: unknown): AdminReportStatus {
  if (s === 'open' || s === 'investigating' || s === 'resolved' || s === 'closed') return s
  return 'open'
}

function mapRow(id: string, data: Record<string, unknown>): AdminReportRow {
  const dateRaw = data.date
  let date = typeof dateRaw === 'string' && dateRaw.length >= 10 ? dateRaw.slice(0, 10) : ''
  if (!date && data.createdAt) {
    const ms = createdAtMillis(data.createdAt)
    if (ms > 0) date = new Date(ms).toISOString().slice(0, 10)
  }
  if (!date) date = new Date().toISOString().slice(0, 10)

  const targetRaw = data.targetOwnerUid
  const targetOwnerUid =
    typeof targetRaw === 'string' && targetRaw.trim().length > 0 ? targetRaw.trim() : undefined

  return {
    id,
    reporter: String(data.reporter ?? ''),
    phone: String(data.phone ?? ''),
    issue: String(data.issue ?? ''),
    shop: String(data.shop ?? ''),
    priority: normalizePriority(data.priority),
    status: normalizeStatus(data.status),
    date,
    description: String(data.description ?? ''),
    ...(targetOwnerUid ? { targetOwnerUid } : {}),
  }
}

/** Rows for Shop → Notifications (complaints routed to this shop owner). */
export type PlatformReportShopInboxSlice = {
  id: string
  issue: string
  shop: string
  description: string
  priority: AdminReportPriority
  sortMs: number
}

function mapShopInboxSlice(id: string, data: Record<string, unknown>): PlatformReportShopInboxSlice {
  const ms = createdAtMillis(data.createdAt)
  return {
    id,
    issue: String(data.issue ?? ''),
    shop: String(data.shop ?? ''),
    description: String(data.description ?? ''),
    priority: normalizePriority(data.priority),
    sortMs: ms > 0 ? ms : Date.now(),
  }
}

/** Live subscription: reports where Admin set “notify” to this approved shop owner UID. */
export function subscribePlatformReportsForTargetOwner(
  ownerId: string,
  onData: (rows: PlatformReportShopInboxSlice[]) => void,
  onError?: (e: unknown) => void,
) {
  const database = requireDb()
  const trimmed = ownerId.trim()
  if (!trimmed) {
    onData([])
    return () => {}
  }
  const q = query(collection(database, COL), where('targetOwnerUid', '==', trimmed))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) =>
        mapShopInboxSlice(d.id, d.data() as Record<string, unknown>),
      )
      rows.sort((a, b) => b.sortMs - a.sortMs)
      onData(rows)
    },
    (err) => {
      console.error(err)
      onError?.(err)
      onData([])
    },
  )
}

/** Full collection read for admin; sorted newest first in memory (no composite index). */
export async function listAllPlatformReports(): Promise<AdminReportRow[]> {
  const database = requireDb()
  const snap = await getDocs(collection(database, COL))
  const rows = snap.docs.map((d) => mapRow(d.id, d.data() as Record<string, unknown>))
  rows.sort((a, b) => {
    const da = a.date.length >= 10 ? new Date(`${a.date}T12:00:00`).getTime() : 0
    const db = b.date.length >= 10 ? new Date(`${b.date}T12:00:00`).getTime() : 0
    return db - da
  })
  return rows
}

export async function updatePlatformReportStatus(id: string, status: AdminReportStatus) {
  const database = requireDb()
  await updateDoc(doc(database, COL, id), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function updatePlatformReportPriority(id: string, priority: AdminReportPriority) {
  const database = requireDb()
  await updateDoc(doc(database, COL, id), {
    priority,
    updatedAt: serverTimestamp(),
  })
}

export async function createPlatformReport(input: {
  reporterUid: string
  reporter: string
  phone: string
  issue: string
  shop: string
  priority: AdminReportPriority
  status: AdminReportStatus
  description: string
  date: string
  /** Shop owner Firebase UID — they see this complaint under Shop → Notifications. */
  targetOwnerUid?: string
}) {
  const database = requireDb()
  const target = input.targetOwnerUid?.trim() ?? ''
  const payload: Record<string, unknown> = {
    reporterUid: input.reporterUid.trim(),
    reporter: input.reporter.trim(),
    phone: input.phone.trim(),
    issue: input.issue.trim(),
    shop: input.shop.trim(),
    priority: input.priority,
    status: input.status,
    description: input.description.trim(),
    date: input.date.trim().slice(0, 10),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (target.length > 0) payload.targetOwnerUid = target
  await addDoc(collection(database, COL), payload)
}

/** Signed-in customer: creates `status: open` with `reporterUid` = current user (see `firestore.rules`). */
export async function submitCustomerPlatformReport(input: {
  reporter: string
  phone: string
  issue: string
  shop: string
  priority: AdminReportPriority
  description: string
  date: string
}) {
  const a = requireAuth()
  const uid = a.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  await createPlatformReport({
    reporterUid: uid,
    reporter: input.reporter,
    phone: input.phone,
    issue: input.issue,
    shop: input.shop,
    priority: input.priority,
    status: 'open',
    description: input.description,
    date: input.date,
  })
}
