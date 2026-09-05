import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import { useInventory } from '../inventory/InventoryContext'
import { useNotifications } from '../notifications/NotificationContext'
import {
  type Compensation,
  type GoodsReceipt,
  type ItemCondition,
  type PurchaseOrder,
  type PurchaseRequisition,
  type PurchaseRequisitionItem,
  type PurchaseReturn,
  type PurchaseReturnItem,
} from './purchasing'

// ข้อมูลอยู่ในตาราง purchase_requisition / purchase_order / goods_receipt /
// purchase_return (+ ตารางลูก) ของ PostgreSQL
//
// **สี่ขั้นตอนของ U7/U9/U10 อยู่ในทรานแซกชันเดียวฝั่งเซิร์ฟเวอร์แล้ว** — การออกใบสั่งซื้อ
// ตอนอนุมัติ · การเพิ่มยอดสต็อกตอนรับสินค้า · การตัดสต็อกตอนส่งคืน · การแจ้งเตือน
// หน้าจอจึงห้ามทำซ้ำ แค่ `reload()` ทั้งสามชุดหลังทำรายการสำเร็จ
const loadPurchasing = async () => {
  const [requisitions, orders, receipts, returns, budget] = await Promise.all([
    apiGet<PurchaseRequisition[]>('/api/requisitions'),
    apiGet<PurchaseOrder[]>('/api/purchase-orders'),
    apiGet<GoodsReceipt[]>('/api/receipts'),
    apiGet<PurchaseReturn[]>('/api/returns'),
    apiGet<BudgetSummary>('/api/purchasing/budget'),
  ])
  return { requisitions, orders, receipts, returns, budget }
}

/** แถบงบประมาณบน SCR-23 — เดิมเป็นค่าคงที่ `PURCHASE_BUDGET` ฝั่งหน้าจอ */
export interface BudgetSummary {
  budget: number
  committed: number
  remaining: number
}

export interface RequisitionDraft {
  supplierId: number
  items: PurchaseRequisitionItem[]
}

export interface GoodsReceiptDraft {
  deliveryNoteNo: string
  lines: { bookId: number; receivedQty: number; condition: ItemCondition; note: string }[]
}

export interface ReturnDraft {
  reason: string
  items: PurchaseReturnItem[]
}

// ใส่แถวใหม่ต่อท้าย (id ยังไม่เคยมีในชุด) หรือแทนที่แถวเดิม (id มีอยู่แล้ว) เรียงตาม id
// ให้ตรงกับ ORDER BY ของ repository เสมอ — ใช้แทน reload() เมื่อเซิร์ฟเวอร์คืนแถวที่อัปเดต
// แล้วมาให้ครบสิ่งที่เปลี่ยนในเอกสารใบนั้นเอง โดยไม่กระทบเอกสารอื่น
function upsertById<T>(list: T[], row: T, id: (item: T) => number): T[] {
  const exists = list.some((item) => id(item) === id(row))
  if (exists) return list.map((item) => (id(item) === id(row) ? row : item))
  return [...list, row].sort((a, b) => id(a) - id(b))
}

interface PurchasingValue {
  requisitions: PurchaseRequisition[]
  orders: PurchaseOrder[]
  receipts: GoodsReceipt[]
  returns: PurchaseReturn[]
  budget: BudgetSummary
  loading: boolean
  error: string | null
  reload: () => Promise<void>

  findRequisition: (prId: number) => PurchaseRequisition | undefined
  findOrder: (poId: number) => PurchaseOrder | undefined
  findReturn: (returnId: number) => PurchaseReturn | undefined
  ordersForSupplier: (supplierId: number) => PurchaseOrder[]
  receiptsForOrder: (poId: number) => GoodsReceipt[]
  returnsForOrder: (poId: number) => PurchaseReturn[]

