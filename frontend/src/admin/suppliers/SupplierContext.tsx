import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../../api/client'
import { useResource } from '../../api/useResource'
import type { Deactivation, Supplier } from './suppliers'

// ข้อมูลอยู่ในตาราง supplier / supplier_book / supplier_edit_log / supplier_deactivation
// ของ PostgreSQL แล้ว · เดิมเก็บใน localStorage คีย์ bookhaven.suppliers.v2
//
// ประกาศไว้ระดับโมดูลเพื่อให้ useResource ได้ฟังก์ชันที่อ้างอิงคงที่
const loadSuppliers = () => apiGet<Supplier[]>('/api/suppliers')

export type SupplierDraft = Omit<
  Supplier,
  'supplierId' | 'status' | 'editHistory' | 'deactivation'
>

interface SupplierValue {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findById: (supplierId: number) => Supplier | undefined
  findByCompanyName: (companyName: string, ignoreId?: number) => Supplier | undefined
  add: (draft: SupplierDraft) => Promise<Supplier>
  /** ผู้แก้ไขมาจาก JWT ฝั่งเซิร์ฟเวอร์ หน้าจอไม่ต้องส่งชื่อมาเอง */
  update: (supplierId: number, draft: SupplierDraft) => Promise<Supplier>
  deactivate: (supplierId: number, deactivation: Deactivation) => Promise<void>
}

const SupplierContext = createContext<SupplierValue | null>(null)

const key = (name: string) => name.trim().toLowerCase()

// SupplierInput ฝั่ง Go รับรายการหนังสือแค่สามฟิลด์ — ชื่อ/ผู้แต่ง/สำนักพิมพ์/ISBN
// เป็นของตาราง book ซึ่ง DTO ดึงมาเติมให้ตอนอ่าน · handler เปิด DisallowUnknownFields ไว้
// ถ้าส่งฟิลด์เกินไปจะได้ 422 INVALID_BODY ทันที
const toBody = (draft: SupplierDraft) => ({
  companyName: draft.companyName,
  contactName: draft.contactName,
  phone: draft.phone,
  email: draft.email,
  address: draft.address,
  tradeTerms: draft.tradeTerms,
  creditTerms: draft.creditTerms,
  books: draft.books.map((book) => ({
    bookId: book.bookId,
    supplyPrice: book.supplyPrice,
    leadTimeDays: book.leadTimeDays,
  })),
})

export function SupplierProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, apply } = useResource(loadSuppliers)

  const value = useMemo<SupplierValue>(() => {
    const suppliers = data ?? []

    const findById = (supplierId: number) =>
      suppliers.find((s) => s.supplierId === supplierId)

    // ตรวจชื่อซ้ำจากรายการที่โหลดมาแล้ว เพื่อเตือนผู้ใช้ก่อนกดบันทึก
    // เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น (SUPPLIER_DUPLICATE) และถือเป็นคำตัดสินสุดท้าย
    const findByCompanyName = (companyName: string, ignoreId?: number) =>
      suppliers.find(
        (s) => key(s.companyName) === key(companyName) && s.supplierId !== ignoreId,
      )

    // แถวที่เซิร์ฟเวอร์คืนมาคือความจริงล่าสุดของรายนั้น (ผ่าน toSupplierDTO เหมือนตอน
    // อ่านลิสต์ทุกประการ) จึงต่อลงชุดเดิมได้เลย ไม่ต้องถาม GET /api/suppliers ซ้ำ
    const replace = (updated: Supplier) => (list: Supplier[]) =>
      list.map((row) => (row.supplierId === updated.supplierId ? updated : row))

    // id มาจาก sequence ของ PostgreSQL — ห้ามคำนวณ max+1 ฝั่งนี้อีก
    const add = async (draft: SupplierDraft) => {
      const created = await apiPost<Supplier>('/api/suppliers', toBody(draft))
      // เรียงตามรหัสให้ตรงกับ ORDER BY supplier_id ของ repository
      apply((list) => [...list, created].sort((a, b) => a.supplierId - b.supplierId))
      return created
    }

    const update = async (supplierId: number, draft: SupplierDraft) => {
      const updated = await apiPut<Supplier>(`/api/suppliers/${supplierId}`, toBody(draft))
      apply(replace(updated))
      return updated
    }

    // at / by ของ Deactivation เซิร์ฟเวอร์เติมเอง ส่งไปด้วยจะโดน DisallowUnknownFields ปฏิเสธ
    const deactivate = async (supplierId: number, deactivation: Deactivation) => {
      const updated = await apiPost<Supplier>(`/api/suppliers/${supplierId}/deactivate`, {
        reason: deactivation.reason,
        note: deactivation.note,
      })
      apply(replace(updated))
    }

    return {
      suppliers,
      loading,
      error,
      reload,
      findById,
      findByCompanyName,
      add,
      update,
      deactivate,
    }
  }, [data, loading, error, reload, apply])

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSuppliers(): SupplierValue {
  const ctx = useContext(SupplierContext)
  if (!ctx) throw new Error('useSuppliers must be used within a SupplierProvider')
  return ctx
}
