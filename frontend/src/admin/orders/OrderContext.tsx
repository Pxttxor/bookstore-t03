import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { useNotifications } from '../notifications/NotificationContext'
import { STOREFRONT_BOOK_IDS, type CustomerOrder, type OrderStatus } from './orders'

// ข้อมูลอยู่ในตาราง customer_order / customer_order_item /
// customer_order_status_history ของ PostgreSQL แล้ว
// (ชื่อตารางเป็น customer_order ไม่ใช่ order เพราะ ORDER เป็นคำสงวนของ SQL)
// เดิมเก็บใน localStorage คีย์ bookhaven.orders.v1
//
// เซิร์ฟเวอร์กรองให้ตามผู้เรียกอยู่แล้ว: พนักงานเห็นทุกใบ ลูกค้าเห็นเฉพาะของตัวเอง
const loadOrders = () => apiGet<CustomerOrder[]>('/api/orders')

export interface OrderDraft {
  shippingAddress: string
  /** slug ของหน้าร้าน — แปลงเป็นรหัสหนังสือของแคตตาล็อกหลังก่อนส่ง */
  items: { slug: string; quantity: number }[]
  slipFileName?: string
}

export interface StatusChangeOpts {
  note?: string
  /** Required when moving to SHIPPED — the delivery staff records these. */
  tracking?: string
  carrierId?: number
}

interface OrderValue {
  orders: CustomerOrder[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findOrder: (orderId: number) => CustomerOrder | undefined
  /** Customer.placeOrder() — เซิร์ฟเวอร์คิดราคาจากตาราง book และแจ้งฝ่ายขายให้เอง */
  placeOrder: (draft: OrderDraft) => Promise<CustomerOrder>
  /**
   * Order.updateStatus(s)
   *
   * backend ไม่มีเส้นทางเปลี่ยนสถานะแบบรวม — แต่ละก้าวมี endpoint ของตัวเองพร้อม role guard
   * และเขียน timeline + แจ้งเตือน (+ ตัดสต็อกตอนแพ็ก) ในทรานแซกชันเดียว
   * ตารางข้างล่างจึงแปลงสถานะปลายทางเป็น endpoint ที่ถูกต้อง
   */
  updateStatus: (
    orderId: number,
    next: OrderStatus,
    opts?: StatusChangeOpts,
  ) => Promise<void>
}

const OrderContext = createContext<OrderValue | null>(null)

// สถานะปลายทาง → เส้นทางที่ต้องเรียก (ดู registerOrderRoutes ใน backend/internal/handler/order.go)
const STATUS_ROUTES: Record<OrderStatus, string | null> = {
  STOCK_CONFIRMED: 'confirm-stock',
  WAITING_PAYMENT: 'await-payment',
  VERIFYING_PAYMENT: 'payment',
  PAID: 'verify-payment',
  REJECTED: 'reject-payment',
  PACKING: 'pack',
  READY_TO_SHIP: 'ready',
  SHIPPED: 'ship',
  DELIVERED: 'deliver',
  CANCELLED: 'cancel',
  // สถานะตั้งต้นเกิดตอนสร้างใบ ไม่มีเส้นทางให้ย้อนกลับมา
  PENDING_CONFIRM: null,
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { reload: reloadNotifications } = useNotifications()

  // Provider นี้อยู่ที่ main.tsx จึงครอบหน้าร้านด้วย · ผู้ที่ยังไม่ล็อกอินไม่มี token
  // จะได้ 401 ทุกครั้งที่เปิดหน้าแรก จึงยิงเฉพาะตอนล็อกอินแล้ว
  const { data, loading, error, reload } = useResource(loadOrders, user !== null)

  const value = useMemo<OrderValue>(() => {
    const orders = data ?? []

    // ทุกก้าวของคำสั่งซื้อทำให้เซิร์ฟเวอร์ออกแจ้งเตือนอย่างน้อยหนึ่งใบ
    const refresh = async () => {
      await Promise.all([reload(), reloadNotifications()])
    }

    const placeOrder = async (draft: OrderDraft) => {
      const items = draft.items.map((line) => {
        const bookId = STOREFRONT_BOOK_IDS[line.slug]
        if (bookId === undefined) {
          throw new Error(`ไม่พบหนังสือ ${line.slug} ในแคตตาล็อกของระบบ`)
        }
        return { bookId, quantity: line.quantity }
      })

      // customerId / channel เซิร์ฟเวอร์เติมให้เองเมื่อผู้เรียกเป็นลูกค้าที่ล็อกอินอยู่
      // ยอดเงินก็คิดจากราคาในตาราง book ไม่ใช่ค่าที่หน้าจอส่งไป
      const order = await apiPost<CustomerOrder>('/api/orders', {
        shippingAddress: draft.shippingAddress,
        slipFileName: draft.slipFileName ?? '',
        items,
      })
      await refresh()
      return order
    }

    const updateStatus = async (
      orderId: number,
      next: OrderStatus,
      opts: StatusChangeOpts = {},
    ) => {
      const route = STATUS_ROUTES[next]
      if (!route) throw new Error(`เปลี่ยนสถานะไป ${next} ไม่ได้`)

      // body ต้องตรงกับ struct ของแต่ละ endpoint เป๊ะ ๆ — `httpx.Decode` เปิด
      // DisallowUnknownFields ไว้ ส่ง note ไปให้เส้นทางที่ไม่รับจะได้ 422 ทันที
      // เส้นทางที่ไม่อ่าน body เลย (confirm-stock · await-payment · verify-payment ·
      // pack · ready · deliver) รับ {} ได้ตามปกติ
      let body: Record<string, unknown> = {}
      if (next === 'SHIPPED') {
        // POST /api/orders/{id}/ship เปิดแถว shipment ในทรานแซกชันเดียวกัน จึงต้องมี body
        // recipientName เว้นได้ ระบบเติมชื่อลูกค้าให้
        body = {
          carrierId: opts.carrierId ?? 1,
          trackingNumber: opts.tracking?.trim() ?? '',
        }
      } else if (next === 'CANCELLED' || next === 'REJECTED') {
        body = { note: opts.note ?? '' }
      } else if (next === 'VERIFYING_PAYMENT') {
        body = { slipFileName: opts.note ?? '' }
      }

      await apiPost(`/api/orders/${orderId}/${route}`, body)
      await refresh()
    }

    return {
      orders,
      loading,
      error,
      reload,
      findOrder: (orderId: number) => orders.find((o) => o.orderId === orderId),
      placeOrder,
      updateStatus,
    }
  }, [data, loading, error, reload, reloadNotifications])

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrders(): OrderValue {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders must be used within an OrderProvider')
  return ctx
}
