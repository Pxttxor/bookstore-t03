import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { useNotifications } from '../notifications/NotificationContext'
import { type CustomerOrder, type OrderStatus } from './orders'

// ข้อมูลอยู่ในตาราง customer_order / customer_order_item /
// customer_order_status_history ของ PostgreSQL แล้ว
// (ชื่อตารางเป็น customer_order ไม่ใช่ order เพราะ ORDER เป็นคำสงวนของ SQL)
//
// เซิร์ฟเวอร์กรองให้ตามผู้เรียกอยู่แล้ว: พนักงานเห็นทุกใบ ลูกค้าเห็นเฉพาะของตัวเอง
const loadOrders = () => apiGet<CustomerOrder[]>('/api/orders')

export interface OrderDraft {
  customerName?: string
  customerPhone?: string
  shippingAddress: string
  /** รหัสหนังสือจากแคตตาล็อก — หน้าร้านกับฐานข้อมูลใช้รหัสเดียวกันแล้ว */
  items: { bookId: number; quantity: number }[]
  slipFileName?: string
  bankId?: number
  promotionId?: number
  discountCode?: string
}

export interface DiscountValidation {
  code: string
  rewardName: string
  discountAmount: number
}

export interface StatusChangeOpts {
  note?: string
  /** Required when moving to SHIPPED — the delivery staff records these. */
  tracking?: string
  carrierId?: number
  refundBankName?: string
  refundAccountNo?: string
  refundAccountName?: string
}

interface OrderValue {
  orders: CustomerOrder[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findOrder: (orderId: number) => CustomerOrder | undefined
  /** ตรวจสอบโค้ดส่วนลดจากการแลกแต้มรางวัล */
  validateDiscount: (code: string, subtotal: number) => Promise<DiscountValidation>
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
  /** บันทึก/แก้ไขข้อมูลบัญชีธนาคารสำหรับรับเงินคืน */
  updateRefundInfo: (
    orderId: number,
    bankName: string,
    accountNo: string,
    accountName: string,
  ) => Promise<CustomerOrder>
  /** พนักงานบันทึกยืนยันว่าคืนเงินลูกค้าแล้ว */
  confirmRefund: (orderId: number, note?: string) => Promise<CustomerOrder>
  /** พนักงานแจ้งสินค้าหมดสต็อก */
  markOutOfStock: (
    orderId: number,
    note: string,
    restockEstimate?: string,
    restockDate?: string,
  ) => Promise<CustomerOrder>
  /** ลูกค้าหรือพนักงานบันทึกการตัดสินใจกรณีสินค้าหมด (รอของ / เปลี่ยนสินค้า / ยกเลิก) */
  submitCustomerChoice: (
    orderId: number,
    choice: 'WAIT_RESTOCK' | 'CHANGE_PRODUCT' | 'CANCEL',
    opts?: {
      replacementBookId?: number
      note?: string
      refundBankName?: string
      refundAccountNo?: string
      refundAccountName?: string
    },
  ) => Promise<CustomerOrder>
  /** พนักงานอนุมัติการเปลี่ยนหนังสือในคำสั่งซื้อ */
  approveExchange: (
    orderId: number,
    replacementBookId: number,
    note?: string,
  ) => Promise<CustomerOrder>
  /** พนักงานยืนยันว่าสินค้าเข้าสต็อกแล้ว */
  confirmRestocked: (orderId: number) => Promise<CustomerOrder>
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
  OUT_OF_STOCK: 'out-of-stock',
  WAITING_RESTOCK: 'customer-choice',
  EXCHANGE_REQUESTED: 'customer-choice',
  // สถานะตั้งต้นเกิดตอนสร้างใบ ไม่มีเส้นทางให้ย้อนกลับมา
  PENDING_CONFIRM: null,
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { reload: reloadNotifications } = useNotifications()

  // Provider นี้อยู่ที่ main.tsx จึงครอบหน้าร้านด้วย · ผู้ที่ยังไม่ล็อกอินไม่มี token
  // จะได้ 401 ทุกครั้งที่เปิดหน้าแรก จึงยิงเฉพาะตอนล็อกอินแล้ว
  const { data, loading, error, reload, apply } = useResource(loadOrders, user !== null)

  const value = useMemo<OrderValue>(() => {
    const orders = data ?? []

    // ทุกก้าวของคำสั่งซื้อทำให้เซิร์ฟเวอร์ออกแจ้งเตือนอย่างน้อยหนึ่งใบ
    const refresh = async () => {
      await Promise.all([reload(), reloadNotifications()])
    }

    const validateDiscount = async (code: string, subtotal: number) => {
      return apiPost<DiscountValidation>('/api/orders/validate-discount', {
        code: code.trim(),
        subtotal,
      })
    }

    const placeOrder = async (draft: OrderDraft) => {
      // customerId / channel เซิร์ฟเวอร์เติมให้เองเมื่อผู้เรียกเป็นลูกค้าที่ล็อกอินอยู่
      // ยอดเงินก็คิดจากราคาในตาราง book ไม่ใช่ค่าที่หน้าจอส่งไป
      const order = await apiPost<CustomerOrder>('/api/orders', {
        customerName: draft.customerName?.trim() || undefined,
        shippingAddress: draft.shippingAddress,
        slipFileName: draft.slipFileName ?? '',
        bankId: draft.bankId,
        items: draft.items,
        promotionId: draft.promotionId,
        discountCode: draft.discountCode?.trim() || undefined,
      })
      apply((prev) => [order, ...prev.filter((o) => o.orderId !== order.orderId)])
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
        body = {
          note: opts.note ?? '',
          refundBankName: opts.refundBankName?.trim() || undefined,
          refundAccountNo: opts.refundAccountNo?.trim() || undefined,
          refundAccountName: opts.refundAccountName?.trim() || undefined,
        }
      } else if (next === 'VERIFYING_PAYMENT') {
        const order = orders.find((row) => row.orderId === orderId)
        body = { slipFileName: opts.note?.trim() || order?.slipFileName || '' }
      }

      await apiPost(`/api/orders/${orderId}/${route}`, body)
      await refresh()
    }

    const updateRefundInfo = async (
      orderId: number,
      bankName: string,
      accountNo: string,
      accountName: string,
    ) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/refund-bank`, {
        refundBankName: bankName.trim(),
        refundAccountNo: accountNo.trim(),
        refundAccountName: accountName.trim(),
      })
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await reloadNotifications()
      return updated
    }

    const confirmRefund = async (orderId: number, note?: string) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/refund-confirm`, {
        note: note?.trim() || 'คืนเงินลูกค้าไปแล้ว',
      })
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await reloadNotifications()
      return updated
    }

