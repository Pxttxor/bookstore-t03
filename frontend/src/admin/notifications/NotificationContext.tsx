import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import type { Role } from '../../auth/roles'

// ข้อมูลอยู่ในตาราง notification ของ PostgreSQL
//
// **หน้าจอไม่สร้างการแจ้งเตือนเองอีกแล้ว** — เซิร์ฟเวอร์เขียนแถวให้ในทรานแซกชันเดียวกับ
// งานธุรกิจที่เป็นต้นเหตุ (อนุมัติใบขอสั่งซื้อ · รับสินค้า · ตรวจนับพบผลต่าง · เปลี่ยนสถานะ
// คำสั่งซื้อ) ถ้าหน้าจอ push ซ้ำจะได้แถวซ้ำสองเท่า · เมธอด `push` จึงถูกถอดออก
const loadNotifications = () => apiGet<AppNotification[]>('/api/notifications')

export type NotificationKind =
  | 'REORDER_ALERT'
  | 'PR_SUBMITTED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'GR_RECORDED'
  | 'RETURN_ESCALATED'
  // Inventory subsystem — a counting round found a variance.
  | 'STOCK_DISCREPANCY'
  // Inventory subsystem — a warehouse employee adjusted stock manually.
  | 'STOCK_ADJUSTED'
  // Book catalogue edits are routed to the manager.
  | 'BOOK_UPDATED'
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

interface NotificationValue {
  notifications: AppNotification[]
  loading: boolean
  error: string | null
  /** เรียกหลังงานที่ทำให้เซิร์ฟเวอร์ออกแจ้งเตือนใหม่ */
  reload: () => Promise<void>
  listFor: (role: Role) => AppNotification[]
  unreadCountFor: (role: Role) => number
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationValue | null>(null)

const newest = (a: AppNotification, b: AppNotification) =>
  b.createdAt.localeCompare(a.createdAt) || b.id - a.id

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // โหลดการแจ้งเตือนสำหรับผู้ใช้ที่ล็อกอินแล้วทั้งหมด (ทั้งพนักงานและลูกค้า)
  const enabled = user !== null
  const { data, loading, error, reload, apply } = useResource(loadNotifications, enabled)

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => void reload(), 10000)
    return () => window.clearInterval(timer)
  }, [enabled, reload])

  const value = useMemo<NotificationValue>(() => {
    const notifications = data ?? []

    return {
      notifications,
      loading,
      error,
      reload,

      // เซิร์ฟเวอร์กรองตามบทบาทของผู้เรียกให้อยู่แล้ว กรองซ้ำที่นี่เพื่อคงสัญญาเดิมของหน้าจอ
      listFor: (role: Role) =>
        notifications.filter((entry) => entry.to === role).sort(newest),

      unreadCountFor: (role: Role) =>
        notifications.filter((entry) => entry.to === role && !entry.read).length,

      // ทั้งสองเส้นทางตอบ 204 ไม่มีเนื้อหา · ผลที่เกิดคือธง read เท่านั้น
      // จึงพลิกธงในชุดที่ถืออยู่ได้เลย ไม่ต้องดึงรายการแจ้งเตือนทั้งกองใหม่
      markRead: async (id: number) => {
        await apiPost(`/api/notifications/${id}/read`)
        apply((list) =>
          list.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)),
        )
      },

      // บทบาทมาจาก JWT — เส้นทางนี้ปิดเฉพาะของผู้เรียกเท่านั้น
      // ชุดที่ถืออยู่ก็เป็นของบทบาทนั้นอยู่แล้ว (เซิร์ฟเวอร์กรองมาให้) จึงพลิกได้ทั้งชุด
      markAllRead: async () => {
        await apiPost('/api/notifications/read-all')
        apply((list) => list.map((entry) => (entry.read ? entry : { ...entry, read: true })))
      },
    }
  }, [data, loading, error, reload, apply])

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
