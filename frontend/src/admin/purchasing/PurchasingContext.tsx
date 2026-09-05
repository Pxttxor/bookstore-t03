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
  /** U9 — เซิร์ฟเวอร์เพิ่มยอดสต็อกให้เอง หน้าจอไม่ต้องเรียกปรับสต็อกซ้ำ */
  receiveGoods: (poId: number, draft: GoodsReceiptDraft) => Promise<GoodsReceipt>
  /** U10 — เซิร์ฟเวอร์ตัดสต็อกให้เอง */
  createReturn: (poId: number, draft: ReturnDraft) => Promise<PurchaseReturn>
  escalateReturn: (returnId: number, note: string) => Promise<void>
  recordCompensation: (returnId: number, compensation: Compensation) => Promise<void>
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
  const { data, loading, error, reload } = useResource(loadPurchasing, !!user && can.viewPurchasing(user.role))
  const { reload: reloadInventory } = useInventory()
  const { reload: reloadNotifications } = useNotifications()

  const value = useMemo<PurchasingValue>(() => {
    const requisitions = data?.requisitions ?? []
    const orders = data?.orders ?? []
    const receipts = data?.receipts ?? []
    const returns = data?.returns ?? []

    // งานจัดซื้อแต่ละอย่างมีผลข้างเคียงฝั่งเซิร์ฟเวอร์ไม่เท่ากัน — โหลดใหม่เฉพาะชุดที่เปลี่ยนจริง
    //
    // เดิมเรียกทั้งสามชุดทุกครั้ง ทำให้กดรับสินค้าหนึ่งครั้งได้คำขอตามหลังเก้าอัน
    // ทั้งที่บางงาน (ส่งใบสั่งซื้อ · ยืนยันวันส่ง) ไม่แตะสต็อกและไม่ออกแจ้งเตือนเลย
    //
    // เอกสารจัดซื้อต้องโหลดใหม่เสมอ เพราะทุกงานเปลี่ยนสถานะเอกสารอย่างน้อยหนึ่งใบ
    // และ `/api/purchasing/budget` คิดจากใบที่ยังคงค้างอยู่
    const refresh = async (also: { stock?: boolean; alerts?: boolean } = {}) => {
      await Promise.all([
        reload(),
        ...(also.stock ? [reloadInventory()] : []),
        ...(also.alerts ? [reloadNotifications()] : []),
      ])
    }

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
      // เซิร์ฟเวอร์แจ้งผู้จัดการเฉพาะตอนที่ใบถูกยื่น — บันทึกร่างไว้เฉย ๆ ไม่ออกแจ้งเตือน
      await refresh({ alerts: submit })
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
        await apiPost(`/api/requisitions/${prId}/reject`, { reason })
        await refresh({ alerts: true })
      },
      // ส่งใบและยืนยันวันส่งเปลี่ยนแค่สถานะเอกสาร ไม่แตะสต็อกและไม่ออกแจ้งเตือน
      sendOrder: async (poId) => {
        await apiPost(`/api/purchase-orders/${poId}/send`)
        await refresh()
      },
      confirmOrder: async (poId, expectedDeliveryDate) => {
        await apiPost(`/api/purchase-orders/${poId}/confirm`, { expectedDeliveryDate })
        await refresh()
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
        await apiPost(`/api/returns/${returnId}/escalate`, { note })
        await refresh({ alerts: true })
      },
      recordCompensation: async (returnId, compensation) => {
        await apiPost(`/api/returns/${returnId}/compensation`, {
          type: compensation.type,
          note: compensation.note,
        })
        // ชดเชยแบบ REPLACEMENT เพิ่มสต็อกคืน · แบบอื่นไม่แตะ แต่แยกไม่ได้จากฝั่งนี้
        await refresh({ stock: true })
      },
    }
  }, [data, loading, error, reload, reloadInventory, reloadNotifications])

  return <PurchasingContext.Provider value={value}>{children}</PurchasingContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePurchasing(): PurchasingValue {
  const ctx = useContext(PurchasingContext)
  if (!ctx) throw new Error('usePurchasing must be used within a PurchasingProvider')
  return ctx
}
