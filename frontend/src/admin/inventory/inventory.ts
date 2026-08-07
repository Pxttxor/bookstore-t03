// InventoryItem / StockTransaction follow the classes in File 3 of the team class
// diagram (จัดการข้อมูลหนังสือ + สินค้าคงคลัง); the field names here mirror the diagram
// rather than inventing new ones.
// Book details (title, isbn, price) are not duplicated here — join to SupplierBook
// through bookId with findSupplierBook() from ../suppliers/suppliers.

import type { BadgeTone } from '../components/StatusBadge'

export type StockTxnType = 'RECEIVE_IN' | 'SALE_OUT' | 'RETURN' | 'ADJUSTMENT'

export interface InventoryItem {
  inventoryId: number
  bookId: number
  quantityOnHand: number
  // Undefined means "ยังไม่ตั้งค่า" — SCR-20 tags these and skips the reorder check.
  reorderPoint?: number
  lastUpdated: string
}

export interface StockTransaction {
  txnId: number
  bookId: number
  type: StockTxnType
  quantityChange: number
  reason: string
  referenceDoc: string
  txnDate: string
}

export const STOCK_TXN_TYPE_LABELS: Record<StockTxnType, string> = {
  RECEIVE_IN: 'รับเข้า',
  SALE_OUT: 'ขายออก',
  RETURN: 'ส่งคืน',
  ADJUSTMENT: 'ปรับปรุงยอด',
}

export const STOCK_TXN_TYPE_TONES: Record<StockTxnType, BadgeTone> = {
  RECEIVE_IN: 'success',
  SALE_OUT: 'info',
  RETURN: 'warning',
  ADJUSTMENT: 'neutral',
}

// Drives the reorder-alert screen: a per-title threshold whose purpose is to trigger a
// purchase requisition. Deliberately NOT the same predicate as stockLevel() below.
export function isBelowReorder(item: InventoryItem) {
  return item.reorderPoint !== undefined && item.quantityOnHand <= item.reorderPoint
}

export function formatBookCode(bookId: number) {
  return `BK${bookId}`
}

/* ── Stock level — the low-stock report, not the reorder alert ───────────────── */

// The low-stock report reads "หนังสือที่เหลือน้อยกว่า 10 แต่ยังไม่หมด", a flat figure
// that ignores reorderPoint entirely. Keep the two helpers apart: the reorder alert
// exists to open a PR, this one is a read-only stock report.
export const LOW_STOCK_THRESHOLD = 10

export type StockLevel = 'OUT' | 'LOW' | 'OK'

export function stockLevel(item: InventoryItem): StockLevel {
  if (item.quantityOnHand === 0) return 'OUT'
  if (item.quantityOnHand < LOW_STOCK_THRESHOLD) return 'LOW'
  return 'OK'
}

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  OUT: 'หมด',
  LOW: 'เหลือน้อย',
  OK: 'ปกติ',
}

export const STOCK_LEVEL_TONES: Record<StockLevel, BadgeTone> = {
  OUT: 'danger',
  LOW: 'warning',
  OK: 'success',
}

/* ── Stock count and discrepancy report ─────────────────────────────────────── */

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
}

export const APPROVAL_STATUS_TONES: Record<ApprovalStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

// The class diagram types StockCount.status as a plain string and the model only ever
// emits DONE. Narrowed to a union so the label map below stays exhaustive, which is the
// house rule for every status in this codebase.
export type StockCountStatus = 'DRAFT' | 'DONE'

export const STOCK_COUNT_STATUS_LABELS: Record<StockCountStatus, string> = {
  DRAFT: 'ร่าง',
  DONE: 'ตรวจนับแล้ว',
}

export const STOCK_COUNT_STATUS_TONES: Record<StockCountStatus, BadgeTone> = {
  DRAFT: 'neutral',
  DONE: 'success',
}

export interface StockCountItem {
  bookId: number
  systemQty: number
  countedQty: number
  /** countedQty - systemQty */
  variance: number
  /** StockCountItem "1" --> "0..1" StockDiscrepancyReport : flags */
  reportId?: number
}

export interface StockCount {
  countId: number
  countDate: string
  status: StockCountStatus
  /** FK for WarehouseStaff "1" --> "*" StockCount : performs */
  countedBy: string
  items: StockCountItem[]
}

export interface StockDiscrepancyReport {
  reportId: number
  // The diagram reaches a report only through StockCountItem.reportId; carrying the
  // round and the title as foreign keys saves every screen a reverse scan.
  countId: number
  bookId: number
  variance: number
  approvalStatus: ApprovalStatus
  /** The store manager's "สาเหตุที่จำนวนไม่ตรง" — empty until the report is decided. */
  note: string
  reportedBy: string
  reportedAt: string
  /** StockDiscrepancyReport "*" --> "1" StoreManager : reported to */
  resolvedBy?: string
  resolvedAt?: string
}

/** StockCountItem.computeVariance() from the model. */
export const computeVariance = (systemQty: number, countedQty: number) => countedQty - systemQty

export const formatCountCode = (countId: number) => `SC${String(countId).padStart(3, '0')}`

export const formatReportCode = (reportId: number) => `DR${String(reportId).padStart(3, '0')}`

function item(
  inventoryId: number,
  bookId: number,
  quantityOnHand: number,
  reorderPoint: number | undefined,
): InventoryItem {
  return { inventoryId, bookId, quantityOnHand, reorderPoint, lastUpdated: '2026-08-01T02:00:00.000Z' }
}

