// Customer-order types (Order / OrderItem / OrderStatusHistory + Shipment) follow the
// team's analysis class diagram, which is authoritative on names and enums.
//
// คำสั่งซื้อสแน็ปช็อตชื่อเรื่อง/ราคา/จำนวนไว้ในแถวของตัวเอง เพื่อให้ประวัติการสั่งซื้อ
// ไม่เปลี่ยนตามเมื่อราคาหน้าปกถูกแก้ทีหลัง · อ้างหนังสือด้วย `bookId` ตัวเดียวกับที่หน้าร้านใช้
//
// **การเปลี่ยนสถานะตัดสินที่เซิร์ฟเวอร์** (`OrderService.advance`) — หน้าจอไม่มีตาราง
// transition ของตัวเองอีกชุด เพราะสองชุดมีโอกาสเพี้ยนจากกันโดยไม่มีอะไรจับ

import type { BadgeTone } from '../components/StatusBadge'

export type OrderStatus =
  | 'PENDING_CONFIRM'
  | 'STOCK_CONFIRMED'
  | 'WAITING_PAYMENT'
  | 'VERIFYING_PAYMENT'
  | 'PAID'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED'

export type OrderChannel = 'WEBSITE' | 'MESSAGE' | 'PHONE'

export type ShipmentStatus = 'PREPARING' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED'

export interface OrderItem {
  /** รหัสหนังสือในแคตตาล็อก (`book.book_id`) — คีย์เดียวกันทั้งหน้าร้านและหลังร้าน */
  bookId: number
  title: string
  unitPrice: number
  quantity: number
}

export interface OrderStatusHistory {
  status: OrderStatus
  changedDate: string
  note?: string
}

export interface Shipment {
  trackingNumber: string
  carrier: string
  recipientName: string
  shippedDate: string
  status: ShipmentStatus
}

export interface CustomerOrder {
  orderId: number
  customerId?: number
  channel: OrderChannel
  orderDate: string
  customerName: string
  /** Email of the signed-in customer who placed it — the key the storefront order-history
   *  page filters by. Optional: guest checkouts and seed orders leave it undefined. */
  customerEmail?: string
  shippingAddress: string
  status: OrderStatus
  /** Server-derived transition guard; role permissions are checked separately. */
  canCancel?: boolean
  subtotal: number
  discountAmount: number
  netAmount: number
  promotionId?: number
  promotionName?: string
  /** Name of the payment slip the customer uploaded at checkout (simulated). */
  slipFileName?: string
  items: OrderItem[]
  timeline: OrderStatusHistory[]
  shipment?: Shipment
}

/* ── Status labels and tones ────────────────────────────────────────────── */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRM: 'รอยืนยันคำสั่งซื้อ',
  STOCK_CONFIRMED: 'ยืนยันสต็อกแล้ว',
  WAITING_PAYMENT: 'รอชำระเงิน',
  VERIFYING_PAYMENT: 'กำลังตรวจสอบการชำระเงิน',
  PAID: 'ชำระเงินแล้ว',
  PACKING: 'กำลังแพ็กสินค้า',
  READY_TO_SHIP: 'พร้อมจัดส่ง',
  SHIPPED: 'จัดส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
  CANCELLED: 'ยกเลิก',
  REJECTED: 'ปฏิเสธ',
}

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  PENDING_CONFIRM: 'warning',
  STOCK_CONFIRMED: 'info',
  WAITING_PAYMENT: 'warning',
  VERIFYING_PAYMENT: 'warning',
  PAID: 'info',
  PACKING: 'info',
  READY_TO_SHIP: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  REJECTED: 'danger',
}

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  WEBSITE: 'เว็บไซต์',
  MESSAGE: 'ข้อความ',
  PHONE: 'โทรศัพท์',
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PREPARING: 'กำลังเตรียม',
  SHIPPED: 'จัดส่งแล้ว',
  IN_TRANSIT: 'ระหว่างขนส่ง',
  DELIVERED: 'ส่งถึงแล้ว',
  FAILED: 'จัดส่งไม่สำเร็จ',
}

/** Delivery companies the delivery staff picks from when recording a shipment. */
export const CARRIERS = ['DHL Express', 'Kerry Express', 'ไปรษณีย์ไทย', 'J&T Express', 'Flash Express'] as const

// The five milestones shown on the customer tracking timeline and the back-office detail
// stepper. CANCELLED / REJECTED sit outside the happy path and render their own banner.
export const ORDER_MILESTONES = ['รับคำสั่งซื้อ', 'ชำระเงิน', 'เตรียมพัสดุ', 'จัดส่ง', 'ส่งถึงแล้ว'] as const

