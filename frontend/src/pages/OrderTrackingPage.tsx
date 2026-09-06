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
  formatOrderDate,
  milestoneOf,
  getOrderStatusLabel,
  type CustomerOrder,
} from '../admin/orders/orders'
import { THAI_BANKS, formatBankAccount, findBank } from '../data/banks'
import { detectProfanity } from '../admin/reviews/reviews'
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
  const [profanityDetected, setProfanityDetected] = useState<string | null>(null)

  const badComment = detectProfanity(comment)

  const startEdit = () => {
    if (!existingReview) return
    setRating(existingReview.rating)
    setComment(existingReview.comment)
    setError('')
    setSuccessMsg('')
    setProfanityDetected(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setError('')
    setSuccessMsg('')
    setProfanityDetected(null)
  }

  const submitNew = async () => {
    if (submitting) return
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว')
      setProfanityDetected(null)
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนส่งรีวิว')
      setProfanityDetected(null)
      return
    }
    if (comment.trim().length > 75) {
      setError('ข้อความรีวิวต้องไม่เกิน 75 ตัวอักษร')
      setProfanityDetected(null)
      return
    }
    // ตรวจสอบคำหยาบคายก่อนส่ง ถ้ามีให้เตือนลูกค้าพิมพ์ใหม่
    if (badComment) {
      setProfanityDetected(badComment)
      setError('ตรวจพบคำไม่สุภาพหรือไม่เหมาะสมในข้อความรีวิว กรุณาตรวจสอบและพิมพ์ใหม่')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    setProfanityDetected(null)
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
      setProfanityDetected(null)
      return
    }
    if (comment.trim() === '') {
      setError('กรุณาเขียนความเห็นก่อนบันทึก')
      setProfanityDetected(null)
      return
    }
    if (comment.trim().length > 75) {
      setError('ข้อความรีวิวต้องไม่เกิน 75 ตัวอักษร')
      setProfanityDetected(null)
      return
    }
    if (badComment) {
      setProfanityDetected(badComment)
      setError('ตรวจพบคำไม่สุภาพหรือไม่เหมาะสมในข้อความรีวิว กรุณาตรวจสอบและพิมพ์ใหม่')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    setProfanityDetected(null)
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
            className={profanityDetected && badComment ? 'track-review__input--warning' : ''}
            onChange={(e) => {
              setComment(e.target.value)
              if (error) setError('')
              if (profanityDetected) setProfanityDetected(null)
            }}
          />
        </div>
        {error && (
          <div
            className={`track-review__notice ${
              profanityDetected ? 'track-review__notice--warning' : 'track-review__notice--error'
            }`}
          >
            <Icon name="alert-triangle" size={18} />
            <span>{error}</span>
          </div>
        )}
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
          className={profanityDetected && badComment ? 'track-review__input--warning' : ''}
          onChange={(e) => {
            setComment(e.target.value)
            if (error) setError('')
            if (profanityDetected) setProfanityDetected(null)
          }}
        />
      </div>
      {error && (
        <div
          className={`track-review__notice ${
            profanityDetected ? 'track-review__notice--warning' : 'track-review__notice--error'
          }`}
        >
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}
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
  const { updateRefundInfo } = useOrders()
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [copied, setCopied] = useState(false)

  const [localOrder, setLocalOrder] = useState<CustomerOrder | null>(null)
  const currentOrder = localOrder && localOrder.orderId === order.orderId ? localOrder : order

  const [bankName, setBankName] = useState(
    currentOrder.refundBankName || THAI_BANKS[0].name,
  )
  const [accountNo, setAccountNo] = useState(
    currentOrder.refundAccountNo
      ? formatBankAccount(
          currentOrder.refundBankName || THAI_BANKS[0].name,
          currentOrder.refundAccountNo,
        )
      : '',
  )
  const [accountName, setAccountName] = useState(
    currentOrder.refundAccountName || '',
  )
  const [savingBank, setSavingBank] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bankSuccess, setBankSuccess] = useState('')

  // หลังจากกรอกข้อมูลครบถ้วนแล้ว ไม่อยากให้ลูกค้ากรอกซ้ำ
  const isBankSaved = Boolean(
    currentOrder.refundBankName &&
      currentOrder.refundAccountNo &&
      currentOrder.refundAccountName,
  )

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankName.trim() || !accountNo.trim() || !accountName.trim()) {
      setBankError('กรุณากรอกข้อมูลธนาคาร เลขที่บัญชี และชื่อ-นามสกุลผู้รับเงินให้ครบถ้วน')
      return
    }
    setSavingBank(true)
    setBankError('')
    setBankSuccess('')
    try {
      const updated = await updateRefundInfo(
        currentOrder.orderId,
        bankName.trim(),
        accountNo.trim(),
        accountName.trim(),
      )
      if (updated) {
        setLocalOrder(updated)
      }
      setBankSuccess('บันทึกข้อมูลบัญชีรับเงินคืนเรียบร้อยแล้ว')
    } catch (err) {
      setBankError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ')
    } finally {
      setSavingBank(false)
    }
  }

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
    if (currentOrder.status === 'DELIVERED' && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadReviews()
    }
  }, [currentOrder.status, user, loadReviews])

  const steps = buildSteps(currentOrder)
  const activeIndex = Math.max(0, steps.findIndex((s) => s.status === 'current'))
  const progress =
    currentOrder.status === 'DELIVERED' ? 100 : (activeIndex / (steps.length - 1)) * 100
  const cancelled = currentOrder.status === 'CANCELLED' || currentOrder.status === 'REJECTED'

  const trackingNumber = currentOrder.shipment?.trackingNumber?.trim() || ''
  const carrier = currentOrder.shipment?.carrier || 'รอจัดส่ง'

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
          <h1>คำสั่งซื้อ {formatOrderCode(currentOrder.orderId)}</h1>
          <p>สั่งซื้อเมื่อ {formatOrderDate(currentOrder.orderDate)}</p>
        </div>
      </header>

      <section className="track__status">
        <h2>สถานะ: {getOrderStatusLabel(currentOrder)}</h2>
        {cancelled ? (
          <div
            className={`track__cancelled-box ${
              currentOrder.refundStatus === 'REFUNDED'
                ? 'is-refunded'
                : currentOrder.refundStatus === 'PENDING'
                  ? 'is-refund-pending'
                  : ''
            }`}
          >
            <p className="track__cancelled">
              <Icon
                name={currentOrder.refundStatus === 'REFUNDED' ? 'check-circle' : 'alert-triangle'}
                size={20}
              />
              {currentOrder.refundStatus === 'REFUNDED'
                ? 'คำสั่งซื้อนี้ถูกยกเลิก และทางร้านได้ดำเนินการคืนเงินให้ท่านเรียบร้อยแล้ว'
                : 'คำสั่งซื้อนี้ถูกยกเลิก และอยู่ระหว่างขั้นตอนการคืนเงิน'}
            </p>
            {currentOrder.cancelReason && (
              <p className="track__cancel-reason">
                <strong>เหตุผลที่ยกเลิก:</strong> {currentOrder.cancelReason}
              </p>
            )}
          </div>
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

      {currentOrder.status === 'CANCELLED' && (
        <section
          className={`track__refund-card ${
            currentOrder.refundStatus === 'REFUNDED' ? 'is-refunded' : ''
          }`}
        >
          <div className="track__refund-header">
            <Icon
              name={currentOrder.refundStatus === 'REFUNDED' ? 'check-circle' : 'credit-card'}
              size={22}
            />
            <div>
              <h3 className="track__refund-title">ข้อมูลการคืนเงินให้ลูกค้า</h3>
              <span
                className={`track__refund-tag is-${(
                  currentOrder.refundStatus || 'pending'
                ).toLowerCase()}`}
              >
                {currentOrder.refundStatus === 'REFUNDED'
                  ? 'คืนเงินแล้ว'
                  : isBankSaved
                    ? 'บันทึกข้อมูลแล้ว - รอพนักงานโอนเงิน'
                    : 'กรุณากรอกข้อมูลบัญชีรับเงินคืน'}
              </span>
            </div>
          </div>

          {currentOrder.refundStatus === 'REFUNDED' ? (
            <div className="track__refund-content is-success">
              <div className="track__refund-msg">
                <Icon name="check-circle" size={20} />
                <span>พนักงานได้ดำเนินการคืนเงินให้ลูกค้าเรียบร้อยแล้ว</span>
              </div>
              <div className="track__refund-account-box">
                <div>
                  <strong>ยอดเงินที่คืน:</strong>{' '}
                  <span className="track__refund-highlight-amount">
                    ฿ {formatPrice(currentOrder.netAmount)}
                  </span>
                </div>
                <div>
                  <strong>ชื่อธนาคาร:</strong> {currentOrder.refundBankName || '—'}
                </div>
                <div>
                  <strong>เลขที่บัญชี:</strong> {currentOrder.refundAccountNo || '—'}
                </div>
                {currentOrder.refundAccountName && (
                  <div>
                    <strong>ชื่อ-นามสกุลผู้รับเงิน:</strong> {currentOrder.refundAccountName}
                  </div>
                )}
              </div>
              {currentOrder.refundNote && (
                <p className="track__refund-detail">
                  <strong>ข้อความบันทึกจากร้าน:</strong> {currentOrder.refundNote}
                </p>
              )}
              {currentOrder.refundedAt && (
                <p className="track__refund-detail">
                  <strong>วันเวลาที่คืนเงิน:</strong>{' '}
                  {new Date(currentOrder.refundedAt).toLocaleString('th-TH')}
                </p>
              )}
            </div>
          ) : isBankSaved ? (
            <div className="track__refund-content">
              <div className="track__refund-saved-view">
                <div className="track__refund-saved-badge">
                  <Icon name="check" size={16} /> บันทึกข้อมูลบัญชีรับเงินคืนเรียบร้อยแล้ว
                </div>
                <p className="track__refund-info-text">
                  ระบบได้บันทึกข้อมูลบัญชีของท่านเรียบร้อยแล้ว ขณะนี้อยู่ระหว่างพนักงานตรวจสอบและโอนเงินคืนตามข้อมูลด้านล่างนี้
                </p>
                <div className="track__refund-account-box">
                  <div>
                    <strong>ยอดเงินที่ได้รับคืน:</strong>{' '}
                    <span className="track__refund-highlight-amount">
                      ฿ {formatPrice(currentOrder.netAmount)}
                    </span>
                  </div>
                  <div>
                    <strong>ธนาคาร:</strong> {currentOrder.refundBankName}
                  </div>
                  <div>
                    <strong>เลขที่บัญชี:</strong> {currentOrder.refundAccountNo}
                  </div>
                  <div>
                    <strong>ชื่อนามสกุลผู้รับ:</strong> {currentOrder.refundAccountName}
                  </div>
                </div>
                {bankSuccess && <p className="track__refund-success">{bankSuccess}</p>}
                <p className="track__refund-locked-notice">
                  <Icon name="lock" size={14} /> ข้อมูลนี้ถูกบันทึกเข้าระบบแล้ว ไม่อนุญาตให้แก้ไขซ้ำ เพื่อความปลอดภัยและถูกต้อง
                </p>
              </div>
            </div>
          ) : (
            <div className="track__refund-content">
              <form className="track__refund-form" onSubmit={(e) => void handleSaveBank(e)}>
                <p className="track__refund-form-prompt">
                  กรุณาเลือกธนาคารและกรอกเลขที่บัญชี พร้อมชื่อ-นามสกุล เพื่อให้พนักงานดำเนินการโอนเงินคืนยอด{' '}
                  <strong>฿ {formatPrice(currentOrder.netAmount)}</strong>
                </p>
                <div className="track__refund-form-grid">
                  <label className="track__refund-form-label">
                    <span>ธนาคารที่รับเงินคืน</span>
                    <select
                      className="track__refund-select"
                      value={bankName}
                      onChange={(e) => {
                        const newBank = e.target.value
                        setBankName(newBank)
                        setAccountNo(formatBankAccount(newBank, accountNo))
                      }}
                      required
                    >
                      {THAI_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="track__refund-form-label">
                    <span>
                      {findBank(bankName)?.code === 'PROMPTPAY'
                        ? 'เบอร์พร้อมเพย์ 10 หลัก (ระบบใส่ขีดให้อัตโนมัติ)'
                        : 'เลขที่บัญชี (ระบบใส่ขีดให้อัตโนมัติ)'}
                    </span>
                    <input
                      type="text"
                      required
                      className="track__refund-input"
                      placeholder={findBank(bankName)?.placeholder || '000-0-00000-0'}
                      maxLength={findBank(bankName)?.code === 'PROMPTPAY' ? 12 : 16}
                      value={accountNo}
                      onChange={(e) => setAccountNo(formatBankAccount(bankName, e.target.value))}
                    />
                  </label>

                  <label className="track__refund-form-label track__refund-form-label--full">
                    <span>ชื่อ - นามสกุล ผู้รับเงินคืน (ตามหน้าสมุดบัญชี)</span>
                    <input
                      type="text"
                      required
                      className="track__refund-input"
                      placeholder="เช่น น.ส. สมศรี มีสุข"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </label>
                </div>
                {bankError && <p className="track__refund-error">{bankError}</p>}
                {bankSuccess && <p className="track__refund-success">{bankSuccess}</p>}
                <div className="track__refund-form-btns">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingBank}
                  >
                    <Icon name="check" size={16} />
                    {savingBank ? 'กำลังบันทึก…' : 'ยืนยันข้อมูลบัญชีรับเงินคืน'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      <div className="track__grid">
        <div className="track__col">
          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="truck" size={18} /> ข้อมูลการจัดส่ง
            </h3>
            <dl className="track__dl">
              <dt>ที่อยู่จัดส่ง</dt>
              <dd>
                {currentOrder.customerName}
                <br />
                {currentOrder.shippingAddress}
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
                <span>{formatPrice(currentOrder.subtotal)}</span>
              </div>
              {currentOrder.discountAmount > 0 && (
                <div className="track__row track__row--discount">
                  <span>ส่วนลด {currentOrder.promotionName ? `(${currentOrder.promotionName})` : ''}</span>
                  <span>-{formatPrice(currentOrder.discountAmount)}</span>
                </div>
              )}
              <div className="track__row track__row--total">
                <span>ยอดชำระทั้งสิ้น</span>
                <span>{formatPrice(currentOrder.netAmount)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="track__col track__col--wide">
          <section className="track__panel">
            <h3 className="track__panel-title">รายการที่สั่งซื้อ</h3>
            <ul className="track__items">
              {currentOrder.items.map((line) => (
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

          {currentOrder.status === 'DELIVERED' && (
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
                  {currentOrder.items.map((line) => {
                    const existingReview =
                      reviews.find(
                        (r) =>
                          r.bookId === line.bookId &&
                          (r.orderId == null || r.orderId === currentOrder.orderId) &&
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
