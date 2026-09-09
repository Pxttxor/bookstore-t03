import { useState, type FormEvent, type RefObject } from 'react'
import Icon from './Icon'
import { useAuth } from '../auth/AuthContext'
import { formatPhoneNumber } from '../data/phone'
import './AuthForm.css'

// การสมัครสมาชิกมีสองขั้นเพราะ backend เปิดบัญชีเป็น UNVERIFIED
// (`PersonService.Register` เขียน person + customer + user_account + member สี่แถวพร้อมกัน)
// แล้วต้อง POST /api/auth/verify-otp ก่อนจึงจะเข้าสู่ระบบได้
type Step = 'form' | 'otp'

// ช่องที่ตรวจฝั่งไคลเอนต์ได้เอง — ข้อความของช่องเหล่านี้ไปอยู่ "ใต้ช่องนั้น" ไม่ใช่แถบบนหัวฟอร์ม
// (คำขอผู้ใช้ 7 ก.ย. 69) · `email` ไม่อยู่ในลิสต์โดยตั้งใจ: เรื่องอีเมลซ้ำ/รูปแบบผิดเป็นของ backend
// ซึ่งส่งข้อความไทยมาให้อยู่แล้ว จึงยังขึ้นเป็นแถบด้านบนเหมือนเดิม
type FieldKey = 'firstName' | 'lastName' | 'phone' | 'address' | 'password' | 'confirm'
type FieldErrors = Partial<Record<FieldKey, string>>

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ตรวจทุกช่องรวดเดียวแล้วคืนมาทั้งชุด — เดิมเป็น `return setError(...)` ที่หยุดตั้งแต่ข้อแรก
  // ซึ่งใช้ไม่ได้แล้วเมื่อข้อความไปอยู่ใต้ช่อง: ผู้ใช้ต้องเห็นทุกช่องที่ผิดในการกดครั้งเดียว
  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!firstName.trim()) next.firstName = 'กรุณากรอกชื่อ'
    if (!lastName.trim()) next.lastName = 'กรุณากรอกนามสกุล'
    const phoneDigits = phone.replace(/\D/g, '')
    if (!phoneDigits) {
      next.phone = 'กรุณากรอกเบอร์โทรศัพท์'
    } else if (phoneDigits.length !== 10) {
      next.phone = 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก'
    }
    if (!address.trim()) next.address = 'กรุณากรอกที่อยู่'
    if (password.length < 6) next.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    if (password !== confirm) next.confirm = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    return next
  }

  // ลบข้อความของช่องเดียวตอนผู้ใช้เริ่มพิมพ์แก้ — ช่องอื่นที่ยังผิดอยู่ต้องไม่หายตามไปด้วย
  const clearFieldError = (...keys: FieldKey[]) => {
    setFieldErrors((prev) => {
      if (!keys.some((key) => prev[key])) return prev
      const next = { ...prev }
      for (const key of keys) delete next[key]
      return next
    })
  }

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // ล้างของเก่าก่อนตรวจเสมอ — ต้องอยู่เหนือ validate() ไม่งั้นแถบ error จากเซิร์ฟเวอร์รอบก่อน
    // (เช่น อีเมลซ้ำ) จะค้างบนหัวฟอร์มพร้อมกับข้อความใต้ช่องชุดใหม่
    setFieldErrors({})
    setError('')

    const invalid = validate()
    if (Object.keys(invalid).length > 0) {
      setFieldErrors(invalid)
      return
    }

    setSubmitting(true)
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
        {/* แถบด้านบนเหลือไว้เฉพาะ error ที่ไม่ผูกกับช่องใดช่องหนึ่ง — ทั้งหมดมาจากเซิร์ฟเวอร์ */}
        {error && (
          <p className="auth-error" role="alert">
            <Icon name="help" size={18} />
            {error}
          </p>
        )}

        <label className="auth-field">
          <span className="auth-label">ชื่อ</span>
          <span className={'auth-input' + (fieldErrors.firstName ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="user" size={18} />
            </span>
            <input
              type="text"
              autoComplete="given-name"
              placeholder="กรอกชื่อจริง"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                clearFieldError('firstName')
              }}
              aria-invalid={!!fieldErrors.firstName}
              autoFocus
              required
            />
          </span>
          {fieldErrors.firstName && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.firstName}
            </span>
          )}
        </label>

        <label className="auth-field">
          <span className="auth-label">นามสกุล</span>
          <span className={'auth-input' + (fieldErrors.lastName ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="user" size={18} />
            </span>
            <input
              type="text"
              autoComplete="family-name"
              placeholder="กรอกนามสกุล"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                clearFieldError('lastName')
              }}
              aria-invalid={!!fieldErrors.lastName}
              required
            />
          </span>
          {fieldErrors.lastName && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.lastName}
            </span>
          )}
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
          <span className={'auth-input' + (fieldErrors.phone ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="phone" size={18} />
            </span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="081-234-5678"
              maxLength={12}
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneNumber(e.target.value))
                clearFieldError('phone')
              }}
              aria-invalid={!!fieldErrors.phone}
              required
            />
          </span>
          {fieldErrors.phone && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.phone}
            </span>
          )}
        </label>

        <label className="auth-field">
          <span className="auth-label">ที่อยู่จัดส่ง</span>
          <span className={'auth-input' + (fieldErrors.address ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="map-pin" size={18} />
            </span>
            <input
              type="text"
              autoComplete="street-address"
              placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                clearFieldError('address')
              }}
              aria-invalid={!!fieldErrors.address}
              required
            />
          </span>
          {fieldErrors.address && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.address}
            </span>
          )}
        </label>

        <label className="auth-field">
          <span className="auth-label">รหัสผ่าน</span>
          <span className={'auth-input' + (fieldErrors.password ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="lock" size={18} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="ตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                // "ไม่ตรงกัน" เป็นข้อความของคู่รหัสผ่าน ไม่ใช่ของช่องยืนยันช่องเดียว —
                // แก้ช่องบนแล้วข้อความใต้ช่องล่างต้องหายไปด้วย
                clearFieldError('password', 'confirm')
              }}
              aria-invalid={!!fieldErrors.password}
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
          {fieldErrors.password && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.password}
            </span>
          )}
        </label>

        <label className="auth-field">
          <span className="auth-label">ยืนยันรหัสผ่าน</span>
          <span className={'auth-input' + (fieldErrors.confirm ? ' auth-input--invalid' : '')}>
            <span className="auth-input__lead">
              <Icon name="lock" size={18} />
            </span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                clearFieldError('confirm')
              }}
              aria-invalid={!!fieldErrors.confirm}
              required
            />
          </span>
          {fieldErrors.confirm && (
            <span className="auth-field__error" role="alert">
              {fieldErrors.confirm}
            </span>
          )}
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
