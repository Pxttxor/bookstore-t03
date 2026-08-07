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
  const { listFor, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  const entries = listFor(role).filter(inApp)
  const unread = entries.filter((entry) => !entry.read).length

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const openEntry = (entry: AppNotification) => {
    markRead(entry.id)
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
        {unread > 0 && <span className="admin-bar__badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif__panel" role="dialog" aria-label="การแจ้งเตือน">
          <div className="notif__head">
            <span>การแจ้งเตือน</span>
            {unread > 0 && (
              <button type="button" className="notif__mark" onClick={() => markAllRead(role)}>
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {entries.length === 0 ? (
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
