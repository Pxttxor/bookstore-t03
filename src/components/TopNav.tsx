import { Link, NavLink } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import './TopNav.css'

interface TopNavProps {
  showSearch?: boolean
}

const LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Bestsellers', to: '/?filter=bestsellers' },
  { label: 'Categories', to: '/?filter=categories' },
  { label: 'Deals', to: '/?filter=deals' },
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TopNav({ showSearch = false }: TopNavProps) {
  const { user } = useAuth()
  const { count } = useCart()

  return (
    <header className="topnav">
      <div className="topnav__inner page-shell">
        <div className="topnav__left">
          <Link to="/" className="topnav__brand">
            BookHaven
          </Link>
          <nav className="topnav__links">
            {LINKS.map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  'topnav__link' + (isActive ? ' is-active' : '')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="topnav__right">
          {showSearch && (
            <label className="topnav__search">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Search books..." />
            </label>
          )}
          <button
            className="topnav__icon-btn"
            aria-label="Favorites"
            disabled
            title="ยังไม่เปิดใช้งานในเวอร์ชันนี้"
          >
            <Icon name="heart" size={20} />
          </button>
          <Link
            to="/checkout/shipping"
            className="topnav__icon-btn topnav__cart"
            aria-label="Cart"
          >
            <Icon name="cart" size={20} />
            {count > 0 && <span className="topnav__badge">{count}</span>}
          </Link>
          {user ? (
            <Link
              to="/profile"
              className="topnav__icon-btn topnav__avatar"
              aria-label="Your profile"
              title={user.name}
            >
              {initialsOf(user.name)}
            </Link>
          ) : (
            <Link
              to="/login"
              className="topnav__icon-btn"
              aria-label="Sign in to your account"
            >
              <Icon name="user" size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
