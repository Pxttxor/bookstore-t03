import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import BookCover from '../components/BookCover'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import EmptyState from '../admin/components/EmptyState'
import { apiPost } from '../api/client'
import { ApiError } from '../api/client'
import { formatPrice } from '../data/money'
import { useOrders } from '../admin/orders/OrderContext'
import {
  formatOrderCode,
  milestoneOf,
  ORDER_STATUS_LABELS,
  type CustomerOrder,
} from '../admin/orders/orders'
import './OrderTrackingPage.css'

type StepStatus = 'done' | 'current' | 'todo'

const STEP_LABELS = ['Order Placed', 'Payment Confirmed', 'Processing', 'Shipped', 'Delivered']

// ReviewForm — เขียนรีวิวจริงลงตาราง review
//
// เดิมกดส่งแล้วขึ้น "ขอบคุณสำหรับรีวิว!" โดยไม่ส่งอะไรเลย
// ตอนนี้ยิง POST /api/reviews จริง — เซิร์ฟเวอร์หาใบที่ DELIVERED ของเล่มนี้ให้เอง
// แล้วติดป้าย "ซื้อสินค้าจริง" · รีวิวเข้าคิวตรวจสอบของพนักงานก่อนขึ้นหน้าร้าน
function ReviewForm({ bookId, title }: { bookId: number; title: string }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (sending) return
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว')
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนส่งรีวิว')
      return
    }
    setSending(true)
    setError('')
    try {
      // body ต้องมีเฉพาะฟิลด์ที่ service.ReviewInput ประกาศ (DisallowUnknownFields)
      await apiPost('/api/reviews', { bookId, rating, comment: comment.trim() })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="track-review">
      <div className="track-review__book">
        <BookCover bookId={bookId} title={title} size="sm" />
        <h4>{title}</h4>
      </div>
      {sent ? (
        <p className="track-review__thanks">
          <Icon name="check-circle" size={18} /> ส่งรีวิวแล้ว รอพนักงานตรวจสอบก่อนเผยแพร่
        </p>
      ) : (
        <>
          <div className="track-review__rate">
            <span>ให้คะแนน</span>
            <RatingStars value={rating} interactive size={22} onChange={setRating} />
          </div>
          <label className="track-review__field">
            <span>เขียนรีวิว</span>
            <textarea
              rows={3}
              placeholder="หนังสือเล่มนี้เป็นอย่างไรบ้าง"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          {error && <p className="track-review__error">{error}</p>}
          <button
            className="btn btn-primary track-review__submit"
            onClick={() => void submit()}
            disabled={sending}
          >
            {sending ? 'กำลังส่ง…' : 'ส่งรีวิว'}
          </button>
        </>
      )}
    </div>
  )
}

// Drives the five-step storefront tracker from the order's real status and timeline.
function buildSteps(order: CustomerOrder): { label: string; date: string; status: StepStatus }[] {
  const current = milestoneOf(order.status)
  const dateFor = (milestone: number) => {
    const entry = order.timeline.find((t) => milestoneOf(t.status) === milestone)
    return entry ? `${entry.changedDate.slice(0, 10)} ${entry.changedDate.slice(11, 16)}` : ''
  }
  return STEP_LABELS.map((label, i) => {
    const status: StepStatus =
      order.status === 'DELIVERED' || i < current ? 'done' : i === current ? 'current' : 'todo'
    return { label, date: status === 'todo' ? '' : dateFor(i) || '—', status }
  })
}

