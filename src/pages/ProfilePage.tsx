import { Link, Navigate, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import './ProfilePage.css'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // only signed-in members can open their profile
  if (!user) return <Navigate to="/login" replace state={{ from: '/profile' }} />

  const signOut = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="profile page-shell">
      <section className="profile__hero">
        <span className="profile__avatar" aria-hidden="true">
          {initialsOf(user.name)}
        </span>
        <div className="profile__id">
          <h1 className="profile__name">{user.name}</h1>
          <p className="profile__email">{user.email}</p>
          <span className="profile__badge">
            <Icon name="check-circle" size={16} />
            BookHaven Member
          </span>
        </div>
      </section>

      <div className="profile__grid">
        <section className="profile__card">
          <h2 className="profile__card-title">
            <Icon name="user" size={20} />
            Account Details
          </h2>
          <dl className="profile__details">
            <div className="profile__row">
              <dt>Full Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="profile__row">
              <dt>Email Address</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="profile__row">
              <dt>Password</dt>
              <dd>••••••••</dd>
            </div>
          </dl>
          <button
            type="button"
            className="btn btn-ghost profile__edit"
            disabled
            title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
          >
            <Icon name="edit" size={16} />
            Edit Profile
          </button>
        </section>

        <section className="profile__card">
          <h2 className="profile__card-title">
            <Icon name="package" size={20} />
            Quick Links
          </h2>
          <nav className="profile__links">
            <Link to="/orders" className="profile__link">
              <Icon name="clock" size={18} />
              <span>Order History</span>
              <Icon name="arrow-right" size={16} />
            </Link>
            <span
              className="profile__link profile__link--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="heart" size={18} />
              <span>My Wishlist</span>
              <em className="profile__soon">เร็ว ๆ นี้</em>
            </span>
            <span
              className="profile__link profile__link--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="truck" size={18} />
              <span>Saved Addresses</span>
              <em className="profile__soon">เร็ว ๆ นี้</em>
            </span>
          </nav>
          <button type="button" className="profile__signout" onClick={signOut}>
            <Icon name="log-out" size={18} />
            Sign Out
          </button>
        </section>
      </div>
    </div>
  )
}
