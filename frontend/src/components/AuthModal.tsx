import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import LoginForm from './LoginForm'
import SignUpForm from './SignUpForm'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import { isEmployee } from '../auth/roles'
import { useToast } from '../admin/components/ToastContext'
import './AuthModal.css'

interface AuthModalProps {
  mode: 'login' | 'signup'
}

interface AuthModalState {
  /** หน้าที่จะพากลับหลังล็อกอินสำเร็จ — ตั้งจาก guard ที่ redirect มา /login (6 จุด) */
  from?: string
  /** หน้าที่จะพากลับเมื่อกดปิดกล่องเฉย ๆ — ตั้งจาก TopNav เท่านั้น
      แยกจาก `from` เพราะ `from` อาจเป็นหน้าที่มี guard (เช่น /profile) — ถ้าปิดกล่องแล้วเด้ง
      กลับไปที่นั่น จะโดน redirect วนกลับมา /login อีกรอบ */
  back?: string
}

// popup เข้าสู่ระบบ/สมัครสมาชิกลอยทับหน้าร้าน สไตล์ mebmarket.com — เปิดจาก URL
// (/login, /signup) ไม่ใช่ context เปิด-ปิดเอง เพราะ 6 จุดในระบบ redirect มา /login ตรง ๆ
// อยู่แล้วด้วย <Navigate state={{ from }} />, การอิงกับ route ทำให้จุดเหล่านั้นไม่ต้องแก้เลย
export default function AuthModal({ mode }: AuthModalProps) {
  const { user, isAuthenticated, initialising } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useToast()

  const state = (location.state ?? {}) as AuthModalState
  const { from, back } = state
  const boxRef = useRef<HTMLDivElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)

  // สลับ login/signup แล้วความสูงเนื้อหาต่างกันมาก (ฟอร์มสมัคร 7 ช่อง vs ล็อกอิน 2 ช่อง) —
  // รีเซ็ต scroll ในกล่องทุกครั้งที่โหมดเปลี่ยน กัน scroll ค้างจากฟอร์มก่อนหน้า
  useEffect(() => {
    boxRef.current?.scrollTo(0, 0)
  }, [mode])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(back ?? '/', { replace: true })
    }
    window.addEventListener('keydown', onKeyDown)
    // ฉากหลังเป็นหน้าร้านเต็มหน้า ถ้าไม่ล็อก scroll จะเลื่อนทะลุกล่องไปโดนหน้าหลังได้
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [navigate, back])

  // รีเฟรชหน้าขณะมี token ค้างอยู่ — อย่าเพิ่งโผล่กล่องจนกว่าจะรู้ว่าล็อกอินอยู่หรือเปล่า
  if (initialising) return null

  // เข้ามาที่ /login หรือ /signup ทั้งที่ล็อกอินอยู่แล้ว (เช่น พิมพ์ URL เอง) — เด้งออกทันที
  if (isAuthenticated && user) {
    return <Navigate to={isEmployee(user.role) ? '/admin' : (from ?? '/')} replace />
  }

  const close = () => navigate(back ?? '/', { replace: true })

  const switchTo = (nextMode: 'login' | 'signup') => {
    navigate(nextMode === 'login' ? '/login' : '/signup', { state, replace: true })
  }

  const handleLoginSuccess = (signedIn: AuthUser) => {
    navigate(isEmployee(signedIn.role) ? '/admin' : (from ?? back ?? '/'), { replace: true })
  }

  const handleVerified = () => {
    notify('success', 'ยืนยันตัวตนสำเร็จ กรุณาเข้าสู่ระบบ')
    navigate('/login', { state, replace: true })
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
      close()
    }
    mouseDownTargetRef.current = null
  }

  return (
    <div
      className="auth-modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={boxRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal__close" aria-label="ปิด" onClick={close}>
          <Icon name="close" size={20} />
        </button>

        {mode === 'login' ? (
          <LoginForm onSuccess={handleLoginSuccess} onSwitchToSignup={() => switchTo('signup')} />
        ) : (
          <SignUpForm
            onVerified={handleVerified}
            onSwitchToLogin={() => switchTo('login')}
            scrollTargetRef={boxRef}
          />
        )}
      </div>
    </div>
  )
}
