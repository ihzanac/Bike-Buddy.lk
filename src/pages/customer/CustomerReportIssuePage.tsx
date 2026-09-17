import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ROUTES } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'
import { submitCustomerPlatformReport } from '@/services/platformReports'
import type { AdminReportPriority } from '@/data/adminReportsSample'
import { describeServiceError } from '@/utils/firebaseErrors'
import '@/styles/bikebuddyCustomerArea.css'
import '@/styles/customer-report-issue.css'

const PRI_OPTIONS: { v: AdminReportPriority; l: string }[] = [
  { v: 'low', l: 'Low — minor inconvenience' },
  { v: 'medium', l: 'Medium — needs attention' },
  { v: 'high', l: 'High — serious issue' },
  { v: 'critical', l: 'Critical — safety / urgent' },
]

export function CustomerReportIssuePage() {
  const { profile, firebaseUser } = useAuth()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [reporter, setReporter] = useState(() =>
    (profile?.displayName || firebaseUser?.displayName || '').trim(),
  )
  const [phone, setPhone] = useState(() => (profile?.phone || '').trim())
  const [shop, setShop] = useState('')
  const [issue, setIssue] = useState('')
  const [priority, setPriority] = useState<AdminReportPriority>('medium')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reporter.trim() || !shop.trim() || !issue.trim() || !description.trim()) {
      toast.error('Please fill your name, shop, issue summary, and description.')
      return
    }
    setSaving(true)
    try {
      await submitCustomerPlatformReport({
        reporter: reporter.trim(),
        phone: phone.trim(),
        issue: issue.trim(),
        shop: shop.trim(),
        priority,
        description: description.trim(),
        date: date.slice(0, 10),
      })
      toast.success('Report sent. Our team will review it in Admin → Reports.')
      setIssue('')
      setDescription('')
      setShop('')
      setPriority('medium')
      setDate(new Date().toISOString().slice(0, 10))
    } catch (err) {
      toast.error('Could not send report', { description: describeServiceError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cri-wrap">
      <header className="cri-head">
        <p className="cri-kicker">Help & safety</p>
        <h1 className="cri-title">Report a problem</h1>
        <p className="cri-lead">
          Tell us what went wrong (include shop name, booking, parts, etc.). Your report goes to{' '}
          <strong>BikeBuddy administrators</strong> — not to the shop directly. Sign in as a customer is required.
        </p>
      </header>

      <form className="cri-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="cri-field">
          <span className="cri-lbl">Your name *</span>
          <input
            className="cri-input"
            required
            value={reporter}
            onChange={(e) => setReporter(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="cri-field">
          <span className="cri-lbl">Phone</span>
          <input
            className="cri-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94 …"
            autoComplete="tel"
          />
        </label>
        <label className="cri-field">
          <span className="cri-lbl">Shop name *</span>
          <input
            className="cri-input"
            required
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="Enter the shop name"
          />
        </label>
        <label className="cri-field">
          <span className="cri-lbl">Issue summary *</span>
          <input
            className="cri-input"
            required
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Short title e.g. Late service, Wrong part"
          />
        </label>
        <label className="cri-field">
          <span className="cri-lbl">Priority</span>
          <select
            className="cri-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as AdminReportPriority)}
          >
            {PRI_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <label className="cri-field">
          <span className="cri-lbl">When it happened</span>
          <input className="cri-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="cri-field cri-field--full">
          <span className="cri-lbl">Details *</span>
          <textarea
            className="cri-textarea"
            required
            rows={6}
            maxLength={8000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened. Include order/booking IDs if you have them."
          />
        </label>
        <div className="cri-actions">
          <Link to={ROUTES.dashboard} className="cri-btn cri-btn--ghost">
            Cancel
          </Link>
          <button type="submit" className="cri-btn cri-btn--pri" disabled={saving}>
            {saving ? 'Sending…' : 'Send report to admins'}
          </button>
        </div>
      </form>
    </div>
  )
}
