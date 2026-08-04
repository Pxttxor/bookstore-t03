import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '../../auth/roles'

const STORAGE_KEY = 'bookhaven.notifications.v1'

export type NotificationKind =
  | 'REORDER_ALERT'
  | 'PR_SUBMITTED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'GR_RECORDED'
  | 'RETURN_ESCALATED'
  // Customer-order flow (Order / Delivery subsystems).
  | 'ORDER_PLACED'
  | 'ORDER_READY_TO_SHIP'
  | 'ORDER_DELIVERED'

// "อีเมล" entries are simulated: they are recorded so SCR-27 can show the document
// routing that actually happened, but nothing is ever sent.
export type NotificationChannel = 'in-app' | 'email'

export interface AppNotification {
  id: number
  to: Role
  kind: NotificationKind
  title: string
  body: string
  link: string
  channel: NotificationChannel
  read: boolean
  createdAt: string
}

export type NotificationDraft = Omit<AppNotification, 'id' | 'read' | 'createdAt'>

interface NotificationValue {
  notifications: AppNotification[]
  listFor: (role: Role) => AppNotification[]
  unreadCountFor: (role: Role) => number
  /** Records one or more entries as a single write, e.g. in-app plus email. */
  push: (drafts: NotificationDraft[]) => void
  markRead: (id: number) => void
  markAllRead: (role: Role) => void
}

const NotificationContext = createContext<NotificationValue | null>(null)

function read(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AppNotification[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

const newest = (a: AppNotification, b: AppNotification) =>
  b.createdAt.localeCompare(a.createdAt) || b.id - a.id

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(read)

  const value = useMemo<NotificationValue>(() => {
    const persist = (next: AppNotification[]) => {
      write(next)
      setNotifications(next)
    }

    const listFor = (role: Role) =>
      notifications.filter((entry) => entry.to === role).sort(newest)

    return {
      notifications,
      listFor,
      unreadCountFor: (role) =>
        notifications.filter((entry) => entry.to === role && !entry.read).length,

      push: (drafts) => {
        if (!drafts.length) return
        const createdAt = new Date().toISOString()
        let nextId = notifications.reduce((max, entry) => Math.max(max, entry.id), 0) + 1
        persist([
          ...notifications,
          ...drafts.map<AppNotification>((draft) => ({
            ...draft,
            id: nextId++,
            read: false,
            createdAt,
          })),
        ])
      },

      markRead: (id) =>
        persist(
          notifications.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
        ),

      markAllRead: (role) =>
        persist(
          notifications.map((entry) => (entry.to === role ? { ...entry, read: true } : entry)),
        ),
    }
  }, [notifications])

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider')
  return ctx
}
