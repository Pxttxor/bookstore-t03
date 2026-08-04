import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Role } from './roles'

export interface AuthUser {
  name: string
  email: string
  role: Role
}

interface AuthValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => AuthUser
  register: (name: string, email: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

// No backend in this project, so accounts and the session live in localStorage.
// Passwords are kept as plain text because this is a demo only.
const ACCOUNTS_KEY = 'bookhaven.accounts'
const SESSION_KEY = 'bookhaven.user'

interface Account {
  name: string
  email: string
  password: string
  role: Role
}

const STAFF_ACCOUNTS: Account[] = [
  {
    name: 'สมชาย ใจดี',
    email: 'warehouse@bookhaven.co.th',
    password: 'staff1234',
    role: 'warehouse',
  },
  {
    name: 'ปิยะพร วงศ์ทอง',
    email: 'manager@bookhaven.co.th',
    password: 'staff1234',
    role: 'manager',
  },
  {
    name: 'ณัฐวุฒิ แสงจันทร์',
    email: 'sales@bookhaven.co.th',
    password: 'staff1234',
    role: 'sales',
  },
  {
    name: 'อรทัย พรมมา',
    email: 'delivery@bookhaven.co.th',
    password: 'staff1234',
    role: 'delivery',
  },
]

const normalise = (email: string) => email.trim().toLowerCase()

function parseAccounts(): Record<string, Account> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function readAccounts(): Record<string, Account> {
  const accounts = parseAccounts()

  // Staff cannot sign up through the site, so their accounts are seeded here.
  let seeded = false
  for (const staff of STAFF_ACCOUNTS) {
    const key = normalise(staff.email)
    if (!accounts[key]) {
      accounts[key] = staff
      seeded = true
    }
  }
  if (seeded) writeAccounts(accounts)

  return accounts
}

function writeAccounts(accounts: Record<string, Account>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    return { ...parsed, role: parsed.role ?? 'customer' }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readSession)

  const value = useMemo<AuthValue>(() => {
    const persist = (next: AuthUser | null) => {
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      else localStorage.removeItem(SESSION_KEY)
      setUser(next)
    }

    const login = (email: string, password: string) => {
      const key = normalise(email)
      const account = readAccounts()[key]
      if (!account) throw new Error('No account found for that email.')
      if (account.password !== password)
        throw new Error('Incorrect password. Please try again.')
      const signedIn: AuthUser = {
        name: account.name,
        email: account.email,
        role: account.role ?? 'customer',
      }
      persist(signedIn)
      return signedIn
    }

    const register = (name: string, email: string, password: string) => {
      const key = normalise(email)
      const accounts = readAccounts()
      if (accounts[key]) throw new Error('An account with that email already exists.')
      const account: Account = {
        name: name.trim(),
        email: key,
        password,
        role: 'customer',
      }
      accounts[key] = account
      writeAccounts(accounts)
      persist({ name: account.name, email: account.email, role: account.role })
    }

    const logout = () => persist(null)

    return { user, isAuthenticated: user !== null, login, register, logout }
  }, [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
