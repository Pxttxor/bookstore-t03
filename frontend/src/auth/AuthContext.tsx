import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiGet, apiPost, setUnauthorizedHandler, tokenStore } from '../api/client'
import type { Role } from './roles'

export interface AuthUser {
  name: string
  email: string
  role: Role
  customerId?: number
  personId?: number
  employeeId?: string
}

// Identity ที่ backend ส่งกลับ (service.Identity)
interface LoginResult {
  token: string
  user: AuthUser
}

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  password: string
}

interface AuthValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** ยืนยัน token เดิมกับเซิร์ฟเวอร์อยู่ — ยังไม่รู้ว่าล็อกอินอยู่หรือเปล่า */
  initialising: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<void>
  verifyOtp: (email: string, otp: string, registrationData?: RegisterInput) => Promise<void>
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  // ถ้ามี token ค้างอยู่ต้องถามเซิร์ฟเวอร์ก่อนว่ายังใช้ได้ไหม (อายุ 12 ชม.)
  // ระหว่างนั้น AdminLayout ต้องไม่เด้งออกไปหน้าเข้าสู่ระบบ
  const [initialising, setInitialising] = useState(() => tokenStore.get() !== null)

  const signOut = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  // token หมดอายุกลางทาง — client.ts เรียกตัวนี้เมื่อ API ตอบ 401
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (!tokenStore.get()) return

    let cancelled = false
    // GET /api/auth/me อ่านแถวจริง ไม่ใช่ค่าใน token — ชื่อหรือบทบาทที่เปลี่ยนไปจะได้ตรง
    apiGet<AuthUser>('/api/auth/me')
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        // token เสียหรือหมดอายุ — client.ts ล้างให้แล้วตอนได้ 401
        tokenStore.clear()
      })
      .finally(() => {
        if (!cancelled) setInitialising(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthValue>(() => {
    const login = async (email: string, password: string) => {
      const result = await apiPost<LoginResult>('/api/auth/login', {
        email: email.trim(),
        password,
      })
      tokenStore.set(result.token)
      setUser(result.user)
      return result.user
    }

    // ตรวจสอบข้อมูลและขอรับรหัส OTP — backend จะยังไม่บันทึกข้อมูลลงระบบจนกว่าจะยืนยัน OTP
    // username ใช้อีเมลไปเลย หน้าจอไม่ได้ถามแยก
    const register = async (input: RegisterInput) => {
      await apiPost('/api/auth/register', {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        username: input.email.trim(),
        password: input.password,
      })
    }

    const verifyOtp = async (email: string, otp: string, registrationData?: RegisterInput) => {
      await apiPost('/api/auth/verify-otp', {
        email: email.trim(),
        otp: otp.trim(),
        ...(registrationData
          ? {
              firstName: registrationData.firstName.trim(),
              lastName: registrationData.lastName.trim(),
              phone: registrationData.phone.trim(),
              address: registrationData.address.trim(),
              username: registrationData.email.trim(),
              password: registrationData.password,
            }
          : {}),
      })
    }

    const refreshUser = async () => {
      try {
        const current = await apiGet<AuthUser>('/api/auth/me')
        setUser(current)
      } catch {
        // ignore
      }
    }

    return {
      user,
      isAuthenticated: user !== null,
      initialising,
      login,
      register,
      verifyOtp,
      refreshUser,
      logout: signOut,
    }
  }, [user, initialising, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
