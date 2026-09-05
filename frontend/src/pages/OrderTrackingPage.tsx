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
  formatOrderDate,
  milestoneOf,
  ORDER_STATUS_LABELS,
  type CustomerOrder,
} from '../admin/orders/orders'
import { detectProfanity } from '../admin/reviews/reviews'
import './OrderTrackingPage.css'

type StepStatus = 'done' | 'current' | 'todo'

// คำเดียวกับ ORDER_STATUS_LABELS ของหลังร้าน เรียงตาม milestoneOf() ทั้งห้าขั้น
const STEP_LABELS = ['สั่งซื้อแล้ว', 'ชำระเงินแล้ว', 'กำลังแพ็กสินค้า', 'จัดส่งแล้ว', 'ส่งถึงแล้ว']

// ReviewForm — เขียนรีวิวจริงลงตาราง review
//
// เดิมกดส่งแล้วขึ้น "ขอบคุณสำหรับรีวิว!" โดยไม่ส่งอะไรเลย
// ตอนนี้ยิง POST /api/reviews จริง — เซิร์ฟเวอร์หาใบที่ DELIVERED ของเล่มนี้ให้เอง
// แล้วติดป้าย "ซื้อสินค้าจริง" · รีวิวเข้าคิวตรวจสอบของพนักงานก่อนขึ้นหน้าร้าน
function ReviewForm({ bookId, title }: { bookId: number; title: string }) {
  const [rating, setRating] = useState(0)
  const [headline, setHeadline] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [profanityDetected, setProfanityDetected] = useState<string | null>(null)

  const badHeadline = detectProfanity(headline)
  const badComment = detectProfanity(comment)

  const submit = async () => {
    if (sending) return
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว')
      setProfanityDetected(null)
      return
    }
    if (headline.trim() === '') {
      setError('กรุณาระบุหัวข้อรีวิวก่อนส่ง')
      setProfanityDetected(null)
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนส่งรีวิว')
      setProfanityDetected(null)
      return
    }

    // ตรวจสอบคำหยาบคายก่อนส่ง ถ้ามีให้เตือนลูกค้าพิมพ์ใหม่
    if (badHeadline || badComment) {
      const detected = badHeadline || badComment
      setProfanityDetected(detected)
      setError(`ตรวจพบคำไม่สุภาพหรือไม่เหมาะสมในข้อความรีวิว กรุณาตรวจสอบและพิมพ์ใหม่`)
      return
    }

    setSending(true)
    setError('')
    setProfanityDetected(null)
    try {
      // body ต้องมีเฉพาะฟิลด์ที่ service.ReviewInput ประกาศ (DisallowUnknownFields)
      await apiPost('/api/reviews', {
        bookId,
        rating,
        headline: headline.trim(),
        comment: comment.trim(),
      })
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
            <span>หัวข้อรีวิว</span>
            <input
              type="text"
              maxLength={200}
              placeholder="สรุปความรู้สึกสั้น ๆ เช่น อ่านสนุกมาก, แนะนำเลย"
              value={headline}
              className={profanityDetected && badHeadline ? 'track-review__input--warning' : ''}
              onChange={(e) => {
                setHeadline(e.target.value)
                if (error) setError('')
                if (profanityDetected) setProfanityDetected(null)
              }}
            />
          </label>
          <label className="track-review__field">
            <span>เขียนรีวิว</span>
            <textarea
              rows={3}
              placeholder="หนังสือเล่มนี้เป็นอย่างไรบ้าง"
              value={comment}
              className={profanityDetected && badComment ? 'track-review__input--warning' : ''}
              onChange={(e) => {
                setComment(e.target.value)
                if (error) setError('')
                if (profanityDetected) setProfanityDetected(null)
              }}
            />
          </label>
          {error && (
            <div className={`track-review__notice ${profanityDetected ? 'track-review__notice--warning' : 'track-review__notice--error'}`}>
              <Icon name="alert-triangle" size={18} />
              <span>{error}</span>
            </div>
          )}
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
  const [copied, setCopied] = useState(false)
  const steps = buildSteps(order)
  const activeIndex = Math.max(0, steps.findIndex((s) => s.status === 'current'))
  const progress =
    order.status === 'DELIVERED' ? 100 : (activeIndex / (steps.length - 1)) * 100
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED'

  const trackingNumber = order.shipment?.trackingNumber?.trim() || ''
  const carrier = order.shipment?.carrier || 'รอจัดส่ง'

  const copyTracking = async (tracking: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(tracking)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = tracking
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="track page-shell">
      <header className="track__head">
        <div>
          <h1>คำสั่งซื้อ {formatOrderCode(order.orderId)}</h1>
          <p>สั่งซื้อเมื่อ {formatOrderDate(order.orderDate)}</p>
        </div>
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
              <Icon name="truck" size={18} /> ข้อมูลการจัดส่ง
            </h3>
            <dl className="track__dl">
              <dt>ที่อยู่จัดส่ง</dt>
              <dd>
                {order.customerName}
                <br />
                {order.shippingAddress}
              </dd>
              <dt>ผู้ให้บริการขนส่ง</dt>
              <dd>{carrier}</dd>
              <dt>หมายเลขพัสดุ</dt>
              <dd className="track__tracking">
                {trackingNumber ? (
                  <div className="track__tracking-group">
                    <span className="track__mono">{trackingNumber}</span>
                    <button
                      type="button"
                      className={`track__copy-btn ${copied ? 'is-copied' : ''}`}
                      title={copied ? 'คัดลอกแล้ว' : 'คัดลอกหมายเลขพัสดุ'}
                      aria-label={`คัดลอกหมายเลขพัสดุ ${trackingNumber}`}
                      onClick={() => void copyTracking(trackingNumber)}
                    >
                      <Icon name={copied ? 'check' : 'clipboard'} size={13} />
                      <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </div>
                ) : (
                  <span className="track__mono">—</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="package" size={18} /> สรุปคำสั่งซื้อ
            </h3>
            <div className="track__totals">
              <div className="track__row">
                <span>รวมค่าสินค้า</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="track__row track__row--discount">
                  <span>ส่วนลด</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <div className="track__row track__row--total">
                <span>ยอดชำระทั้งสิ้น</span>
                <span>{formatPrice(order.netAmount)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="track__col track__col--wide">
          <section className="track__panel">
            <h3 className="track__panel-title">รายการที่สั่งซื้อ</h3>
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
                <Icon name="star" size={18} filled /> รีวิวและให้คะแนน
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
