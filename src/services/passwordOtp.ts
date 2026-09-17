import { httpsCallable } from 'firebase/functions'
import { firebaseApp, functions } from '@/services/firebase'

const otpApiPath = import.meta.env.VITE_PASSWORD_OTP_API_PATH || '/api/customer-password-otp.php'

type OtpApiResponse = {
  ok?: boolean
  message?: string
  resetToken?: string
}

async function callOtpApi(payload: Record<string, unknown>): Promise<OtpApiResponse> {
  let res: Response
  try {
    res = await fetch(otpApiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    throw new Error(
      [
        'OTP service is unreachable.',
        `Endpoint: ${otpApiPath}`,
        'Start the PHP API server (and make sure VITE_PASSWORD_OTP_API_PATH points to it), then try again.',
        msg ? `Network error: ${msg}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
  const raw = await res.text()
  let data: OtpApiResponse = {}
  try {
    data = raw ? (JSON.parse(raw) as OtpApiResponse) : {}
  } catch {
    const preview = raw.slice(0, 140).trim()
    throw new Error(
      preview
        ? `OTP service returned non-JSON response (${res.status}): ${preview}`
        : `OTP service returned an empty response (${res.status}).`,
    )
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.message || `Unable to complete OTP request (${res.status}).`)
  }
  return data
}

export async function requestPasswordOtp(email: string): Promise<void> {
  await callOtpApi({ action: 'request_otp', email })
}

export async function resendPasswordOtp(email: string): Promise<void> {
  await callOtpApi({ action: 'resend_otp', email })
}

export async function verifyPasswordOtp(email: string, otp: string): Promise<string> {
  const out = await callOtpApi({ action: 'verify_otp', email, otp })
  if (!out.resetToken) {
    throw new Error('OTP verified, but reset token was not returned.')
  }
  return out.resetToken
}

type ResetCallableResult = {
  ok: boolean
}

export async function resetPasswordWithOtpToken(email: string, newPassword: string, resetToken: string) {
  if (!firebaseApp || !functions) {
    throw new Error('Firebase Functions is not configured.')
  }
  const run = httpsCallable(functions, 'resetCustomerPasswordWithOtp')
  const res = await run({ email, newPassword, resetToken })
  const data = res.data as ResetCallableResult
  if (!data.ok) {
    throw new Error('Password reset failed.')
  }
}
