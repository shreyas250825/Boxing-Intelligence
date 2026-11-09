import { FormEvent, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface ForgotResponse {
  message: string
  reset_token?: string
  expires_in_seconds?: number
  email_delivery_configured: boolean
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<ForgotResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiClient.post<{ data: ForgotResponse }>(
        '/api/v1/auth/forgot-password',
        { email }
      )
      setResult(res.data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <span className="auth-badge">Reset access</span>
          <h1 className="auth-title">Recover your account.</h1>
          <p className="auth-subtitle">
            We'll help you restore access. Email delivery must be configured on
            the backend for production use.
          </p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Forgot password</h1>
          <p>Enter your email address.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!result}
              />
            </div>

            {!result && (
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Checking…' : 'Continue'}
                <ArrowRight size={14} />
              </button>
            )}

            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              Back to <Link className="auth-link" to="/login">Sign in</Link>
            </p>

            {/* Success: email delivery configured (production) */}
            {result && result.email_delivery_configured && (
              <div className="form-status" style={{ color: '#86efac' }}>
                {result.message}
              </div>
            )}

            {/* Development mode: show the reset token directly */}
            {result && !result.email_delivery_configured && (
              <div className="form-status" style={{ borderColor: 'rgba(251,191,36,0.32)', background: 'rgba(120,80,0,0.18)', color: '#fde68a' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
                  ⚠ Development mode — email delivery not configured
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '0.8rem' }}>
                  {result.message}
                </p>
                {result.reset_token && (
                  <>
                    <p style={{ margin: '0 0 4px', fontSize: '0.75rem', opacity: 0.8 }}>
                      Reset token (valid {Math.round((result.expires_in_seconds ?? 3600) / 60)} minutes):
                    </p>
                    <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '0.72rem', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 8, marginBottom: 10 }}>
                      {result.reset_token}
                    </code>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', fontSize: '0.8rem' }}
                      onClick={() => navigate(`/reset-password?token=${encodeURIComponent(result.reset_token!)}`)}
                    >
                      Use this token to reset password →
                    </button>
                  </>
                )}
              </div>
            )}

            {error && <div className="form-status">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  )
}
