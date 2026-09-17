import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { resendPasswordOtp, verifyPasswordOtp } from '@/services/passwordOtp'
import { ROUTES } from '@/utils/constants'
import verifiedEmailIllustration from '@/assets/verified-email-illustration.svg'
import '@/styles/bikebuddyAuthSplit.css'

const N = 6

export function ForgotPasswordCheckPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''
  const [vals, setVals] = useState<string[]>(() => Array(N).fill(''))
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const resend = async () => {
    if (!email) {
      toast.error('Go back and enter your email first.')
      navigate(ROUTES.forgotPassword)
      return
    }
    try {
      await resendPasswordOtp(email)
      toast.success('Verification code sent again. Check your inbox.')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not resend verification code.'
      toast.error(message)
    }
  }

  const onChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...vals]
    next[i] = d
    setVals(next)
    if (d && i < N - 1) inputs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !vals[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const onVerifyCode = async () => {
    const code = vals.join('')
    if (code.length !== N || /\D/.test(code)) {
      toast.error('Enter the 6-digit code.')
      return
    }
    if (!email) {
      toast.error('Go back and enter your email first.')
      navigate(ROUTES.forgotPassword)
      return
    }
    try {
      const resetToken = await verifyPasswordOtp(email, code)
      navigate(ROUTES.resetPassword, { state: { fromCodeVerify: true, email, resetToken } })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid or expired verification code.'
      toast.error(message)
    }
  }

  return (
    <div className="bbl-split-page">
      <div className="bbl-container">
        <div className="bbl-card">
          <div className="bbl-image-box">
            <img src={verifiedEmailIllustration} alt="Verified email illustration" />
          </div>
          <div className="bbl-content-box">
            <h2>Verify Your Email</h2>
            <p>
              We’ve sent a verification code to your email address. Please enter the 6-digit code below to
              reset your password.
            </p>
            <p className="bbl-hint">
              {email ? <strong>Sent to: {email}</strong> : 'No email in session — you can resend from the link below.'}
            </p>
            <div className="bbl-otp-box" aria-label="6-digit verification code">
              {vals.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={v}
                  onChange={(e) => onChange(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                />
              ))}
            </div>
            <p className="bbl-hint" style={{ marginTop: 8 }}>Enter the code exactly as it appears in your email.</p>
            <button type="button" className="bbl-primary" onClick={onVerifyCode}>
              Verify Code
            </button>
            <div className="bbl-links" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="bbl-primary"
                style={{ background: 'transparent', color: '#2f7d6d', boxShadow: 'none' }}
                onClick={resend}
              >
                Resend code
              </button>
            </div>
            <p className="bbl-back">
              <Link to={ROUTES.forgotPassword}>Change email</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
