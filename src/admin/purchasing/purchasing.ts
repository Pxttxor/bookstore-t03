// Types follow the PurchaseRequisition / PurchaseOrder / GoodsReceipt / PurchaseReturn
// classes in Sub2-Purchasing of the team's analysis class diagram. The class diagram is
// authoritative where it disagrees with the Figma UI spec.
//
// PurchaseOrder lives here rather than in ../suppliers/suppliers.ts: U8/U9/U10 need the
// full order with line items and per-line receivedQty, and two copies of an order would
// let SCR-25 receive goods against an order SCR-11 still shows as open.

import type { BadgeTone } from '../components/StatusBadge'

export type PRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export type POStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CONFIRMED'
  | 'RECEIVED_PARTIAL'
  | 'RECEIVED_FULL'
  | 'RETURNED'
  | 'CANCELLED'

export type ReturnStatus = 'TRACKING' | 'ESCALATED' | 'CLOSED'

export type GoodsReceiptStatus = 'PARTIAL' | 'FULL'

export type ItemCondition = 'NORMAL' | 'DAMAGED'

export interface PurchaseRequisitionItem {
  bookId: number
  quantity: number
  unitPrice: number
}

export interface PurchaseRequisition {
  prId: number
  supplierId: number
  createdDate: string
  status: PRStatus
  requestedBy: string
  items: PurchaseRequisitionItem[]
  /** Filled by SCR-23 when the manager sends the requisition back for edits. */
  rejectionReason?: string
  /** Reason the manager recorded when approving an over-budget requisition. */
  overBudgetNote?: string
}

export interface PurchaseOrderItem {
  bookId: number
  quantity: number
  unitPrice: number
  receivedQty: number
}

export interface PurchaseOrder {
  poId: number
  /** Absent for the seeded historical orders, which predate the PR flow. */
  prId?: number
  supplierId: number
  orderDate: string
  expectedDeliveryDate: string
  status: POStatus
  items: PurchaseOrderItem[]
  /** Set by U8 when the order is emailed to the supplier. */
  sentAt?: string
  confirmedAt?: string
}

export interface GoodsReceiptItem {
  bookId: number
  orderedQty: number
  receivedQty: number
  condition: ItemCondition
  note: string
}

export interface GoodsReceipt {
  grId: number
  poId: number
  receivedDate: string
  status: GoodsReceiptStatus
  deliveryNoteNo: string
  receivedBy: string
  items: GoodsReceiptItem[]
}

export interface PurchaseReturnItem {
  bookId: number
  quantity: number
  reason: string
  /** Data URL of the attached photo. Kept small — it goes into localStorage. */
  evidence?: string
}

export interface Compensation {
  type: 'REPLACEMENT' | 'CREDIT_NOTE'
  note: string
  at: string
  by: string
}

export interface PurchaseReturn {
  returnId: number
  poId: number
  returnDate: string
  reason: string
  status: ReturnStatus
  createdBy: string
  items: PurchaseReturnItem[]
  compensation?: Compensation
  /** Reason recorded when the supplier refuses the return and it goes to the manager. */
  escalationNote?: string
}

/* ── Status labels and tones (Figma UI spec §8) ─────────────────────────── */

export const PR_STATUS_LABELS: Record<PRStatus, string> = {
  DRAFT: 'ร่าง',
  SUBMITTED: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ตีกลับ',
}

export const PR_STATUS_TONES: Record<PRStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

// The spec shows five PO states but the class diagram's POStatus has no member for
// "รอยืนยัน". Rather than add one, a sent-but-unconfirmed order is APPROVED with sentAt
// set, and the display status is derived. See poDisplayStatus().
export type PODisplayStatus =
  | 'PENDING_APPROVAL'
  | 'AWAITING_SEND'
  | 'AWAITING_CONFIRM'
  | 'CONFIRMED'
  | 'RECEIVED_PARTIAL'
  | 'RECEIVED_FULL'
  | 'RETURNED'
  | 'CANCELLED'

export const PO_STATUS_LABELS: Record<PODisplayStatus, string> = {
  PENDING_APPROVAL: 'รออนุมัติ',
  AWAITING_SEND: 'อนุมัติแล้ว รอส่ง',
  AWAITING_CONFIRM: 'รอยืนยัน',
  CONFIRMED: 'ยืนยันแล้ว',
  RECEIVED_PARTIAL: 'รับบางส่วน',
  RECEIVED_FULL: 'รับครบ',
  RETURNED: 'ส่งคืน',
  CANCELLED: 'ยกเลิก',
}

export const PO_STATUS_TONES: Record<PODisplayStatus, BadgeTone> = {
  PENDING_APPROVAL: 'warning',
  AWAITING_SEND: 'info',
  AWAITING_CONFIRM: 'warning',
  CONFIRMED: 'success',
  RECEIVED_PARTIAL: 'warning',
  RECEIVED_FULL: 'success',
  RETURNED: 'neutral',
  CANCELLED: 'neutral',
}

