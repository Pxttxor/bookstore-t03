import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/books'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { can } from '../permissions'
import { usePayments } from '../payments/PaymentContext'
import {
  formatPaymentCode,
  paymentDate,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  type PaymentStatus,
} from '../payments/payments'
import { formatOrderCode } from '../orders/orders'
import { useOrders } from '../orders/OrderContext'
import '../components/DataTable.css'
import './PaymentListPage.css'

type StatusFilter = PaymentStatus | 'ALL'

// รายการรอตรวจสอบต้องขึ้นก่อนเสมอ พนักงานฝ่ายขายเปิดหน้านี้มาเพื่อเคลียร์คิวนั้น
const STATUS_ORDER: Record<PaymentStatus, number> = {
  VERIFYING: 0,
  WAITING: 1,
  REJECTED: 2,
  SUCCESS: 3,
}

export default function PaymentListPage() {
  const { user } = useAuth()
  const { payments, banks, loading, error, reload } = usePayments()
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    reload: reloadOrders,
  } = useOrders()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [bank, setBank] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role
  const bankName = (bankId?: number) =>
    banks.find((b) => b.bankId === bankId)?.name ?? '—'
  const customerByOrder = useMemo(
    () => new Map(orders.map((order) => [order.orderId, order.customerName])),
    [orders],
  )

  const waiting = payments.filter((p) => p.status === 'VERIFYING').length
  const received = payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0)
  const rejected = payments.filter((p) => p.status === 'REJECTED').length

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    const bankIds = banks.filter((b) => b.name === bank).map((b) => b.bankId)
    return payments
      .filter((payment) => {
        if (status !== 'ALL' && payment.status !== status) return false
        if (bank !== 'ALL' && !bankIds.includes(payment.bankId ?? -1)) return false
        if (!needle) return true
        return (
          (customerByOrder.get(payment.orderId) ?? '').toLowerCase().includes(needle) ||
          formatPaymentCode(payment.paymentId).toLowerCase().includes(needle) ||
          formatOrderCode(payment.orderId).toLowerCase().includes(needle)
        )
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (b.transferDate ?? '').localeCompare(a.transferDate ?? ''),
      )
  }, [payments, banks, customerByOrder, term, status, bank])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isFiltered = term.trim() !== '' || status !== 'ALL' || bank !== 'ALL'

  const clearFilters = () => {
    setTerm('')
    setStatus('ALL')
    setBank('ALL')
    setPage(1)
  }

  if (loading || ordersLoading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดรายการชำระเงิน…" />
        </section>
      </div>
    )
  }

  if (error || ordersError) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState
            message={error ?? ordersError ?? 'โหลดข้อมูลไม่สำเร็จ'}
            onRetry={() => void Promise.all([reload(), reloadOrders()])}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ตรวจสอบการชำระเงิน' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ตรวจสอบการชำระเงิน</h1>
          <p className="admin-page__subtitle">
            รายการแจ้งชำระเงินทั้งหมด {payments.length} รายการ · รอตรวจสอบ {waiting} รายการ
          </p>
        </div>
        {can.managePaymentReports(role) && (
          <div className="admin-page__actions">
            <Link to="/admin/payments/report" className="btn btn-ghost btn-sm">
              <Icon name="bar-chart" size={18} />
              รายงานสรุปรับชำระเงิน
            </Link>
          </div>
        )}
      </div>

      <section className="payment-list__tiles">
        <StatTile
          label="รอตรวจสอบ"
          value={waiting}
          note="รายการที่ลูกค้าแนบสลิปแล้ว"
          icon="clock"
          tone={waiting > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="ยอดรับชำระสะสม"
          value={formatPrice(received)}
          note="เฉพาะรายการที่ตรวจสอบผ่าน"
          icon="credit-card"
          tone="accent"
        />
        <StatTile
          label="ปฏิเสธการชำระ"
          value={rejected}
          note="สลิปไม่ผ่านการตรวจสอบ"
          icon="alert-triangle"
          tone={rejected > 0 ? 'danger' : 'default'}
        />
      </section>

      <section className="admin-card payment-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหารหัสการชำระ เลขคำสั่งซื้อ หรือชื่อลูกค้า"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
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
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-bar__select">
            <span>ธนาคาร</span>
            <select
              value={bank}
              onChange={(e) => {
                setBank(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              {banks.map((b) => (
                <option key={b.bankId} value={b.name}>
                  {b.name}
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

        {rows.length === 0 ? (
          <EmptyState
            icon="credit-card"
            title="ไม่พบรายการชำระเงินที่ตรงกับคำค้น"
            description="ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมดอีกครั้ง"
            action={isFiltered ? { label: 'ล้างตัวกรอง', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัสการชำระ</th>
                    <th>คำสั่งซื้อ</th>
                    <th>ลูกค้า</th>
                    <th>ธนาคาร</th>
                    <th>วันที่โอน</th>
                    <th className="payment-list__num">ยอดเงิน</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((payment) => (
                    <tr key={payment.paymentId}>
                      <td className="data-table__code">
                        {formatPaymentCode(payment.paymentId)}
                      </td>
                      <td>{formatOrderCode(payment.orderId)}</td>
                      <td className="data-table__strong">
                        {customerByOrder.get(payment.orderId) ?? '—'}
                      </td>
                      <td>{bankName(payment.bankId)}</td>
                      <td>{paymentDate(payment)}</td>
                      <td className="payment-list__num">{formatPrice(payment.amount)}</td>
                      <td>
                        <StatusBadge tone={PAYMENT_STATUS_TONES[payment.status]}>
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ดูสลิปและตรวจสอบ"
                            onClick={() => navigate(`/admin/payments/${payment.paymentId}`)}
                          >
                            <Icon name="eye" size={17} />
                          </button>
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
