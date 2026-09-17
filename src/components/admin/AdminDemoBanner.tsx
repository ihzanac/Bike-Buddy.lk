import { isAdminDummyDataEnabled } from '@/data/adminDummyData'

export function AdminDemoBanner() {
  if (!isAdminDummyDataEnabled()) return null
  return (
    <div className="bb-admin-demo-banner" role="status">
      <strong>Sample data</strong> — Set <code className="bb-admin-demo-code">VITE_ADMIN_DUMMY_DATA=false</code> in
      <code className="bb-admin-demo-code">.env</code> to show only live Firestore data. Approve, delete, and status
      changes on rows marked <span className="bb-badge neutral">Sample</span> are disabled.
    </div>
  )
}

export function SampleBadge() {
  if (!isAdminDummyDataEnabled()) return null
  return (
    <span className="bb-badge neutral" style={{ marginLeft: 8 }}>
      Sample
    </span>
  )
}