export default function OrderTrackingPage() {
  const { id } = useParams()
  const { findOrder, loading, error, reload } = useOrders()
  const order = findOrder(Number(id))

  // ลำดับ loading → error → "ไม่พบ" ตามกติกา — ถ้าสลับลำดับ
  // หน้านี้จะขึ้น "ไม่พบคำสั่งซื้อ" แว้บหนึ่งทุกครั้งที่เปิด ทั้งที่ใบมีอยู่จริง
  if (loading) return <LoadingState label="กำลังโหลดคำสั่งซื้อ…" />
  if (error) {
    return (
      <div className="track page-shell">
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    )
  }
  if (!order) {
    return (
      <div className="track page-shell">
        <EmptyState
          icon="package"
          title="ไม่พบคำสั่งซื้อนี้"
          description="หมายเลขอาจไม่ถูกต้อง หรือคำสั่งซื้อนี้ไม่ได้เป็นของบัญชีที่ล็อกอินอยู่"
        />
        <p className="track__back">
          <Link to="/orders" className="btn btn-outline">
            ดูประวัติการสั่งซื้อของฉัน
          </Link>
        </p>
      </div>
    )
  }

  return <RealOrderView order={order} />
}

function RealOrderView({ order }: { order: CustomerOrder }) {
  const steps = buildSteps(order)
  const activeIndex = Math.max(0, steps.findIndex((s) => s.status === 'current'))
  const progress =
    order.status === 'DELIVERED' ? 100 : (activeIndex / (steps.length - 1)) * 100
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED'

  return (
    <div className="track page-shell">
      <header className="track__head">
        <div>
          <h1>Order #{formatOrderCode(order.orderId)}</h1>
          <p>สั่งซื้อเมื่อ {order.orderDate}</p>
        </div>
        <button className="btn btn-ghost track__help">
          <Icon name="help" size={18} />
          Need Help?
        </button>
      </header>

      <section className="track__status">
        <h2>สถานะ: {ORDER_STATUS_LABELS[order.status]}</h2>
        {cancelled ? (
          <p className="track__cancelled">
            <Icon name="alert-triangle" size={18} /> คำสั่งซื้อนี้{ORDER_STATUS_LABELS[order.status]}
          </p>
        ) : (
          <div className="track__steps">
            <div className="track__line" />
            <div className="track__line track__line--active" style={{ width: `${progress}%` }} />
            {steps.map((s) => (
              <div key={s.label} className={`track__step is-${s.status}`}>
                <span className="track__dot">
                  {s.status === 'done' ? (
                    <Icon name="check" size={16} />
                  ) : s.status === 'current' ? (
                    <Icon name="truck" size={16} />
                  ) : (
                    <Icon name="package" size={16} />
                  )}
                </span>
                <span className="track__step-label">{s.label}</span>
                <span className="track__step-date">{s.date}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="track__grid">
        <div className="track__col">
          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="truck" size={18} /> Shipping Details
            </h3>
            <dl className="track__dl">
              <dt>DELIVERY ADDRESS</dt>
              <dd>
                {order.customerName}
                <br />
                {order.shippingAddress}
              </dd>
              <dt>CARRIER</dt>
              <dd>{order.shipment?.carrier ?? 'รอจัดส่ง'}</dd>
              <dt>TRACKING NUMBER</dt>
              <dd className="track__tracking">
                {order.shipment ? (
                  <span className="track__mono">{order.shipment.trackingNumber}</span>
                ) : (
                  <span className="track__mono">—</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="package" size={18} /> Order Summary
            </h3>
            <div className="track__totals">
              <div className="track__row">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="track__row track__row--discount">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <div className="track__row track__row--total">
                <span>Total</span>
                <span>{formatPrice(order.netAmount)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="track__col track__col--wide">
          <section className="track__panel">
            <h3 className="track__panel-title">Items Ordered</h3>
            <ul className="track__items">
              {order.items.map((line) => (
                <li key={line.bookId} className="track__item">
                  <div className="track__item-cover">
                    <BookCover bookId={line.bookId} title={line.title} size="sm" />
                  </div>
                  <div className="track__item-info">
                    <strong>{line.title}</strong>
                    <span className="track__format">จำนวน {line.quantity}</span>
                  </div>
                  <span className="track__item-price">
                    {formatPrice(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {order.status === 'DELIVERED' && (
            <section className="track__panel">
              <h3 className="track__panel-title">
                <Icon name="star" size={18} filled /> Review &amp; Rate
              </h3>
              <div className="track__reviews">
                {order.items.map((line) => (
                  <ReviewForm key={line.bookId} bookId={line.bookId} title={line.title} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
