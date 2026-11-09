import { FormEvent, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import apiClient from '../../api/client'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const tokenFromUrl = searchParams.get('token') || ''
  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!token.trim()) {
      setError('A reset token is required. Use the link from your email or the forgot-password response.')
      return
    }
    setLoading(true)
    try {
      await apiClient.post('/api/v1/auth/reset-password', { token: token.trim(), password })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. The token may be invalid or expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <span className="auth-badge">Security</span>
          <h1 className="auth-title">Set a new password.</h1>
          <p className="auth-subtitle">
            Choose a strong password. The reset token is single-use and expires in 1 hour.
          </p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Reset password</h1>
          <p>Enter your reset token and new password.</p>

          {!done ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Token field — pre-filled if arriving from forgot-password flow */}
              <div className="input-group">
                <label className="label">Reset token</label>
                <input
                  className="input"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token from email or development response"
                  required
                />
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label className="label">New password</label>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="input-group">
                <label className="label">Confirm password</label>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
                <ArrowRight size={14} />
              </button>

              <p style={{ margin: 0, fontSize: '0.8rem' }}>
                Back to <Link className="auth-link" to="/login">Sign in</Link>
              </p>

              {error && <div className="form-status">{error}</div>}
            </form>
          ) : (
            <div className="auth-form">
              <div className="form-status" style={{ color: '#86efac', borderColor: 'rgba(134,239,172,0.3)', background: 'rgba(0,70,40,0.2)' }}>
                Password reset successfully. You can now sign in with your new password.
              </div>
              <button className="btn-primary" onClick={() => navigate('/login', { replace: true })}>
                Sign in now <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
