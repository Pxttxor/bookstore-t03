import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useInventory, type StockChange } from '../inventory/InventoryContext'
import {
  useNotifications,
  type NotificationDraft,
} from '../notifications/NotificationContext'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht } from '../suppliers/suppliers'
import {
  documentTotal,
  formatPOCode,
  formatPRCode,
  receivedInFull,
  SEED_GOODS_RECEIPTS,
  SEED_PURCHASE_ORDERS,
  SEED_PURCHASE_RETURNS,
  SEED_REQUISITIONS,
  type Compensation,
  type GoodsReceipt,
  type ItemCondition,
  type PurchaseOrder,
  type PurchaseRequisition,
  type PurchaseRequisitionItem,
  type PurchaseReturn,
  type PurchaseReturnItem,
} from './purchasing'

const STORAGE_KEY = 'bookhaven.purchasing.v1'

// Suppliers normally quote two to three weeks; U8 replaces this with the date the
// supplier actually confirms.
const DEFAULT_LEAD_DAYS = 14

export interface RequisitionDraft {
  supplierId: number
  items: PurchaseRequisitionItem[]
}

export interface GoodsReceiptDraft {
  deliveryNoteNo: string
  receivedBy: string
  lines: { bookId: number; receivedQty: number; condition: ItemCondition; note: string }[]
}

export interface ReturnDraft {
  reason: string
  items: PurchaseReturnItem[]
}

interface Stored {
  requisitions: PurchaseRequisition[]
  orders: PurchaseOrder[]
  receipts: GoodsReceipt[]
  returns: PurchaseReturn[]
}

interface PurchasingValue extends Stored {
  findRequisition: (prId: number) => PurchaseRequisition | undefined
  findOrder: (poId: number) => PurchaseOrder | undefined
  findReturn: (returnId: number) => PurchaseReturn | undefined
  ordersForSupplier: (supplierId: number) => PurchaseOrder[]
  receiptsForOrder: (poId: number) => GoodsReceipt[]
  returnsForOrder: (poId: number) => PurchaseReturn[]

  // Saving and submitting are one operation each: a save followed by a submit in the
  // same tick would read this provider's state before the save landed.
  saveDraft: (draft: RequisitionDraft, by: string, prId?: number) => PurchaseRequisition
  submitRequisition: (draft: RequisitionDraft, by: string, prId?: number) => PurchaseRequisition
  approveRequisition: (prId: number, overBudgetNote?: string) => PurchaseOrder
  rejectRequisition: (prId: number, reason: string) => void
  sendOrder: (poId: number) => void
  confirmOrder: (poId: number, expectedDeliveryDate: string) => void
  receiveGoods: (poId: number, draft: GoodsReceiptDraft) => GoodsReceipt
  createReturn: (poId: number, draft: ReturnDraft, by: string) => PurchaseReturn
  escalateReturn: (returnId: number, note: string) => void
  recordCompensation: (returnId: number, compensation: Compensation) => void
}

const PurchasingContext = createContext<PurchasingValue | null>(null)

const SEED: Stored = {
  requisitions: SEED_REQUISITIONS,
  orders: SEED_PURCHASE_ORDERS,
  receipts: SEED_GOODS_RECEIPTS,
  returns: SEED_PURCHASE_RETURNS,
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED
    const parsed = JSON.parse(raw) as Stored
    return Array.isArray(parsed?.orders) ? parsed : SEED
  } catch {
    return SEED
  }
}

