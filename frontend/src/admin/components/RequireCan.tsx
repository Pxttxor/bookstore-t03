import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import type { Role } from '../../auth/roles'
import EmptyState from './EmptyState'

interface RequireCanProps {
  allowed: (role: Role) => boolean
}

// Route-level guard: the sidebar already hides menu items outside a role's scope
// (AdminSidebar.tsx), but that does not stop someone from typing the URL directly.
// This closes that gap for the routes that have no page-level `can.*` check of their
// own — pages that already self-gate (e.g. ReorderAlertsPage) are left untouched.
export default function RequireCan({ allowed }: RequireCanProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user!.role

  if (!allowed(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์เข้าถึงหน้านี้"
            description="หน้านี้เป็นสิทธิ์ของบทบาทอื่นในระบบ"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  return <Outlet />
}
