import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { isFirebaseConfigured } from '@/services/firebase'
import {
  setShopReviewFlagged,
  subscribeShopReviewsForOwner,
  updateShopReviewOwnerReply,
} from '@/services/shopReviews'
import type { ShopReview } from '@/types'
import { ROUTES } from '@/utils/constants'

type FilterKey = 'all' | '1' | '2' | '3' | '4' | '5'

function formatReviewDate(createdAt: unknown): string {
  if (
    createdAt &&
    typeof createdAt === 'object' &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === 'function'
  ) {
    return (createdAt as { toDate: () => Date }).toDate().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return '—'
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase()
  const w = p[0] || '?'
  return w.slice(0, 2).toUpperCase()
}

function starRow(rating: number): string {
  const r = Math.min(5, Math.max(0, Math.round(rating)))
  return '⭐'.repeat(r)
}

export function ShopFeedbackPage() {
  const { profile, firebaseUser } = useAuth()
  const ownerId = (profile?.uid ?? firebaseUser?.uid ?? '').trim()
  const [reviews, setReviews] = useState<ShopReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<ShopReview | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ownerId || !isFirebaseConfigured) {
      setLoading(false)
      setReviews([])
      return
    }
    const unsub = subscribeShopReviewsForOwner(
      ownerId,
      (rows) => {
        setReviews(rows)
        setLoading(false)
      },
      () => {
        setReviews([])
        setLoading(false)
        toast.error('Could not load reviews. Deploy Firestore rules and indexes for shopReviews.')
      },
    )
    return () => unsub()
  }, [ownerId])

  const stats = useMemo(() => {
    const total = reviews.length
    const by: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let sum = 0
    for (const r of reviews) {
      const n = Math.min(5, Math.max(1, Math.round(r.rating)))
      by[n] = (by[n] ?? 0) + 1
      sum += n
    }
    const avg = total > 0 ? sum / total : 0
    return { total, by, avg }
  }, [reviews])

  const counts = useMemo(
    () => ({
      all: reviews.length,
      5: stats.by[5] ?? 0,
      4: stats.by[4] ?? 0,
      3: stats.by[3] ?? 0,
      2: stats.by[2] ?? 0,
      1: stats.by[1] ?? 0,
    }),
    [reviews.length, stats.by],
  )

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews
    const n = Number(filter) as 1 | 2 | 3 | 4 | 5
    return reviews.filter((r) => Math.round(r.rating) === n)
  }, [reviews, filter])

  const openReply = (r: ShopReview) => {
    setReplyTarget(r)
    setReplyDraft(r.ownerReply ?? '')
    setReplyOpen(true)
  }

  const closeReply = useCallback(() => {
    setReplyOpen(false)
    setReplyTarget(null)
    setReplyDraft('')
  }, [])

  useEffect(() => {
    if (!replyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReply()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [replyOpen, closeReply])

  const submitReply = useCallback(async () => {
    if (!replyTarget) return
    const t = replyDraft.trim()
    if (!t) {
      toast.error('Write a response first.')
      return
    }
    if (t.length > 500) {
      toast.error('Response must be 500 characters or less.')
      return
    }
    setSaving(true)
    try {
      await updateShopReviewOwnerReply(replyTarget.id, t)
      toast.success('Reply saved')
      closeReply()
    } catch {
      toast.error('Could not save reply.')
    } finally {
      setSaving(false)
    }
  }, [replyTarget, replyDraft, closeReply])

  const onFlag = (r: ShopReview) => {
    if (r.flagged) {
      toast('This review is already flagged for moderation.', { id: 'flag' })
      return
    }
    if (
      !window.confirm(
        'Flag this review? Flagged items can be reviewed by the platform team (when moderation is connected).',
      )
    ) {
      return
    }
    setSaving(true)
    void (async () => {
      try {
        await setShopReviewFlagged(r.id, true)
        toast.success('Review flagged')
      } catch {
        toast.error('Could not flag review.')
      } finally {
        setSaving(false)
      }
    })()
  }

  const onShare = async (r: ShopReview) => {
    const line = `★${r.rating} from ${r.customerName}: ${r.text.slice(0, 200)}${r.text.length > 200 ? '…' : ''}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Customer review', text: line })
        return
      } catch {
        /* try clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(line)
      toast.success('Review text copied to clipboard')
    } catch {
      toast.error('Copy failed. Select and copy the review manually.')
    }
  }

  const barPct = (count: number) => {
    if (stats.total === 0) return 0
    return Math.round((count / stats.total) * 100)
  }

  if (!profile || profile.role !== 'owner') {
    return (
      <div className="sp-panel">
        <p>Customer feedback is for signed-in shop owners only.</p>
      </div>
    )
  }

  if (!isFirebaseConfigured) {
    return (
      <>
        <div className="sp-top-bar">
          <div>
            <h1>Customer feedback</h1>
            <div className="sp-breadcrumb">
              <Link to={ROUTES.shopDashboard}>Home</Link>
              <i className="fas fa-chevron-right" aria-hidden />
              <span>Customer feedback</span>
            </div>
          </div>
        </div>
        <div className="sp-panel">
          <p>Connect Firebase in your environment to load and manage reviews.</p>
        </div>
      </>
    )
  }

  return (
    <div className="sp-feedback-page">
      <div className="sp-top-bar">
        <div>
          <h1>Customer feedback &amp; reviews</h1>
          <div className="sp-breadcrumb">
            <Link to={ROUTES.shopDashboard}>Home</Link>
            <i className="fas fa-chevron-right" aria-hidden />
            <span>Customer feedback</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="sp-fb-card">
          <p className="sp-fb-muted" style={{ margin: 0 }}>
            Loading reviews…
          </p>
        </div>
      ) : null}

      {!loading ? (
        <>
          <div className="sp-fb-summary">
            <div className="sp-fb-summary-left">
              <div className="sp-fb-big-rating">
                {stats.total > 0 ? stats.avg.toFixed(1) : '—'}
              </div>
              <div className="sp-fb-star-line" aria-hidden>
                {stats.total > 0 ? starRow(Math.round(stats.avg)) : '—'}
              </div>
              <p className="sp-fb-countline">
                {stats.total > 0 ? `Based on ${stats.total} reviews` : 'No reviews yet'}
              </p>
            </div>
            <div className="sp-fb-bars">
              {[5, 4, 3, 2, 1].map((k) => (
                <div key={k} className="sp-fb-bar-item">
                  <span className="sp-fb-bar-lbl">
                    {k} <span className="sp-fb-emoji">⭐</span>
                  </span>
                  <div className="sp-fb-bar">
                    <div
                      className="sp-fb-bar-fill"
                      style={{ width: `${barPct(stats.by[k] ?? 0)}%` }}
                    />
                  </div>
                  <span className="sp-fb-bar-num">{stats.by[k] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sp-fb-filters">
            {(
              [
                ['all', 'All reviews', 'fa-list'],
                ['5', '5 stars', 'fa-star'],
                ['4', '4 stars', 'fa-star'],
                ['3', '3 stars', 'fa-star'],
                ['2', '2 stars', 'fa-star'],
                ['1', '1 star', 'fa-star'],
              ] as const
            ).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`sp-fb-tab${filter === key ? ' sp-fb-tab--on' : ''}`}
                onClick={() => setFilter(key as FilterKey)}
              >
                <i className={`fas ${icon}`} aria-hidden />
                {label}
                <span className="sp-fb-tab-c">{counts[key as keyof typeof counts]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="sp-fb-empty">
              <i className="fas fa-comments" aria-hidden />
              <h3>No reviews to show</h3>
              <p>
                {stats.total === 0
                  ? 'Reviews appear when customers rate your shop (after you connect a “leave review” flow on the public site or customer app).'
                  : 'Try another filter.'}
              </p>
            </div>
          ) : (
            <div className="sp-fb-grid">
              {filtered.map((r) => (
                <article key={r.id} className="sp-fb-card">
                  <div className="sp-fb-card-head">
                    <div className="sp-fb-user">
                      <div className="sp-fb-avatar" aria-hidden>
                        {initials(r.customerName)}
                      </div>
                      <div>
                        <h4>{r.customerName}</h4>
                        <div className="sp-fb-stars" aria-label={`${r.rating} stars`}>
                          {starRow(r.rating)}
                        </div>
                      </div>
                    </div>
                    <div className="sp-fb-date">
                      <i className="fas fa-calendar" aria-hidden />
                      {formatReviewDate(r.createdAt)}
                    </div>
                  </div>
                  {r.flagged ? (
                    <p className="sp-fb-flagged">
                      <i className="fas fa-flag" aria-hidden /> Flagged for moderation
                    </p>
                  ) : null}
                  <p className="sp-fb-text">{r.text}</p>
                  {r.serviceName ? (
                    <div className="sp-fb-service">
                      <i className="fas fa-wrench" aria-hidden />
                      {r.serviceName}
                    </div>
                  ) : null}
                  {r.ownerReply ? (
                    <div className="sp-fb-reply">
                      <div className="sp-fb-reply-h">
                        <i className="fas fa-store" aria-hidden />
                        Shop response
                      </div>
                      <p>{r.ownerReply}</p>
                    </div>
                  ) : null}
                  <div className="sp-fb-actions">
                    <button
                      type="button"
                      className="sp-fb-btn sp-fb-btn--reply"
                      onClick={() => openReply(r)}
                      disabled={saving}
                    >
                      <i className="fas fa-reply" aria-hidden />
                      {r.ownerReply ? 'Edit reply' : 'Reply'}
                    </button>
                    <button
                      type="button"
                      className="sp-fb-btn sp-fb-btn--flag"
                      onClick={() => onFlag(r)}
                      disabled={saving || r.flagged}
                    >
                      <i className="fas fa-flag" aria-hidden />
                      Flag
                    </button>
                    <button
                      type="button"
                      className="sp-fb-btn sp-fb-btn--share"
                      onClick={() => void onShare(r)}
                    >
                      <i className="fas fa-share-alt" aria-hidden />
                      Share
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {replyOpen && replyTarget ? (
        <div
          className="sp-fb-modal-back"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReply()
          }}
        >
          <div className="sp-fb-modal" role="dialog" aria-modal aria-labelledby="sp-fb-reply-title">
            <div className="sp-fb-modal-h">
              <h2 id="sp-fb-reply-title">Reply to review</h2>
              <button
                type="button"
                className="sp-fb-modal-x"
                onClick={closeReply}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="sp-fb-modal-b">
              <div className="sp-fb-modal-preview">
                <h4>{replyTarget.customerName}&apos;s review</h4>
                <div className="sp-fb-stars">{starRow(replyTarget.rating)}</div>
                <p>{replyTarget.text}</p>
              </div>
              <label className="sp-fb-ta-l" htmlFor="sp-fb-reply-ta">
                Your response
              </label>
              <textarea
                id="sp-fb-reply-ta"
                className="sp-fb-ta"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Write a professional, friendly reply…"
              />
              <p className="sp-fb-char">
                {replyDraft.length} / 500
              </p>
              <div className="sp-fb-modal-actions">
                <button
                  type="button"
                  className="sp-fb-btn-pri"
                  onClick={() => void submitReply()}
                  disabled={saving}
                >
                  <i className="fas fa-paper-plane" aria-hidden />
                  {saving ? 'Sending…' : 'Send reply'}
                </button>
                <button type="button" className="sp-fb-btn-sec" onClick={closeReply} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
