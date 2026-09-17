import { httpsCallable } from 'firebase/functions'
import { functions, firebaseApp } from '@/services/firebase'

type ReceiptResult = {
  sent: boolean
  reason?: 'resend_not_configured' | 'no_email' | 'resend_error'
  detail?: string
}

/**
 * Sends a booking summary to the address stored on the booking (via Resend from Cloud Functions).
 * Must run while the user is signed in (customer for their booking, or shop owner for walk-in).
 */
export async function callSendBookingReceiptEmail(bookingId: string): Promise<ReceiptResult> {
  if (!firebaseApp || !functions) {
    return { sent: false, reason: 'resend_not_configured' }
  }
  const run = httpsCallable(functions, 'sendBookingReceiptEmail')
  const res = await run({ bookingId })
  const data = res.data as ReceiptResult
  return data
}
