import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../auth/AuthContext'
import { useNotifications, type AppNotification } from '../admin/notifications/NotificationContext'
import '../admin/components/NotificationBell.css'

const inApp = (entry: AppNotification) => entry.channel === 'in-app'

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  return `${Math.round(hours / 24)} วันที่แล้ว`
}

export default function CustomerNotificationBell() {
  const { user } = useAuth()
  const { listFor, markRead, markAllRead, loading, error, reload } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!user) return null

  const entries = listFor(user.role).filter(inApp)
  const unread = loading || error ? 0 : entries.filter((entry) => !entry.read).length
  const badgeLabel = unread > 99 ? '99' : String(unread)

  const openEntry = (entry: AppNotification) => {
    void markRead(entry.id).catch(() => {
      // ignore
    })
    setOpen(false)
    navigate(entry.link)
  }

  return (
    <div className="notif" ref={wrapper}>
      <button
        type="button"
        className="topnav__icon-btn"
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title="การแจ้งเตือน"
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="topnav__badge">{badgeLabel}</span>}
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
              {entries.slice(0, 15).map((entry) => (
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
