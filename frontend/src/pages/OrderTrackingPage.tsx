import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import BookCover from '../components/BookCover'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import EmptyState from '../admin/components/EmptyState'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '../api/client'
import { formatPrice } from '../data/money'
import { useAuth } from '../auth/AuthContext'
import { useOrders } from '../admin/orders/OrderContext'
import {
  formatOrderCode,
  milestoneOf,
  ORDER_STATUS_LABELS,
  type CustomerOrder,
} from '../admin/orders/orders'
import './OrderTrackingPage.css'

type StepStatus = 'done' | 'current' | 'todo'

// คำเดียวกับ ORDER_STATUS_LABELS ของหลังร้าน เรียงตาม milestoneOf() ทั้งห้าขั้น
const STEP_LABELS = ['สั่งซื้อแล้ว', 'ชำระเงินแล้ว', 'กำลังแพ็กสินค้า', 'จัดส่งแล้ว', 'ส่งถึงแล้ว']

interface CustomerReview {
  reviewId: number
  bookId: number
  orderId?: number
  orderCode?: string
  rating: number
  headline?: string
  comment: string
  status: 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED'
  statusLabel?: string
  createdDate?: string
}

interface ReviewFormProps {
  bookId: number
  title: string
  existingReview?: CustomerReview
  onRefresh: () => void | Promise<void>
}

