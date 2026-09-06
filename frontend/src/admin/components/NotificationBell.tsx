import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import type { Role } from '../../auth/roles'
import { useNotifications, type AppNotification } from '../notifications/NotificationContext'
import './NotificationBell.css'

// Only the in-app channel belongs in the bell; the simulated email copies show up in
// the การแจ้งเตือน tab of SCR-27 instead.
const inApp = (entry: AppNotification) => entry.channel === 'in-app'

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  return `${Math.round(hours / 24)} วันที่แล้ว`
}

export default function NotificationBell({ role }: { role: Role }) {
  const { listFor, markRead, markAllRead, loading, error, reload } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  const entries = listFor(role).filter(inApp)
  // ตัวเลขบนกระดิ่งอยู่บนแถบบนตลอด — ระหว่างโหลดหรือโหลดไม่สำเร็จให้ซ่อนไว้
  // ดีกว่าขึ้น 0 แล้วกระโดดเป็นเลขจริง หรือค้างเลขเก่าที่อาจไม่จริงแล้ว
  const unread = loading || error ? 0 : entries.filter((entry) => !entry.read).length
  // ป้ายกลมบนกระดิ่งกว้างพอสำหรับตัวเลขไม่เกิน 2 หลัก (ดีไซน์เดิม min-width 18px +
  // right:-8px) — เลข 3 หลักดันป้ายกว้างขึ้นจนล้ำทับไอคอนกระดิ่ง จึงตัดที่ 99 แทนที่จะโชว์ตัวเลขจริง
  const badgeLabel = unread > 99 ? '99' : String(unread)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // ทำเครื่องหมายว่าอ่านแล้วเป็นงานเบื้องหลัง ไม่ต้องรอก่อนพาผู้ใช้ไปหน้าปลายทาง
  // แต่ต้องดักไว้ ไม่งั้น promise ที่ reject จะกลายเป็น unhandled rejection ใน console
  const openEntry = (entry: AppNotification) => {
    void markRead(entry.id).catch(() => {
      // อ่านไม่สำเร็จไม่ใช่เรื่องที่ต้องขัดจังหวะผู้ใช้ · จุดแดงจะยังอยู่จนกว่าจะโหลดใหม่
    })
    setOpen(false)
    navigate(entry.link)
  }

  return (
    <div className="notif" ref={wrapper}>
      <button
        type="button"
        className="admin-bar__bell"
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="admin-bar__badge">{badgeLabel}</span>}
      </button>

      {open && (
        <div className="notif__panel" role="dialog" aria-label="การแจ้งเตือน">
          <div className="notif__head">
            <span>การแจ้งเตือน</span>
            {unread > 0 && (
              <button type="button" className="notif__mark" onClick={() => void markAllRead()}>
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {loading ? (
            <p className="notif__empty">กำลังโหลดการแจ้งเตือน…</p>
          ) : error ? (
            <p className="notif__empty">
              {error}{' '}
              <button type="button" className="notif__mark" onClick={() => void reload()}>
                ลองใหม่
              </button>
            </p>
          ) : entries.length === 0 ? (
            <p className="notif__empty">ยังไม่มีการแจ้งเตือน</p>
          ) : (
            <ul className="notif__list">
              {entries.slice(0, 12).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={'notif__item' + (entry.read ? '' : ' notif__item--unread')}
                    onClick={() => openEntry(entry)}
                  >
                    <span className="notif__title">{entry.title}</span>
                    <span className="notif__body">{entry.body}</span>
                    <span className="notif__time">{relative(entry.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