// Covers every bookId that appears in SEED_SUPPLIERS. Seven titles sit at or below
// their reorder point so SCR-20 and the notification bell have something to show,
// and BK115 has no reorder point at all to exercise the ⚠ ยังไม่ตั้งค่า branch.
export const SEED_INVENTORY: InventoryItem[] = [
  item(1, 101, 3, 10),
  item(2, 102, 24, 10),
  item(3, 103, 8, 8),
  item(4, 104, 0, 5),
  item(5, 105, 15, 6),
  item(6, 106, 42, 12),
  item(7, 107, 5, 6),
  item(8, 108, 19, 8),
  item(9, 109, 31, 10),
  item(10, 110, 12, 6),
  item(11, 111, 7, 5),
  item(12, 112, 2, 8),
  item(13, 113, 26, 10),
  item(14, 114, 11, 8),
  item(15, 115, 4, undefined),
  item(16, 116, 18, 6),
  item(17, 117, 9, 6),
  item(18, 118, 6, 4),
  item(19, 119, 1, 5),
  item(20, 120, 14, 5),
  item(21, 121, 3, 6),
  item(22, 122, 22, 10),
  item(23, 123, 16, 10),
]

function txn(
  txnId: number,
  bookId: number,
  type: StockTxnType,
  quantityChange: number,
  reason: string,
  referenceDoc: string,
  txnDate: string,
): StockTransaction {
  return { txnId, bookId, type, quantityChange, reason, referenceDoc, txnDate }
}

// Historical movements so the per-title history has something to show on first load.
// They reference documents that really exist in the purchasing and order seeds. Like
// the seeded purchase orders, they are backdated context and are not expected to add up
// to the on-hand figures in SEED_INVENTORY.
export const SEED_STOCK_TRANSACTIONS: StockTransaction[] = [
  txn(1, 101, 'RECEIVE_IN', 40, 'รับสินค้าเข้าคลัง', 'PO-2401', '2026-07-08T03:10:00.000Z'),
  txn(2, 101, 'SALE_OUT', -37, 'ตัดขายตามคำสั่งซื้อ', 'SO-1001', '2026-07-21T07:45:00.000Z'),
  txn(3, 104, 'RECEIVE_IN', 20, 'รับสินค้าเข้าคลัง', 'PO-2410', '2026-07-11T04:20:00.000Z'),
  txn(4, 104, 'SALE_OUT', -20, 'ตัดขายตามคำสั่งซื้อ', 'SO-1003', '2026-07-28T06:05:00.000Z'),
  txn(5, 106, 'RECEIVE_IN', 50, 'รับสินค้าเข้าคลัง', 'PO-2418', '2026-07-15T02:30:00.000Z'),
  txn(6, 106, 'ADJUSTMENT', -8, 'ปรับปรุงยอดตามผลการตรวจนับ', 'DR001', '2026-07-31T09:00:00.000Z'),
  txn(7, 112, 'RETURN', -3, 'ส่งคืนสินค้าชำรุด', 'PO-2422', '2026-07-19T08:15:00.000Z'),
  txn(8, 119, 'ADJUSTMENT', -2, 'ปรับปรุงยอดตามผลการตรวจนับ', 'DR002', '2026-07-31T09:05:00.000Z'),
]

// Two closed rounds. SC002 leaves report DR003 pending so the store manager has
// something waiting the first time they sign in.
export const SEED_STOCK_COUNTS: StockCount[] = [
  {
    countId: 1,
    countDate: '2026-07-31',
    status: 'DONE',
    countedBy: 'สมชาย ใจดี',
    items: [
      { bookId: 106, systemQty: 50, countedQty: 42, variance: -8, reportId: 1 },
      { bookId: 119, systemQty: 3, countedQty: 1, variance: -2, reportId: 2 },
      { bookId: 102, systemQty: 24, countedQty: 24, variance: 0 },
    ],
  },
  {
    countId: 2,
    countDate: '2026-08-05',
    status: 'DONE',
    countedBy: 'สมชาย ใจดี',
    items: [
      { bookId: 104, systemQty: 0, countedQty: 0, variance: 0 },
      { bookId: 110, systemQty: 12, countedQty: 12, variance: 0 },
      { bookId: 121, systemQty: 3, countedQty: 5, variance: 2, reportId: 3 },
    ],
  },
]

export const SEED_DISCREPANCY_REPORTS: StockDiscrepancyReport[] = [
  {
    reportId: 1,
    countId: 1,
    bookId: 106,
    variance: -8,
    approvalStatus: 'APPROVED',
    note: 'หนังสือชำรุดจากน้ำรั่วในคลัง',
    reportedBy: 'สมชาย ใจดี',
    reportedAt: '2026-07-31T08:40:00.000Z',
    resolvedBy: 'ปิยะพร วงศ์ทอง',
    resolvedAt: '2026-07-31T09:00:00.000Z',
  },
  {
    reportId: 2,
    countId: 1,
    bookId: 119,
    variance: -2,
    approvalStatus: 'APPROVED',
    note: 'หนังสือชำรุด ปกฉีกขาดระหว่างจัดเก็บ',
    reportedBy: 'สมชาย ใจดี',
    reportedAt: '2026-07-31T08:42:00.000Z',
    resolvedBy: 'ปิยะพร วงศ์ทอง',
    resolvedAt: '2026-07-31T09:05:00.000Z',
  },
  {
    reportId: 3,
    countId: 2,
    bookId: 121,
    variance: 2,
    approvalStatus: 'PENDING',
    note: '',
    reportedBy: 'สมชาย ใจดี',
    reportedAt: '2026-08-05T07:15:00.000Z',
  },
]
