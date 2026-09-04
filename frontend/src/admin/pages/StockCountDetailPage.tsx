import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import { useInventory } from '../inventory/InventoryContext'
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_TONES,
  formatBookCode,
  formatCountCode,
  formatReportCode,
  STOCK_COUNT_STATUS_LABELS,
  STOCK_COUNT_STATUS_TONES,
} from '../inventory/inventory'
import '../components/DataTable.css'
import './StockCountDetailPage.css'

export default function StockCountDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { findById } = useBooks()
  const { findCount, reports, loading, error, reload } = useInventory()
  const navigate = useNavigate()

  const role = user!.role
  const count = findCount(Number(id))

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

  // ต้องมาก่อนการเช็ค "ไม่พบข้อมูล" ไม่งั้นระหว่างโหลดจะขึ้นว่าไม่พบทุกครั้งที่เปิดหน้า
  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดประวัติการตรวจนับ…" />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={error} onRetry={() => void reload()} />
        </section>
      </div>
    )
  }

  if (!count) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'ตรวจนับสต็อก', to: '/admin/stock/counts' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="clipboard"
            title="ไม่พบรอบการตรวจนับ"
            description="รหัสรอบที่ระบุไม่มีอยู่ในระบบ"
            action={{
              label: 'กลับไปหน้าประวัติ',
              onClick: () => navigate('/admin/stock/counts'),
            }}
          />
        </section>
      </div>
    )
  }

  const variances = count.items.filter((item) => item.variance !== 0).length

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ตรวจนับสต็อก', to: '/admin/stock/counts' },
          { label: formatCountCode(count.countId) },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            รอบตรวจนับ {formatCountCode(count.countId)}
          </h1>
          <p className="admin-page__subtitle">
            ตรวจนับวันที่ {new Date(count.countDate).toLocaleDateString('th-TH')} · ผู้ตรวจนับ{' '}
            {count.countedBy} · {count.items.length} รายการ พบผลต่าง {variances} รายการ
          </p>
        </div>
        <div className="admin-page__actions">
          <StatusBadge tone={STOCK_COUNT_STATUS_TONES[count.status]}>
            {STOCK_COUNT_STATUS_LABELS[count.status]}
          </StatusBadge>
        </div>
      </div>

      <section className="admin-card count-detail">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>หนังสือ</th>
                <th className="count-detail__num">จำนวนในระบบ</th>
                <th className="count-detail__num">จำนวนที่นับได้จริง</th>
                <th className="count-detail__num">ผลต่าง</th>
                <th>ผลการเทียบ</th>
                <th>รายงานผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {count.items.map((item) => {
                const book = findById(item.bookId)
                const report = reports.find((entry) => entry.reportId === item.reportId)
                return (
                  <tr key={item.bookId}>
                    <td className="data-table__code">{formatBookCode(item.bookId)}</td>
                    <td className="data-table__strong">
                      {book ? (
                        <Link to={`/admin/books/${book.bookId}`}>{book.title}</Link>
                      ) : (
                        'ไม่พบข้อมูลหนังสือ'
                      )}
                    </td>
                    <td className="count-detail__num">{item.systemQty}</td>
                    <td className="count-detail__num">{item.countedQty}</td>
                    <td className="count-detail__num">
                      {item.variance > 0 ? `+${item.variance}` : item.variance}
                    </td>
                    <td>
                      {item.variance === 0 ? (
                        <StatusBadge tone="success">✓ เท่ากัน</StatusBadge>
                      ) : (
                        <StatusBadge tone="danger">X ไม่เท่ากัน</StatusBadge>
                      )}
                    </td>
                    <td>
                      {report ? (
                        <span className="count-detail__report">
                          <Link to="/admin/stock/discrepancies" className="data-table__code">
                            {formatReportCode(report.reportId)}
                          </Link>
                          <StatusBadge tone={APPROVAL_STATUS_TONES[report.approvalStatus]}>
                            {APPROVAL_STATUS_LABELS[report.approvalStatus]}
                          </StatusBadge>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
