import { FormEvent, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { forgotPassword } from '../../api/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await forgotPassword(email)
      setSent(true)
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
          <h1 className="auth-title">Recover your account securely.</h1>
          <p className="auth-subtitle">We’ll help you restore access quickly without affecting your current workspace.</p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Forgot password</h1>
          <p>Enter your email to receive reset instructions.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
              <ArrowRight size={14} />
            </button>

            <p style={{ margin: '0', fontSize: '0.8rem' }}>
              Back to <Link className="auth-link" to="/login">Sign in</Link>
            </p>

            {sent && <div className="form-status" style={{ color: '#86efac' }}>Reset instructions sent if the account exists.</div>}
            {error && <div className="form-status">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  )
}
