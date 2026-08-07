import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  BOOK_FIELD_LABELS,
  BOOK_STATUS_LABELS,
  SEED_BOOKS,
  SEED_CATEGORIES,
  searchBook,
  type Book,
  type BookField,
  type BookStatus,
  type Category,
} from './books'

const STORAGE_KEY = 'bookhaven.books.v1'

export type BookDraft = Omit<Book, 'bookId' | 'changeLogs'>

interface BookValue {
  books: Book[]
  categories: Category[]
  findById: (bookId: number) => Book | undefined
  /** Backs the "พบ ISBN ซ้ำ" check; ignoreId lets a book keep its own ISBN on edit. */
  findByIsbn: (isbn: string, ignoreId?: number) => Book | undefined
  categoryName: (categoryId: number) => string
  /** Book.search() plus the category filter of the search use case. */
  search: (keyword: string, categoryId?: number) => Book[]
  /** Book.add() — allocates the next bookId. */
  add: (draft: BookDraft) => Book
  /** Book.update() — writes one BookChangeLog row per field that actually changed. */
  update: (bookId: number, draft: BookDraft, by: string) => Book
  setStatus: (bookId: number, status: BookStatus, by: string) => void
}

const BookContext = createContext<BookValue | null>(null)

function read(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SEED_BOOKS
    const parsed = JSON.parse(raw) as Book[]
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_BOOKS
  } catch {
    return SEED_BOOKS
  }
}

function write(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
}

const isbnKey = (isbn: string) => isbn.trim().toLowerCase()

const CHANGE_FIELDS = Object.keys(BOOK_FIELD_LABELS) as BookField[]

// The diagram types oldValue / newValue as plain strings, so the history reads better
// with the label a user would recognise rather than the raw foreign key.
function fieldValue(source: BookDraft, field: BookField, categories: Category[]) {
  if (field === 'categoryId') {
    return categories.find((c) => c.categoryId === source.categoryId)?.name ?? String(source.categoryId)
  }
  if (field === 'status') return BOOK_STATUS_LABELS[source.status]
  return String(source[field] ?? '')
}

export function BookProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>(read)

  const value = useMemo<BookValue>(() => {
    const persist = (next: Book[]) => {
      write(next)
      setBooks(next)
    }

    const findById = (bookId: number) => books.find((b) => b.bookId === bookId)

    const categoryName = (categoryId: number) =>
      SEED_CATEGORIES.find((c) => c.categoryId === categoryId)?.name ?? 'ไม่ระบุหมวดหมู่'

    // Appends the change log rows for every field that differs, newest last.
    const logChanges = (current: Book, draft: BookDraft, by: string) => {
      let nextLogId = current.changeLogs.reduce((max, log) => Math.max(max, log.logId), 0) + 1
      const changedDate = new Date().toISOString()

      const rows = CHANGE_FIELDS.filter(
        (field) => fieldValue(current, field, SEED_CATEGORIES) !== fieldValue(draft, field, SEED_CATEGORIES),
      ).map((field) => ({
        logId: nextLogId++,
        changedField: field,
        oldValue: fieldValue(current, field, SEED_CATEGORIES),
        newValue: fieldValue(draft, field, SEED_CATEGORIES),
        changedDate,
        changedBy: by,
      }))

      return [...current.changeLogs, ...rows]
    }

    const add = (draft: BookDraft) => {
      // Seeded ids run 101-123, so a new title continues from 124.
      const nextId = books.reduce((max, b) => Math.max(max, b.bookId), 100) + 1
      // BookChangeLog is an edit history, so a brand new title starts with none.
      const created: Book = { ...draft, bookId: nextId, changeLogs: [] }
      persist([...books, created])
      return created
    }

    const update = (bookId: number, draft: BookDraft, by: string) => {
      const current = books.find((b) => b.bookId === bookId)
      if (!current) throw new Error('ไม่พบข้อมูลหนังสือ')

      const updated: Book = { ...current, ...draft, changeLogs: logChanges(current, draft, by) }
      persist(books.map((b) => (b.bookId === bookId ? updated : b)))
      return updated
    }

    const setStatus = (bookId: number, status: BookStatus, by: string) => {
      const current = books.find((b) => b.bookId === bookId)
      if (!current || current.status === status) return
      update(bookId, { ...current, status }, by)
    }

    return {
      books,
      categories: SEED_CATEGORIES,
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
    }
  }, [books])

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBooks(): BookValue {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error('useBooks must be used within a BookProvider')
  return ctx
}
