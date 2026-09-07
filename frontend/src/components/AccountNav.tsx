import { startTransition } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { ACCOUNT_MENU, ACCOUNT_MENU_SOON_TITLE } from './accountMenu'
import { initialsOf } from '../data/initials'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import './AccountNav.css'

interface AccountNavProps {
  user: AuthUser
}

// แถบเมนูซ้ายของหน้าบัญชี (/profile, /orders, /member/points, /member/rewards) — ค้างอยู่
// ทุกหน้าแบบตัวอย่าง SE-ED ที่ผู้ใช้ส่งมา (คำขอ 7 ก.ย. 69) หัวแถบเก็บสิ่งที่เคยเป็น
// "profile__hero" ของ ProfilePage เดิม (อวาตาร์ · ชื่อ · อีเมล · ป้าย BookHaven Member)
// รายการเมนูมาจาก ACCOUNT_MENU ชุดเดียวกับที่ UserMenu (ดรอปดาวน์บน TopNav) ใช้
export default function AccountNav({ user }: AccountNavProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    // navigate() ของ react-router ใช้ startTransition ภายในตัวเอง ทำให้การอัปเดต location
    // ของมันมีลำดับความสำคัญต่ำกว่า setState ธรรมดา — ถ้าเรียก navigate('/') แล้ว logout()
    // แยกกันเฉย ๆ (แม้ navigate มาก่อน) setUser(null) จาก logout() จะ commit render ก่อน
    // ในขณะที่ location ยังเป็น /profile อยู่ (ยืนยันด้วย console.log จริงในเบราว์เซอร์) ทำให้
    // guard ของ AccountLayout แทรกเด้งไป /login แทนที่จะเป็น / ที่ตั้งใจ — ห่อทั้งคู่ด้วย
    // startTransition เดียวกันให้ทั้งสอง state update commit พร้อมกันจึงแก้ได้จริง
    // (ต่างจาก flushSync ซึ่งบังคับ transition ให้เป็น sync ไม่ได้ — ลองแล้วไม่ช่วย)
    startTransition(() => {
      navigate('/', { replace: true })
      logout()
    })
  }

  return (
    <aside className="account-nav">
      <div className="account-nav__head">
        <span className="account-nav__avatar" aria-hidden="true">
          {initialsOf(user.name)}
        </span>
        <span className="account-nav__name">{user.name}</span>
        <span className="account-nav__email">{user.email}</span>
        <span className="account-nav__badge">
          <Icon name="check-circle" size={14} />
          BookHaven Member
        </span>
      </div>

      <nav className="account-nav__list">
        {ACCOUNT_MENU.map((item) =>
          item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end
              className={({ isActive }) =>
                'account-nav__link' + (isActive ? ' account-nav__link--active' : '')
              }
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ) : (
            <span
              key={item.label}
              className="account-nav__link account-nav__link--soon"
              aria-disabled="true"
              title={ACCOUNT_MENU_SOON_TITLE}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              <em className="account-nav__soon">เร็ว ๆ นี้</em>
            </span>
          ),
        )}
      </nav>

      <button type="button" className="account-nav__signout" onClick={signOut}>
        <Icon name="log-out" size={18} />
        ออกจากระบบ
      </button>
    </aside>
  )
}
