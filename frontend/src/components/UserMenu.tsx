import { startTransition, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { ACCOUNT_MENU, ACCOUNT_MENU_SOON_TITLE } from './accountMenu'
import { initialsOf } from '../data/initials'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import './UserMenu.css'

interface UserMenuProps {
  user: AuthUser
}

// ป็อปอัปเมนูสมาชิกที่ห้อยลงมาจากไอคอนอวาตาร์บน TopNav แทนการเด้งไปหน้า /profile ตรง ๆ
// (สไตล์ mebmarket.com ตามภาพที่ผู้ใช้ส่งมา, คำขอ 7 ก.ย. 69) — หน้า /profile ยังอยู่ครบ
// เป็นปลายทางของรายการ "ข้อมูลสมาชิก" รายการและป้ายไทยที่เหลือมาจาก ACCOUNT_MENU
// (แหล่งเดียวกับแถบเมนูซ้ายของหน้าบัญชี — ดู components/accountMenu.ts)
export default function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const close = () => setOpen(false)

  const signOut = () => {
    close()
    // navigate() ของ react-router ใช้ startTransition ภายในตัวเอง ทำให้การอัปเดต location
    // ของมันมีลำดับความสำคัญต่ำกว่า setState ธรรมดา — ถ้าเรียก navigate('/') แล้ว logout()
    // แยกกันเฉย ๆ (แม้ navigate มาก่อน) setUser(null) จาก logout() จะ commit render ก่อน
    // ในขณะที่ location ยังเป็นหน้าเดิมอยู่ (ยืนยันด้วย console.log จริงในเบราว์เซอร์) ทำให้
    // guard ของหน้าที่มี ProfilePage/OrderHistoryPage/AccountLayout แทรกเด้งไป /login แทนที่
    // จะเป็น / ที่ตั้งใจ — ห่อทั้งคู่ด้วย startTransition เดียวกันให้ทั้งสอง state update
    // commit พร้อมกันจึงแก้ได้จริง (ต่างจาก flushSync ซึ่งบังคับ transition ให้เป็น sync ไม่ได้)
    startTransition(() => {
      navigate('/', { replace: true })
      logout()
    })
  }

  return (
    <div className="user-menu" ref={wrapper}>
      <button
        type="button"
        className="topnav__icon-btn topnav__avatar"
        aria-label="บัญชีของฉัน"
        aria-expanded={open}
        title={user.name}
        onClick={() => setOpen((value) => !value)}
      >
        {initialsOf(user.name)}
      </button>

      {open && (
        <div className="user-menu__panel" role="dialog" aria-label="เมนูบัญชีของฉัน">
          <div className="user-menu__head">
            <span className="user-menu__avatar" aria-hidden="true">
              {initialsOf(user.name)}
            </span>
            <span className="user-menu__id">
              <span className="user-menu__name">{user.name}</span>
              <span className="user-menu__email">{user.email}</span>
            </span>
          </div>

          <nav className="user-menu__list">
            {ACCOUNT_MENU.map((item) =>
              item.to ? (
                <Link key={item.label} to={item.to} className="user-menu__item" onClick={close}>
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  key={item.label}
                  className="user-menu__item user-menu__item--soon"
                  aria-disabled="true"
                  title={ACCOUNT_MENU_SOON_TITLE}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  <em className="user-menu__soon">เร็ว ๆ นี้</em>
                </span>
              ),
            )}
          </nav>

          <button type="button" className="user-menu__signout" onClick={signOut}>
            <Icon name="log-out" size={18} />
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  )
}
