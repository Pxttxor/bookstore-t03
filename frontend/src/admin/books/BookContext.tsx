import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../../api/client'
import { useResource } from '../../api/useResource'
import {
  searchBook,
  type Book,
  type BookChangeLog,
  type BookStatus,
  type Category,
} from './books'

// ข้อมูลอยู่ในตาราง book / category / book_change_log ของ PostgreSQL แล้ว
// เดิมเก็บใน localStorage คีย์ bookhaven.books.v1
//
// หมวดหมู่โหลดคู่กันเพราะทุกหน้าที่แสดงหนังสือต้องใช้ชื่อหมวดหมู่ และเปลี่ยนแปลงน้อยมาก
// (`GET /api/categories` เป็น read-only — ตารางนี้ backfill จาก migrate.go)
const loadCatalogue = async () => {
  const [books, categories] = await Promise.all([
    apiGet<Book[]>('/api/books'),
    apiGet<Category[]>('/api/categories'),
  ])
  return { books, categories }
}

export type BookDraft = Omit<Book, 'bookId' | 'changeLogs'>

interface BookValue {
  books: Book[]
  categories: Category[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findById: (bookId: number) => Book | undefined
  /** Backs the "พบ ISBN ซ้ำ" check; ignoreId lets a book keep its own ISBN on edit. */
  findByIsbn: (isbn: string, ignoreId?: number) => Book | undefined
  categoryName: (categoryId: number) => string
  /** Book.search() plus the category filter of the search use case. */
  search: (keyword: string, categoryId?: number) => Book[]
  /** Book.add() — bookId มาจาก sequence ของ PostgreSQL ไม่ใช่ max+1 ฝั่งนี้ */
  add: (draft: BookDraft) => Promise<Book>
  /** Book.update() — เซิร์ฟเวอร์เขียน book_change_log ให้เองทีละฟิลด์ที่เปลี่ยนจริง */
  update: (bookId: number, draft: BookDraft) => Promise<Book>
  setStatus: (bookId: number, status: BookStatus) => Promise<void>
  /**
   * ประวัติการแก้ไขของเล่มหนึ่ง — ไม่ได้ติดมากับ `GET /api/books` เพราะเป็นคนละ endpoint
   * (`bookDTO` ไม่มีฟิลด์นี้) หน้ารายละเอียดจึงต้องเรียกเอง
   */
  changeLogs: (bookId: number) => Promise<BookChangeLog[]>
}

const BookContext = createContext<BookValue | null>(null)

const isbnKey = (isbn: string) => isbn.trim().toLowerCase()

// ฟิลด์ที่ BookDraft ฝั่ง Go รับ — handler เปิด DisallowUnknownFields ส่งเกินได้ 422
const toBody = (draft: BookDraft) => ({
  isbn: draft.isbn,
  title: draft.title,
  author: draft.author,
  publisher: draft.publisher,
  price: draft.price,
  description: draft.description,
  categoryId: draft.categoryId,
  status: draft.status,
})

export function BookProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, apply } = useResource(loadCatalogue)

  const value = useMemo<BookValue>(() => {
    const books = data?.books ?? []
    const categories = data?.categories ?? []

    const findById = (bookId: number) => books.find((b) => b.bookId === bookId)

    const categoryName = (categoryId: number) =>
      categories.find((c) => c.categoryId === categoryId)?.name ?? 'ไม่ระบุหมวดหมู่'

    // ทั้งสามเส้นทางคืนเล่มที่อัปเดตแล้วผ่าน toBookDTO ตัวเดียวกับตอนอ่านลิสต์
    // จึงต่อลงชุดเดิมได้เลย · หมวดหมู่เป็น read-only ไม่ต้องแตะ
    const replace = (updated: Book) => (current: { books: Book[]; categories: Category[] }) => ({
      ...current,
      books: current.books.map((row) => (row.bookId === updated.bookId ? updated : row)),
    })

    const add = async (draft: BookDraft) => {
      const created = await apiPost<Book>('/api/books', toBody(draft))
      // เรียงตามรหัสให้ตรงกับ ORDER BY book_id ของ repository
      apply((current) => ({
        ...current,
        books: [...current.books, created].sort((a, b) => a.bookId - b.bookId),
      }))
      return created
    }

    // ผู้แก้ไขมาจาก JWT ฝั่งเซิร์ฟเวอร์ — เดิมหน้าจอคำนวณ change log เองแล้วส่งมาทั้งก้อน
    const update = async (bookId: number, draft: BookDraft) => {
      const updated = await apiPut<Book>(`/api/books/${bookId}`, toBody(draft))
      apply(replace(updated))
      return updated
    }

    const setStatus = async (bookId: number, status: BookStatus) => {
      const updated = await apiPost<Book>(`/api/books/${bookId}/status`, { status })
      apply(replace(updated))
    }

    return {
      books,
      categories,
      loading,
      error,
      reload,
      findById,
      findByIsbn: (isbn: string, ignoreId?: number) =>
        books.find((b) => isbnKey(b.isbn) === isbnKey(isbn) && b.bookId !== ignoreId),
      categoryName,
      search: (keyword: string, categoryId?: number) =>
        books.filter(
          (b) => searchBook(b, keyword) && (categoryId === undefined || b.categoryId === categoryId),
        ),
      add,
      update,
      setStatus,
      changeLogs: (bookId: number) =>
        apiGet<BookChangeLog[]>(`/api/books/${bookId}/change-logs`),
    }
  }, [data, loading, error, reload, apply])

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBooks(): BookValue {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error('useBooks must be used within a BookProvider')
  return ctx
}
