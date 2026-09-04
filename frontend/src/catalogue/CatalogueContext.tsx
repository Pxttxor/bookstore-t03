import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useResource } from '../api/useResource'
import { loadCatalogue, type CatalogueBook, type CatalogueCategory } from '../data/catalogue'

// แคตตาล็อกหน้าร้าน — อ่านจากตาราง book / inventory_item / review ผ่าน
// `GET /api/catalogue` ซึ่งเป็นเส้นทางสาธารณะ จึงโหลดได้ทั้งที่ยังไม่ล็อกอิน
//
// Provider นี้อยู่ที่ `StorefrontLayout` ไม่ใช่ `main.tsx` — หลังร้านมีแคตตาล็อก
// ของตัวเองอยู่แล้ว (`BookContext` ที่อ่าน `/api/books` พร้อมสถานะและประวัติการแก้ไข)
// ถ้ายกขึ้น root หลังร้านจะโหลดข้อมูลชุดเดียวกันสองรอบทุกครั้งที่เปิด

interface CatalogueValue {
  books: CatalogueBook[]
  categories: CatalogueCategory[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findById: (bookId: number) => CatalogueBook | undefined
}

const CatalogueContext = createContext<CatalogueValue | null>(null)

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useResource(loadCatalogue)

  const value = useMemo<CatalogueValue>(() => {
    const books = data?.books ?? []
    const categories = data?.categories ?? []

    return {
      books,
      categories,
      loading,
      error,
      reload,
      findById: (bookId: number) => books.find((b) => b.bookId === bookId),
    }
  }, [data, loading, error, reload])

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalogue(): CatalogueValue {
  const ctx = useContext(CatalogueContext)
  if (!ctx) throw new Error('useCatalogue must be used within a CatalogueProvider')
  return ctx
}
