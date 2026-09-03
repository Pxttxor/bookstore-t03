import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/books'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { can } from '../permissions'
import { usePayments } from '../payments/PaymentContext'
import {
  canReject,
  canVerify,
  formatPaymentCode,
  isSettled,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  REJECT_REASONS,
} from '../payments/payments'
import { useOrders } from '../orders/OrderContext'
import { formatOrderCode, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '../orders/orders'
import '../components/AdminForm.css'
import './PaymentDetailPage.css'

const fmtDateTime = (iso?: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—')

export default function PaymentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const {
    findPayment,
    banks,
    beginVerification,
    verify,
    reject,
    loading,
    error,
    reload,
  } = usePayments()
  const { findOrder } = useOrders()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState<string>(REJECT_REASONS[0])
  const [otherReason, setOtherReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [working, setWorking] = useState(false)

  const role = user!.role
  const payment = findPayment(Number(id))

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดรายละเอียดการชำระเงิน…" />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={error} onRetry={() => void reload()} />
        </section>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'ตรวจสอบการชำระเงิน', to: '/admin/payments' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="credit-card"
            title="ไม่พบรายการชำระเงิน"
            description="รหัสที่ระบุอาจถูกลบไปแล้วหรือพิมพ์ไม่ถูกต้อง"
            action={{ label: 'กลับไปรายการชำระเงิน', onClick: () => navigate('/admin/payments') }}
          />
        </section>
      </div>
    )
  }

  const bank = banks.find((b) => b.bankId === payment.bankId)
  const order = findOrder(payment.orderId)
  const mayVerify = can.verifyPayment(role)
  const orderReady = order?.status === 'VERIFYING_PAYMENT'

  const confirmBeginVerification = async () => {
    if (working) return
    setWorking(true)
    try {
      await beginVerification(payment.paymentId)
      notify('success', `เริ่มตรวจสอบ ${formatPaymentCode(payment.paymentId)} แล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เริ่มตรวจสอบไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  const confirmVerify = async () => {
    if (working) return
    setWorking(true)
    try {
      await verify(payment.paymentId)
      notify('success', `ยืนยันการชำระเงิน ${formatPaymentCode(payment.paymentId)} เรียบร้อยแล้ว`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'ตรวจสอบไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  const confirmReject = async () => {
    const finalReason = reason === 'OTHER' ? otherReason.trim() : reason
    if (!finalReason) {
      setReasonError('กรุณาระบุเหตุผลที่ปฏิเสธการชำระเงิน')
      return
    }
    if (working) return
    setWorking(true)
    try {
      await reject(payment.paymentId, finalReason)
      setRejectOpen(false)
      notify('warning', `ปฏิเสธการชำระเงิน ${formatPaymentCode(payment.paymentId)} แล้ว`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="admin-page payment-detail">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ตรวจสอบการชำระเงิน', to: '/admin/payments' },
          { label: formatPaymentCode(payment.paymentId) },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            การชำระเงิน {formatPaymentCode(payment.paymentId)}
            <StatusBadge tone={PAYMENT_STATUS_TONES[payment.status]}>
              {PAYMENT_STATUS_LABELS[payment.status]}
            </StatusBadge>
          </h1>
          <p className="admin-page__subtitle">
            ลูกค้า {order?.customerName ?? '—'} · คำสั่งซื้อ {formatOrderCode(payment.orderId)} · แจ้งโอน{' '}
            {fmtDateTime(payment.transferDate)}
          </p>
        </div>
      </div>

      {payment.status === 'REJECTED' && (
        <p className="payment-detail__banner payment-detail__banner--danger">
          <Icon name="alert-triangle" size={18} />
          ปฏิเสธการชำระเงิน — {payment.rejectReason}
        </p>
      )}
      {payment.status === 'SUCCESS' && (
        <p className="payment-detail__banner payment-detail__banner--ok">
          <Icon name="check-circle" size={18} />
          ตรวจสอบผ่านแล้วเมื่อ {fmtDateTime(payment.verifiedDate)}
          {payment.verifiedBy ? ` โดย ${payment.verifiedBy}` : ''}
        </p>
      )}

      <div className="payment-detail__grid">
        <section className="admin-card payment-detail__panel">
          <h2 className="payment-detail__panel-title">
            <Icon name="upload" size={18} /> สลิปการโอนเงิน
          </h2>

          {payment.slipImageUrl ? (
            <>
              {/* ต้นแบบนี้ไม่มี backend เก็บไฟล์จริง จึงเรนเดอร์สลิปจำลองจากข้อมูลที่บันทึกไว้ */}
              <figure className="payment-detail__slip">
                <div className="payment-detail__slip-head">
                  <Icon name="check-circle" size={20} />
                  <span>โอนเงินสำเร็จ</span>
                </div>
                <dl className="payment-detail__slip-body">
                  <dt>ธนาคาร</dt>
                  <dd>{bank?.name ?? 'ไม่ระบุ'}</dd>
                  <dt>บัญชีปลายทาง</dt>
                  <dd className="payment-detail__mono">{bank?.accountNo ?? '—'}</dd>
                  <dt>วันเวลาที่โอน</dt>
                  <dd>{fmtDateTime(payment.transferDate)}</dd>
                  <dt>เลขที่อ้างอิง</dt>
                  <dd className="payment-detail__mono">
                    {formatPaymentCode(payment.paymentId)}
                  </dd>
                </dl>
                <p className="payment-detail__slip-amount">{formatPrice(payment.amount)}</p>
                <figcaption className="payment-detail__slip-file">
                  <Icon name="file-text" size={15} />
                  {payment.slipImageUrl}
                </figcaption>
              </figure>
              <p className="payment-detail__hint">
                ภาพสลิปจำลองจากข้อมูลที่ลูกค้าแนบมา (ต้นแบบนี้ไม่มีระบบจัดเก็บไฟล์จริง)
              </p>
            </>
          ) : (
            <EmptyState
              icon="clock"
              title="ลูกค้ายังไม่ได้แนบสลิป"
              description="รายการนี้จะเข้าคิวตรวจสอบเมื่อลูกค้าอัปโหลดสลิปการโอนเงิน"
            />
          )}
        </section>

        <div className="payment-detail__col">
          <section className="admin-card payment-detail__panel">
            <h2 className="payment-detail__panel-title">
              <Icon name="credit-card" size={18} /> รายละเอียดการชำระเงิน
            </h2>
            <dl className="payment-detail__dl">
              <dt>ยอดที่ต้องชำระ</dt>
              <dd className="payment-detail__amount">{formatPrice(payment.amount)}</dd>
              <dt>ธนาคารที่โอนเข้า</dt>
              <dd>{bank ? `${bank.name} · ${bank.accountNo}` : 'ไม่ระบุ'}</dd>
              <dt>วันเวลาที่แจ้งโอน</dt>
              <dd>{fmtDateTime(payment.transferDate)}</dd>
              <dt>วันเวลาที่ตรวจสอบ</dt>
              <dd>{fmtDateTime(payment.verifiedDate)}</dd>
              <dt>ผู้ตรวจสอบ</dt>
              <dd>{payment.verifiedBy ?? '—'}</dd>
              {payment.rejectReason && (
                <>
                  <dt>เหตุผลที่ปฏิเสธ</dt>
                  <dd>{payment.rejectReason}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="admin-card payment-detail__panel">
            <h2 className="payment-detail__panel-title">
              <Icon name="shopping-bag" size={18} /> คำสั่งซื้อที่เกี่ยวข้อง
            </h2>
            {order ? (
              <>
                <dl className="payment-detail__dl">
                  <dt>เลขที่คำสั่งซื้อ</dt>
                  <dd>
                    <Link to={`/admin/orders/${order.orderId}`} className="payment-detail__link">
                      {formatOrderCode(order.orderId)}
                      <Icon name="arrow-right" size={15} />
                    </Link>
                  </dd>
                  <dt>สถานะคำสั่งซื้อ</dt>
                  <dd>
                    <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </StatusBadge>
                  </dd>
                  <dt>ยอดสุทธิ</dt>
                  <dd>{formatPrice(order.netAmount)}</dd>
                </dl>
                {order.netAmount.toFixed(2) !== payment.amount.toFixed(2) && (
                  <p className="payment-detail__warn">
                    <Icon name="alert-triangle" size={16} />
                    ยอดที่โอนไม่ตรงกับยอดสุทธิของคำสั่งซื้อ
                  </p>
                )}
                <p className="payment-detail__hint">
                  การเปลี่ยนสถานะคำสั่งซื้อทำที่หน้าคำสั่งซื้อลูกค้า
                  ระบบชำระเงินรับผิดชอบเฉพาะการตรวจสลิป
                </p>
              </>
            ) : (
              <p className="payment-detail__hint">ไม่พบคำสั่งซื้อของรายการชำระเงินนี้</p>
            )}
          </section>

          <section className="admin-card payment-detail__panel">
            <h2 className="payment-detail__panel-title">ดำเนินการ</h2>
            {isSettled(payment.status) ? (
              <p className="payment-detail__waiting">
                <Icon name={payment.status === 'SUCCESS' ? 'check' : 'close'} size={18} />
                รายการนี้{payment.status === 'SUCCESS' ? 'ตรวจสอบผ่าน' : 'ถูกปฏิเสธ'}แล้ว
                ไม่สามารถแก้ไขได้
              </p>
            ) : mayVerify ? (
              <>
                {order?.status === 'STOCK_CONFIRMED' && payment.status === 'VERIFYING' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={working}
                    onClick={() => void confirmBeginVerification()}
                  >
                    <Icon name="eye" size={18} />
                    เริ่มตรวจสอบการชำระเงิน
                  </button>
                )}
                {!orderReady && payment.status === 'VERIFYING' && (
                  <p className="payment-detail__waiting">
                    <Icon name="clock" size={18} />
                    กรุณายืนยันสต็อกและเริ่มตรวจสอบจากคำสั่งซื้อก่อนตัดสินสลิป
                  </p>
                )}
                <div className="payment-detail__actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={working || !canVerify(payment.status) || !orderReady}
                    title={
                      canVerify(payment.status) && orderReady
                        ? undefined
                        : 'คำสั่งซื้อต้องอยู่สถานะกำลังตรวจสอบการชำระเงิน'
                    }
                    onClick={() => void confirmVerify()}
                  >
                    <Icon name="check" size={18} />
                    ยืนยันการชำระเงิน
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={working || !canReject(payment.status) || !orderReady}
                    onClick={() => setRejectOpen(true)}
                  >
                    <Icon name="close" size={18} />
                    ปฏิเสธการชำระเงิน
                  </button>
                </div>
              </>
            ) : (
              <p className="payment-detail__waiting">
                <Icon name="clock" size={18} />
                รอพนักงานฝ่ายขายตรวจสอบสลิป
              </p>
            )}
          </section>
        </div>
      </div>

      {rejectOpen && (
        <Modal
          title={`ปฏิเสธการชำระเงิน ${formatPaymentCode(payment.paymentId)}`}
          onClose={() => setRejectOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={working}
                onClick={() => setRejectOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={working}
                onClick={() => void confirmReject()}
              >
                ยืนยันการปฏิเสธ
              </button>
            </>
          }
        >
          <label className="admin-field">
            <span className="admin-field__label">
              เหตุผลที่ปฏิเสธ <em>*</em>
            </span>
            <select
              className="admin-input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError('')
              }}
            >
              {REJECT_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="OTHER">อื่น ๆ (ระบุเอง)</option>
            </select>
          </label>

          {reason === 'OTHER' && (
            <label className="admin-field">
              <span className="admin-field__label">
                ระบุเหตุผล <em>*</em>
              </span>
              <textarea
                className={'admin-input' + (reasonError ? ' admin-input--error' : '')}
                rows={3}
                value={otherReason}
                placeholder="เช่น สลิปเป็นของบัญชีอื่น"
                onChange={(e) => {
                  setOtherReason(e.target.value)
                  setReasonError('')
                }}
              />
            </label>
          )}
          {reasonError && <span className="admin-field__error">{reasonError}</span>}

          <p className="payment-detail__hint">
            ระบบจะบันทึกเหตุผลไว้กับรายการชำระเงินและคำสั่งซื้อเพื่อใช้อ้างอิงภายหลัง
          </p>
        </Modal>
      )}
    </div>
  )
}