export function poDisplayStatus(po: PurchaseOrder): PODisplayStatus {
  if (po.status === 'APPROVED') return po.sentAt ? 'AWAITING_CONFIRM' : 'AWAITING_SEND'
  return po.status
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  TRACKING: 'กำลังติดตาม',
  ESCALATED: 'ส่งต่อผู้จัดการ',
  CLOSED: 'ปิดรายการ',
}

export const RETURN_STATUS_TONES: Record<ReturnStatus, BadgeTone> = {
  TRACKING: 'warning',
  ESCALATED: 'danger',
  CLOSED: 'success',
}

export const GR_STATUS_LABELS: Record<GoodsReceiptStatus, string> = {
  PARTIAL: 'รับบางส่วน',
  FULL: 'รับครบ',
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  NORMAL: 'ปกติ',
  DAMAGED: 'ขาด/ชำรุด',
}

export const RETURN_REASONS = ['ชำรุด', 'ขาดจำนวน', 'ส่งผิดรายการ', 'เกินจำนวนที่สั่ง']

export const COMPENSATION_LABELS: Record<Compensation['type'], string> = {
  REPLACEMENT: 'สินค้าทดแทน',
  CREDIT_NOTE: 'ใบลดหนี้',
}

export const SEND_CHANNELS = ['อีเมล'] as const

