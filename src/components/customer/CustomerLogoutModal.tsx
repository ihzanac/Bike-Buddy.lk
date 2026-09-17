import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export function CustomerLogoutModal({ open, onClose, onConfirm }: Props) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => cancelRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="bbl-logout-overlay"
      role="presentation"
      onClick={onClose}
      aria-hidden={!open}
    >
      <div
        className="bbl-logout-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bbl-logout-modal-accent" aria-hidden />
        <div className="bbl-logout-modal-icon-wrap" aria-hidden>
          <i className="fa-solid fa-right-from-bracket bbl-logout-modal-icon" />
        </div>
        <h2 id={titleId} className="bbl-logout-modal-title">
          Logout from BikeBuddy?
        </h2>
        <p id={descId} className="bbl-logout-modal-desc">
          Are you sure you want to logout? You&apos;ll need to sign in again to access your account.
        </p>
        <div className="bbl-logout-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="bbl-logout-btn bbl-logout-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bbl-logout-btn bbl-logout-btn--confirm"
            onClick={() => void onConfirm()}
          >
            Yes, Logout
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
