import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth, type AuthUser } from '../../auth/AuthContext'
import { ROLE_LABELS } from '../../auth/roles'
import NotificationBell from './NotificationBell'
import './AdminTopBar.css'

export default function AdminTopBar({ user }: { user: AuthUser }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user.name.trim().charAt(0) || 'U'

  return (
    <header className="admin-bar">
      <Link to="/admin" className="admin-bar__brand">
        <Icon name="book" size={24} />
        <span>BookHaven Back Office</span>
      </Link>

      <label className="admin-bar__search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="ค้นหาทั้งระบบ" aria-label="ค้นหาทั้งระบบ" />
      </label>

      <div className="admin-bar__side">
        <NotificationBell role={user.role} />

        <div className="admin-bar__user">
          <span className="admin-bar__avatar">{initials}</span>
          <span className="admin-bar__meta">
            <span className="admin-bar__name">{user.name}</span>
            <span className="admin-bar__role">{ROLE_LABELS[user.role]}</span>
          </span>
        </div>

        <button type="button" className="admin-bar__logout" onClick={signOut}>
          <Icon name="log-out" size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </header>
  )
}
