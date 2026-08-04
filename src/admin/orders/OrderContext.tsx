import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  useNotifications,
  type NotificationDraft,
} from '../notifications/NotificationContext'
import {
  canTransition,
  formatOrderCode,
  orderItemCount,
  SEED_ORDERS,
  type CustomerOrder,
  type OrderItem,
  type OrderStatus,
} from './orders'

const STORAGE_KEY = 'bookhaven.orders.v1'

export interface OrderDraft {
  customerName: string
  customerEmail?: string
  shippingAddress: string
  items: OrderItem[]
  subtotal: number
  discountAmount?: number
  netAmount: number
  slipFileName?: string
}

export interface StatusChangeOpts {
  note?: string
  /** Required when moving to SHIPPED — the delivery staff records these. */
  tracking?: string
  carrier?: string
}

interface OrderValue {
  orders: CustomerOrder[]
  findOrder: (orderId: number) => CustomerOrder | undefined
  /** Customer.placeOrder(): records a WEBSITE order and alerts the sales staff. */
  placeOrder: (draft: OrderDraft) => CustomerOrder
  /** Order.updateStatus(s): guarded transition + timeline entry + role notifications. */
  updateStatus: (orderId: number, next: OrderStatus, opts?: StatusChangeOpts) => CustomerOrder
}

const OrderContext = createContext<OrderValue | null>(null)

function read(): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED_ORDERS
    const parsed = JSON.parse(raw) as CustomerOrder[]
    return Array.isArray(parsed) ? parsed : SEED_ORDERS
  } catch {
    return SEED_ORDERS
  }
}

function write(orders: CustomerOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

const today = () => new Date().toISOString().slice(0, 10)

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<CustomerOrder[]>(read)
  const { push } = useNotifications()

  const value = useMemo<OrderValue>(() => {
    const persist = (next: CustomerOrder[]) => {
      write(next)
      setOrders(next)
    }

    const findOrder = (orderId: number) => orders.find((o) => o.orderId === orderId)

    const notifyBoth = (
      to: NotificationDraft['to'],
      kind: NotificationDraft['kind'],
      title: string,
      body: string,
      link: string,
    ) =>
      push(
        (['in-app', 'email'] as NotificationDraft['channel'][]).map((channel) => ({
          to,
          kind,
          title,
          body,
          link,
          channel,
        })),
      )

    const placeOrder = (draft: OrderDraft) => {
      const orderId = orders.reduce((max, o) => Math.max(max, o.orderId), 1000) + 1
      const now = new Date().toISOString()
      const order: CustomerOrder = {
        orderId,
        channel: 'WEBSITE',
        orderDate: today(),
        customerName: draft.customerName,
        customerEmail: draft.customerEmail,
        shippingAddress: draft.shippingAddress,
        status: 'PENDING_CONFIRM',
        subtotal: draft.subtotal,
        discountAmount: draft.discountAmount ?? 0,
        netAmount: draft.netAmount,
        slipFileName: draft.slipFileName,
        items: draft.items,
        timeline: [{ status: 'PENDING_CONFIRM', changedDate: now }],
      }

      persist([...orders, order])

      notifyBoth(
        'sales',
        'ORDER_PLACED',
        'มีคำสั่งซื้อใหม่จากลูกค้า',
        `${formatOrderCode(orderId)} · ${order.customerName} · ${orderItemCount(order)} เล่ม · ` +
          `รอยืนยันคำสั่งซื้อและตรวจสอบการชำระเงิน`,
        `/admin/orders/${orderId}`,
      )
      return order
    }

    const updateStatus = (orderId: number, next: OrderStatus, opts: StatusChangeOpts = {}) => {
      const current = findOrder(orderId)
      if (!current) throw new Error('ไม่พบคำสั่งซื้อ')
      if (!canTransition(current.status, next)) {
        throw new Error(`เปลี่ยนสถานะจาก ${current.status} ไป ${next} ไม่ได้`)
      }

      const now = new Date().toISOString()
      const updated: CustomerOrder = {
        ...current,
        status: next,
        timeline: [...current.timeline, { status: next, changedDate: now, note: opts.note }],
      }

      if (next === 'SHIPPED') {
        updated.shipment = {
          trackingNumber: opts.tracking?.trim() || `TH-${orderId}`,
          carrier: opts.carrier ?? 'ไปรษณีย์ไทย',
          recipientName: current.customerName,
          shippedDate: today(),
          status: 'SHIPPED',
        }
      }
      if (next === 'DELIVERED' && updated.shipment) {
        updated.shipment = { ...updated.shipment, status: 'DELIVERED' }
      }

      persist(orders.map((o) => (o.orderId === orderId ? updated : o)))

      if (next === 'READY_TO_SHIP') {
        notifyBoth(
          'delivery',
          'ORDER_READY_TO_SHIP',
          'มีพัสดุพร้อมจัดส่ง',
          `${formatOrderCode(orderId)} · ${updated.customerName} · ${orderItemCount(updated)} เล่ม · แพ็กเสร็จ พร้อมนำจ่าย`,
          `/admin/orders/${orderId}`,
        )
      }
      if (next === 'DELIVERED') {
        notifyBoth(
          'sales',
          'ORDER_DELIVERED',
          'จัดส่งสำเร็จ',
          `${formatOrderCode(orderId)} · ${updated.customerName} · พนักงานจัดส่งยืนยันส่งถึงแล้ว`,
          `/admin/orders/${orderId}`,
        )
      }

      return updated
    }

    return { orders, findOrder, placeOrder, updateStatus }
  }, [orders, push])

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrders(): OrderValue {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders must be used within an OrderProvider')
  return ctx
}
