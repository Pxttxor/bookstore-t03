import { useCallback, useMemo, useState } from 'react'
import { apiGet } from '../../api/client'
import { useResource } from '../../api/useResource'
import Icon from '../../components/Icon'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useBooks } from '../books/BookContext'
import { bookFieldLabel, type BookChangeLog } from '../books/books'
import { formatBookCode } from '../inventory/inventory'
import './BookChangeHistoryPage.css'

const whenText = (iso: string) => new Date(iso).toLocaleString('th-TH')

export default function BookChangeHistoryPage() {
  const { books } = useBooks()
  const load = useCallback(() => apiGet<BookChangeLog[]>('/api/book-change-logs'), [])
  const { data, loading, error, reload } = useResource(load)
  const [term, setTerm] = useState('')
  const changes = data ?? []
  const bookNames = new Map(books.map((book) => [book.bookId, book]))

  // ค้นหาด้วยชื่อหนังสือหรือรหัสหนังสือ (BKxx หรือตัวเลข)
  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase()
    if (!query) return changes
    return changes.filter((change) => {
      const book = bookNames.get(change.bookId)
      const searchable = `${book?.title ?? ''} ${formatBookCode(change.bookId)} ${change.bookId}`.toLowerCase()
      return searchable.includes(query)
    })
  }, [changes, bookNames, term])

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ประวัติการแก้ไขหนังสือ' }]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ประวัติการแก้ไขหนังสือ</h1>
          <p className="admin-page__subtitle">ประวัติการแก้ไขทุกเล่ม</p>
        </div>
      </div>

      <section className="admin-card book-history__card">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาชื่อหนังสือ หรือรหัสหนังสือ"
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดประวัติการแก้ไข…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="clock"
            title={changes.length ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'ยังไม่มีประวัติการแก้ไข'}
            description={
              changes.length
                ? 'ลองค้นหาด้วยชื่อหนังสือหรือรหัสหนังสือ (เช่น BK1)'
                : 'เมื่อมีการแก้ไขข้อมูลหนังสือ รายการจะปรากฏที่นี่'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>หนังสือ</th>
                  <th>ช่องที่แก้ไข</th>
                  <th>ค่าเดิม</th>
                  <th>ค่าใหม่</th>
                  <th>ผู้แก้ไข</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((change) => {
                  const book = bookNames.get(change.bookId)
                  return (
                    <tr key={change.logId}>
                      <td className="data-table__code">{whenText(change.changedDate)}</td>
                      <td>
                        <strong>{book?.title ?? `หนังสือ ${formatBookCode(change.bookId)}`}</strong>
                        <span className="book-history__code">{formatBookCode(change.bookId)}</span>
                      </td>
                      <td className="data-table__strong">{bookFieldLabel(change.changedField)}</td>
                      <td>{change.oldValue || '—'}</td>
                      <td>{change.newValue || '—'}</td>
                      <td>{change.changedBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
