import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret, defineString } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createHmac, timingSafeEqual } from 'node:crypto'

initializeApp()

const resendApiKey = defineSecret('RESEND_API_KEY')
const otpResetTokenSecret = defineSecret('OTP_RESET_TOKEN_SECRET')
const emailFrom = defineString('BOOKING_EMAIL_FROM', {
  default: 'BikeBuddy <onboarding@resend.dev>',
  description: 'Resend "from" address. Use a domain you verified in Resend for production.',
})

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeBase64Url(input: string): string {
  const padded = `${input}${'='.repeat((4 - (input.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function verifyResetToken(token: string, secret: string): { email: string; exp: number } {
  const [payloadPart, sigPart] = token.split('.')
  if (!payloadPart || !sigPart) {
    throw new HttpsError('invalid-argument', 'Invalid reset token format.')
  }
  const expected = createHmac('sha256', secret).update(payloadPart).digest()
  const got = Buffer.from(
    `${sigPart}${'='.repeat((4 - (sigPart.length % 4)) % 4)}`
      .replace(/-/g, '+')
      .replace(/_/g, '/'),
    'base64',
  )
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw new HttpsError('permission-denied', 'Invalid reset token signature.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64Url(payloadPart))
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid reset token payload.')
  }
  const email = typeof parsed === 'object' && parsed && 'email' in parsed ? String(parsed.email) : ''
  const exp = typeof parsed === 'object' && parsed && 'exp' in parsed ? Number(parsed.exp) : NaN
  if (!email || !isEmail(email) || !Number.isFinite(exp)) {
    throw new HttpsError('invalid-argument', 'Invalid reset token claims.')
  }
  if (Math.floor(Date.now() / 1000) > exp) {
    throw new HttpsError('deadline-exceeded', 'Reset token expired.')
  }
  return { email, exp }
}

function buildMessages(data: Record<string, unknown>) {
  const shop = String(data.location ?? 'Shop')
  const serviceName = String(data.serviceName ?? 'Service')
  const when = `${String(data.date ?? '')} at ${String(data.time ?? '')}`
  const total = data.estimatedTotalLkr
  const totalLine =
    typeof total === 'number' && !Number.isNaN(total) && total >= 0
      ? `Estimated total: LKR ${total.toLocaleString('en-LK')}`
      : null
  const details = data.ownerNote ? String(data.ownerNote) : ''
  const subj = `BikeBuddy — booking at ${shop}`
  const text = [
    'Your bike service booking is saved in BikeBuddy.',
    '',
    `Shop / place: ${shop}`,
    `Services: ${serviceName}`,
    `When: ${when}`,
  ]
  if (totalLine) text.push(totalLine)
  if (details) text.push('', 'Details:', details)
  text.push(
    '',
    'The shop can accept, change, or decline the booking in their portal.',
    '',
    'Thank you for using BikeBuddy.lk',
  )
  const html = `<p>Your bike service booking is saved in <strong>BikeBuddy</strong>.</p>
<ul>
<li><strong>Shop / place</strong> ${escapeHtml(shop)}</li>
<li><strong>Services</strong> ${escapeHtml(serviceName)}</li>
<li><strong>When</strong> ${escapeHtml(when)}</li>
${
  totalLine
    ? `<li><strong>${escapeHtml(totalLine)}</strong></li>`
    : ''
}
</ul>
${details ? `<p><strong>Details</strong><br/>${escapeHtml(details).replace(/\n/g, '<br/>')}</p>` : ''}
<p style="color:#555;font-size:14px">The shop can accept or update the booking in their portal.</p>`

  return { from: emailFrom.value(), subj, text, html }
}

/**
 * After a booking is created with `customerEmail`, call this from the app to send
 * the confirmation to that address (Gmail, etc.) via Resend.
 *
 * Setup: `firebase functions:secrets:set RESEND_API_KEY` then
 * `npm run firebase:deploy:functions` from the repo root.
 * Production: add a verified domain in Resend and set BOOKING_EMAIL_FROM in Functions params.
 */
export const sendBookingReceiptEmail = onCall(
  { region: 'asia-south1', secrets: [resendApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required')
    }
    const bookingId = (request.data as { bookingId?: string } | null)?.bookingId
    if (typeof bookingId !== 'string' || !bookingId.trim()) {
      throw new HttpsError('invalid-argument', 'bookingId is required')
    }
    const key = resendApiKey.value()
    if (!key) {
      return { sent: false, reason: 'resend_not_configured' as const }
    }
    const db = getFirestore()
    const snap = await db.collection('bookings').doc(bookingId.trim()).get()
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Booking not found')
    }
    const d = snap.data() as Record<string, unknown>
    const uid = request.auth.uid
    if (d.customerId !== uid && d.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Not allowed to send this booking email')
    }
    const to = d.customerEmail
    if (typeof to !== 'string' || !isEmail(to)) {
      return { sent: false, reason: 'no_email' as const }
    }
    const { from, subj, text, html } = buildMessages(d)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject: subj, text, html }),
    })
    if (!res.ok) {
      const t = await res.text()
      logger.error('Resend error', { status: res.status, body: t })
      return { sent: false, reason: 'resend_error' as const, detail: t }
    }
    return { sent: true as const }
  },
)

/**
 * Completes forgot-password after OTP email verification (OTP is issued/verified by PHP endpoint).
 * This callable validates an HMAC reset token then updates Firebase Auth password by email.
 */
export const resetCustomerPasswordWithOtp = onCall(
  { region: 'asia-south1', secrets: [otpResetTokenSecret] },
  async (request) => {
    const email = String((request.data as { email?: string } | null)?.email ?? '')
      .trim()
      .toLowerCase()
    const newPassword = String((request.data as { newPassword?: string } | null)?.newPassword ?? '')
    const resetToken = String((request.data as { resetToken?: string } | null)?.resetToken ?? '')

    if (!isEmail(email)) {
      throw new HttpsError('invalid-argument', 'Valid email is required.')
    }
    if (newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.')
    }
    if (!resetToken) {
      throw new HttpsError('invalid-argument', 'Reset token is required.')
    }

    const secret = otpResetTokenSecret.value()
    if (!secret) {
      throw new HttpsError('failed-precondition', 'OTP reset secret is not configured.')
    }
    const tokenPayload = verifyResetToken(resetToken, secret)
    if (tokenPayload.email.toLowerCase() !== email) {
      throw new HttpsError('permission-denied', 'Reset token email mismatch.')
    }

    let userRecord
    try {
      userRecord = await getAuth().getUserByEmail(email)
    } catch {
      // Keep response generic to avoid account enumeration.
      return { ok: true as const }
    }
    await getAuth().updateUser(userRecord.uid, { password: newPassword })
    return { ok: true as const }
  },
)
