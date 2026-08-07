import { Link, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { useOrders } from '../admin/orders/OrderContext'
import StatusBadge from '../admin/components/StatusBadge'
import { formatPrice } from '../data/books'
import {
  formatOrderCode,
  orderItemCount,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from '../admin/orders/orders'
import './OrderHistoryPage.css'

export default function OrderHistoryPage() {
  const { user } = useAuth()
  const { orders } = useOrders()

  // Only signed-in members have an order history to show.
  if (!user) return <Navigate to="/login" replace state={{ from: '/orders' }} />

  // Orders are tagged with the buyer's email at checkout; newest first.
  const mine = orders
    .filter((order) => order.customerEmail === user.email)
    .sort((a, b) => b.orderId - a.orderId)

  return (
    <div className="history page-shell">
      <header className="history__head">
        <h1 className="history__title">ประวัติการสั่งซื้อ</h1>
        <p className="history__subtitle">คำสั่งซื้อทั้งหมดของบัญชี {user.email}</p>
      </header>

      {mine.length === 0 ? (
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
                      {order.orderDate} · {orderItemCount(order)} เล่ม
                    </span>
                  </div>
                  <div className="history__card-side">
                    <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
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
