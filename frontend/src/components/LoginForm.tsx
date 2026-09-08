import { useState, type FormEvent } from 'react'
import Icon from './Icon'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import './AuthForm.css'

interface LoginFormProps {
  onSuccess: (user: AuthUser) => void
  onSwitchToSignup: () => void
}

export default function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const signedIn = await login(email, password)
      onSuccess(signedIn)
    } catch (err) {
      // ApiError.message เป็นภาษาไทยจาก backend อยู่แล้ว (บัญชีถูกระงับ / ยังไม่ยืนยันตัวตน ฯลฯ)
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="auth-card__head">
        <h1 className="auth-card__title">เข้าสู่ระบบ</h1>
        <p className="auth-card__subtitle">เข้าถึงรายการหนังสือและคำสั่งซื้อของคุณ</p>
      </div>

      <form className="auth-form auth-form--roomy" onSubmit={submit} noValidate>
        {error && (
          <p className="auth-error" role="alert">
            <Icon name="help" size={18} />
            {error}
          </p>
        )}

        <label className="auth-field">
          <span className="auth-label">อีเมล</span>
          <span className="auth-input">
            <input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </span>
        </label>

        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">รหัสผ่าน</span>
            <button type="button" className="auth-forgot">
              ลืมรหัสผ่าน?
            </button>
          </div>
          <span className="auth-input">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-input__toggle"
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              onClick={() => setShowPassword((s) => !s)}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} />
            </button>
          </span>
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      <p className="auth-alt">
        ยังไม่มีบัญชี?{' '}
        <button type="button" className="auth-switch" onClick={onSwitchToSignup}>
          สมัครสมาชิก
        </button>
      </p>
    </>
  )
}
