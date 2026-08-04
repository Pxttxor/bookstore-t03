import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import './AuthPages.css'

export default function SignUpPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your full name.')
    if (password.length < 6)
      return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    try {
      register(name, email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-card__head auth-card__head--center">
          <h1 className="auth-card__title">Create Account</h1>
          <p className="auth-card__subtitle">
            Sign up to get personalized recommendations
          </p>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {error && (
            <p className="auth-error" role="alert">
              <Icon name="help" size={18} />
              {error}
            </p>
          )}

          <label className="auth-field">
            <span className="auth-label">Full Name</span>
            <span className="auth-input">
              <span className="auth-input__lead">
                <Icon name="user" size={18} />
              </span>
              <input
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Email Address</span>
            <span className="auth-input">
              <span className="auth-input__lead">
                <Icon name="mail" size={18} />
              </span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <span className="auth-input">
              <span className="auth-input__lead">
                <Icon name="lock" size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-input__toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} />
              </button>
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Confirm Password</span>
            <span className="auth-input">
              <span className="auth-input__lead">
                <Icon name="lock" size={18} />
              </span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </span>
          </label>

          <button type="submit" className="btn btn-primary auth-submit">
            Create Account
          </button>
        </form>

        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  )
}
