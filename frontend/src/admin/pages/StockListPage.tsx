import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import { searchBook } from '../books/books'
import { useInventory } from '../inventory/InventoryContext'
import {
  formatBookCode,
  LOW_STOCK_THRESHOLD,
  STOCK_LEVEL_LABELS,
  STOCK_LEVEL_TONES,
  stockLevel,
  type StockLevel,
} from '../inventory/inventory'
import '../components/DataTable.css'
import '../components/Tabs.css'
import './StockListPage.css'

type Tab = 'ALL' | StockLevel

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'LOW', label: STOCK_LEVEL_LABELS.LOW },
  { key: 'OUT', label: STOCK_LEVEL_LABELS.OUT },
]

// One component serves two routes: /admin/stock is the current on-hand list, while
// /admin/stock/low is the low-stock report, which the flow reaches by pressing
// "หนังสือที่ใกล้หมด". A path rather than a query string keeps NavLink from lighting up
// both sidebar entries at once.
export default function StockListPage() {
  const { pathname } = useLocation()
  const lowReport = pathname.endsWith('/low')
  // Both routes render this same component, so React would keep it mounted and the tab
  // would not re-seed when the user moves between them. Remount on the switch instead.
  return <StockList key={lowReport ? 'low' : 'all'} lowReport={lowReport} />
}

function StockList({ lowReport }: { lowReport: boolean }) {
  const { user } = useAuth()
  const { books, categories, categoryName } = useBooks()
  const { items } = useInventory()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>(lowReport ? 'LOW' : 'ALL')
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Inventory only carries bookId, so the title and category are joined in from the
  // catalogue. A stock row with no matching book still shows, under its code.
  const rows = useMemo(
    () =>
      items.map((item) => {
        const book = books.find((entry) => entry.bookId === item.bookId)
        return { item, book, level: stockLevel(item) }
      }),
    [items, books],
  )

  const outCount = rows.filter((row) => row.level === 'OUT').length
  const lowCount = rows.filter((row) => row.level === 'LOW').length

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (tab !== 'ALL' && row.level !== tab) return false
        if (category !== 'ALL' && row.book?.categoryId !== Number(category)) return false
        if (!term.trim()) return true
        if (row.book) return searchBook(row.book, term)
        return formatBookCode(row.item.bookId).toLowerCase().includes(term.trim().toLowerCase())
      }),
    [rows, tab, category, term],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const isFiltered = term.trim() !== '' || category !== 'ALL'

  const role = user!.role

  if (!can.viewStock(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูข้อมูลสินค้าคงคลัง"
            description="ยอดคงเหลือเปิดให้พนักงานคลังสินค้า พนักงานฝ่ายขาย และผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const clearFilters = () => {
    setTerm('')
    setCategory('ALL')
    setPage(1)
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          ...(lowReport
            ? [{ label: 'สินค้าคงคลัง', to: '/admin/stock' }, { label: 'หนังสือที่ใกล้หมด' }]
            : [{ label: 'สินค้าคงคลัง' }]),
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            {lowReport ? 'หนังสือที่ใกล้หมด' : 'ยอดคงเหลือปัจจุบัน'}
          </h1>
          <p className="admin-page__subtitle">
            {lowReport
              ? `แสดงจำนวนหนังสือที่ใกล้หมดและหมดแล้ว — เกณฑ์เหลือน้อยคือน้อยกว่า ${LOW_STOCK_THRESHOLD} เล่มแต่ยังไม่หมด`
              : `ยอดคงเหลือของหนังสือทั้งหมด ${rows.length} รายการในคลัง`}
          </p>
        </div>
        {can.adjustStock(role) && (
          <div className="admin-page__actions">
            <Link to="/admin/stock/adjust" className="btn btn-primary btn-sm">
              <Icon name="edit" size={18} />
              อัปเดทจำนวนหนังสือ
            </Link>
          </div>
        )}
      </div>

      <div className="stock-list__tiles">
        <StatTile label="หมด" value={outCount} note="ยอดคงเหลือเป็น 0" icon="alert-triangle" tone="danger" />
        <StatTile
          label="เหลือน้อย"
          value={lowCount}
          note={`เหลือน้อยกว่า ${LOW_STOCK_THRESHOLD} เล่มแต่ยังไม่หมด`}
          icon="trending-down"
          tone="warning"
        />
        <StatTile label="รายการทั้งหมด" value={rows.length} note="หนังสือที่มีข้อมูลในคลัง" icon="package" />
      </div>

      {/* The reorder alert is a different screen with a different threshold; point at it
          rather than duplicating its purchase-requisition flow here. */}
      {can.viewAlerts(role) && (
        <p className="stock-list__banner">
          <Icon name="bell" size={18} />
          รายการนี้ดูจากยอดคงเหลือจริง · หากต้องการรายการที่ถึงจุดสั่งซื้อเพื่อเปิดใบขอสั่งซื้อ ดูที่{' '}
          <Link to="/admin/alerts">แจ้งเตือนสินค้าถึงจุดสั่งซื้อ</Link>
        </p>
      )}

      <section className="admin-card stock-list">
        <div className="stock-list__tabs">
          <div className="admin-tabs">
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={
                  'admin-tabs__tab' + (tab === entry.key ? ' admin-tabs__tab--active' : '')
                }
                onClick={() => {
                  setTab(entry.key)
                  setPage(1)
                }}
              >
                {entry.label}
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
              placeholder="ค้นหาชื่อหนังสือ ผู้แต่ง ISBN หรือรหัส"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="filter-bar__select">
            <span>เลือกหมวดหมู่หนังสือ</span>
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

          {isFiltered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="filter" size={16} />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {pageRows.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title={
              tab === 'OUT'
                ? 'ไม่มีหนังสือที่หมดสต็อก'
                : tab === 'LOW'
                  ? 'ไม่มีรายการที่ต้องสั่งซื้อเพิ่ม'
                  : 'ไม่พบรายการที่ตรงกับคำค้น'
            }
            description="ลองเปลี่ยนแท็บ ปรับหมวดหมู่ หรือล้างตัวกรองเพื่อดูรายการอื่น"
            action={isFiltered ? { label: 'ล้างตัวกรอง', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ชื่อหนังสือ</th>
                    <th>หมวดหมู่</th>
                    <th className="stock-list__num">คงเหลือ</th>
                    <th className="stock-list__num">จุดสั่งซื้อ</th>
                    <th>สถานะ</th>
                    <th>อัปเดตล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(({ item, book, level }) => (
                    <tr key={item.bookId}>
                      <td className="data-table__code">{formatBookCode(item.bookId)}</td>
                      <td className="data-table__strong">
                        {book ? (
                          <Link to={`/admin/books/${book.bookId}`}>{book.title}</Link>
                        ) : (
                          'ไม่พบข้อมูลหนังสือ'
                        )}
                      </td>
                      <td>{book ? categoryName(book.categoryId) : '—'}</td>
                      <td className="stock-list__num">{item.quantityOnHand}</td>
                      <td className="stock-list__num">{item.reorderPoint ?? '—'}</td>
                      <td>
                        <StatusBadge tone={STOCK_LEVEL_TONES[level]}>
                          {STOCK_LEVEL_LABELS[level]}
                        </StatusBadge>
                      </td>
                      <td className="data-table__code">
                        {new Date(item.lastUpdated).toLocaleDateString('th-TH')}
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
