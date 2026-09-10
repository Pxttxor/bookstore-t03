import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { can } from '../permissions'
import { matchesSearch } from '../search'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  formatGRCode,
  formatPOCode,
  GR_STATUS_LABELS,
  PO_STATUS_LABELS,
  PO_STATUS_TONES,
  poDisplayStatus,
} from '../purchasing/purchasing'
import type { GoodsReceiptStatus } from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatSupplierCode } from '../suppliers/suppliers'
import './ReceiptsListPage.css'

const STATUS_TABS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'PARTIAL', label: GR_STATUS_LABELS.PARTIAL },
  { key: 'FULL', label: GR_STATUS_LABELS.FULL },
] as const

export default function ReceiptsListPage() {
  const { user } = useAuth()
  const { orders, receipts, loading, error, reload } = usePurchasing()
  const { suppliers } = useSuppliers()

  const role = user!.role
  const mayReceive = can.receiveGoods(role)

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<'ALL' | GoodsReceiptStatus>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const supplierName = (supplierId: number) =>
    suppliers.find((entry) => entry.supplierId === supplierId)?.companyName ?? '—'

  const pending = orders.filter((po) => {
    const display = poDisplayStatus(po)
    return display === 'CONFIRMED' || display === 'RECEIVED_PARTIAL'
  })

  // receivedDate เป็นวันที่ระดับวัน ใบที่รับวันเดียวกันจึงเสมอกัน — ต้องตัดสินด้วยเลขที่ใบ
  // ไม่งั้น stable sort จะคืนลำดับเดิมจากเซิร์ฟเวอร์ (gr_id ASC) ในตารางที่เรียงจากใหม่ไปเก่า
  // ลำดับต้องเป็น sort → filter → slice เสมอ ห้ามสลับ ไม่งั้นการเรียงข้ามหน้าจะเพี้ยน
  const history = useMemo(
    () =>
      [...receipts].sort(
        (a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.grId - a.grId,
      ),
    [receipts],
  )

  const statusCounts = useMemo(
    () => ({
      ALL: history.length,
      PARTIAL: history.filter((receipt) => receipt.status === 'PARTIAL').length,
      FULL: history.filter((receipt) => receipt.status === 'FULL').length,
    }),
    [history],
  )

  const filtered = useMemo(() => {
    return history.filter((receipt) => {
      if (status !== 'ALL' && receipt.status !== status) return false
      // เลขที่ใบรับกับเลขใบสั่งซื้อเป็นค่าที่ format ขึ้นมา ไม่ใช่ฟิลด์ใน DTO จึงต้องค้นจากสตริงที่แสดงจริง
      return matchesSearch(
        term,
        formatGRCode(receipt.grId),
        formatPOCode(receipt.poId),
        receipt.deliveryNoteNo,
        receipt.receivedBy,
        receipt.receivedDate,
      )
    })
  }, [history, status, term])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (!mayReceive) {
    return (
      <div className="admin-page">
        <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'รับสินค้าเข้าคลัง' }]} />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์เข้าหน้ารับสินค้า"
            description="การตรวจรับสินค้าเข้าคลังเป็นหน้าที่ของพนักงานคลังสินค้า"
          />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'รับสินค้าเข้าคลัง' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">รับสินค้าเข้าคลัง</h1>
          <p className="admin-page__subtitle">
            ใบสั่งซื้อที่ผู้จัดจำหน่ายยืนยันแล้ว {pending.length} ใบ รอการตรวจรับ
          </p>
        </div>
      </div>

      <section className="admin-card admin-card--flush receipts__section">
        <div className="admin-card__head">
          <h2 className="admin-card__title">รอตรวจรับ</h2>
        </div>
        {loading ? (
          <LoadingState label="กำลังโหลดใบรับสินค้า…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="ไม่มีใบสั่งซื้อรอตรวจรับ"
            description="เมื่อผู้จัดจำหน่ายยืนยันใบสั่งซื้อแล้ว รายการจะปรากฏที่นี่"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ผู้จัดจำหน่าย</th>
                  <th>กำหนดส่ง</th>
                  <th className="receipts__num">คงค้าง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((po) => {
                  const display = poDisplayStatus(po)
                  const outstanding = po.items.reduce(
                    (sum, line) => sum + Math.max(0, line.quantity - line.receivedQty),
                    0,
                  )
                  return (
                    <tr key={po.poId}>
                      <td className="data-table__code">{formatPOCode(po.poId)}</td>
                      <td className="data-table__strong">
                        {formatSupplierCode(po.supplierId)} · {supplierName(po.supplierId)}
                      </td>
                      <td>{po.expectedDeliveryDate}</td>
                      <td className="receipts__num">{outstanding} เล่ม</td>
                      <td>
                        <StatusBadge tone={PO_STATUS_TONES[display]}>
                          {PO_STATUS_LABELS[display]}
                        </StatusBadge>
                      </td>
                      <td>
                        <Link
                          to={`/admin/purchasing/po/${po.poId}/receive`}
                          className="btn btn-outline btn-sm"
                        >
                          <Icon name="package" size={16} />
                          รับสินค้า
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card admin-card--flush receipts__section">
        <div className="admin-card__head">
          <h2 className="admin-card__title">ประวัติการรับสินค้า</h2>
        </div>

        <div className="admin-tabs admin-tabs--inset" role="tablist">
          {STATUS_TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={status === entry.key}
              className={
                'admin-tabs__tab' + (status === entry.key ? ' admin-tabs__tab--active' : '')
              }
              onClick={() => {
                setStatus(entry.key)
                setPage(1)
              }}
            >
              {entry.label} ({statusCounts[entry.key]})
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาเลขที่ใบรับ ใบสั่งซื้อ เลขใบส่งของ หรือผู้รับ"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดประวัติการรับสินค้า…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="file-text"
            title={history.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติการรับสินค้า'}
            description={
              history.length ? 'ลองเปลี่ยนแท็บหรือปรับคำค้นเพื่อดูรายการอื่น' : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>อ้างอิง</th>
                    <th>วันที่รับ</th>
                    <th>เลขใบส่งของ</th>
                    <th>ผู้รับ</th>
                    <th className="receipts__num">จำนวน</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((receipt) => (
                    <tr key={receipt.grId}>
                      <td className="data-table__code">{formatGRCode(receipt.grId)}</td>
                      <td>
                        <Link
                          to={`/admin/purchasing/po/${receipt.poId}`}
                          className="receipts__link"
                        >
                          {formatPOCode(receipt.poId)}
                        </Link>
                      </td>
                      <td>{receipt.receivedDate}</td>
                      <td>{receipt.deliveryNoteNo || '—'}</td>
                      <td>{receipt.receivedBy}</td>
                      <td className="receipts__num">
                        {receipt.items.reduce((sum, line) => sum + line.receivedQty, 0)} เล่ม
                      </td>
                      <td>
                        <StatusBadge tone={receipt.status === 'FULL' ? 'success' : 'warning'}>
                          {GR_STATUS_LABELS[receipt.status]}
                        </StatusBadge>
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