  // ผู้ทำรายการมาจาก JWT ทุกเส้นทาง หน้าจอไม่ต้องส่งชื่อไปเอง
  saveDraft: (draft: RequisitionDraft, prId?: number) => Promise<PurchaseRequisition>
  submitRequisition: (draft: RequisitionDraft, prId?: number) => Promise<PurchaseRequisition>
  /** U7 — เซิร์ฟเวอร์ออกใบสั่งซื้อและแจ้งเตือนให้ในทรานแซกชันเดียวกัน แล้วคืนใบที่ออก */
  approveRequisition: (prId: number, overBudgetNote?: string) => Promise<PurchaseOrder>
  rejectRequisition: (prId: number, reason: string) => Promise<void>
  sendOrder: (poId: number) => Promise<void>
  confirmOrder: (poId: number, expectedDeliveryDate: string) => Promise<void>
  /** SCR-24 Abnormal (U8) — ผู้จัดจำหน่ายเลิกส่งกลางคัน ยกเลิกใบสั่งซื้อได้ (ยกเว้นใบที่ปิดแล้ว) */
  cancelOrder: (poId: number, reason?: string) => Promise<void>
  /** U9 — เซิร์ฟเวอร์เพิ่มยอดสต็อกให้เอง หน้าจอไม่ต้องเรียกปรับสต็อกซ้ำ */
  receiveGoods: (poId: number, draft: GoodsReceiptDraft) => Promise<GoodsReceipt>
  /** U10 — เซิร์ฟเวอร์ตัดสต็อกให้เอง */
  createReturn: (poId: number, draft: ReturnDraft) => Promise<PurchaseReturn>
  escalateReturn: (returnId: number, note: string) => Promise<void>
  recordCompensation: (returnId: number, input: Pick<Compensation, 'type' | 'note'>) => Promise<void>
}

const PurchasingContext = createContext<PurchasingValue | null>(null)

const EMPTY_BUDGET: BudgetSummary = { budget: 0, committed: 0, remaining: 0 }

