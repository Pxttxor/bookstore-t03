import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from './Icon'
import UserMenu from './UserMenu'
import CustomerNotificationBell from './CustomerNotificationBell'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import './TopNav.css'

interface TopNavProps {
  showSearch?: boolean
}

const LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Bestsellers', to: '/?filter=bestsellers' },
  { label: 'Deals', to: '/promotions' },
]

export default function TopNav({ showSearch = false }: TopNavProps) {
  const { user } = useAuth()
  const { count } = useCart()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const query = params.get('q') ?? ''
  const currentFilter = params.get('filter')

  // ค้นหาที่ TopNav พาไปโชว์ผลบน grid หน้าหลัก — sync กับ ?q= เส้นเดียว
  const onSearch = (value: string) => {
    navigate(value ? `/?q=${encodeURIComponent(value)}` : '/', { replace: true })
  }

  return (
    <header className="topnav">
      <div className="topnav__inner page-shell">
        <div className="topnav__left">
          <Link to="/" className="topnav__brand">
            BookHaven
          </Link>
          <nav className="topnav__links">
            {LINKS.map((l) => {
              const isActive =
                l.to === '/'
                  ? location.pathname === '/' && !currentFilter && !query
                  : l.to.startsWith('/?filter=')
                    ? location.pathname === '/' && currentFilter === l.to.split('=')[1]
                    : l.to === '/promotions'
                      ? location.pathname === '/promotions' || location.pathname === '/deals'
                      : location.pathname === l.to

              return (
                <Link
                  key={l.label}
                  to={l.to}
                  className={'topnav__link' + (isActive ? ' is-active' : '')}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="topnav__right">
          {showSearch && (
            <label className="topnav__search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="ค้นหาหนังสือ..."
                aria-label="ค้นหาหนังสือ"
              />
            </label>
          )}
          <button
            className="topnav__icon-btn"
            aria-label="รายการโปรด"
            disabled
            title="ยังไม่เปิดใช้งานในเวอร์ชันนี้"
          >
            <Icon name="heart" size={20} />
          </button>
          <Link
            to={user ? '/checkout/shipping' : '/login'}
            state={user ? undefined : { from: '/checkout/shipping', back: location.pathname + location.search }}
            className="topnav__icon-btn topnav__cart"
            aria-label="ตะกร้าสินค้า"
          >
            <Icon name="cart" size={20} />
            {count > 0 && <span className="topnav__badge">{count}</span>}
          </Link>
          {user && <CustomerNotificationBell />}
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              to="/login"
              state={{ back: location.pathname + location.search }}
              className="topnav__icon-btn"
              aria-label="เข้าสู่ระบบ"
            >
              <Icon name="user" size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
