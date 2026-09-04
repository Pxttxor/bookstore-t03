import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import {
  isBelowReorder,
  type InventoryItem,
  type StockCount,
  type StockDiscrepancyReport,
  type StockTransaction,
} from './inventory'

// ข้อมูลอยู่ในตาราง inventory_item / stock_transaction / stock_count / stock_count_item
// / stock_discrepancy_report ของ PostgreSQL แล้ว · เดิมเป็น blob ก้อนเดียวใน localStorage
// คีย์ bookhaven.inventory.v3
//
// สามชุดนี้เป็นคนละ endpoint จึงยิงขนานกันแล้วรวมเป็นก้อนเดียวให้หน้าจอเหมือนเดิม
const loadInventory = async () => {
  const [items, counts, reports] = await Promise.all([
    apiGet<InventoryItem[]>('/api/inventory'),
    apiGet<StockCount[]>('/api/stock-counts'),
    apiGet<StockDiscrepancyReport[]>('/api/discrepancies'),
  ])
  return { items, counts, reports }
}

// Sales may read stock, but must not request warehouse-only counts/discrepancies.
const loadStockOnly = async () => ({
  items: await apiGet<InventoryItem[]>('/api/inventory'),
  counts: [] as StockCount[],
  reports: [] as StockDiscrepancyReport[],
})

/** One line of a manual stock adjustment. quantityChange is signed. */
export interface AdjustLine {
  bookId: number
  quantityChange: number
  reason: string
  referenceDoc: string
}

/** ผู้ตรวจนับมาจาก JWT และยอดในระบบเซิร์ฟเวอร์อ่านเอง หน้าจอส่งแค่ยอดที่นับได้ */
export interface StockCountDraft {
  items: { bookId: number; countedQty: number }[]
}

interface InventoryValue {
  items: InventoryItem[]
  counts: StockCount[]
  reports: StockDiscrepancyReport[]
  loading: boolean
  error: string | null
  /** เรียกหลังงานที่ทำให้สต็อกขยับฝั่งเซิร์ฟเวอร์ เช่นการรับสินค้าเข้าคลัง (U9) */
  reload: () => Promise<void>
  findByBookId: (bookId: number) => InventoryItem | undefined
  belowReorder: InventoryItem[]
  findCount: (countId: number) => StockCount | undefined
  /**
   * ประวัติการเคลื่อนไหวของหนังสือเล่มหนึ่ง ล่าสุดขึ้นก่อน
   *
   * ไม่มี endpoint ที่คืนรายการเคลื่อนไหวทั้งระบบ (ตารางโตเร็วเกินจะดึงมาทั้งก้อน)
   * จึงอ่านทีละเล่มผ่าน `GET /api/books/{id}/stock-transactions`
   */
  transactionsForBook: (bookId: number) => Promise<StockTransaction[]>
  /** Drives the sidebar dot and the store manager's dashboard tile. */
  pendingReports: StockDiscrepancyReport[]
  setReorderPoint: (bookId: number, reorderPoint: number) => Promise<void>
  /** InventoryItem.adjust(). เซิร์ฟเวอร์ปฏิเสธทั้งชุดถ้าบรรทัดไหนทำให้ยอดติดลบ */
  adjustStock: (lines: AdjustLine[]) => Promise<void>
  /** บันทึกรอบตรวจนับ · เซิร์ฟเวอร์เปิดรายงานผลต่างและแจ้งผู้จัดการให้ในทรานแซกชันเดียว */
  saveStockCount: (draft: StockCountDraft) => Promise<StockCount>
  /** ตั้งยอดคงเหลือเท่าที่นับได้แล้วอนุมัติรายงาน ในการเขียนครั้งเดียว */
  resolveDiscrepancy: (reportId: number, note: string) => Promise<void>
  /** ปฏิเสธรายงานโดยไม่แตะยอดคงเหลือ */
  rejectDiscrepancy: (reportId: number, note: string) => Promise<void>
}

const InventoryContext = createContext<InventoryValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const loader = user && can.viewStockCounts(user.role) ? loadInventory : loadStockOnly
  const { data, loading, error, reload, apply } = useResource(loader, !!user && can.viewStock(user.role))

  const value = useMemo<InventoryValue>(() => {
    const items = data?.items ?? []
    const counts = data?.counts ?? []
    const reports = data?.reports ?? []

    const findByBookId = (bookId: number) => items.find((entry) => entry.bookId === bookId)

    // `GET /api/inventory` กับเส้นทางนี้คืน model.InventoryItem ตัวเดียวกัน (ไม่ผ่าน DTO)
    // จึงต่อลงชุดเดิมได้ · จุดสั่งซื้อไม่กระทบรอบตรวจนับหรือรายงานผลต่าง ไม่ต้องโหลดสองชุดนั้น
    const setReorderPoint = async (bookId: number, reorderPoint: number) => {
      const updated = await apiPut<InventoryItem>(
        `/api/inventory/${bookId}/reorder-point`,
        { reorderPoint },
      )
      apply((current) => ({
        ...current,
        items: current.items.map((row) => (row.bookId === bookId ? updated : row)),
      }))
    }

    // การตรวจยอดติดลบย้ายไปอยู่ฝั่งเซิร์ฟเวอร์แล้ว (`ApplyStrictStockChanges` +
    // `assertNoNegativeStock` ตรวจทุกเล่มให้ครบก่อนเขียน) หน้าจอจึงแค่ส่งไปแล้วจับ error
    const adjustStock = async (lines: AdjustLine[]) => {
      if (!lines.length) return
      await apiPost('/api/inventory/adjust', {
        lines: lines.map((line) => ({
          bookId: line.bookId,
          quantityChange: line.quantityChange,
          reason: line.reason,
          referenceDoc: line.referenceDoc,
        })),
      })
      await reload()
    }

    // เดิมหน้าจอคำนวณผลต่าง เปิดรายงานเอง และยิงแจ้งเตือนเอง — ตอนนี้เซิร์ฟเวอร์ทำทั้งหมด
    // ในทรานแซกชันเดียว ถ้าหน้าจอยิงแจ้งเตือนซ้ำจะได้แถวซ้ำสองเท่า
    const saveStockCount = async (draft: StockCountDraft) => {
      const count = await apiPost<StockCount>('/api/stock-counts', {
        items: draft.items.map((line) => ({
          bookId: line.bookId,
          countedQty: line.countedQty,
        })),
      })
      await reload()
      return count
    }

    const decide = async (reportId: number, action: 'approve' | 'reject', note: string) => {
      await apiPost(`/api/discrepancies/${reportId}/${action}`, { note })
      await reload()
    }

    return {
      items,
      counts,
      reports,
      loading,
      error,
      reload,
      findByBookId,
      belowReorder: items.filter(isBelowReorder),
      findCount: (countId: number) => counts.find((count) => count.countId === countId),
      transactionsForBook: (bookId: number) =>
        apiGet<StockTransaction[]>(`/api/books/${bookId}/stock-transactions`),
      pendingReports: reports.filter((entry) => entry.approvalStatus === 'PENDING'),
      setReorderPoint,
      adjustStock,
      saveStockCount,
      resolveDiscrepancy: (reportId, note) => decide(reportId, 'approve', note),
      rejectDiscrepancy: (reportId, note) => decide(reportId, 'reject', note),
    }
  }, [data, loading, error, reload, apply])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory(): InventoryValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider')
  return ctx
}
