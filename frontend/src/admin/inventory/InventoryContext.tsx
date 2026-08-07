import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  isBelowReorder,
  SEED_INVENTORY,
  SEED_STOCK_TRANSACTIONS,
  type InventoryItem,
  type StockTransaction,
  type StockTxnType,
} from './inventory'

const STORAGE_KEY = 'bookhaven.inventory.v1'

export interface StockChange {
  bookId: number
  type: StockTxnType
  quantityChange: number
  reason: string
  referenceDoc: string
}

interface Stored {
  items: InventoryItem[]
  transactions: StockTransaction[]
}

interface InventoryValue {
  items: InventoryItem[]
  transactions: StockTransaction[]
  findByBookId: (bookId: number) => InventoryItem | undefined
  belowReorder: InventoryItem[]
  /** Applies several movements as one write so a whole GRN lands together. */
  applyStockChanges: (changes: StockChange[]) => void
  setReorderPoint: (bookId: number, reorderPoint: number) => void
}

const InventoryContext = createContext<InventoryValue | null>(null)

const SEED: Stored = { items: SEED_INVENTORY, transactions: SEED_STOCK_TRANSACTIONS }

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

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(read)

  const value = useMemo<InventoryValue>(() => {
    const persist = (next: Stored) => {
      write(next)
      setStored(next)
    }

    const findByBookId = (bookId: number) =>
      stored.items.find((entry) => entry.bookId === bookId)

    const applyStockChanges = (changes: StockChange[]) => {
      if (!changes.length) return
      const now = new Date().toISOString()
      let nextTxnId = stored.transactions.reduce((max, txn) => Math.max(max, txn.txnId), 0) + 1

      const items = stored.items.map((entry) => {
        const delta = changes
          .filter((change) => change.bookId === entry.bookId)
          .reduce((sum, change) => sum + change.quantityChange, 0)
        if (!delta) return entry
        return {
          ...entry,
          quantityOnHand: Math.max(0, entry.quantityOnHand + delta),
          lastUpdated: now,
        }
      })

      const transactions = [
        ...stored.transactions,
        ...changes.map<StockTransaction>((change) => ({
          txnId: nextTxnId++,
          bookId: change.bookId,
          type: change.type,
          quantityChange: change.quantityChange,
          reason: change.reason,
          referenceDoc: change.referenceDoc,
          txnDate: now,
        })),
      ]

      persist({ items, transactions })
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

    return {
      items: stored.items,
      transactions: stored.transactions,
      findByBookId,
      belowReorder: stored.items.filter(isBelowReorder),
      applyStockChanges,
      setReorderPoint,
    }
  }, [stored])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory(): InventoryValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider')
  return ctx
}