// Router state handed from SCR-20 to SCR-21 by "สร้าง PR จากที่เลือก".
export interface RequisitionSeedState {
  supplierId: number
  lines: PurchaseRequisitionItem[]
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export const formatPRCode = (prId: number) => `PR-${prId}`
export const formatPOCode = (poId: number) => `PO-${poId}`
export const formatGRCode = (grId: number) => `GR-${grId}`
export const formatReturnCode = (returnId: number) => `RT-${returnId}`

interface Line {
  quantity: number
  unitPrice: number
}

export const lineTotal = (line: Line) => line.quantity * line.unitPrice

export const documentTotal = (lines: Line[]) =>
  lines.reduce((sum, line) => sum + lineTotal(line), 0)

// An order counts as outstanding until it is fully received, returned or cancelled.
// SCR-14 blocks deactivating a supplier while any of its orders remain outstanding.
const CLOSED_PO: POStatus[] = ['RECEIVED_FULL', 'RETURNED', 'CANCELLED']

export function outstandingOrders(orders: PurchaseOrder[]) {
  return orders.filter((po) => !CLOSED_PO.includes(po.status))
}

export function receivedInFull(po: PurchaseOrder) {
  return po.items.every((line) => line.receivedQty >= line.quantity)
}

// The spec shows a remaining-budget bar on SCR-23 but never says where the figure comes
// from. This is the fiscal budget for the period; remaining is what is left after every
// order that has not been cancelled. 500,000 reproduces the spec's ฿340,000 / 68% example.
export const PURCHASE_BUDGET = 500000

export function committedAmount(orders: PurchaseOrder[]) {
  return orders
    .filter((po) => po.status !== 'CANCELLED')
    .reduce((sum, po) => sum + documentTotal(po.items), 0)
}

/* ── Seed data ──────────────────────────────────────────────────────────── */

const prItem = (bookId: number, quantity: number, unitPrice: number) => ({
  bookId,
  quantity,
  unitPrice,
})

const poItem = (bookId: number, quantity: number, unitPrice: number, receivedQty = 0) => ({
  bookId,
  quantity,
  unitPrice,
  receivedQty,
})

const WAREHOUSE = 'สมชาย ใจดี'

// Three requisitions sit at รออนุมัติ so the manager has something in the Approval Inbox
// on first sign-in. They carry the PO numbers 2431/2433/2435 that the earlier seed used
// for orders "pending approval" — under the class diagram that state belongs to a PR.
export const SEED_REQUISITIONS: PurchaseRequisition[] = [
  {
    prId: 101,
    supplierId: 2,
    createdDate: '2026-07-28',
    status: 'SUBMITTED',
    requestedBy: WAREHOUSE,
    items: [prItem(104, 20, 355), prItem(105, 10, 320)],
  },
  {
    prId: 102,
    supplierId: 7,
    createdDate: '2026-07-30',
    status: 'SUBMITTED',
    requestedBy: WAREHOUSE,
    items: [prItem(116, 30, 195), prItem(117, 30, 210)],
  },
  {
    prId: 103,
    supplierId: 11,
    createdDate: '2026-08-01',
    status: 'SUBMITTED',
    requestedBy: WAREHOUSE,
    items: [prItem(121, 50, 300)],
  },
]

export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    poId: 2380,
    supplierId: 8,
    orderDate: '2026-03-02',
    expectedDeliveryDate: '2026-03-20',
    status: 'RECEIVED_FULL',
    sentAt: '2026-03-02T03:00:00.000Z',
    confirmedAt: '2026-03-03T02:00:00.000Z',
    items: [poItem(118, 40, 220, 40)],
  },
  {
    poId: 2401,
    supplierId: 1,
    orderDate: '2026-05-12',
    expectedDeliveryDate: '2026-05-22',
    status: 'RECEIVED_FULL',
    sentAt: '2026-05-12T03:00:00.000Z',
    confirmedAt: '2026-05-13T02:00:00.000Z',
    items: [poItem(101, 50, 285, 50), poItem(102, 40, 240, 40), poItem(103, 15, 310, 15)],
  },
  {
    poId: 2418,
    supplierId: 1,
    orderDate: '2026-06-30',
    expectedDeliveryDate: '2026-07-10',
    status: 'RECEIVED_FULL',
    sentAt: '2026-06-30T03:00:00.000Z',
    confirmedAt: '2026-07-01T02:00:00.000Z',
    items: [poItem(101, 20, 285, 20), poItem(102, 20, 240, 20)],
  },
  {
    poId: 2402,
    supplierId: 3,
    orderDate: '2026-05-20',
    expectedDeliveryDate: '2026-06-10',
    status: 'RECEIVED_FULL',
    sentAt: '2026-05-20T03:00:00.000Z',
    confirmedAt: '2026-05-21T02:00:00.000Z',
    items: [poItem(106, 60, 420, 60), poItem(107, 40, 480, 40), poItem(108, 50, 265, 50)],
  },
  {
    poId: 2410,
    supplierId: 4,
    orderDate: '2026-06-14',
    expectedDeliveryDate: '2026-06-28',
    status: 'RECEIVED_FULL',
    sentAt: '2026-06-14T03:00:00.000Z',
    confirmedAt: '2026-06-15T02:00:00.000Z',
    items: [poItem(110, 30, 275, 30), poItem(111, 35, 295, 35)],
  },
  {
    poId: 2415,
    supplierId: 12,
    orderDate: '2026-06-25',
    expectedDeliveryDate: '2026-07-08',
    status: 'RECEIVED_FULL',
    sentAt: '2026-06-25T03:00:00.000Z',
    confirmedAt: '2026-06-26T02:00:00.000Z',
    items: [poItem(122, 35, 145, 35), poItem(123, 25, 160, 25)],
  },
  {
    poId: 2422,
    supplierId: 5,
    orderDate: '2026-07-08',
    expectedDeliveryDate: '2026-08-02',
    status: 'APPROVED',
    items: [poItem(112, 40, 385), poItem(113, 30, 360), poItem(114, 25, 340)],
  },
  {
    poId: 2425,
    supplierId: 2,
    orderDate: '2026-07-18',
    expectedDeliveryDate: '2026-08-02',
    status: 'CONFIRMED',
    sentAt: '2026-07-18T04:00:00.000Z',
    confirmedAt: '2026-07-19T03:30:00.000Z',
    items: [poItem(104, 40, 355), poItem(105, 25, 320)],
  },
  {
    poId: 2427,
    supplierId: 9,
    orderDate: '2026-07-21',
    expectedDeliveryDate: '2026-08-05',
    status: 'CONFIRMED',
    sentAt: '2026-07-21T04:00:00.000Z',
    confirmedAt: '2026-07-22T02:15:00.000Z',
    items: [poItem(119, 50, 420), poItem(120, 30, 450)],
  },
  {
    poId: 2429,
    supplierId: 3,
    orderDate: '2026-07-25',
    expectedDeliveryDate: '2026-08-15',
    status: 'RECEIVED_PARTIAL',
    sentAt: '2026-07-25T04:00:00.000Z',
    confirmedAt: '2026-07-26T02:00:00.000Z',
    items: [poItem(108, 30, 265, 30), poItem(109, 40, 290, 25)],
  },
]

export const SEED_GOODS_RECEIPTS: GoodsReceipt[] = [
  {
    grId: 5001,
    poId: 2429,
    receivedDate: '2026-08-02',
    status: 'PARTIAL',
    deliveryNoteNo: 'DN-2026-0812',
    receivedBy: WAREHOUSE,
    items: [
      { bookId: 108, orderedQty: 30, receivedQty: 30, condition: 'NORMAL', note: '' },
      {
        bookId: 109,
        orderedQty: 40,
        receivedQty: 25,
        condition: 'NORMAL',
        note: 'ผู้จัดจำหน่ายแจ้งส่งส่วนที่เหลือรอบถัดไป',
      },
    ],
  },
]

export const SEED_PURCHASE_RETURNS: PurchaseReturn[] = []
