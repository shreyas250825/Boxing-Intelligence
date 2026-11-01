import { FormEvent, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { loginUser } from '../../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/app'

  const [email, setEmail] = useState('alex@valenlabs.test')
  const [password, setPassword] = useState('StrongPassword123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await loginUser({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in. Please check your credentials.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <span className="auth-badge"><ShieldCheck size={12} /> Valen Labs</span>
          <h1 className="auth-title">Turn every round into performance intelligence.</h1>
          <p className="auth-subtitle">
            Trusted by boxing academies, coaches, and high-performance athletes to review footage, compare sessions, and coach with evidence.
          </p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Welcome back</h1>
          <p>Sign in to the Boxing Intelligence platform.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="auth-actions">
              <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
              <Link className="auth-link" to="/register">Create account</Link>
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={14} />
            </button>

            {error && <div className="form-status">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  )
}
