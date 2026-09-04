import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import Modal from './Modal'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import LoadingState from './LoadingState'
import { useBooks } from '../books/BookContext'
import { searchBook, type Book } from '../books/books'
import { formatBookCode } from '../inventory/inventory'
import { useInventory } from '../inventory/InventoryContext'
import './BookPicker.css'

interface BookPickerProps {
  title?: string
  /** Titles already on the form; they stay listed but cannot be picked twice. */
  exclude?: number[]
  onSelect: (book: Book) => void
  onClose: () => void
}

// The search-then-pick step shared by the stock adjustment and the counting round:
// "แสดงหน้าค้นหาหนังสือ" → "แสดงหนังสือที่เข้าเงื่อนไข" → "กดเลือกหนังสือที่ต้องการ".
export default function BookPicker({
  title = 'ค้นหาหนังสือ',
  exclude = [],
  onSelect,
  onClose,
}: BookPickerProps) {
  const { books, categoryName, loading, error, reload } = useBooks()
  const { findByBookId } = useInventory()
  const [term, setTerm] = useState('')

  const results = useMemo(
    () => books.filter((book) => searchBook(book, term)).slice(0, 40),
    [books, term],
  )

  return (
    <Modal title={title} onClose={onClose}>
      <label className="book-picker__search">
        <Icon name="search" size={18} />
        <input
          type="search"
          autoFocus
          value={term}
          placeholder="กรอกชื่อหนังสือที่ต้องการ ผู้แต่ง หรือ ISBN"
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>

      {/* กล่องนี้เปิดเมื่อผู้ใช้กดเท่านั้น ไม่ได้อยู่บนโครงหน้า จึงขึ้นสถานะเต็มพื้นที่ได้
          ต้องเช็คก่อน results.length ไม่งั้นระหว่างโหลดจะขึ้นว่า "ไม่พบหนังสือที่ตรงกับคำค้น" */}
      {loading ? (
        <LoadingState label="กำลังโหลดรายการหนังสือ…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="book"
          title="ไม่พบหนังสือที่ตรงกับคำค้น"
          description="ลองพิมพ์ชื่อหนังสือ ผู้แต่ง หรือ ISBN ใหม่อีกครั้ง"
        />
      ) : (
        <ul className="book-picker__results">
          {results.map((book) => {
            const picked = exclude.includes(book.bookId)
            return (
              <li key={book.bookId}>
                <button
                  type="button"
                  className="book-picker__item"
                  disabled={picked}
                  title={picked ? 'หนังสือเล่มนี้อยู่ในรายการแล้ว' : undefined}
                  onClick={() => onSelect(book)}
                >
                  <span className="book-picker__code">{formatBookCode(book.bookId)}</span>
                  <span className="book-picker__title">{book.title}</span>
                  <span className="book-picker__meta">
                    {book.author} · {categoryName(book.categoryId)}
                  </span>
                  {/* "แสดงหนังสือและจำนวนที่มี" — the picker shows on-hand so the user
                      can tell the right edition apart before adding a row. */}
                  <span className="book-picker__qty">
                    คงเหลือ {findByBookId(book.bookId)?.quantityOnHand ?? 0}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
