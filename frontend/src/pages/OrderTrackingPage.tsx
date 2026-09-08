import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import BookCover from '../components/BookCover'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import EmptyState from '../admin/components/EmptyState'
import Modal from '../admin/components/Modal'
import { apiGet, apiPost, apiDelete, ApiError } from '../api/client'
import { formatPrice } from '../data/money'
import { useAuth } from '../auth/AuthContext'
import { useOrders } from '../admin/orders/OrderContext'
import { usePayments } from '../admin/payments/PaymentContext'
import {
  formatOrderCode,
  formatOrderDate,
  milestoneOf,
  getOrderStatusLabel,
  type CustomerOrder,
} from '../admin/orders/orders'
import { THAI_BANKS, formatBankAccount, findBank, cleanDigits } from '../data/banks'
import { detectProfanity } from '../admin/reviews/reviews'
import './OrderTrackingPage.css'

const MAX_SLIP_BYTES = 5 * 1024 * 1024
const SLIP_PATTERN = /\.(jpe?g|png|pdf)$/i

function getSlipSource(orderId: number, slipFileName?: string): string {
  if (!slipFileName) return ''
  try {
    const fromOrder = localStorage.getItem(`slip_order_${orderId}`)
    if (fromOrder) return fromOrder
    const fromFile = localStorage.getItem(`slip_file_${slipFileName}`)
    if (fromFile) return fromFile
  } catch {
    // ignore
  }
  return `/slips/${slipFileName}`
}

type StepStatus = 'done' | 'current' | 'todo'

// คำเดียวกับ ORDER_STATUS_LABELS ของหลังร้าน เรียงตาม milestoneOf() ทั้งห้าขั้น
const STEP_LABELS = ['สั่งซื้อแล้ว', 'ชำระเงินแล้ว', 'กำลังแพ็กสินค้า', 'จัดส่งแล้ว', 'ส่งถึงแล้ว']

