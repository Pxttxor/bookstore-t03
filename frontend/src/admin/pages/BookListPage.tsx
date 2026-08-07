import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import {
  BOOK_STATUS_LABELS,
  BOOK_STATUS_TONES,
  formatPriceBaht,
  searchBook,
  type BookStatus,
} from '../books/books'
import { formatBookCode } from '../inventory/inventory'
import '../components/DataTable.css'
import './BookListPage.css'

type StatusFilter = BookStatus | 'ALL'

export default function BookListPage() {
  const { user } = useAuth()
  const { books, categories, categoryName } = useBooks()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role
  const mayEdit = can.editBooks(role)

  // Book.search() supplies the keyword half; the category and status selects are the
  // "(Optional)" filters the search flow puts beside it.
  const filtered = useMemo(
    () =>
      books.filter((book) => {
        if (category !== 'ALL' && book.categoryId !== Number(category)) return false
        if (status !== 'ALL' && book.status !== status) return false
        return searchBook(book, term)
      }),
    [books, term, category, status],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isFiltered = term.trim() !== '' || category !== 'ALL' || status !== 'ALL'

  const clearFilters = () => {
    setTerm('')
    setCategory('ALL')
    setStatus('ALL')
    setPage(1)
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ข้อมูลหนังสือ' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">รายการหนังสือ</h1>
          <p className="admin-page__subtitle">
            ค้นหาและเรียกดูข้อมูลหนังสือในระบบทั้งหมด {books.length} รายการ
          </p>
        </div>
        {mayEdit && (
          <div className="admin-page__actions">
            <Link to="/admin/books/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={18} />
              เพิ่มหนังสือ
            </Link>
          </div>
        )}
      </div>

      <section className="admin-card book-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="กรอกรายละเอียดของหนังสือในช่องค้นหา — ชื่อหนังสือ ผู้แต่ง หรือ ISBN"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="filter-bar__select">
            <span>หมวดหมู่</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              {categories.map((entry) => (
                <option key={entry.categoryId} value={entry.categoryId}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-bar__select">
            <span>สถานะ</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="ACTIVE">{BOOK_STATUS_LABELS.ACTIVE}</option>
              <option value="INACTIVE">{BOOK_STATUS_LABELS.INACTIVE}</option>
            </select>
          </label>

          {isFiltered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="filter" size={16} />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="ไม่พบหนังสือที่ตรงกับคำค้น"
            description="ลองปรับคำค้น เปลี่ยนหมวดหมู่ หรือล้างตัวกรองเพื่อดูรายการทั้งหมดอีกครั้ง"
            action={isFiltered ? { label: 'ล้างตัวกรอง', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ISBN</th>
                    <th>ชื่อหนังสือ</th>
                    <th>ผู้แต่ง</th>
                    <th>หมวดหมู่</th>
                    <th className="book-list__num">ราคาปก</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((book) => (
                    <tr key={book.bookId}>
                      <td className="data-table__code">{formatBookCode(book.bookId)}</td>
                      <td className="data-table__code">{book.isbn}</td>
                      <td className="data-table__strong">{book.title}</td>
                      <td>{book.author}</td>
                      <td>{categoryName(book.categoryId)}</td>
                      <td className="book-list__num">{formatPriceBaht(book.price)}</td>
                      <td>
                        <StatusBadge tone={BOOK_STATUS_TONES[book.status]}>
                          {BOOK_STATUS_LABELS[book.status]}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ดูรายละเอียด"
                            onClick={() => navigate(`/admin/books/${book.bookId}`)}
                          >
                            <Icon name="eye" size={17} />
                          </button>
                          {mayEdit && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="แก้ไขข้อมูลหนังสือ"
                              onClick={() => navigate(`/admin/books/${book.bookId}/edit`)}
                            >
                              <Icon name="edit" size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </section>
    </div>
  )
}
