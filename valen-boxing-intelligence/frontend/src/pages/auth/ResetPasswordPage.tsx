import { FormEvent, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setDone(true)
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <span className="auth-badge">Security</span>
          <h1 className="auth-title">Set a new password.</h1>
          <p className="auth-subtitle">Choose a strong password to keep the athlete and coaching workspace protected.</p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Reset password</h1>
          <p>Choose a password with at least 8 characters.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">New password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button className="btn-primary" type="submit">
              Reset password
              <ArrowRight size={14} />
            </button>

            {done && (
              <div className="form-status" style={{ color: '#86efac' }}>
                Password updated. <Link className="auth-link" to="/login">Return to sign in</Link>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  )
}