interface CustomerReview {
  reviewId: number
  bookId: number
  orderId?: number
  orderCode?: string
  rating: number
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

// ReviewForm — จัดการรีวิวของลูกค้า (เขียนใหม่ / ลบ)
function ReviewForm({ bookId, title, existingReview, onRefresh }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [profanityDetected, setProfanityDetected] = useState<string | null>(null)

  const badComment = detectProfanity(comment)
  const badWord = badComment

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
    if (badWord) {
      setProfanityDetected(badWord)
      setError('ตรวจพบคำไม่สุภาพหรือไม่เหมาะสมในข้อความรีวิว กรุณาตรวจสอบและพิมพ์ใหม่')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccessMsg('')
    setProfanityDetected(null)
    try {
      await apiPost('/api/reviews', {
        bookId,
        rating,
        comment: comment.trim(),
      })
      setRating(0)
      setComment('')
      setSuccessMsg('ส่งรีวิวสำเร็จแล้ว')
      await onRefresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
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
      setRating(0)
      setComment('')
      await onRefresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setDeleting(false)
    }
  }

  // กรณีมีรีวิวแล้ว → แสดงรีวิวพร้อมปุ่ม ลบ (ไม่มีปุ่มแก้ไข)
  if (existingReview) {
    return (
      <div className="track-review">
        <div className="track-review__book">
          <BookCover bookId={bookId} title={title} size="sm" />
          <div className="track-review__book-info">
            <h4>{title}</h4>
            {existingReview.createdDate && (
              <span className="track-review__date">
                รีวิวเมื่อ {new Date(existingReview.createdDate).toLocaleDateString('th-TH')}
              </span>
            )}
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
  const { updateRefundInfo, submitCustomerChoice, reload } = useOrders()
  const { banks } = usePayments()
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [copied, setCopied] = useState(false)

  const [localOrder, setLocalOrder] = useState<CustomerOrder | null>(null)
  const currentOrder = localOrder && localOrder.orderId === order.orderId ? localOrder : order

  // Out of stock customer decision state
  const [choiceLoading, setChoiceLoading] = useState(false)
  const [choiceError, setChoiceError] = useState('')
  const [choiceSuccess, setChoiceSuccess] = useState('')

  // Change product modal state
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [exchangeNote, setExchangeNote] = useState('')

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelNote, setCancelNote] = useState('')

  const handleWaitRestock = async () => {
    if (choiceLoading) return
    setChoiceLoading(true)
    setChoiceError('')
    setChoiceSuccess('')
    try {
      const updated = await submitCustomerChoice(currentOrder.orderId, 'WAIT_RESTOCK')
      setLocalOrder(updated)
      setChoiceSuccess('บันทึกความประสงค์รอสินค้าเติมสต็อกเรียบร้อยแล้ว เมื่อสินค้าเข้าสต็อกทางร้านจะจัดส่งให้ทันที')
      await reload()
    } catch (err) {
      setChoiceError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setChoiceLoading(false)
    }
  }

  const handleConfirmExchange = async () => {
    if (choiceLoading) return
    setChoiceLoading(true)
    setChoiceError('')
    setChoiceSuccess('')
    try {
      const updated = await submitCustomerChoice(currentOrder.orderId, 'CHANGE_PRODUCT', {
        note: exchangeNote.trim() || undefined,
      })
      setLocalOrder(updated)
      setShowExchangeModal(false)
      setChoiceSuccess('ยกเลิกคำสั่งซื้อเพื่อเปลี่ยนสินค้าเรียบร้อยแล้ว กรุณากรอกข้อมูลบัญชีรับเงินคืนด้านล่าง ทางร้านจะดำเนินการคืนเงินให้ท่านเต็มจำนวน')
      await reload()
    } catch (err) {
      setChoiceError(err instanceof Error ? err.message : 'ไม่สามารถยกเลิกคำสั่งซื้อเพื่อเปลี่ยนสินค้าได้')
    } finally {
      setChoiceLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (choiceLoading) return
    setChoiceLoading(true)
    setChoiceError('')
    setChoiceSuccess('')
    try {
      const updated = await submitCustomerChoice(currentOrder.orderId, 'CANCEL', {
        note: cancelNote.trim() || undefined,
      })
      setLocalOrder(updated)
      setShowCancelModal(false)
      setChoiceSuccess('ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว กรุณากรอกข้อมูลบัญชีธนาคารด้านล่างเพื่อรับเงินคืน')
      await reload()
    } catch (err) {
      setChoiceError(err instanceof Error ? err.message : 'ไม่สามารถยกเลิกคำสั่งซื้อได้')
    } finally {
      setChoiceLoading(false)
    }
  }



  // Re-upload slip states for REJECTED orders
  const [newSlip, setNewSlip] = useState<File | null>(null)
  const [newSlipPreview, setNewSlipPreview] = useState<string>('')
  const [uploadingSlip, setUploadingSlip] = useState(false)
  const [slipUploadError, setSlipUploadError] = useState('')
  const [slipUploadSuccess, setSlipUploadSuccess] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedBankId, setSelectedBankId] = useState<number | undefined>(undefined)
  const slipInputRef = useRef<HTMLInputElement>(null)

  const pickNewSlip = (file: File | undefined) => {
    setSlipUploadError('')
    setSlipUploadSuccess('')
    if (!file) {
      setNewSlip(null)
      setNewSlipPreview('')
      if (slipInputRef.current) slipInputRef.current.value = ''
      return
    }
    if (!SLIP_PATTERN.test(file.name)) {
      setSlipUploadError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือเอกสาร PDF')
      setNewSlip(null)
      setNewSlipPreview('')
      if (slipInputRef.current) slipInputRef.current.value = ''
      return
    }
    if (file.size > MAX_SLIP_BYTES) {
      setSlipUploadError('ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB')
      setNewSlip(null)
      setNewSlipPreview('')
      if (slipInputRef.current) slipInputRef.current.value = ''
      return
    }
    setNewSlip(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setNewSlipPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setNewSlipPreview('')
    }
  }

  const handleReuploadSlip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlip) {
      setSlipUploadError('กรุณาเลือกไฟล์สลิปก่อนส่ง')
      return
    }
    setUploadingSlip(true)
    setSlipUploadError('')
    setSlipUploadSuccess('')
    try {
      const updated = await apiPost<CustomerOrder>(`/api/orders/${currentOrder.orderId}/payment`, {
        slipFileName: newSlip.name,
        bankId: selectedBankId,
      })
      if (newSlipPreview) {
        try {
          localStorage.setItem(`slip_order_${currentOrder.orderId}`, newSlipPreview)
          localStorage.setItem(`slip_file_${newSlip.name}`, newSlipPreview)
        } catch {
          // ignore localStorage quota error
        }
      }
      setLocalOrder(updated)
      setSlipUploadSuccess('ส่งหลักฐานการชำระเงินใหม่เรียบร้อยแล้ว อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบ')
      setNewSlip(null)
      setNewSlipPreview('')
      if (slipInputRef.current) slipInputRef.current.value = ''
      await reload()
    } catch (err) {
      setSlipUploadError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งสลิป กรุณาลองใหม่อีกครั้ง',
      )
    } finally {
      setUploadingSlip(false)
    }
  }

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
  const [accountTouched, setAccountTouched] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)

  // หลังจากกรอกข้อมูลครบถ้วนแล้ว ไม่อยากให้ลูกค้ากรอกซ้ำ
  const isBankSaved = Boolean(
    currentOrder.refundBankName &&
      currentOrder.refundAccountNo &&
      currentOrder.refundAccountName,
  )

  const currentBank = findBank(bankName)
  const isPromptPay = currentBank?.code === 'PROMPTPAY'
  const expectedDigits = currentBank?.digits || 10
  const rawDigits = cleanDigits(accountNo)

  // ตรวจสอบความถูกต้องของหมายเลขพร้อมเพย์หรือเลขบัญชี (ไม่แสดงตัวนับหลัก)
  let accountValidationError = ''
  if (rawDigits.length === 0) {
    accountValidationError = isPromptPay
      ? 'กรุณากรอกหมายเลขพร้อมเพย์'
      : 'กรุณากรอกเลขที่บัญชี'
  } else if (isPromptPay && !rawDigits.startsWith('0')) {
    accountValidationError = 'หมายเลขพร้อมเพย์ต้องขึ้นต้นด้วย 0'
  } else if (rawDigits.length < expectedDigits) {
    accountValidationError = isPromptPay
      ? 'กรุณากรอกหมายเลขพร้อมเพย์ให้ครบถ้วน'
      : 'กรุณากรอกเลขที่บัญชีให้ครบถ้วน'
  }

  const isAccountValid = accountValidationError === ''

  // ตรวจสอบความถูกต้องของชื่อ-นามสกุล
  let nameValidationError = ''
  if (!accountName.trim()) {
    nameValidationError = 'กรุณาระบุชื่อ - นามสกุล ผู้รับเงินคืน (ตามหน้าสมุดบัญชี)'
  } else if (accountName.trim().length < 2) {
    nameValidationError = 'ชื่อ - นามสกุล ต้องมีความยาวอย่างน้อย 2 ตัวอักษร'
  }

  const isNameValid = nameValidationError === ''
  const isFormValid = isAccountValid && isNameValid && Boolean(bankName.trim())

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountTouched(true)
    setNameTouched(true)
    if (!isFormValid) {
      if (accountValidationError) {
        setBankError(accountValidationError)
      } else if (nameValidationError) {
        setBankError(nameValidationError)
      } else {
        setBankError('กรุณากรอกข้อมูลเพื่อรับเงินคืนให้ครบถ้วนและถูกต้องตามรูปแบบ')
      }
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
  const isCancelled = currentOrder.status === 'CANCELLED'
  const isRejected = currentOrder.status === 'REJECTED'
  const isVerifying = currentOrder.status === 'VERIFYING_PAYMENT'
  const isOutOfStock = currentOrder.status === 'OUT_OF_STOCK'
  const isWaitingRestock = currentOrder.status === 'WAITING_RESTOCK'
  const isExchangeRequested = currentOrder.status === 'EXCHANGE_REQUESTED'

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
        {isCancelled ? (
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
            {currentOrder.discountCode && (
              <div className="track__discount-reset-banner" style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '13px' }}>
                <Icon name="tag" size={16} />
                <span>
                  <strong>คืนสิทธิ์โค้ดส่วนลดเรียบร้อย:</strong> รหัส <strong>{currentOrder.discountCode}</strong> ได้รับการรีเซ็ตให้สามารถนำกลับไปใช้สั่งซื้อใหม่ได้แล้ว
                </span>
              </div>
            )}
          </div>
        ) : isRejected ? (
          <div className="track__rejected-box">
            <div className="track__rejected-header">
              <Icon name="alert-triangle" size={22} />
              <div>
                <p className="track__rejected-title">
                  การชำระเงินถูกปฏิเสธ (สลิปไม่ถูกต้อง)
                </p>
                <p className="track__rejected-desc">
                  เจ้าหน้าที่ได้ตรวจสอบหลักฐานแล้วพบว่าข้อมูลไม่ถูกต้อง กรุณาแนบรูปสลีปใหม่อีกครั้งด้านล่าง เพื่อให้เจ้าหน้าที่ตรวจสอบ
                </p>
              </div>
            </div>
            {currentOrder.cancelReason && (
              <p className="track__rejected-reason">
                <strong>เหตุผลที่ปฏิเสธจากทางร้าน:</strong> {currentOrder.cancelReason}
              </p>
            )}
          </div>
        ) : isOutOfStock ? (
          <div className="track__oos-box">
            <div className="track__oos-header">
              <Icon name="alert-triangle" size={24} />
              <div>
                <p className="track__oos-title">สินค้าหมดสต็อกชั่วคราว (รอลูกค้าตัดสินใจ)</p>
                <p className="track__oos-desc">
                  ขออภัยในความไม่สะดวก ทางร้านได้ตรวจสอบแล้วพบว่าสินค้าหมดสต็อกชั่วคราว ท่านสามารถเลือกวิธีการดำเนินการต่อได้ 3 รูปแบบตามที่สะดวกในกล่องด้านล่าง
                </p>
              </div>
            </div>
            {currentOrder.outOfStockNote && (
              <p className="track__oos-note">
                <strong>ข้อความจากทางร้าน:</strong> {currentOrder.outOfStockNote}
              </p>
            )}
            {(currentOrder.restockEstimate || currentOrder.restockDate) && (
              <div className="track__oos-estimate">
                <Icon name="clock" size={16} />
                <span>
                  <strong>ประมาณการสินค้าเข้า:</strong>{' '}
                  {currentOrder.restockEstimate || (currentOrder.restockDate ? new Date(currentOrder.restockDate).toLocaleDateString('th-TH') : '')}
                </span>
              </div>
            )}
          </div>
        ) : isWaitingRestock ? (
          <div className="track__waiting-box">
            <div className="track__waiting-header">
              <Icon name="clock" size={24} />
              <div>
                <p className="track__waiting-title">อยู่ระหว่างรอสินค้าเติมสต็อก</p>
                <p className="track__waiting-desc">
                  ท่านได้เลือก: <strong>ยินดีรอสินค้าเติมสต็อก</strong>{' '}
                  {currentOrder.restockEstimate || (currentOrder.restockDate ? `(คาดว่าเข้า: ${currentOrder.restockEstimate || new Date(currentOrder.restockDate).toLocaleDateString('th-TH')})` : '')}
                </p>
                <p className="track__waiting-sub">
                  เมื่อสินค้าเข้าสต็อกแล้ว เจ้าหน้าที่จะดำเนินการยืนยันสต็อกและจัดส่งให้ท่านโดยเร็วที่สุด
                </p>
              </div>
            </div>
          </div>
        ) : isExchangeRequested ? (
          <div className="track__exchange-box">
            <div className="track__exchange-header">
              <Icon name="edit" size={24} />
              <div>
                <p className="track__exchange-title">อยู่ระหว่างรอดำเนินการเปลี่ยนสินค้า</p>
                <p className="track__exchange-desc">
                  ท่านได้เลือก: <strong>ขอเปลี่ยนสินค้าเป็นเล่มอื่น</strong>
                  {currentOrder.replacementBookTitle ? (
                    <span> (เล่มที่เลือก: <strong>{currentOrder.replacementBookTitle}</strong>)</span>
                  ) : currentOrder.replacementBookId ? (
                    <span> (รหัสเล่มที่เลือก: <strong>#{currentOrder.replacementBookId}</strong>)</span>
                  ) : null}
                </p>
                {currentOrder.replacementNote && (
                  <p className="track__exchange-note">
                    <strong>หมายเหตุ:</strong> {currentOrder.replacementNote}
                  </p>
                )}
                <p className="track__exchange-sub">
                  อยู่ระหว่างรอเจ้าหน้าที่ฝ่ายขายตรวจสอบและปรับปรุงรายการคำสั่งซื้อให้ท่าน
                </p>
              </div>
            </div>
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

        {isVerifying && (
          <div className="track__verifying-notice">
            <Icon name="clock" size={20} />
            <div>
              <p className="track__verifying-title">ได้รับหลักฐานการชำระเงินแล้ว</p>
              <p className="track__verifying-desc">
                ขณะนี้ระบบได้รับสลิปของท่านเรียบร้อยแล้ว อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบยอดเงิน
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Card เลือกดำเนินการกรณีสินค้าหมด ── */}
      {isOutOfStock && (
        <section className="track__oos-card">
          <div className="track__oos-card-head">
            <Icon name="help" size={24} />
            <div>
              <h3 className="track__oos-card-title">กรุณาเลือกวิธีการดำเนินการต่อ</h3>
              <p className="track__oos-card-subtitle">
                เพื่อความสะดวกของท่าน ท่านสามารถเลือกได้ 3 รูปแบบตามที่สะดวก
              </p>
            </div>
          </div>

          {choiceError && (
            <div className="track__choice-error">
              <Icon name="alert-triangle" size={16} />
              <span>{choiceError}</span>
            </div>
          )}

          {choiceSuccess && (
            <div className="track__choice-success">
              <Icon name="check-circle" size={16} />
              <span>{choiceSuccess}</span>
            </div>
          )}

          <div className="track__oos-card-grid">
            {/* 1. รอสินค้า */}
            <div className="track__oos-choice-item is-wait">
              <div className="track__oos-choice-icon is-wait">
                <Icon name="clock" size={26} />
              </div>
              <div className="track__oos-choice-body">
                <h4 className="track__oos-choice-title">1. รอสินค้าเติมสต็อก</h4>
                <p className="track__oos-choice-desc">
                  ยินดีรอสินค้าตามกำหนดการที่ร้านแจ้ง{' '}
                  {currentOrder.restockEstimate || (currentOrder.restockDate ? `(${currentOrder.restockEstimate || new Date(currentOrder.restockDate).toLocaleDateString('th-TH')})` : '')}
                  {' '}เมื่อของเข้าสต็อก ทางร้านจะรีบจัดส่งให้ทันที
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary track__oos-choice-btn"
                disabled={choiceLoading}
                onClick={() => void handleWaitRestock()}
              >
                <Icon name="check" size={16} /> ยืนยันรอสินค้า
              </button>
            </div>

            {/* 2. เปลี่ยนสินค้า */}
            <div className="track__oos-choice-item is-exchange">
              <div className="track__oos-choice-icon is-exchange">
                <Icon name="book" size={26} />
              </div>
              <div className="track__oos-choice-body">
                <h4 className="track__oos-choice-title">2. ต้องการเปลี่ยนสินค้า</h4>
                <p className="track__oos-choice-desc">
                  ยกเลิกคำสั่งซื้อนี้ทั้งหมดและดำเนินการคืนเงิน เพื่อให้ท่านสามารถเลือกสั่งซื้อหนังสือเล่มใหม่ตามต้องการ
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary track__oos-choice-btn"
                disabled={choiceLoading}
                onClick={() => {
                  setExchangeNote('')
                  setShowExchangeModal(true)
                }}
              >
                <Icon name="book" size={16} /> เปลี่ยนสินค้า (ยกเลิกและคืนเงิน)
              </button>
            </div>

            {/* 3. ยกเลิกคำสั่งซื้อ */}
            <div className="track__oos-choice-item is-cancel">
              <div className="track__oos-choice-icon is-cancel">
                <Icon name="close" size={26} />
              </div>
              <div className="track__oos-choice-body">
                <h4 className="track__oos-choice-title">3. ขอยกเลิกคำสั่งซื้อ</h4>
                <p className="track__oos-choice-desc">
                  ยกเลิกคำสั่งซื้อนี้ และกรอกข้อมูลเลขบัญชีธนาคารเพื่อรับเงินคืนเต็มจำนวน
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline-danger track__oos-choice-btn"
                disabled={choiceLoading}
                onClick={() => {
                  setCancelNote('')
                  setShowCancelModal(true)
                }}
              >
                <Icon name="close" size={16} /> ยกเลิกคำสั่งซื้อ
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── ตัวเลือกเปลี่ยนใจสำหรับสถานะ WAITING_RESTOCK หรือ EXCHANGE_REQUESTED ── */}
      {(isWaitingRestock || isExchangeRequested) && (
        <section className="track__oos-secondary-bar">
          <span className="track__oos-secondary-label">
            <Icon name="help" size={16} /> ต้องการเปลี่ยนตัวเลือกการดำเนินการ?
          </span>
          <div className="track__oos-secondary-btns">

            {isExchangeRequested && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={choiceLoading}
                onClick={() => {
                  setExchangeNote(currentOrder.replacementNote || '')
                  setShowExchangeModal(true)
                }}
              >
                <Icon name="book" size={14} /> ต้องการเปลี่ยนสินค้า (ยกเลิกและคืนเงิน)
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={choiceLoading}
              onClick={() => {
                setCancelNote('')
                setShowCancelModal(true)
              }}
            >
              <Icon name="close" size={14} /> ขอยกเลิกคำสั่งซื้อเพื่อรับเงินคืน
            </button>
          </div>
        </section>
      )}

      {isRejected && (
        <section className="track__reupload-card">
          <div className="track__reupload-header">
            <Icon name="upload" size={22} />
            <div>
              <h3 className="track__reupload-title">แนบหลักฐานการชำระเงินใหม่</h3>
              <p className="track__reupload-subtitle">
                ยอดชำระที่ต้องโอน: <strong className="track__reupload-amount">฿ {formatPrice(currentOrder.netAmount)}</strong>
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleReuploadSlip(e)} className="track__reupload-form">
            {banks && banks.length > 0 && (
              <div className="track__reupload-bank-group">
                <label className="track__reupload-bank-label">
                  <span>บัญชีธนาคารของร้านที่โอนเข้า</span>
                  <select
                    className="track__reupload-select"
                    value={selectedBankId ?? banks[0].bankId}
                    onChange={(e) => setSelectedBankId(Number(e.target.value))}
                  >
                    {banks.map((b) => (
                      <option key={b.bankId} value={b.bankId}>
                        {b.name} ({b.accountNo})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div
              className={`track__reupload-dropzone ${isDragOver ? 'is-dragover' : ''} ${
                newSlip ? 'has-file' : ''
              }`}
              onClick={() => slipInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDragOver(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (e.dataTransfer.files?.[0]) {
                  pickNewSlip(e.dataTransfer.files[0])
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  slipInputRef.current?.click()
                }
              }}
            >
              <input
                ref={slipInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => pickNewSlip(e.target.files?.[0])}
              />

              {newSlip ? (
                <div className="track__reupload-preview">
                  {newSlipPreview ? (
                    <img
                      src={newSlipPreview}
                      alt="ตัวอย่างสลิปใหม่"
                      className="track__reupload-preview-img"
                    />
                  ) : (
                    <div className="track__reupload-pdf-icon">
                      <Icon name="file-text" size={48} />
                    </div>
                  )}
                  <div className="track__reupload-preview-info">
                    <span className="track__reupload-preview-name">{newSlip.name}</span>
                    <span className="track__reupload-preview-size">
                      {(newSlip.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      className="track__reupload-change-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        slipInputRef.current?.click()
                      }}
                    >
                      <Icon name="edit" size={14} /> คลิกเพื่อเปลี่ยนไฟล์
                    </button>
                  </div>
                </div>
              ) : (
                <div className="track__reupload-drop-prompt">
                  <div className="track__reupload-drop-icon">
                    <Icon name="upload" size={32} />
                  </div>
                  <p className="track__reupload-drop-title">
                    ลากไฟล์สลิปมาวางที่นี่ หรือ <span>เลือกไฟล์</span>
                  </p>
                  <p className="track__reupload-drop-hint">
                    รองรับไฟล์รูปภาพ JPG, PNG หรือ PDF (ขนาดไม่เกิน 5MB)
                  </p>
                </div>
              )}
            </div>

            {slipUploadError && (
              <div className="track__reupload-error">
                <Icon name="alert-triangle" size={16} />
                <span>{slipUploadError}</span>
              </div>
            )}

            {slipUploadSuccess && (
              <div className="track__reupload-success">
                <Icon name="check-circle" size={16} />
                <span>{slipUploadSuccess}</span>
              </div>
            )}

            <div className="track__reupload-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!newSlip || uploadingSlip}
              >
                <Icon name={uploadingSlip ? 'clock' : 'check'} size={18} />
                {uploadingSlip ? 'กำลังส่งหลักฐาน…' : 'ส่งหลักฐานการชำระเงินใหม่'}
              </button>
            </div>
          </form>
        </section>
      )}

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
                    {formatPrice(currentOrder.netAmount)}
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
                <p className="track__refund-info-text">
                  รอพนักงานตรวจสอบและโอนเงินคืนตามข้อมูลด้านล่างนี้
                </p>
                <div className="track__refund-account-box">
                  <div>
                    <strong>ยอดเงินที่ได้รับคืน:</strong>{' '}
                    <span className="track__refund-highlight-amount">
                      {formatPrice(currentOrder.netAmount)}
                    </span>
                  </div>
                  <div>
                    <strong>ธนาคาร:</strong> {currentOrder.refundBankName}
                  </div>
                  <div>
                    <strong>เลขที่บัญชี:</strong> {currentOrder.refundAccountNo}
                  </div>
                  <div>
                    <strong>ชื่อผู้รับเงิน:</strong> {currentOrder.refundAccountName}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="track__refund-content">
              <form className="track__refund-form" onSubmit={(e) => void handleSaveBank(e)}>
                <p className="track__refund-form-prompt">
                  กรุณาเลือกธนาคารและกรอกเลขที่บัญชี พร้อมชื่อ-นามสกุล เพื่อให้พนักงานดำเนินการโอนเงินคืนยอด{' '}
                  <strong>{formatPrice(currentOrder.netAmount)}</strong>
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
                    <span>{isPromptPay ? 'หมายเลขพร้อมเพย์' : 'เลขที่บัญชี'}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      className={`track__refund-input ${
                        accountTouched || accountNo.length > 0
                          ? isAccountValid
                            ? 'is-valid'
                            : 'is-invalid'
                          : ''
                      }`}
                      placeholder={currentBank?.placeholder || (isPromptPay ? '000-000-0000' : '000-0-00000-0')}
                      maxLength={isPromptPay ? 12 : expectedDigits === 12 ? 14 : 14}
                      value={accountNo}
                      onChange={(e) => {
                        setAccountNo(formatBankAccount(bankName, e.target.value))
                        setAccountTouched(true)
                        setBankError('')
                      }}
                      onBlur={() => setAccountTouched(true)}
                    />
                    {(accountTouched || accountNo.length > 0) && !isAccountValid && (
                      <span className="track__refund-field-msg track__refund-field-msg--error">
                        <Icon name="alert-triangle" size={13} />
                        <span>{accountValidationError}</span>
                      </span>
                    )}
                  </label>

                  <label className="track__refund-form-label track__refund-form-label--full">
                    <span>ชื่อ - นามสกุล ผู้รับเงินคืน (ตามหน้าสมุดบัญชี)</span>
                    <input
                      type="text"
                      required
                      className={`track__refund-input ${
                        nameTouched || accountName.length > 0
                          ? isNameValid
                            ? 'is-valid'
                            : 'is-invalid'
                          : ''
                      }`}
                      placeholder="เช่น น.ส. สมศรี มีสุข"
                      value={accountName}
                      onChange={(e) => {
                        setAccountName(e.target.value)
                        setNameTouched(true)
                        setBankError('')
                      }}
                      onBlur={() => setNameTouched(true)}
                    />
                    {(nameTouched || accountName.length > 0) && !isNameValid && (
                      <span className="track__refund-field-msg track__refund-field-msg--error">
                        <Icon name="alert-triangle" size={13} />
                        <span>{nameValidationError}</span>
                      </span>
                    )}
                  </label>
                </div>
                {bankError && <p className="track__refund-error">{bankError}</p>}
                {bankSuccess && <p className="track__refund-success">{bankSuccess}</p>}
                <div className="track__refund-form-btns">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={savingBank || !isFormValid}
                    title={!isFormValid ? 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้องตามรูปแบบก่อนกดยืนยัน' : undefined}
                  >
                    <Icon name="check" size={16} />
                    {savingBank ? 'กำลังบันทึก…' : 'ยืนยันข้อมูลบัญชีรับเงินคืน'}
                  </button>
                  {!isFormValid && (accountNo.length > 0 || accountName.length > 0) && (
                    <span className="track__refund-btn-hint">
                      <Icon name="alert-triangle" size={13} />
                      {accountValidationError || nameValidationError}
                    </span>
                  )}
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
              <dt>ชื่อผู้รับ</dt>
              <dd>{currentOrder.customerName}</dd>
              <dt>เบอร์โทรศัพท์</dt>
              <dd>{currentOrder.customerPhone || '—'}</dd>
              <dt>ที่อยู่จัดส่ง</dt>
              <dd>{currentOrder.shippingAddress}</dd>
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

          {currentOrder.slipFileName && (
            <section className="track__panel">
              <h3 className="track__panel-title">
                <Icon name="file-text" size={18} /> หลักฐานการชำระเงิน
              </h3>
              <div className="track__slip-box">
                <div className="track__slip-header-info">
                  <span className="track__slip-file-name">{currentOrder.slipFileName}</span>
                  {currentOrder.status === 'VERIFYING_PAYMENT' && (
                    <span className="track__slip-badge is-verifying">รอตรวจสอบ</span>
                  )}
                  {currentOrder.status === 'REJECTED' && (
                    <span className="track__slip-badge is-rejected">สลิปไม่ผ่าน</span>
                  )}
                </div>
                {getSlipSource(currentOrder.orderId, currentOrder.slipFileName) && (
                  <div className="track__slip-img-container">
                    <img
                      src={getSlipSource(currentOrder.orderId, currentOrder.slipFileName)}
                      alt={`สลิป ${currentOrder.slipFileName}`}
                      className="track__slip-thumb-img"
                      onError={(e) => {
                        const target = e.currentTarget
                        if (!target.src.endsWith('/slips/default-slip.png')) {
                          target.src = '/slips/default-slip.png'
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

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

      {/* ── Modal เลือกสินค้าเปลี่ยน ── */}
      {showExchangeModal && (
        <Modal
          title="ยืนยันยกเลิกคำสั่งซื้อเพื่อเปลี่ยนสินค้า"
          onClose={() => setShowExchangeModal(false)}
          footer={
            <div className="track__modal-foot">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowExchangeModal(false)}
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={choiceLoading}
                onClick={() => void handleConfirmExchange()}
              >
                <Icon name="check" size={16} />
                {choiceLoading ? 'กำลังดำเนินการ…' : 'ยืนยันยกเลิกรายการและขอคืนเงิน'}
              </button>
            </div>
          }
        >
          <div className="track__cancel-modal-body">
            <div className="track__cancel-modal-alert">
              <Icon name="alert-triangle" size={24} />
              <div>
                <p className="track__cancel-modal-warn">
                  ยกเลิกคำสั่งซื้อ <strong>{formatOrderCode(currentOrder.orderId)}</strong> เพื่อเปลี่ยนสินค้าใหม่
                </p>
                <p className="track__cancel-modal-desc">
                  เนื่องจากสินค้าหมดสต็อก ระบบจะทำการ<strong>ยกเลิกคำสั่งซื้อนี้ทั้งหมด</strong> และ<strong>คืนเงินให้ท่านเต็มจำนวน</strong> เพื่อให้ท่านสามารถเลือกสั่งซื้อหนังสือเล่มใหม่ตามต้องการได้ทันที
                </p>
              </div>
            </div>

            {currentOrder.discountCode && (
              <div className="track__modal-discount-info" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', margin: '12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '13px' }}>
                <Icon name="tag" size={18} />
                <span>
                  <strong>คืนสิทธิ์โค้ดส่วนลด:</strong> คำสั่งซื้อนี้มีการใช้โค้ด <strong>{currentOrder.discountCode}</strong> เมื่อกดยืนยันแล้ว ระบบจะคืนสิทธิ์ให้ท่านนำไปใช้สั่งซื้อใหม่ได้ทันที
                </span>
              </div>
            )}

            <label className="track__modal-note-label">
              <span>ระบุหมายเหตุหรือหนังสือที่ต้องการเปลี่ยน (ไม่บังคับ)</span>
              <textarea
                rows={2}
                placeholder="เช่น ต้องการเปลี่ยนเป็นหนังสือ... หรือเหตุผลเพิ่มเติม"
                value={exchangeNote}
                onChange={(e) => setExchangeNote(e.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}

      {/* ── Modal ยืนยันการยกเลิกคำสั่งซื้อ ── */}
      {showCancelModal && (
        <Modal
          title="ยืนยันการยกเลิกคำสั่งซื้อ"
          onClose={() => setShowCancelModal(false)}
          footer={
            <div className="track__modal-foot">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowCancelModal(false)}
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={choiceLoading}
                onClick={() => void handleConfirmCancel()}
              >
                <Icon name="close" size={16} />
                {choiceLoading ? 'กำลังดำเนินการ…' : 'ยืนยันยกเลิกคำสั่งซื้อ'}
              </button>
            </div>
          }
        >
          <div className="track__cancel-modal-body">
            <div className="track__cancel-modal-alert">
              <Icon name="alert-triangle" size={24} />
              <div>
                <p className="track__cancel-modal-warn">
                  ท่านกำลังจะยกเลิกคำสั่งซื้อ <strong>{formatOrderCode(currentOrder.orderId)}</strong>
                </p>
                <p className="track__cancel-modal-desc">
                  เมื่อกดยืนยันแล้ว คำสั่งซื้อจะถูกยกเลิก และท่านสามารถกรอกข้อมูลเลขที่บัญชีธนาคารเพื่อรับเงินคืนเต็มจำนวนได้ทันที
                </p>
              </div>
            </div>

            {currentOrder.discountCode && (
              <div className="track__modal-discount-info" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', margin: '12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '13px' }}>
                <Icon name="tag" size={18} />
                <span>
                  <strong>คืนสิทธิ์โค้ดส่วนลด:</strong> คำสั่งซื้อนี้มีการใช้โค้ด <strong>{currentOrder.discountCode}</strong> เมื่อกดยืนยันยกเลิกแล้ว ระบบจะคืนสิทธิ์ให้ท่านนำไปใช้สั่งซื้อใหม่ได้ทันที
                </span>
              </div>
            )}

            <label className="track__modal-note-label">
              <span>เหตุผลหรือข้อความเพิ่มเติม (ไม่บังคับ)</span>
              <textarea
                rows={2}
                placeholder="ระบุเหตุผลในการยกเลิก..."
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