function write(stored: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

const today = () => new Date().toISOString().slice(0, 10)

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const nextId = <T,>(rows: T[], pick: (row: T) => number, floor: number) =>
  rows.reduce((max, row) => Math.max(max, pick(row)), floor) + 1

export function PurchasingProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(read)
  const { findById: findSupplier } = useSuppliers()
  const { applyStockChanges } = useInventory()
  const { push } = useNotifications()

  const value = useMemo<PurchasingValue>(() => {
    const persist = (next: Stored) => {
      write(next)
      setStored(next)
    }

    const findRequisition = (prId: number) =>
      stored.requisitions.find((pr) => pr.prId === prId)
    const findOrder = (poId: number) => stored.orders.find((po) => po.poId === poId)
    const findReturn = (returnId: number) =>
      stored.returns.find((entry) => entry.returnId === returnId)

    const supplierName = (supplierId: number) =>
      findSupplier(supplierId)?.companyName ?? 'ผู้จัดจำหน่าย'

    const replaceOrder = (orders: PurchaseOrder[], updated: PurchaseOrder) =>
      orders.map((po) => (po.poId === updated.poId ? updated : po))

    const buildRequisition = (
      draft: RequisitionDraft,
      by: string,
      prId: number | undefined,
      status: PurchaseRequisition['status'],
    ): PurchaseRequisition => {
      const existing = prId !== undefined ? findRequisition(prId) : undefined
      return existing
        ? { ...existing, ...draft, status }
        : {
            prId: nextId(stored.requisitions, (pr) => pr.prId, 100),
            supplierId: draft.supplierId,
            createdDate: today(),
            status,
            requestedBy: by,
            items: draft.items,
          }
    }

    const commitRequisition = (requisition: PurchaseRequisition) =>
      persist({
        ...stored,
        requisitions: stored.requisitions.some((pr) => pr.prId === requisition.prId)
          ? stored.requisitions.map((pr) =>
              pr.prId === requisition.prId ? requisition : pr,
            )
          : [...stored.requisitions, requisition],
      })

    const saveDraft = (draft: RequisitionDraft, by: string, prId?: number) => {
      const requisition = buildRequisition(draft, by, prId, 'DRAFT')
      commitRequisition(requisition)
      return requisition
    }

    // U6 postcondition: the requisition moves to รออนุมัติ and the manager is notified
    // automatically, in-app and by email (Figma spec SCR-27 §C).
    const submitRequisition = (draft: RequisitionDraft, by: string, prId?: number) => {
      const requisition = buildRequisition(draft, by, prId, 'SUBMITTED')
      commitRequisition(requisition)

      notifyBoth(
        'manager',
        'PR_SUBMITTED',
        'ใบขอสั่งซื้อรออนุมัติ',
        `${formatPRCode(requisition.prId)} · ${supplierName(requisition.supplierId)} · ` +
          `฿${formatBaht(documentTotal(requisition.items))} · ผู้ขอ ${requisition.requestedBy}`,
        `/admin/purchasing/pr/${requisition.prId}/approve`,
      )
      return requisition
    }

    // U7 postcondition: approving issues the purchase order automatically.
    const approveRequisition = (prId: number, overBudgetNote?: string) => {
      const current = findRequisition(prId)
      if (!current) throw new Error('ไม่พบใบขอสั่งซื้อ')

      const order: PurchaseOrder = {
        poId: nextId(stored.orders, (po) => po.poId, 2435),
        prId,
        supplierId: current.supplierId,
        orderDate: today(),
        expectedDeliveryDate: addDays(DEFAULT_LEAD_DAYS),
        status: 'APPROVED',
        items: current.items.map((line) => ({ ...line, receivedQty: 0 })),
      }

      persist({
        ...stored,
        requisitions: stored.requisitions.map((pr) =>
          pr.prId === prId ? { ...pr, status: 'APPROVED' as const, overBudgetNote } : pr,
        ),
        orders: [...stored.orders, order],
      })

      notifyBoth(
        'warehouse',
        'PR_APPROVED',
        'ใบขอสั่งซื้อได้รับอนุมัติ',
        `${formatPRCode(prId)} อนุมัติแล้ว ระบบออก ${formatPOCode(order.poId)} พร้อมส่งให้ผู้จัดจำหน่าย`,
        `/admin/purchasing/po/${order.poId}`,
      )
      return order
    }

    const rejectRequisition = (prId: number, reason: string) => {
      persist({
        ...stored,
        requisitions: stored.requisitions.map((pr) =>
          pr.prId === prId ? { ...pr, status: 'REJECTED' as const, rejectionReason: reason } : pr,
        ),
      })

      notifyBoth(
        'warehouse',
        'PR_REJECTED',
        'ใบขอสั่งซื้อถูกตีกลับ',
        `${formatPRCode(prId)} ถูกตีกลับให้แก้ไข · เหตุผล: ${reason}`,
        `/admin/purchasing/pr/${prId}`,
      )
    }

    // U8: sending leaves the order at APPROVED with sentAt set, which reads as
    // "รอยืนยัน" until the supplier confirms. See poDisplayStatus().
    const sendOrder = (poId: number) => {
      const current = findOrder(poId)
      if (!current) throw new Error('ไม่พบใบสั่งซื้อ')
      persist({
        ...stored,
        orders: replaceOrder(stored.orders, { ...current, sentAt: new Date().toISOString() }),
      })
    }

    const confirmOrder = (poId: number, expectedDeliveryDate: string) => {
      const current = findOrder(poId)
      if (!current) throw new Error('ไม่พบใบสั่งซื้อ')
      persist({
        ...stored,
        orders: replaceOrder(stored.orders, {
          ...current,
          status: 'CONFIRMED',
          confirmedAt: new Date().toISOString(),
          expectedDeliveryDate,
        }),
      })
    }

    // U9: records the receipt, tops up the line quantities and adjusts stock in one go.
    const receiveGoods = (poId: number, draft: GoodsReceiptDraft) => {
      const current = findOrder(poId)
      if (!current) throw new Error('ไม่พบใบสั่งซื้อ')

      const receipt: GoodsReceipt = {
        grId: nextId(stored.receipts, (gr) => gr.grId, 5000),
        poId,
        receivedDate: today(),
        status: 'PARTIAL',
        deliveryNoteNo: draft.deliveryNoteNo,
        receivedBy: draft.receivedBy,
        items: draft.lines.map((line) => ({
          bookId: line.bookId,
          orderedQty: current.items.find((i) => i.bookId === line.bookId)?.quantity ?? 0,
          receivedQty: line.receivedQty,
          condition: line.condition,
          note: line.note,
        })),
      }

      const order: PurchaseOrder = {
        ...current,
        items: current.items.map((line) => {
          const received = draft.lines.find((entry) => entry.bookId === line.bookId)
          return received
            ? { ...line, receivedQty: line.receivedQty + received.receivedQty }
            : line
        }),
      }
      order.status = receivedInFull(order) ? 'RECEIVED_FULL' : 'RECEIVED_PARTIAL'
      receipt.status = order.status === 'RECEIVED_FULL' ? 'FULL' : 'PARTIAL'

      persist({
        ...stored,
        orders: replaceOrder(stored.orders, order),
        receipts: [...stored.receipts, receipt],
      })

      // Everything that physically arrived enters stock, damaged or not; U10 takes the
      // damaged units back out again when a return is raised.
      applyStockChanges(
        draft.lines
          .filter((line) => line.receivedQty > 0)
          .map<StockChange>((line) => ({
            bookId: line.bookId,
            type: 'RECEIVE_IN',
            quantityChange: line.receivedQty,
            reason: 'รับสินค้าเข้าคลัง',
            referenceDoc: formatPOCode(poId),
          })),
      )

      notifyBoth(
        'manager',
        'GR_RECORDED',
        'บันทึกรับสินค้าเข้าคลัง',
        `${formatPOCode(poId)} · ${supplierName(current.supplierId)} · รับ ${draft.lines.reduce(
          (sum, line) => sum + line.receivedQty,
          0,
        )} เล่ม`,
        `/admin/purchasing/po/${poId}`,
        ['in-app'],
      )

      return receipt
    }

    const createReturn = (poId: number, draft: ReturnDraft, by: string) => {
      const current = findOrder(poId)
      if (!current) throw new Error('ไม่พบใบสั่งซื้อ')

      const entry: PurchaseReturn = {
        returnId: nextId(stored.returns, (item) => item.returnId, 7000),
        poId,
        returnDate: today(),
        reason: draft.reason,
        status: 'TRACKING',
        createdBy: by,
        items: draft.items,
      }

      // The order counts as ส่งคืน only once every received unit has gone back.
      const returnedByBook = new Map<number, number>()
      for (const item of [...stored.returns.filter((r) => r.poId === poId), entry].flatMap(
        (r) => r.items,
      )) {
        returnedByBook.set(item.bookId, (returnedByBook.get(item.bookId) ?? 0) + item.quantity)
      }
      const fullyReturned = current.items.every(
        (line) => (returnedByBook.get(line.bookId) ?? 0) >= line.receivedQty && line.receivedQty > 0,
      )

      persist({
        ...stored,
        returns: [...stored.returns, entry],
        orders: fullyReturned
          ? replaceOrder(stored.orders, { ...current, status: 'RETURNED' })
          : stored.orders,
      })

      applyStockChanges(
        draft.items.map<StockChange>((item) => ({
          bookId: item.bookId,
          type: 'RETURN',
          quantityChange: -item.quantity,
          reason: item.reason,
          referenceDoc: formatPOCode(poId),
        })),
      )

      return entry
    }

    const escalateReturn = (returnId: number, note: string) => {
      const current = findReturn(returnId)
      if (!current) throw new Error('ไม่พบใบส่งคืน')

      persist({
        ...stored,
        returns: stored.returns.map((entry) =>
          entry.returnId === returnId
            ? { ...entry, status: 'ESCALATED' as const, escalationNote: note }
            : entry,
        ),
      })

      notifyBoth(
        'manager',
        'RETURN_ESCALATED',
        'ผู้จัดจำหน่ายปฏิเสธการรับคืน',
        `${formatPOCode(current.poId)} · ${note}`,
        `/admin/purchasing/returns/${returnId}`,
      )
    }

    const recordCompensation = (returnId: number, compensation: Compensation) => {
      const current = findReturn(returnId)
      if (!current) throw new Error('ไม่พบใบส่งคืน')

      persist({
        ...stored,
        returns: stored.returns.map((entry) =>
          entry.returnId === returnId
            ? { ...entry, status: 'CLOSED' as const, compensation }
            : entry,
        ),
      })

      if (compensation.type === 'REPLACEMENT') {
        applyStockChanges(
          current.items.map<StockChange>((item) => ({
            bookId: item.bookId,
            type: 'RECEIVE_IN',
            quantityChange: item.quantity,
            reason: 'สินค้าทดแทนจากการส่งคืน',
            referenceDoc: formatPOCode(current.poId),
          })),
        )
      }
    }

    function notifyBoth(
      to: NotificationDraft['to'],
      kind: NotificationDraft['kind'],
      title: string,
      body: string,
      link: string,
      channels: NotificationDraft['channel'][] = ['in-app', 'email'],
    ) {
      push(channels.map((channel) => ({ to, kind, title, body, link, channel })))
    }

    return {
      ...stored,
      findRequisition,
      findOrder,
      findReturn,
      ordersForSupplier: (supplierId) =>
        stored.orders.filter((po) => po.supplierId === supplierId),
      receiptsForOrder: (poId) => stored.receipts.filter((gr) => gr.poId === poId),
      returnsForOrder: (poId) => stored.returns.filter((entry) => entry.poId === poId),
      saveDraft,
      submitRequisition,
      approveRequisition,
      rejectRequisition,
      sendOrder,
      confirmOrder,
      receiveGoods,
      createReturn,
      escalateReturn,
      recordCompensation,
    }
  }, [stored, findSupplier, applyStockChanges, push])

  return <PurchasingContext.Provider value={value}>{children}</PurchasingContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePurchasing(): PurchasingValue {
  const ctx = useContext(PurchasingContext)
  if (!ctx) throw new Error('usePurchasing must be used within a PurchasingProvider')
  return ctx
}