const toRequisitionBody = (draft: RequisitionDraft, submit: boolean) => ({
  supplierId: draft.supplierId,
  items: draft.items.map((item) => ({
    bookId: item.bookId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
  submit,
})

export function PurchasingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data, loading, error, reload, apply } = useResource(
    loadPurchasing,
    !!user && can.viewPurchasing(user.role),
  )
  const { reload: reloadInventory } = useInventory()
  const { reload: reloadNotifications } = useNotifications()

  const value = useMemo<PurchasingValue>(() => {
    const requisitions = data?.requisitions ?? []
    const orders = data?.orders ?? []
    const receipts = data?.receipts ?? []
    const returns = data?.returns ?? []

    // บางงาน (ออก PO ใหม่ตอนอนุมัติ · เพิ่มยอดสต็อกตอนรับของ · ปิด PO ตอนคืนครบ · ยอดงบที่เปลี่ยน
    // ตอนยกเลิก) เปลี่ยนมากกว่าที่ endpoint นั้นคืนมาให้ — ใช้ reload() ทั้งชุดเฉพาะงานพวกนี้
    // ส่วนงานที่เปลี่ยนแค่เอกสารใบเดียวและเซิร์ฟเวอร์คืนแถวที่อัปเดตแล้วมาให้ครบ ใช้ apply()
    // แทน ไม่งั้น reload() จะตั้ง loading:true แล้วทำให้ตัวห่อของฟอร์ม (เช่น RequisitionFormPage)
    // unmount ฟอร์มทิ้งกลางคัน ข้อมูลที่ผู้ใช้พิมพ์ค้างอยู่หายไปเงียบ ๆ
    const refresh = async (also: { stock?: boolean; alerts?: boolean } = {}) => {
      await Promise.all([
        reload(),
        ...(also.stock ? [reloadInventory()] : []),
        ...(also.alerts ? [reloadNotifications()] : []),
      ])
    }

    const applyRequisition = (row: PurchaseRequisition) =>
      apply((current) => ({
        ...current,
        requisitions: upsertById(current.requisitions, row, (pr) => pr.prId),
      }))
    const applyOrder = (row: PurchaseOrder) =>
      apply((current) => ({
        ...current,
        orders: upsertById(current.orders, row, (po) => po.poId),
      }))
    const applyReturn = (row: PurchaseReturn) =>
      apply((current) => ({
        ...current,
        returns: upsertById(current.returns, row, (rt) => rt.returnId),
      }))

    const saveRequisition = async (
      draft: RequisitionDraft,
      submit: boolean,
      prId?: number,
    ) => {
      const body = toRequisitionBody(draft, submit)
      const saved =
        prId === undefined
          ? await apiPost<PurchaseRequisition>('/api/requisitions', body)
          : await apiPut<PurchaseRequisition>(`/api/requisitions/${prId}`, body)
      applyRequisition(saved)
      // เซิร์ฟเวอร์แจ้งผู้จัดการเฉพาะตอนที่ใบถูกยื่น — บันทึกร่างไว้เฉย ๆ ไม่ออกแจ้งเตือน
      if (submit) await reloadNotifications()
      return saved
    }

    return {
      requisitions,
      orders,
      receipts,
      returns,
      budget: data?.budget ?? EMPTY_BUDGET,
      loading,
      error,
      reload,

      findRequisition: (prId: number) => requisitions.find((pr) => pr.prId === prId),
      findOrder: (poId: number) => orders.find((po) => po.poId === poId),
      findReturn: (returnId: number) => returns.find((row) => row.returnId === returnId),
      ordersForSupplier: (supplierId: number) =>
        orders.filter((po) => po.supplierId === supplierId),
      receiptsForOrder: (poId: number) => receipts.filter((grn) => grn.poId === poId),
      returnsForOrder: (poId: number) => returns.filter((row) => row.poId === poId),

      saveDraft: (draft, prId) => saveRequisition(draft, false, prId),
      submitRequisition: (draft, prId) => saveRequisition(draft, true, prId),

      approveRequisition: async (prId, overBudgetNote) => {
        const order = await apiPost<PurchaseOrder>(`/api/requisitions/${prId}/approve`, {
          overBudgetNote: overBudgetNote ?? '',
        })
        // ออกใบสั่งซื้อ + แจ้งคลังสินค้า · ของยังไม่เข้าคลัง สต็อกจึงไม่ขยับ
        await refresh({ alerts: true })
        return order
      },
      rejectRequisition: async (prId, reason) => {
        const updated = await apiPost<PurchaseRequisition>(`/api/requisitions/${prId}/reject`, { reason })
        applyRequisition(updated)
        await reloadNotifications()
      },
      // ส่งใบและยืนยันวันส่งเปลี่ยนแค่สถานะเอกสาร ไม่แตะสต็อกและไม่ออกแจ้งเตือน
      sendOrder: async (poId) => {
        const updated = await apiPost<PurchaseOrder>(`/api/purchase-orders/${poId}/send`)
        applyOrder(updated)
      },
      confirmOrder: async (poId, expectedDeliveryDate) => {
        const updated = await apiPost<PurchaseOrder>(`/api/purchase-orders/${poId}/confirm`, {
          expectedDeliveryDate,
        })
        applyOrder(updated)
      },
      // ยอดผูกพันงบประมาณเปลี่ยนตอนยกเลิก (ใบ CANCELLED นับตามจำนวนที่รับจริง) และแจ้งผู้จัดการ
      // เสมอ — เปลี่ยนมากกว่าที่ endpoint นี้คืนมาให้ จึง reload() ทั้งชุดเหมือน approve/receive
      cancelOrder: async (poId, reason) => {
        await apiPost(`/api/purchase-orders/${poId}/cancel`, { reason: reason ?? '' })
        await refresh({ alerts: true })
      },
      receiveGoods: async (poId, draft) => {
        const receipt = await apiPost<GoodsReceipt>(
          `/api/purchase-orders/${poId}/receipts`,
          {
            deliveryNoteNo: draft.deliveryNoteNo,
            lines: draft.lines.map((line) => ({
              bookId: line.bookId,
              receivedQty: line.receivedQty,
              condition: line.condition,
              note: line.note,
            })),
          },
        )
        // U9 เพิ่มยอดสต็อกและแจ้งผู้จัดการในทรานแซกชันเดียวกับใบรับ
        await refresh({ stock: true, alerts: true })
        return receipt
      },
      createReturn: async (poId, draft) => {
        const created = await apiPost<PurchaseReturn>(
          `/api/purchase-orders/${poId}/returns`,
          {
            reason: draft.reason,
            items: draft.items.map((item) => ({
              bookId: item.bookId,
              quantity: item.quantity,
              reason: item.reason,
              evidence: item.evidence ?? '',
            })),
          },
        )
        // U10 ตัดสต็อกให้ในทรานแซกชันเดียวกับใบคืน · ไม่ออกแจ้งเตือนจนกว่าจะยกระดับ
        await refresh({ stock: true })
        return created
      },
      escalateReturn: async (returnId, note) => {
        const updated = await apiPost<PurchaseReturn>(`/api/returns/${returnId}/escalate`, { note })
        applyReturn(updated)
        await reloadNotifications()
      },
      recordCompensation: async (returnId, input) => {
        const updated = await apiPost<PurchaseReturn>(`/api/returns/${returnId}/compensation`, input)
        applyReturn(updated)
        // ชดเชยแบบ REPLACEMENT เพิ่มสต็อกคืน · แบบอื่นไม่แตะ แต่แยกไม่ได้จากฝั่งนี้ จึง reload เผื่อไว้เสมอ
        await reloadInventory()
      },
    }
  }, [data, loading, error, reload, apply, reloadInventory, reloadNotifications])

  return <PurchasingContext.Provider value={value}>{children}</PurchasingContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePurchasing(): PurchasingValue {
  const ctx = useContext(PurchasingContext)
  if (!ctx) throw new Error('usePurchasing must be used within a PurchasingProvider')
  return ctx
}