// ReviewForm — จัดการรีวิวของลูกค้า (เขียนใหม่ / แก้ไข / ลบ)
function ReviewForm({ bookId, title, existingReview, onRefresh }: ReviewFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const startEdit = () => {
    if (!existingReview) return
    setRating(existingReview.rating)
    setComment(existingReview.comment)
    setError('')
    setSuccessMsg('')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setError('')
    setSuccessMsg('')
  }

  const submitNew = async () => {
    if (submitting) return
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว')
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนส่งรีวิว')
      return
    }
    if (comment.trim().length > 75) {
      setError('ข้อความรีวิวต้องไม่เกิน 75 ตัวอักษร')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    try {
      await apiPost('/api/reviews', { bookId, rating, comment: comment.trim() })
      setRating(0)
      setComment('')
      setSuccessMsg('ส่งรีวิวแล้ว รอพนักงานตรวจสอบก่อนเผยแพร่')
      await onRefresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const saveEdit = async () => {
    if (submitting || !existingReview) return
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนบันทึก')
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนบันทึก')
      return
    }
    if (comment.trim().length > 75) {
      setError('ข้อความรีวิวต้องไม่เกิน 75 ตัวอักษร')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    try {
      // ต้องส่ง headline กลับไปด้วยแม้ฟอร์มนี้ไม่มีช่องแก้ไข — service.UpdateReviewInput
      // เขียนทับ Headline แบบไม่มีเงื่อนไข ไม่ส่ง = ค่าเดิมหายเงียบ ๆ
      await apiPut(`/api/reviews/${existingReview.reviewId}`, {
        rating,
        headline: existingReview.headline ?? '',
        comment: comment.trim(),
      })
      setIsEditing(false)
      setSuccessMsg('แก้ไขรีวิวสำเร็จแล้ว')
      await onRefresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'แก้ไขรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteReview = async () => {
    if (deleting || !existingReview) return
    if (!window.confirm('คุณต้องการลบรีวิวนี้ใช่หรือไม่? เมื่อลบแล้วจะไม่สามารถกู้คืนได้')) {
      return
    }
    setDeleting(true)
    setError('')
    setSuccessMsg('')
    try {
      await apiDelete(`/api/reviews/${existingReview.reviewId}`)
      setIsEditing(false)
      setRating(0)
      setComment('')
      await onRefresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setDeleting(false)
    }
  }

  // กรณีมีรีวิวแล้วและไม่ได้อยู่ในโหมดแก้ไข → แสดงรีวิวพร้อมปุ่ม แก้ไข / ลบ
  if (existingReview && !isEditing) {
    return (
      <div className="track-review">
        <div className="track-review__book">
          <BookCover bookId={bookId} title={title} size="sm" />
          <div className="track-review__book-info">
            <h4>{title}</h4>
            <div className="track-review__status-row">
              <span className={`track-review__badge is-${existingReview.status.toLowerCase()}`}>
                {existingReview.status === 'PUBLISHED' ? (
                  <>
                    <Icon name="check-circle" size={14} /> เผยแพร่แล้ว
                  </>
                ) : existingReview.status === 'HIDDEN' ? (
                  <>
                    <Icon name="eye-off" size={14} /> ถูกซ่อน
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={14} /> รอพนักงานตรวจสอบ
                  </>
                )}
              </span>
              {existingReview.createdDate && (
                <span className="track-review__date">
                  รีวิวเมื่อ {new Date(existingReview.createdDate).toLocaleDateString('th-TH')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="track-review__existing-content">
          <div className="track-review__existing-rating">
            <RatingStars value={existingReview.rating} size={18} />
            <span className="track-review__rating-num">{existingReview.rating}/5</span>
          </div>
          <p className="track-review__comment-text">{existingReview.comment}</p>
        </div>

        {error && <p className="track-review__error">{error}</p>}
        {successMsg && (
          <p className="track-review__success">
            <Icon name="check-circle" size={15} /> {successMsg}
          </p>
        )}

        <div className="track-review__actions">
          <button
            type="button"
            className="btn btn-outline btn-sm track-review__btn-edit"
            onClick={startEdit}
          >
            <Icon name="edit" size={15} /> แก้ไขรีวิว
          </button>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm track-review__btn-delete"
            onClick={() => void deleteReview()}
            disabled={deleting}
          >
            <Icon name="trash" size={15} /> {deleting ? 'กำลังลบ…' : 'ลบรีวิว'}
          </button>
        </div>
      </div>
    )
  }

  // กรณีมีรีวิวแล้วและกดแก้ไข → แสดงแบบฟอร์มแก้ไข
  if (existingReview && isEditing) {
    return (
      <div className="track-review">
        <div className="track-review__book">
          <BookCover bookId={bookId} title={title} size="sm" />
          <div className="track-review__book-info">
            <h4>{title}</h4>
            <span className="track-review__editing-badge">กำลังแก้ไขรีวิวของคุณ</span>
          </div>
        </div>

        <div className="track-review__rate">
          <span>แก้ไขคะแนน</span>
          <RatingStars value={rating} interactive size={22} onChange={setRating} />
        </div>
        <div className="track-review__field">
          <div className="track-review__field-header">
            <span>แก้ไขความเห็น</span>
            <span className={`track-review__char-count ${comment.length >= 75 ? 'is-max' : ''}`}>
              {comment.length}/75 ตัวอักษร
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={75}
            placeholder="หนังสือเล่มนี้เป็นอย่างไรบ้าง (ไม่เกิน 75 ตัวอักษร)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        {error && <p className="track-review__error">{error}</p>}
        <div className="track-review__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void saveEdit()}
            disabled={submitting}
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={cancelEdit}
            disabled={submitting}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    )
  }

  // กรณียังไม่เคยรีวิว → แสดงแบบฟอร์มเขียนรีวิวตามปกติ
  return (
    <div className="track-review">
      <div className="track-review__book">
        <BookCover bookId={bookId} title={title} size="sm" />
        <h4>{title}</h4>
      </div>

      <div className="track-review__rate">
        <span>ให้คะแนน</span>
        <RatingStars value={rating} interactive size={22} onChange={setRating} />
      </div>
      <div className="track-review__field">
        <div className="track-review__field-header">
          <span>เขียนรีวิว</span>
          <span className={`track-review__char-count ${comment.length >= 75 ? 'is-max' : ''}`}>
            {comment.length}/75 ตัวอักษร
          </span>
        </div>
        <textarea
          rows={3}
          maxLength={75}
          placeholder="หนังสือเล่มนี้เป็นอย่างไรบ้าง (ไม่เกิน 75 ตัวอักษร)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {error && <p className="track-review__error">{error}</p>}
      {successMsg && (
        <p className="track-review__success">
          <Icon name="check-circle" size={15} /> {successMsg}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-sm track-review__submit"
        onClick={() => void submitNew()}
        disabled={submitting}
      >
        {submitting ? 'กำลังส่ง…' : 'ส่งรีวิว'}
      </button>
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
  const { user } = useAuth()
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)

  const loadReviews = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiGet<CustomerReview[]>('/api/reviews')
      setReviews(data)
    } catch {
      // ละเว้นหากดึงรีวิวไม่สำเร็จ
    } finally {
      setLoadingReviews(false)
    }
  }, [user])

  useEffect(() => {
    if (order.status === 'DELIVERED' && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadReviews()
    }
  }, [order.status, user, loadReviews])

  const steps = buildSteps(order)
  const activeIndex = Math.max(0, steps.findIndex((s) => s.status === 'current'))
  const progress =
    order.status === 'DELIVERED' ? 100 : (activeIndex / (steps.length - 1)) * 100
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED'

  return (
    <div className="track page-shell">
      <header className="track__head">
        <div>
          <h1>คำสั่งซื้อ {formatOrderCode(order.orderId)}</h1>
          <p>สั่งซื้อเมื่อ {order.orderDate}</p>
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
              <dd>{order.shipment?.carrier ?? 'รอจัดส่ง'}</dd>
              <dt>หมายเลขพัสดุ</dt>
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
              {loadingReviews && reviews.length === 0 ? (
                <div className="track-review__loading">
                  <Icon name="clock" size={16} /> กำลังโหลดข้อมูลรีวิว…
                </div>
              ) : (
                <div className="track__reviews">
                  {order.items.map((line) => {
                    const existingReview =
                      reviews.find(
                        (r) =>
                          r.bookId === line.bookId &&
                          (r.orderId == null || r.orderId === order.orderId) &&
                          r.status !== 'REMOVED'
                      ) ||
                      reviews.find((r) => r.bookId === line.bookId && r.status !== 'REMOVED')

                    return (
                      <ReviewForm
                        key={line.bookId}
                        bookId={line.bookId}
                        title={line.title}
                        existingReview={existingReview}
                        onRefresh={loadReviews}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
