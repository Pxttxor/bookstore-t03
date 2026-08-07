import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNotifications } from '../notifications/NotificationContext'
import {
  computeVariance,
  formatCountCode,
  formatReportCode,
  isBelowReorder,
  SEED_DISCREPANCY_REPORTS,
  SEED_INVENTORY,
  SEED_STOCK_COUNTS,
  SEED_STOCK_TRANSACTIONS,
  type InventoryItem,
  type StockCount,
  type StockDiscrepancyReport,
  type StockTransaction,
  type StockTxnType,
} from './inventory'

// v2 added the stock-count rounds and their discrepancy reports to the persisted shape.
// A blob written under v1 would deserialise into a type that no longer matches, so the
// key is bumped rather than migrated.
const STORAGE_KEY = 'bookhaven.inventory.v2'

export interface StockChange {
  bookId: number
  type: StockTxnType
  quantityChange: number
  reason: string
  referenceDoc: string
}

/** One line of a manual stock adjustment. quantityChange is signed. */
export interface AdjustLine {
  bookId: number
  quantityChange: number
  reason: string
  referenceDoc: string
}

export interface StockCountDraft {
  countedBy: string
  items: { bookId: number; systemQty: number; countedQty: number }[]
}

interface Stored {
  items: InventoryItem[]
  transactions: StockTransaction[]
  counts: StockCount[]
  reports: StockDiscrepancyReport[]
}

interface InventoryValue {
  items: InventoryItem[]
  transactions: StockTransaction[]
  findByBookId: (bookId: number) => InventoryItem | undefined
  belowReorder: InventoryItem[]
  /** Applies several movements as one write so a whole GRN lands together. */
  applyStockChanges: (changes: StockChange[]) => void
  setReorderPoint: (bookId: number, reorderPoint: number) => void

  counts: StockCount[]
  reports: StockDiscrepancyReport[]
  findCount: (countId: number) => StockCount | undefined
  /** The movement history of one title, newest first. */
  transactionsForBook: (bookId: number) => StockTransaction[]
  /** Drives the sidebar dot and the store manager's dashboard tile. */
  pendingReports: StockDiscrepancyReport[]
  /** InventoryItem.adjust(). Refuses the whole batch if any line would go below zero. */
  adjustStock: (lines: AdjustLine[]) => void
  /** Saves a counting round, opens one report per variance and alerts the manager. */
  saveStockCount: (draft: StockCountDraft) => StockCount
  /** Sets on-hand to the counted figure and approves the report, in one write. */
  resolveDiscrepancy: (reportId: number, note: string, by: string) => void
  /** Rejects the report and leaves stock untouched. */
  rejectDiscrepancy: (reportId: number, note: string, by: string) => void
}

const InventoryContext = createContext<InventoryValue | null>(null)

const SEED: Stored = {
  items: SEED_INVENTORY,
  transactions: SEED_STOCK_TRANSACTIONS,
  counts: SEED_STOCK_COUNTS,
  reports: SEED_DISCREPANCY_REPORTS,
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED
    const parsed = JSON.parse(raw) as Stored
    return Array.isArray(parsed?.items) && parsed.items.length ? parsed : SEED
  } catch {
    return SEED
  }
}

