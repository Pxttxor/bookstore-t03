import { Link, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useOrders } from '../admin/orders/OrderContext'
import StatusBadge from '../admin/components/StatusBadge'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import { formatPrice } from '../data/money'
import {
  formatOrderCode,
  orderItemCount,
  getOrderStatusLabel,
  getOrderStatusTone,
} from '../admin/orders/orders'
import './OrderHistoryPage.css'

export default function OrderHistoryPage() {
  const { user } = useAuth()
  const { orders, loading, error, reload } = useOrders()

  // Only signed-in members have an order history to show.
  if (!user) return <Navigate to="/login" replace state={{ from: '/orders' }} />

  // Orders are tagged with the buyer's email/id; newest first.
  const userEmail = user.email.trim().toLowerCase()
  const mine = orders
    .filter((order) => {
      if (order.customerEmail) {
        return order.customerEmail.trim().toLowerCase() === userEmail
      }
      if (order.customerId && user.customerId) {
        return order.customerId === user.customerId
      }
      // For signed-in customer, backend /api/orders already returns only their own orders
      return user.role === 'customer'
    })
    .sort((a, b) => b.orderId - a.orderId)

  return (
    <div className="history page-shell">
      <header className="history__head">
        <h1 className="history__title">ประวัติการสั่งซื้อ</h1>
        <p className="history__subtitle">คำสั่งซื้อทั้งหมดของบัญชี {user.email}</p>
      </header>

      {loading ? (
        <LoadingState label="กำลังโหลดประวัติการสั่งซื้อ…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : mine.length === 0 ? (
        <div className="history__empty">
          <Icon name="package" size={40} />
          <p className="history__empty-title">ยังไม่มีคำสั่งซื้อ</p>
          <p className="history__empty-sub">เมื่อคุณสั่งซื้อหนังสือ รายการจะแสดงที่นี่</p>
          <Link to="/" className="btn btn-primary">
            เลือกซื้อหนังสือ
          </Link>
        </div>
      ) : (
        <ul className="history__list">
          {mine.map((order) => {
            const first = order.items[0]
            const more = order.items.length - 1
            return (
              <li key={order.orderId}>
                <Link to={`/order/${order.orderId}`} className="history__card">
                  <div className="history__card-main">
                    <span className="history__code">{formatOrderCode(order.orderId)}</span>
                    <span className="history__summary">
                      {first?.title ?? '—'}
                      {more > 0 && ` และอีก ${more} รายการ`}
                    </span>
                    <span className="history__meta">
                      {order.orderDate ? order.orderDate.slice(0, 10) : '—'} · {orderItemCount(order)} เล่ม
                    </span>
                    {order.status === 'CANCELLED' && order.cancelReason && (
                      <span className="history__cancel-reason">
                        <Icon name="alert-triangle" size={14} /> เหตุผลที่ยกเลิก: {order.cancelReason}
                      </span>
                    )}
                    {order.status === 'REJECTED' && (
                      <span className="history__cancel-reason history__cancel-reason--rejected">
                        <Icon name="alert-triangle" size={14} /> สลิปไม่ผ่าน{order.cancelReason ? `: ${order.cancelReason}` : ''} (คลิกเพื่อแนบใหม่)
                      </span>
                    )}
                  </div>
                  <div className="history__card-side">
                    <StatusBadge tone={getOrderStatusTone(order)}>
                      {getOrderStatusLabel(order)}
                    </StatusBadge>
                    <span className="history__total">{formatPrice(order.netAmount)}</span>
                    <Icon name="arrow-right" size={18} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