const MILESTONE_OF: Record<OrderStatus, number> = {
  PENDING_CONFIRM: 0,
  STOCK_CONFIRMED: 0,
  WAITING_PAYMENT: 1,
  VERIFYING_PAYMENT: 1,
  PAID: 1,
  PACKING: 2,
  READY_TO_SHIP: 2,
  SHIPPED: 3,
  DELIVERED: 4,
  CANCELLED: -1,
  REJECTED: -1,
}

export const milestoneOf = (status: OrderStatus) => MILESTONE_OF[status]

export const isClosedOrder = (status: OrderStatus) =>
  status === 'DELIVERED' || status === 'CANCELLED' || status === 'REJECTED'

/* ── Helpers ────────────────────────────────────────────────────────────── */

export const formatOrderCode = (orderId: number) => `SO-${orderId}`

export const orderItemTotal = (item: OrderItem) => item.unitPrice * item.quantity

export const orderItemCount = (order: CustomerOrder) =>
  order.items.reduce((sum, item) => sum + item.quantity, 0)

/* ── Seed data ──────────────────────────────────────────────────────────── */

const item = (bookId: number, title: string, unitPrice: number, quantity: number): OrderItem => ({
  bookId,
  title,
  unitPrice,
  quantity,
})

// One order waits for sales (PENDING_CONFIRM), one waits for delivery (READY_TO_SHIP) and
// one is already delivered, so every role sees something on first sign-in.
export const SEED_ORDERS: CustomerOrder[] = [
  {
    orderId: 1001,
    channel: 'WEBSITE',
    orderDate: '2026-08-04',
    customerName: 'ณภัทร วงศ์สว่าง',
    shippingAddress: '88/12 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    status: 'PENDING_CONFIRM',
    subtotal: 50.9,
    discountAmount: 0,
    netAmount: 50.9,
    slipFileName: 'slip-1001.jpg',
    items: [
      item(109, 'The Midnight Library', 18.5, 1),
      item(101, 'Atomic Habits', 16.2, 2),
    ],
    timeline: [{ status: 'PENDING_CONFIRM', changedDate: '2026-08-04T02:10:00.000Z' }],
  },
  {
    orderId: 1002,
    channel: 'WEBSITE',
    orderDate: '2026-08-03',
    customerName: 'กัญญา ศรีสาย',
    shippingAddress: '199 หมู่ 4 ตำบลสุรนารี อำเภอเมือง จังหวัดนครราชสีมา 30000',
    status: 'READY_TO_SHIP',
    subtotal: 38.98,
    discountAmount: 0,
    netAmount: 38.98,
    slipFileName: 'slip-1002.png',
    items: [
      item(106, 'Dune', 23.99, 1),
      item(104, 'Project Hail Mary', 14.99, 1),
    ],
    timeline: [
      { status: 'PENDING_CONFIRM', changedDate: '2026-08-03T01:00:00.000Z' },
      { status: 'STOCK_CONFIRMED', changedDate: '2026-08-03T02:00:00.000Z' },
      { status: 'VERIFYING_PAYMENT', changedDate: '2026-08-03T02:05:00.000Z' },
      { status: 'PAID', changedDate: '2026-08-03T03:00:00.000Z' },
      { status: 'PACKING', changedDate: '2026-08-03T06:00:00.000Z' },
      { status: 'READY_TO_SHIP', changedDate: '2026-08-03T08:30:00.000Z' },
    ],
  },
  {
    orderId: 1003,
    channel: 'WEBSITE',
    orderDate: '2026-07-30',
    customerName: 'สมศักดิ์ ใจดี',
    shippingAddress: '45/7 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง จังหวัดเชียงใหม่ 50200',
    status: 'DELIVERED',
    subtotal: 13.5,
    discountAmount: 0,
    netAmount: 13.5,
    slipFileName: 'slip-1003.jpg',
    items: [item(110, 'The Song of Achilles', 13.5, 1)],
    timeline: [
      { status: 'PENDING_CONFIRM', changedDate: '2026-07-30T01:00:00.000Z' },
      { status: 'STOCK_CONFIRMED', changedDate: '2026-07-30T02:00:00.000Z' },
      { status: 'VERIFYING_PAYMENT', changedDate: '2026-07-30T02:05:00.000Z' },
      { status: 'PAID', changedDate: '2026-07-30T03:00:00.000Z' },
      { status: 'PACKING', changedDate: '2026-07-30T05:00:00.000Z' },
      { status: 'READY_TO_SHIP', changedDate: '2026-07-30T07:00:00.000Z' },
      { status: 'SHIPPED', changedDate: '2026-07-31T02:00:00.000Z' },
      { status: 'DELIVERED', changedDate: '2026-08-01T07:20:00.000Z' },
    ],
    shipment: {
      trackingNumber: 'TH-2026-073001',
      carrier: 'ไปรษณีย์ไทย',
      recipientName: 'สมศักดิ์ ใจดี',
      shippedDate: '2026-07-31',
      status: 'DELIVERED',
    },
  },
]
