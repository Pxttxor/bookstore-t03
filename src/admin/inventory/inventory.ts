// InventoryItem / StockTransaction follow the classes in File 3 of the team class
// diagram (จัดการข้อมูลหนังสือ + สินค้าคงคลัง). That subsystem belongs to another
// member, so the field names here mirror his diagram rather than inventing new ones.
// Book details (title, isbn, price) are not duplicated here — join to SupplierBook
// through bookId with findSupplierBook() from ../suppliers/suppliers.

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
  RECEIVE_IN: 'รับเข้าคลัง',
  SALE_OUT: 'ตัดขาย',
  RETURN: 'ส่งคืน',
  ADJUSTMENT: 'ปรับปรุงยอด',
}

export function isBelowReorder(item: InventoryItem) {
  return item.reorderPoint !== undefined && item.quantityOnHand <= item.reorderPoint
}

export function formatBookCode(bookId: number) {
  return `BK${bookId}`
}

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

export const SEED_STOCK_TRANSACTIONS: StockTransaction[] = []
