import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SEED_SUPPLIERS, type Deactivation, type Supplier } from './suppliers'

// v2 dropped Supplier.purchaseOrders — orders now live in the purchasing subsystem.
// A blob written under the old key would deserialise into a shape that no longer
// matches, so the key is bumped rather than migrated.
const STORAGE_KEY = 'bookhaven.suppliers.v2'

export type SupplierDraft = Omit<
  Supplier,
  'supplierId' | 'status' | 'editHistory' | 'deactivation'
>

interface SupplierValue {
  suppliers: Supplier[]
  findById: (supplierId: number) => Supplier | undefined
  findByCompanyName: (companyName: string, ignoreId?: number) => Supplier | undefined
  add: (draft: SupplierDraft) => Supplier
  update: (supplierId: number, draft: SupplierDraft, by: string) => Supplier
  deactivate: (supplierId: number, deactivation: Deactivation) => void
}

const SupplierContext = createContext<SupplierValue | null>(null)

function read(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED_SUPPLIERS
    const parsed = JSON.parse(raw) as Supplier[]
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_SUPPLIERS
  } catch {
    return SEED_SUPPLIERS
  }
}

function write(suppliers: Supplier[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers))
}

const key = (name: string) => name.trim().toLowerCase()

export function SupplierProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(read)

  const value = useMemo<SupplierValue>(() => {
    const persist = (next: Supplier[]) => {
      write(next)
      setSuppliers(next)
    }

    const findById = (supplierId: number) =>
      suppliers.find((s) => s.supplierId === supplierId)

    const findByCompanyName = (companyName: string, ignoreId?: number) =>
      suppliers.find(
        (s) => key(s.companyName) === key(companyName) && s.supplierId !== ignoreId,
      )

    const add = (draft: SupplierDraft) => {
      const nextId = suppliers.reduce((max, s) => Math.max(max, s.supplierId), 0) + 1
      const supplier: Supplier = {
        ...draft,
        supplierId: nextId,
        status: 'ACTIVE',
        editHistory: [],
      }
      persist([...suppliers, supplier])
      return supplier
    }

    const update = (supplierId: number, draft: SupplierDraft, by: string) => {
      const current = suppliers.find((s) => s.supplierId === supplierId)
      if (!current) throw new Error('ไม่พบข้อมูลผู้จัดจำหน่าย')

      const updated: Supplier = {
        ...current,
        ...draft,
        editHistory: [
          ...current.editHistory,
          { at: new Date().toISOString(), by, summary: describeChanges(current, draft) },
        ],
      }
      persist(suppliers.map((s) => (s.supplierId === supplierId ? updated : s)))
      return updated
    }

    const deactivate = (supplierId: number, deactivation: Deactivation) => {
      persist(
        suppliers.map((s) =>
          s.supplierId === supplierId
            ? { ...s, status: 'CANCELLED' as const, deactivation }
            : s,
        ),
      )
    }

    return { suppliers, findById, findByCompanyName, add, update, deactivate }
  }, [suppliers])

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>
}

const FIELD_LABELS: Record<string, string> = {
  companyName: 'ชื่อบริษัท',
  contactName: 'ผู้ติดต่อ',
  phone: 'เบอร์โทร',
  email: 'อีเมล',
  address: 'ที่อยู่',
  tradeTerms: 'เงื่อนไขการค้า',
  creditTerms: 'เงื่อนไขเครดิต',
}

function describeChanges(before: Supplier, after: SupplierDraft) {
  const changed = Object.keys(FIELD_LABELS).filter(
    (field) =>
      before[field as keyof Supplier] !== after[field as keyof SupplierDraft],
  )
  if (before.books.length !== after.books.length) changed.push('books')

  const labels = changed.map((field) => FIELD_LABELS[field] ?? 'รายการหนังสือ')
  return labels.length ? `แก้ไข ${labels.join(', ')}` : 'บันทึกข้อมูลโดยไม่มีการเปลี่ยนแปลง'
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSuppliers(): SupplierValue {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSuppliers must be used within a SupplierProvider')
  return ctx
}