function write(stored: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

const nextId = <T,>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((max, row) => Math.max(max, pick(row)), 0) + 1

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(read)
  const { push } = useNotifications()

  const value = useMemo<InventoryValue>(() => {
    const persist = (next: Stored) => {
      write(next)
      setStored(next)
    }

    const findByBookId = (bookId: number) =>
      stored.items.find((entry) => entry.bookId === bookId)

    // Writes the movement rows and moves the on-hand figures in one pass. `clamp` is
    // what separates the goods-receipt path (floors at zero, which is safe there) from
    // a manual adjustment, whose whole point is to refuse a negative balance.
    const applyMovements = (base: Stored, changes: StockChange[], clamp: boolean): Stored => {
      const now = new Date().toISOString()
      let txnId = nextId(base.transactions, (entry) => entry.txnId)

      const items = base.items.map((entry) => {
        const delta = changes
          .filter((change) => change.bookId === entry.bookId)
          .reduce((sum, change) => sum + change.quantityChange, 0)
        if (!delta) return entry
        const raw = entry.quantityOnHand + delta
        return {
          ...entry,
          quantityOnHand: clamp ? Math.max(0, raw) : raw,
          lastUpdated: now,
        }
      })

      const transactions = [
        ...base.transactions,
        ...changes.map<StockTransaction>((change) => ({
          txnId: txnId++,
          bookId: change.bookId,
          type: change.type,
          quantityChange: change.quantityChange,
          reason: change.reason,
          referenceDoc: change.referenceDoc,
          txnDate: now,
        })),
      ]

      return { ...base, items, transactions }
    }

    const applyStockChanges = (changes: StockChange[]) => {
      if (!changes.length) return
      persist(applyMovements(stored, changes, true))
    }

    const adjustStock = (lines: AdjustLine[]) => {
      if (!lines.length) return

      // Check every title before writing anything — a manual adjustment must not be
      // allowed to drive a balance below zero, and a partial write would be worse.
      for (const bookId of new Set(lines.map((line) => line.bookId))) {
        const onHand = findByBookId(bookId)?.quantityOnHand ?? 0
        const delta = lines
          .filter((line) => line.bookId === bookId)
          .reduce((sum, line) => sum + line.quantityChange, 0)
        if (onHand + delta < 0) throw new Error('ยอดคงเหลือติดลบ ไม่สามารถบันทึกได้')
      }

      persist(
        applyMovements(
          stored,
          lines.map((line) => ({ ...line, type: 'ADJUSTMENT' as const })),
          false,
        ),
      )
    }

    const setReorderPoint = (bookId: number, reorderPoint: number) => {
      persist({
        ...stored,
        items: stored.items.map((entry) =>
          entry.bookId === bookId
            ? { ...entry, reorderPoint, lastUpdated: new Date().toISOString() }
            : entry,
        ),
      })
    }

    const saveStockCount = (draft: StockCountDraft) => {
      const now = new Date().toISOString()
      const countId = nextId(stored.counts, (entry) => entry.countId)
      let reportId = nextId(stored.reports, (entry) => entry.reportId)

      const reports: StockDiscrepancyReport[] = []
      const items = draft.items.map((line) => {
        const variance = computeVariance(line.systemQty, line.countedQty)
        if (variance === 0) return { ...line, variance }

        const report: StockDiscrepancyReport = {
          reportId: reportId++,
          countId,
          bookId: line.bookId,
          variance,
          approvalStatus: 'PENDING',
          note: '',
          reportedBy: draft.countedBy,
          reportedAt: now,
        }
        reports.push(report)
        return { ...line, variance, reportId: report.reportId }
      })

      const count: StockCount = {
        countId,
        countDate: now.slice(0, 10),
        status: 'DONE',
        countedBy: draft.countedBy,
        items,
      }

      persist({
        ...stored,
        counts: [...stored.counts, count],
        reports: [...stored.reports, ...reports],
      })

      if (reports.length) {
        const body =
          `${formatCountCode(countId)} · พบ ${reports.length} รายการที่จำนวนไม่ตรง · ` +
          `ผู้ตรวจนับ ${draft.countedBy}`
        push(
          (['in-app', 'email'] as const).map((channel) => ({
            to: 'manager' as const,
            kind: 'STOCK_DISCREPANCY' as const,
            title: 'พบจำนวนหนังสือคลาดเคลื่อน',
            body,
            link: '/admin/stock/discrepancies',
            channel,
          })),
        )
      }

      return count
    }

    const decide = (
      reportId: number,
      approvalStatus: 'APPROVED' | 'REJECTED',
      note: string,
      by: string,
    ) => {
      const report = stored.reports.find((entry) => entry.reportId === reportId)
      if (!report || report.approvalStatus !== 'PENDING') return
      const now = new Date().toISOString()

      const decided: Stored = {
        ...stored,
        reports: stored.reports.map((entry) =>
          entry.reportId === reportId
            ? { ...entry, approvalStatus, note, resolvedBy: by, resolvedAt: now }
            : entry,
        ),
      }

      if (approvalStatus === 'REJECTED') {
        persist(decided)
        return
      }

      // Set on-hand to the figure that was actually counted rather than adding the
      // stored variance, which may be stale if the title moved since the count.
      const counted = stored.counts
        .find((count) => count.countId === report.countId)
        ?.items.find((line) => line.bookId === report.bookId)?.countedQty
      if (counted === undefined) {
        persist(decided)
        return
      }

      const onHand = findByBookId(report.bookId)?.quantityOnHand ?? 0
      const quantityChange = counted - onHand
      if (!quantityChange) {
        persist(decided)
        return
      }

      persist(
        applyMovements(
          decided,
          [
            {
              bookId: report.bookId,
              type: 'ADJUSTMENT',
              quantityChange,
              reason: 'ปรับปรุงยอดตามผลการตรวจนับ',
              referenceDoc: formatReportCode(reportId),
            },
          ],
          false,
        ),
      )
    }

    return {
      items: stored.items,
      transactions: stored.transactions,
      findByBookId,
      belowReorder: stored.items.filter(isBelowReorder),
      applyStockChanges,
      setReorderPoint,

      counts: stored.counts,
      reports: stored.reports,
      findCount: (countId: number) => stored.counts.find((count) => count.countId === countId),
      transactionsForBook: (bookId: number) =>
        stored.transactions
          .filter((entry) => entry.bookId === bookId)
          .sort((a, b) => b.txnDate.localeCompare(a.txnDate) || b.txnId - a.txnId),
      pendingReports: stored.reports.filter((entry) => entry.approvalStatus === 'PENDING'),
      adjustStock,
      saveStockCount,
      resolveDiscrepancy: (reportId, note, by) => decide(reportId, 'APPROVED', note, by),
      rejectDiscrepancy: (reportId, note, by) => decide(reportId, 'REJECTED', note, by),
    }
  }, [stored, push])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory(): InventoryValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider')
  return ctx
}
