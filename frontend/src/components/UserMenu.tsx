import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuth, type AuthUser } from '../auth/AuthContext'
import './UserMenu.css'

interface UserMenuProps {
  user: AuthUser
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ป็อปอัปเมนูสมาชิกที่ห้อยลงมาจากไอคอนอวาตาร์บน TopNav แทนการเด้งไปหน้า /profile ตรง ๆ
// (สไตล์ mebmarket.com ตามภาพที่ผู้ใช้ส่งมา, คำขอ 7 ก.ย. 69) — หน้า /profile ยังอยู่ครบ
// เป็นปลายทางของรายการ "ข้อมูลสมาชิก" รายการและป้ายไทยที่เหลือยกมาจาก "ทางลัด" ของ
// ProfilePage ทุกตัว ไม่ได้เพิ่มของใหม่
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
    // navigate ก่อน logout() เสมอ — ถ้าสลับกัน `user` จะกลายเป็น null ขณะเมนูนี้ยังลอยอยู่บน
    // หน้าที่มี guard (เช่น ProfilePage, OrderHistoryPage) ทำให้ guard ของหน้านั้นแทรกเด้งไป
    // /login ก่อนที่ navigate('/') ของเราจะมีผล — เจอจริงตอนทดสอบออกจากระบบจากหน้า /profile
    navigate('/', { replace: true })
    logout()
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
            <Link to="/profile" className="user-menu__item" onClick={close}>
              <Icon name="user" size={18} />
              <span>ข้อมูลสมาชิก</span>
            </Link>
            <Link to="/orders" className="user-menu__item" onClick={close}>
              <Icon name="clock" size={18} />
              <span>ประวัติการสั่งซื้อ</span>
            </Link>
            <Link to="/member/points" className="user-menu__item" onClick={close}>
              <Icon name="award" size={18} />
              <span>แต้มสะสมของฉัน</span>
            </Link>
            <Link to="/member/rewards" className="user-menu__item" onClick={close}>
              <Icon name="gift" size={18} />
              <span>แลกของรางวัล</span>
            </Link>
            <span
              className="user-menu__item user-menu__item--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="heart" size={18} />
              <span>รายการโปรดของฉัน</span>
              <em className="user-menu__soon">เร็ว ๆ นี้</em>
            </span>
            <span
              className="user-menu__item user-menu__item--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="truck" size={18} />
              <span>สมุดที่อยู่จัดส่ง</span>
              <em className="user-menu__soon">เร็ว ๆ นี้</em>
            </span>
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
