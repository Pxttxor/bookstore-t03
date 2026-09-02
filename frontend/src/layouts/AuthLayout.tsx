import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import AuthHeader from '../components/AuthHeader'
import './AuthLayout.css'

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <AuthHeader />
      <main className="auth-page">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="auth-footer">
        © {new Date().getFullYear()} BookHaven · Your curated online bookstore
      </footer>
    </div>
  )
}
