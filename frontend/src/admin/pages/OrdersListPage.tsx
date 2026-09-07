import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/money'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useOrders } from '../orders/OrderContext'
import {
  CHANNEL_LABELS,
  formatOrderCode,
  formatOrderDate,
  getOrderStatusLabel,
  getOrderStatusTone,
  ORDER_STATUS_LABELS,
  orderItemCount,
  type OrderStatus,
} from '../orders/orders'
import './OrdersListPage.css'

type StatusFilter = OrderStatus | 'ALL'

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING_CONFIRM',
  'STOCK_CONFIRMED',
  'WAITING_PAYMENT',
  'VERIFYING_PAYMENT',
  'PAID',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
]

export default function OrdersListPage() {
  const { user } = useAuth()
  const { orders, loading, error, reload } = useOrders()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return orders
      .filter((order) => {
        if (status !== 'ALL' && order.status !== status) return false
        if (!needle) return true
        return (
          formatOrderCode(order.orderId).toLowerCase().includes(needle) ||
          order.customerName.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => b.orderId - a.orderId)
  }, [orders, term, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Highlight the orders that are waiting on the signed-in role's action.
  const waitingCount = useMemo(() => {
    const mine: Partial<Record<OrderStatus, boolean>> =
      role === 'sales'
        ? { PENDING_CONFIRM: true, STOCK_CONFIRMED: true, VERIFYING_PAYMENT: true }
        : role === 'warehouse'
          ? { PAID: true, PACKING: true }
          : role === 'delivery'
            ? { READY_TO_SHIP: true, SHIPPED: true }
            : {}
    return orders.filter((order) => mine[order.status]).length
  }, [orders, role])

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'คำสั่งซื้อลูกค้า' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">คำสั่งซื้อลูกค้า</h1>
          <p className="admin-page__subtitle">
            ติดตามคำสั่งซื้อทั้งหมด {orders.length} รายการ
            {waitingCount > 0 && ` · รอคุณดำเนินการ ${waitingCount} รายการ`}
          </p>
        </div>
      </div>

      <section className="admin-card orders-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาเลขคำสั่งซื้อหรือชื่อลูกค้า"
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
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดคำสั่งซื้อ…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="ไม่พบคำสั่งซื้อ"
            description="ลองปรับคำค้นหรือตัวกรองสถานะเพื่อดูรายการอื่น"
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขคำสั่งซื้อ</th>
                    <th>ลูกค้า</th>
                    <th>ช่องทาง</th>
                    <th>วันที่</th>
                    <th className="orders-list__num">ยอดสุทธิ</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr key={order.orderId}>
                      <td className="data-table__code">{formatOrderCode(order.orderId)}</td>
                      <td className="data-table__strong">
                        {order.customerName}
                        <span className="orders-list__meta">{orderItemCount(order)} เล่ม</span>
                      </td>
                      <td>{CHANNEL_LABELS[order.channel]}</td>
                      <td>{formatOrderDate(order.orderDate)}</td>
                      <td className="orders-list__num">{formatPrice(order.netAmount)}</td>
                      <td>
                        <StatusBadge tone={getOrderStatusTone(order)}>
                          {getOrderStatusLabel(order)}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ดูรายละเอียด"
                            onClick={() => navigate(`/admin/orders/${order.orderId}`)}
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