    const markOutOfStock = async (
      orderId: number,
      note: string,
      restockEstimate?: string,
      restockDate?: string,
    ) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/out-of-stock`, {
        note: note.trim(),
        restockEstimate: restockEstimate?.trim() || undefined,
        restockDate: restockDate || undefined,
      })
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await refresh()
      return updated
    }

    const submitCustomerChoice = async (
      orderId: number,
      choice: 'WAIT_RESTOCK' | 'CHANGE_PRODUCT' | 'CANCEL',
      opts?: {
        replacementBookId?: number
        note?: string
        refundBankName?: string
        refundAccountNo?: string
        refundAccountName?: string
      },
    ) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/customer-choice`, {
        choice,
        replacementBookId: opts?.replacementBookId,
        note: opts?.note?.trim() || undefined,
        refundBankName: opts?.refundBankName?.trim() || undefined,
        refundAccountNo: opts?.refundAccountNo?.trim() || undefined,
        refundAccountName: opts?.refundAccountName?.trim() || undefined,
      })
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await refresh()
      return updated
    }

    const approveExchange = async (
      orderId: number,
      replacementBookId: number,
      note?: string,
    ) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/approve-exchange`, {
        replacementBookId,
        note: note?.trim() || undefined,
      })
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await refresh()
      return updated
    }

    const confirmRestocked = async (orderId: number) => {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${orderId}/confirm-restocked`, {})
      apply((prev) => prev.map((o) => (o.orderId === orderId ? updated : o)))
      await refresh()
      return updated
    }

    return {
      orders,
      loading,
      error,
      reload,
      findOrder: (orderId: number) => orders.find((o) => o.orderId === orderId),
      validateDiscount,
      placeOrder,
      updateStatus,
      updateRefundInfo,
      confirmRefund,
      markOutOfStock,
      submitCustomerChoice,
      approveExchange,
      confirmRestocked,
    }
  }, [data, loading, error, reload, reloadNotifications, apply])

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrders(): OrderValue {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders must be used within an OrderProvider')
  return ctx
}
