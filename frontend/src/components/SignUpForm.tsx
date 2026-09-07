import { useState, type FormEvent, type RefObject } from 'react'
import Icon from './Icon'
import { useAuth } from '../auth/AuthContext'
import './AuthForm.css'

// การสมัครสมาชิกมีสองขั้นเพราะ backend เปิดบัญชีเป็น UNVERIFIED
// (`PersonService.Register` เขียน person + customer + user_account + member สี่แถวพร้อมกัน)
// แล้วต้อง POST /api/auth/verify-otp ก่อนจึงจะเข้าสู่ระบบได้
type Step = 'form' | 'otp'

interface SignUpFormProps {
  onVerified: () => void
  onSwitchToLogin: () => void
  /** กล่อง modal ที่ครอบฟอร์มนี้ — สลับไปขั้น OTP (สั้นกว่าฟอร์มสมัครมาก) แล้วรีเซ็ต scroll
      กันเนื้อหาค้างสกอลล์จากฟอร์ม 7 ช่องก่อนหน้า */
  scrollTargetRef?: RefObject<HTMLDivElement | null>
}

export default function SignUpForm({
  onVerified,
  onSwitchToLogin,
  scrollTargetRef,
}: SignUpFormProps) {
  const { register, verifyOtp } = useAuth()

  const [step, setStep] = useState<Step>('form')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!firstName.trim()) return setError('กรุณากรอกชื่อ')
    if (!lastName.trim()) return setError('กรุณากรอกนามสกุล')
    if (!phone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์')
    if (!address.trim()) return setError('กรุณากรอกที่อยู่')
    if (password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    if (password !== confirm) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')

    setSubmitting(true)
    setError('')
    try {
      await register({ firstName, lastName, email, phone, address, password })
      setStep('otp')
      scrollTargetRef?.current?.scrollTo(0, 0)
    } catch (err) {
      // ApiError.message เป็นภาษาไทยจาก backend อยู่แล้ว (อีเมลซ้ำ ฯลฯ)
      setError(err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const submitOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')
    try {
      await verifyOtp(email, otp)
      onVerified()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ยืนยันรหัส OTP ไม่สำเร็จ')
      setSubmitting(false)
    }
  }

  if (step === 'otp') {
    return (
      <>
        <div className="auth-card__head">
          <h1 className="auth-card__title">ยืนยันตัวตน</h1>
          <p className="auth-card__subtitle">ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่ {email}</p>
        </div>

        <form className="auth-form auth-form--roomy" onSubmit={submitOtp} noValidate>
          {error && (
            <p className="auth-error" role="alert">
              <Icon name="help" size={18} />
              {error}
            </p>
          )}

          <label className="auth-field">
            <span className="auth-label">รหัสยืนยัน (OTP)</span>
            <span className="auth-input">
              <span className="auth-input__lead">
                <Icon name="key" size={18} />
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="กรอกรหัส 6 หลัก"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
                required
              />
            </span>
          </label>

          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            ยืนยันและเข้าสู่ระบบ
          </button>
        </form>

        <p className="auth-alt">
          กรอกอีเมลผิด?{' '}
          <button type="button" onClick={() => setStep('form')}>
            เริ่มใหม่
          </button>
        </p>
      </>
    )
  }

  return (
    <>
      <div className="auth-card__head">
        <h1 className="auth-card__title">สมัครสมาชิก</h1>
        <p className="auth-card__subtitle">สมัครเพื่อรับคำแนะนำหนังสือที่ตรงกับคุณ</p>
      </div>

      <form className="auth-form" onSubmit={submitForm} noValidate>
        {error && (
          <p className="auth-error" role="alert">
            <Icon name="help" size={18} />
            {error}
          </p>
        )}

        <label className="auth-field">
          <span className="auth-label">ชื่อ</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="user" size={18} />
            </span>
            <input
              type="text"
              autoComplete="given-name"
              placeholder="กรอกชื่อจริง"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              required
            />
          </span>
        </label>

        <label className="auth-field">
          <span className="auth-label">นามสกุล</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="user" size={18} />
            </span>
            <input
              type="text"
              autoComplete="family-name"
              placeholder="กรอกนามสกุล"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </span>
        </label>

        <label className="auth-field">
          <span className="auth-label">อีเมล</span>
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
          <span className="auth-label">เบอร์โทรศัพท์</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="phone" size={18} />
            </span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="08X-XXX-XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </span>
        </label>

        <label className="auth-field">
          <span className="auth-label">ที่อยู่จัดส่ง</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="map-pin" size={18} />
            </span>
            <input
              type="text"
              autoComplete="street-address"
              placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </span>
        </label>

        <label className="auth-field">
          <span className="auth-label">รหัสผ่าน</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="lock" size={18} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
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
        </label>

        <label className="auth-field">
          <span className="auth-label">ยืนยันรหัสผ่าน</span>
          <span className="auth-input">
            <span className="auth-input__lead">
              <Icon name="lock" size={18} />
            </span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </span>
        </label>

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          สมัครสมาชิก
        </button>
      </form>

      <p className="auth-alt">
        มีบัญชีอยู่แล้ว?{' '}
        <button type="button" className="auth-switch" onClick={onSwitchToLogin}>
          เข้าสู่ระบบ
        </button>
      </p>
    </>
  )
}
