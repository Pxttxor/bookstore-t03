import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useInventory } from '../inventory/InventoryContext'
import {
  formatCountCode,
  STOCK_COUNT_STATUS_LABELS,
  STOCK_COUNT_STATUS_TONES,
} from '../inventory/inventory'
import '../components/DataTable.css'
import './StockCountListPage.css'

// The counting history — the record every round leaves behind.
export default function StockCountListPage() {
  const { user } = useAuth()
  const { counts } = useInventory()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role

  if (!can.viewStockCounts(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูประวัติการตรวจนับ"
            description="ประวัติการตรวจนับเปิดให้พนักงานคลังสินค้าและผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const sorted = [...counts].sort(
    (a, b) => b.countDate.localeCompare(a.countDate) || b.countId - a.countId,
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ตรวจนับสต็อก' }]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ประวัติการตรวจนับ</h1>
          <p className="admin-page__subtitle">
            บันทึกรอบการตรวจนับสินค้าคงคลังทั้งหมด {counts.length} รอบ
          </p>
        </div>
        {can.countStock(role) && (
          <div className="admin-page__actions">
            <Link to="/admin/stock/counts/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={18} />
              ตรวจนับหนังสือ
            </Link>
          </div>
        )}
      </div>

      <section className="admin-card count-list">
        {rows.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="ยังไม่มีประวัติการตรวจนับ"
            description="เมื่อบันทึกการตรวจนับแล้ว รอบนั้นจะถูกเก็บไว้ที่นี่พร้อมผลต่างของแต่ละเล่ม"
            action={
              can.countStock(role)
                ? { label: 'ตรวจนับหนังสือ', onClick: () => navigate('/admin/stock/counts/new') }
                : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัสรอบ</th>
                    <th>วันที่ตรวจนับ</th>
                    <th>ผู้ตรวจนับ</th>
                    <th className="count-list__num">จำนวนรายการ</th>
                    <th className="count-list__num">พบผลต่าง</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((count) => {
                    const variances = count.items.filter((item) => item.variance !== 0).length
                    return (
                      <tr key={count.countId}>
                        <td className="data-table__code">{formatCountCode(count.countId)}</td>
                        <td>{new Date(count.countDate).toLocaleDateString('th-TH')}</td>
                        <td>{count.countedBy}</td>
                        <td className="count-list__num">{count.items.length}</td>
                        <td className="count-list__num">
                          {variances > 0 ? (
                            <span className="count-list__variance">{variances}</span>
                          ) : (
                            0
                          )}
                        </td>
                        <td>
                          <StatusBadge tone={STOCK_COUNT_STATUS_TONES[count.status]}>
                            {STOCK_COUNT_STATUS_LABELS[count.status]}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="data-table__actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title="ดูรายละเอียด"
                              onClick={() => navigate(`/admin/stock/counts/${count.countId}`)}
                            >
                              <Icon name="eye" size={17} />
                            </button>
                          </div>
                        </td>
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
              total={sorted.length}
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
