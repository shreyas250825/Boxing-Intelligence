import { FormEvent, useState } from 'react'
import { ArrowRight, UserRoundPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { registerUser } from '../../api/auth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('Alex Coach')
  const [email, setEmail] = useState('alex@valenlabs.test')
  const [password, setPassword] = useState('StrongPassword123!')
  const [role, setRole] = useState('coach')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await registerUser({ full_name: fullName, email, password, role })
      navigate('/app', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create account.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <span className="auth-badge"><UserRoundPlus size={12} /> Build your team</span>
          <h1 className="auth-title">Create a performance environment for every athlete.</h1>
          <p className="auth-subtitle">
            Register your club or coaching team, upload footage, and turn analysis into measurable development conversations.
          </p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-panel">
          <h1>Create account</h1>
          <p>Set up your Valen Labs workspace.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="coach">Coach</option>
                <option value="fighter">Fighter</option>
                <option value="gym_admin">Gym Admin</option>
                <option value="platform_admin">Platform Admin</option>
              </select>
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
              <ArrowRight size={14} />
            </button>

            <p style={{ margin: '0', fontSize: '0.8rem' }}>
              Already have an account? <Link className="auth-link" to="/login">Sign in</Link>
            </p>

            {error && <div className="form-status">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  )
}
