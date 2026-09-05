import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import { useBooks } from '../books/BookContext'
import { formatBookCode, type StockTransaction } from '../inventory/inventory'
import '../components/DataTable.css'
import './StockAdjustmentHistoryPage.css'

const formatDate = (value: string) =>
  new Date(value).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

export default function StockAdjustmentHistoryPage() {
  const { user } = useAuth()
  const { books } = useBooks()
  const navigate = useNavigate()
  const permitted = !!user && can.viewAdjustmentHistory(user.role)
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  // เริ่มจากค่า permitted ตรง ๆ — ถ้าไม่มีสิทธิ์ตั้งแต่ต้นก็ไม่ต้องรอ (กัน
  // react-hooks/set-state-in-effect ที่ห้าม setState เปล่า ๆ ใน effect โดยไม่มีงานอื่นตามมา)
  const [loading, setLoading] = useState(permitted)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    if (!permitted) return
    let active = true

    // setState เกิดหลัง await เสมอ ไม่ใช่ตอน effect เริ่มทำงาน — แพตเทิร์นเดียวกับ
    // useResource.run() กัน react-hooks/set-state-in-effect
    const run = async () => {
      try {
        const rows = await apiGet<StockTransaction[]>('/api/inventory/adjustments')
        if (!active) return
        setTransactions(rows)
        setError(null)
        setLoading(false)
      } catch (reason: unknown) {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'โหลดประวัติการปรับยอดไม่สำเร็จ')
        setLoading(false)
      }
    }
    void run()

    return () => {
      active = false
    }
  }, [permitted])

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase()
    return transactions.filter((transaction) => {
      const book = books.find((entry) => entry.bookId === transaction.bookId)
      const searchable = `${book?.title ?? ''} ${book?.isbn ?? ''} ${formatBookCode(transaction.bookId)} ${transaction.reason} ${transaction.referenceDoc}`.toLowerCase()
      const matchesDirection =
        direction === 'ALL' || (direction === 'IN' ? transaction.quantityChange > 0 : transaction.quantityChange < 0)
      return matchesDirection && (!query || searchable.includes(query))
    })
  }, [books, direction, term, transactions])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (!permitted) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูประวัติการปรับยอด"
            description="หน้านี้เปิดให้ผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ประวัติการปรับยอด' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ประวัติการปรับยอดสต็อก</h1>
          <p className="admin-page__subtitle">ตรวจสอบรายการปรับจำนวนหนังสือทั้งหมดที่บันทึกโดยคลังสินค้า</p>
        </div>
      </div>

      <section className="admin-card adjustment-history">
        <div className="adjustment-history__summary">
          <span className="adjustment-history__count">ทั้งหมด {transactions.length} รายการ</span>
          <div className="admin-tabs">
            {([
              ['ALL', 'ทั้งหมด'],
              ['IN', 'เพิ่มสต็อก'],
              ['OUT', 'ลดสต็อก'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={'admin-tabs__tab' + (direction === key ? ' admin-tabs__tab--active' : '')}
                onClick={() => {
                  setDirection(key)
                  setPage(1)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาชื่อหนังสือ เหตุผล หรือเอกสารอ้างอิง"
              onChange={(event) => {
                setTerm(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดประวัติการปรับยอด…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title={transactions.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการปรับยอด'}
            description={transactions.length ? 'ลองเปลี่ยนคำค้นหาหรือประเภทการปรับยอด' : 'รายการจากหน้าปรับปรุงจำนวนจะแสดงที่นี่'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>วันที่และเวลา</th>
                    <th>หนังสือ</th>
                    <th>การเปลี่ยนแปลง</th>
                    <th>เหตุผล</th>
                    <th>เอกสารอ้างอิง</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((transaction) => {
                    const book = books.find((entry) => entry.bookId === transaction.bookId)
                    return (
                      <tr key={transaction.txnId}>
                        <td className="data-table__code">{formatDate(transaction.txnDate)}</td>
                        <td className="data-table__strong">
                          {book ? <Link to={`/admin/books/${book.bookId}`}>{book.title}</Link> : formatBookCode(transaction.bookId)}
                        </td>
                        <td className={transaction.quantityChange > 0 ? 'adjustment-history__increase' : 'adjustment-history__decrease'}>
                          {transaction.quantityChange > 0 ? '+' : ''}{transaction.quantityChange} เล่ม
                        </td>
                        <td>{transaction.reason}</td>
                        <td>{transaction.referenceDoc || '—'}</td>
                      </tr>
                    )
                  })}
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
