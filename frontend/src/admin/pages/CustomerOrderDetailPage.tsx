import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useResource } from '../../api/useResource'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABELS, type Role } from '../../auth/roles'
import { formatPrice } from '../../data/money'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import BookPicker from '../components/BookPicker'
import { can } from '../permissions'
import { useOrders } from '../orders/OrderContext'
import { usePayments } from '../payments/PaymentContext'
import { useInventory } from '../inventory/InventoryContext'
import {
  CHANNEL_LABELS,
  formatOrderCode,
  formatOrderDate,
  isClosedOrder,
  milestoneOf,
  ORDER_MILESTONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  getOrderStatusLabel,
  getOrderStatusTone,
  orderItemTotal,
  SHIPMENT_STATUS_LABELS,
  type OrderStatus,
} from '../orders/orders'
import './CustomerOrderDetailPage.css'

const fmtDateTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`.trim()

// Who the order is waiting on at each open status, so a role that has nothing to do right
// now still sees who is next.
const OWNER_ROLE: Partial<Record<OrderStatus, Role | 'customer'>> = {
  PENDING_CONFIRM: 'sales',
  STOCK_CONFIRMED: 'sales',
  WAITING_PAYMENT: 'customer',
  VERIFYING_PAYMENT: 'sales',
  PAID: 'warehouse',
  PACKING: 'warehouse',
  READY_TO_SHIP: 'delivery',
  SHIPPED: 'delivery',
  DELIVERED: undefined,
  CANCELLED: undefined,
  REJECTED: 'customer',
  OUT_OF_STOCK: 'customer',
  WAITING_RESTOCK: 'sales',
  EXCHANGE_REQUESTED: 'sales',
}

interface CarrierOption {
  carrierId: number
  name: string
}

const loadCarriers = () => apiGet<CarrierOption[]>('/api/carriers')

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

export default function CustomerOrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const {
    findOrder,
    updateStatus,
    loading,
    error,
    reload,
    markOutOfStock,
    submitCustomerChoice,
    approveExchange,
    confirmRestocked,
  } = useOrders()
  const { reload: reloadPayments, payments, banks } = usePayments()
  const { reload: reloadInventory } = useInventory()
  // บริษัทขนส่งอยู่ในตาราง shipping_company · พัสดุเป็นคนละ endpoint กับใบสั่งซื้อ
  const { data: carrierRows } = useResource(loadCarriers)
  const { notify } = useToast()
  const navigate = useNavigate()

  const [shipOpen, setShipOpen] = useState(false)
  const [tracking, setTracking] = useState('')
  const [carrierId, setCarrierId] = useState<number>(0)
  const [trackingError, setTrackingError] = useState('')
  const [decision, setDecision] = useState<'CANCELLED' | 'REJECTED' | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const [saving, setSaving] = useState(false)
  const [slipModalOpen, setSlipModalOpen] = useState(false)

  // Out of stock states
  const [oosModalOpen, setOosModalOpen] = useState(false)
  const [oosNote, setOosNote] = useState('')
  const [oosEstimate, setOosEstimate] = useState('ประมาณ 7 วัน')
  const [oosDate, setOosDate] = useState('')
  const [oosError, setOosError] = useState('')

  const setDaysPreset = (days: number) => {
    const target = new Date()
    target.setDate(target.getDate() + days)
    const isoDate = target.toISOString().slice(0, 10)
    setOosDate(isoDate)
    const thaiDate = target.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    setOosEstimate(`ประมาณ ${days} วัน (${thaiDate})`)
  }

  const handleOosDateChange = (val: string) => {
    setOosDate(val)
    if (val) {
      const d = new Date(val + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const thaiDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
        if (diffDays > 0) {
          setOosEstimate(`ประมาณ ${diffDays} วัน (${thaiDate})`)
        } else {
          setOosEstimate(`วันที่ ${thaiDate}`)
        }
      }
    }
  }

  // Staff exchange book picker modal
  const [staffExchangeModalOpen, setStaffExchangeModalOpen] = useState(false)

  const role = user!.role
  const order = findOrder(Number(id))
  const payment = payments.find((p) => p.orderId === order?.orderId)
  const bank = banks.find((b) => b.bankId === payment?.bankId)
  const slipSrc = order ? getSlipSource(order.orderId, order.slipFileName) : ''

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดคำสั่งซื้อ…" />
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

  if (!order) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'คำสั่งซื้อลูกค้า', to: '/admin/orders' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="shopping-bag"
            title="ไม่พบคำสั่งซื้อ"
            description="เลขที่ที่ระบุอาจถูกลบไปแล้วหรือพิมพ์ไม่ถูกต้อง"
            action={{ label: 'กลับไปรายการคำสั่งซื้อ', onClick: () => navigate('/admin/orders') }}
          />
        </section>
      </div>
    )
  }

  // ต้องรอผลก่อนขึ้น toast — เซิร์ฟเวอร์เป็นคนตัดสินว่าเปลี่ยนสถานะได้จริงไหม
  // (ตารางการเปลี่ยนสถานะ · สต็อกพอไหมตอนแพ็ก · สิทธิ์ของบทบาท)
  const advance = async (
    next: OrderStatus,
    message: string,
    note?: string,
  ) => {
    if (saving) return
    setSaving(true)
    try {
      await updateStatus(order.orderId, next, { note })
      await Promise.all([reloadPayments(), reloadInventory()])
      setDecision(null)
      notify('success', message)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const askReason = (next: 'CANCELLED' | 'REJECTED') => {
    setReason('')
    setReasonError('')
    setDecision(next)
  }

  const confirmDecision = () => {
    if (!decision || saving) return
    if (!reason.trim()) {
      setReasonError('กรุณาระบุเหตุผลก่อนยืนยัน')
      return
    }
    void advance(
      decision,
      decision === 'CANCELLED' ? 'ยกเลิกคำสั่งซื้อแล้ว' : 'ปฏิเสธการชำระเงินแล้ว',
      reason.trim(),
    )
  }

  const recordShipment = () => {
    if (!tracking.trim()) {
      setTrackingError('กรุณากรอกหมายเลขติดตามพัสดุ')
      return
    }
    const carriers = carrierRows ?? []
    const chosen = carriers.find((c) => c.carrierId === carrierId) ?? carriers[0]
    if (!chosen) {
      notify('error', 'ยังโหลดรายชื่อบริษัทขนส่งไม่สำเร็จ กรุณาลองใหม่')
      return
    }
    void (async () => {
      try {
        // เซิร์ฟเวอร์เปิดแถว shipment ในทรานแซกชันเดียวกับการเปลี่ยนสถานะ
        await updateStatus(order.orderId, 'SHIPPED', {
          tracking,
          carrierId: chosen.carrierId,
        })
        setShipOpen(false)
        notify(
          'success',
          `บันทึกการจัดส่ง ${formatOrderCode(order.orderId)} ทาง${chosen.name} แล้ว`,
        )
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'บันทึกการจัดส่งไม่สำเร็จ')
      }
    })()
  }

  const step = milestoneOf(order.status)
  const closed = isClosedOrder(order.status)
  const ownerRole = OWNER_ROLE[order.status]
  const ownerLabel =
    ownerRole === 'customer' ? 'ลูกค้า' : ownerRole ? ROLE_LABELS[ownerRole] : undefined

  // Actions available to the signed-in role at the current status.
  const actions: { label: string; tone: 'primary' | 'outline' | 'danger'; run: () => void }[] = []
  if (order.status === 'PENDING_CONFIRM' && can.confirmStock(role)) {
    actions.push({
      label: 'ยืนยันสต็อก',
      tone: 'primary',
      run: () => void advance('STOCK_CONFIRMED', 'ยืนยันสต็อกแล้ว รอตรวจสอบการชำระเงิน'),
    })
  }
  if (order.status === 'STOCK_CONFIRMED' && can.verifyPayment(role)) {
    actions.push({
      label: order.slipFileName ? 'ตรวจสอบการชำระเงิน' : 'แจ้งรอชำระเงิน',
      tone: 'primary',
      run: () => void (order.slipFileName
        ? advance('VERIFYING_PAYMENT', 'เริ่มตรวจสอบการชำระเงิน')
        : advance('WAITING_PAYMENT', 'แจ้งรอลูกค้าชำระเงินแล้ว')),
    })
  }
  if (order.status === 'VERIFYING_PAYMENT' && can.verifyPayment(role)) {
    actions.push({
      label: 'ยืนยันการชำระเงิน',
      tone: 'primary',
      run: () => void advance('PAID', 'ยืนยันการชำระเงินแล้ว รอคลังแพ็กสินค้า'),
    })
    actions.push({
      label: 'สลิปไม่ถูกต้อง',
      tone: 'danger',
      run: () => askReason('REJECTED'),
    })
  }
  if (order.status === 'PAID' && can.packOrder(role)) {
    actions.push({
      label: 'เริ่มแพ็กสินค้า',
      tone: 'primary',
      run: () => void advance('PACKING', 'เริ่มแพ็กสินค้า'),
    })
  }
  if (order.status === 'PACKING' && can.packOrder(role)) {
    actions.push({
      label: 'แพ็กเสร็จ พร้อมส่ง',
      tone: 'primary',
      run: () => void advance('READY_TO_SHIP', 'แพ็กเสร็จแล้ว แจ้งพนักงานจัดส่ง'),
    })
  }
  if (order.status === 'READY_TO_SHIP' && can.shipOrder(role)) {
    actions.push({ label: 'บันทึกการจัดส่ง', tone: 'primary', run: () => setShipOpen(true) })
  }
  if (order.status === 'SHIPPED' && can.confirmDelivery(role)) {
    actions.push({
      label: 'ยืนยันจัดส่งสำเร็จ',
      tone: 'primary',
      run: () => void advance('DELIVERED', 'ยืนยันการจัดส่งสำเร็จแล้ว'),
    })
  }
  if (order.canCancel && can.cancelOrder(role)) {
    actions.push({
      label: 'ยกเลิกคำสั่งซื้อ',
      tone: 'outline',
      run: () => askReason('CANCELLED'),
    })
  }
  if (
    (order.status === 'PENDING_CONFIRM' ||
      order.status === 'STOCK_CONFIRMED' ||
      order.status === 'WAITING_PAYMENT' ||
      order.status === 'VERIFYING_PAYMENT' ||
      order.status === 'PAID') &&
    can.confirmStock(role)
  ) {
    actions.push({
      label: 'แจ้งสินค้าหมดสต็อก',
      tone: 'outline',
      run: () => {
        setOosNote('สินค้าหมดสต็อกชั่วคราว')
        setDaysPreset(7)
        setOosError('')
        setOosModalOpen(true)
      },
    })
  }
  if (order.status === 'WAITING_RESTOCK' && can.confirmStock(role)) {
    actions.push({
      label: 'สินค้าเข้าแล้ว (ยืนยันสต็อก)',
      tone: 'primary',
      run: () => void (async () => {
        try {
          await confirmRestocked(order.orderId)
          notify('success', 'ยืนยันสินค้าเข้าสต็อกเรียบร้อยแล้ว ดำเนินการต่อ')
        } catch (err) {
          notify('error', err instanceof Error ? err.message : 'ยืนยันสต็อกไม่สำเร็จ')
        }
      })(),
    })
  }
  if (order.status === 'EXCHANGE_REQUESTED' && can.confirmStock(role)) {
    actions.push({
      label: 'อนุมัติการเปลี่ยนสินค้า',
      tone: 'primary',
      run: () => {
        if (order.replacementBookId) {
          void (async () => {
            try {
              await approveExchange(order.orderId, order.replacementBookId!)
              notify('success', 'เปลี่ยนสินค้าในคำสั่งซื้อเรียบร้อยแล้ว')
            } catch (err) {
              notify('error', err instanceof Error ? err.message : 'อนุมัติเปลี่ยนสินค้าไม่สำเร็จ')
            }
          })()
        } else {
          setStaffExchangeModalOpen(true)
        }
      },
    })
  }

  const btnClass = (tone: 'primary' | 'outline' | 'danger') =>
    tone === 'primary'
      ? 'btn btn-primary btn-sm'
      : tone === 'danger'
        ? 'btn btn-danger btn-sm'
        : 'btn btn-outline btn-sm'

  return (
    <div className="admin-page order-detail">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'คำสั่งซื้อลูกค้า', to: '/admin/orders' },
          { label: formatOrderCode(order.orderId) },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            คำสั่งซื้อ {formatOrderCode(order.orderId)}
            <StatusBadge tone={getOrderStatusTone(order)}>
              {getOrderStatusLabel(order)}
            </StatusBadge>
          </h1>
          <p className="admin-page__subtitle">
            ลูกค้า {order.customerName} · ช่องทาง {CHANNEL_LABELS[order.channel]} · วันที่{' '}
            {formatOrderDate(order.orderDate)}
          </p>
        </div>
      </div>

      {order.status === 'CANCELLED' && (
        <div
          className={`order-detail__banner ${
            order.refundStatus === 'REFUNDED'
              ? 'order-detail__banner--success'
              : order.refundStatus === 'PENDING'
                ? 'order-detail__banner--warning'
                : 'order-detail__banner--muted'
          }`}
        >
          <p className="order-detail__banner-title">
            <Icon
              name={order.refundStatus === 'REFUNDED' ? 'check-circle' : 'alert-triangle'}
              size={18}
            />
            {order.refundStatus === 'REFUNDED'
              ? 'คำสั่งซื้อนี้ถูกยกเลิก และคืนเงินให้ลูกค้าเรียบร้อยแล้ว'
              : order.refundStatus === 'PENDING'
                ? 'คำสั่งซื้อนี้ถูกยกเลิก และอยู่ระหว่างรอการคืนเงินให้ลูกค้า'
                : 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว'}
          </p>
          {order.cancelReason && (
            <p className="order-detail__cancel-reason-text">
              <strong>เหตุผลที่ยกเลิก:</strong> {order.cancelReason}
            </p>
          )}
          {order.discountCode && (
            <p className="order-detail__cancel-reason-text" style={{ color: '#166534', marginTop: '6px' }}>
              <Icon name="tag" size={14} /> <strong>โค้ดส่วนลด {order.discountCode}:</strong> ได้รับการคืนสิทธิ์ให้ลูกค้านำไปใช้ซ้ำในคำสั่งซื้อใหม่แล้ว
            </p>
          )}
        </div>
      )}
      {order.status === 'REJECTED' && (
        <div className="order-detail__banner order-detail__banner--danger">
          <p className="order-detail__banner-title">
            <Icon name="alert-triangle" size={18} /> คำสั่งซื้อนี้ถูกปฏิเสธ (สลิปไม่ถูกต้อง — รอลูกค้าแนบใหม่)
          </p>
          {order.cancelReason && (
            <p className="order-detail__cancel-reason-text">
              <strong>เหตุผลที่ปฏิเสธ:</strong> {order.cancelReason}
            </p>
          )}
        </div>
      )}

      {order.status === 'OUT_OF_STOCK' && (
        <div className="order-detail__banner order-detail__banner--warning">
          <p className="order-detail__banner-title">
            <Icon name="alert-triangle" size={18} /> แจ้งสินค้าหมดสต็อกแล้ว — อยู่ระหว่างรอลูกค้าตัดสินใจ
          </p>
          {order.outOfStockNote && (
            <p className="order-detail__cancel-reason-text">
              <strong>ข้อความแจ้งลูกค้า:</strong> {order.outOfStockNote}
            </p>
          )}
          {order.restockEstimate && (
            <p className="order-detail__cancel-reason-text">
              <strong>กำหนดการเติมสต็อกที่แจ้ง:</strong> {order.restockEstimate}
            </p>
          )}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ลูกค้าติดต่อกลับมาทางโทรศัพท์/แชทหรือไม่? บันทึกการตัดสินใจแทนลูกค้า:</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void (async () => {
                try {
                  await submitCustomerChoice(order.orderId, 'WAIT_RESTOCK')
                  notify('success', 'บันทึกลูกค้าเลือกรอสินค้าเติมสต็อกแล้ว')
                } catch (err) {
                  notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
                }
              })()}
            >
              ลูกค้ายินดีรอของ
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void (async () => {
                if (!window.confirm('ลูกค้ายืนยันต้องการเปลี่ยนสินค้า? ระบบจะทำการยกเลิกรายการทั้งหมดและนำเข้าสู่ขั้นตอนการคืนเงิน')) return
                try {
                  await submitCustomerChoice(order.orderId, 'CHANGE_PRODUCT')
                  notify('success', 'บันทึกสำเร็จ: คำสั่งซื้อถูกยกเลิกเพื่อดำเนินการคืนเงินให้ลูกค้า')
                } catch (err) {
                  notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
                }
              })()}
            >
              ลูกค้าต้องการเปลี่ยนสินค้า (ยกเลิกและคืนเงิน)
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => askReason('CANCELLED')}
            >
              ลูกค้ายกเลิกคำสั่งซื้อ
            </button>
          </div>
        </div>
      )}

      {order.status === 'WAITING_RESTOCK' && (
        <div className="order-detail__banner order-detail__banner--info">
          <p className="order-detail__banner-title">
            <Icon name="clock" size={18} /> ลูกค้ายินดีรอสินค้าเติมสต็อก (กำหนดการ: {order.restockEstimate || 'ตามที่แจ้ง'})
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {can.confirmStock(role) && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void (async () => {
                  try {
                    await confirmRestocked(order.orderId)
                    notify('success', 'ยืนยันสินค้าเข้าสต็อกแล้ว ดำเนินการต่อ')
                  } catch (err) {
                    notify('error', err instanceof Error ? err.message : 'ยืนยันสต็อกไม่สำเร็จ')
                  }
                })()}
              >
                สินค้าเข้าแล้ว (ยืนยันสต็อก)
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => askReason('CANCELLED')}
            >
              ขอยกเลิกคำสั่งซื้อ
            </button>
          </div>
        </div>
      )}

      {order.status === 'EXCHANGE_REQUESTED' && (
        <div className="order-detail__banner order-detail__banner--info">
          <p className="order-detail__banner-title">
            <Icon name="package" size={18} /> ลูกค้าประสงค์ขอเปลี่ยนสินค้า
          </p>
          <p className="order-detail__cancel-reason-text">
            <strong>หนังสือที่ลูกค้าต้องการเปลี่ยนเป็น:</strong>{' '}
            {order.replacementBookTitle || (order.replacementBookId ? `หนังสือรหัส ${order.replacementBookId}` : 'ยังไม่ได้ระบุ')}
          </p>
          {order.replacementNote && (
            <p className="order-detail__cancel-reason-text">
              <strong>หมายเหตุจากลูกค้า:</strong> {order.replacementNote}
            </p>
          )}
          {can.confirmStock(role) && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (order.replacementBookId) {
                    void (async () => {
                      try {
                        await approveExchange(order.orderId, order.replacementBookId!)
                        notify('success', 'เปลี่ยนสินค้าในคำสั่งซื้อเรียบร้อยแล้ว')
                      } catch (err) {
                        notify('error', err instanceof Error ? err.message : 'อนุมัติเปลี่ยนสินค้าไม่สำเร็จ')
                      }
                    })()
                  } else {
                    setStaffExchangeModalOpen(true)
                  }
                }}
              >
                อนุมัติและเปลี่ยนสินค้าในใบสั่งซื้อ
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setStaffExchangeModalOpen(true)}
              >
                เลือกหนังสือเล่มอื่น
              </button>
            </div>
          )}
        </div>
      )}

      {step >= 0 && (
        <section className="admin-card order-detail__steps">
          {ORDER_MILESTONES.map((label, i) => (
            <div
              key={label}
              className={
                'order-detail__step' +
                (i < step ? ' is-done' : i === step ? ' is-current' : '')
              }
            >
              <span className="order-detail__dot">
                {i < step ? <Icon name="check" size={15} /> : i + 1}
              </span>
              <span className="order-detail__step-label">{label}</span>
            </div>
          ))}
        </section>
      )}

      <div className="order-detail__grid">
        <div className="order-detail__col">
          <section className="admin-card order-detail__panel">
            <h2 className="order-detail__panel-title">
              <Icon name="user" size={18} /> ข้อมูลลูกค้า
            </h2>
            <dl className="order-detail__dl">
              <dt>ชื่อผู้รับ</dt>
              <dd>{order.customerName}</dd>
              <dt>เบอร์โทรศัพท์</dt>
              <dd>{order.customerPhone || '—'}</dd>
              <dt>ที่อยู่จัดส่ง</dt>
              <dd>{order.shippingAddress}</dd>
              <dt>สลิปการชำระเงิน</dt>
              <dd>
                {order.slipFileName ? (
                  <button
                    type="button"
                    className="order-detail__slip-link"
                    onClick={() => setSlipModalOpen(true)}
                    title="คลิกเพื่อดูภาพสลิป"
                  >
                    <Icon name="file-text" size={14} />
                    {order.slipFileName}
                  </button>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
          </section>

          {order.slipFileName ? (
            <section
              className={`admin-card order-detail__panel order-detail__slip-panel ${
                order.status === 'VERIFYING_PAYMENT' ? 'is-verifying' : ''
              }`}
            >
              <div className="order-detail__panel-header-row">
                <h2 className="order-detail__panel-title">
                  <Icon name="upload" size={18} /> หลักฐานการชำระเงิน
                </h2>
                {order.status === 'VERIFYING_PAYMENT' && (
                  <span className="order-detail__slip-tag">รอตรวจสอบ</span>
                )}
              </div>

              <div className="order-detail__slip-wrapper">
                <div
                  className="order-detail__slip-thumb-container"
                  onClick={() => setSlipModalOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSlipModalOpen(true)
                  }}
                  title="คลิกเพื่อดูภาพสลิปขนาดเต็ม"
                >
                  <img
                    src={slipSrc}
                    alt={`สลิปโอนเงิน ${order.slipFileName}`}
                    className="order-detail__slip-img"
                    onError={(e) => {
                      const target = e.currentTarget
                      if (!target.src.endsWith('/slips/default-slip.png')) {
                        target.src = '/slips/default-slip.png'
                      }
                    }}
                  />
                  <div className="order-detail__slip-overlay">
                    <Icon name="search" size={20} />
                    <span>คลิกเพื่อดูภาพขนาดเต็ม</span>
                  </div>
                </div>

                <div className="order-detail__slip-meta">
                  <div className="order-detail__slip-row">
                    <span className="order-detail__slip-label">ชื่อไฟล์:</span>
                    <span className="order-detail__slip-val order-detail__mono">{order.slipFileName}</span>
                  </div>
                  <div className="order-detail__slip-row">
                    <span className="order-detail__slip-label">ยอดที่ต้องชำระ:</span>
                    <strong className="order-detail__slip-val order-detail__slip-amount">
                      {formatPrice(order.netAmount)}
                    </strong>
                  </div>
                  {bank && (
                    <div className="order-detail__slip-row">
                      <span className="order-detail__slip-label">โอนเข้าธนาคาร:</span>
                      <span className="order-detail__slip-val">
                        {bank.name} ({bank.accountNo})
                      </span>
                    </div>
                  )}
                  {payment?.transferDate && (
                    <div className="order-detail__slip-row">
                      <span className="order-detail__slip-label">วันเวลาที่แจ้งโอน:</span>
                      <span className="order-detail__slip-val">
                        {fmtDateTime(payment.transferDate)}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm order-detail__slip-btn"
                    onClick={() => setSlipModalOpen(true)}
                  >
                    <Icon name="eye" size={16} /> ขยายดูภาพสลิป
                  </button>
                </div>
              </div>

              {order.status === 'VERIFYING_PAYMENT' && (
                <div className="order-detail__slip-notice">
                  <Icon name="alert-triangle" size={16} />
                  <span>กรุณาตรวจสอบยอดเงินและรายละเอียดในสลิปให้ตรงกับคำสั่งซื้อก่อนกดยืนยัน</span>
                </div>
              )}
            </section>
          ) : (
            <section className="admin-card order-detail__panel">
              <h2 className="order-detail__panel-title">
                <Icon name="upload" size={18} /> หลักฐานการชำระเงิน
              </h2>
              <p className="order-detail__waiting">
                <Icon name="clock" size={16} /> ลูกค้ายังไม่ได้แนบสลิปการชำระเงิน
              </p>
            </section>
          )}

          {order.shipment && (
            <section className="admin-card order-detail__panel">
              <h2 className="order-detail__panel-title">
                <Icon name="truck" size={18} /> ข้อมูลการจัดส่ง
              </h2>
              <dl className="order-detail__dl">
                <dt>บริษัทขนส่ง</dt>
                <dd>{order.shipment.carrier}</dd>
                <dt>หมายเลขติดตาม</dt>
                <dd className="order-detail__mono">{order.shipment.trackingNumber}</dd>
                <dt>วันที่ส่ง</dt>
                <dd>{order.shipment.shippedDate}</dd>
                <dt>สถานะพัสดุ</dt>
                <dd>{SHIPMENT_STATUS_LABELS[order.shipment.status]}</dd>
              </dl>
            </section>
          )}

          <section className="admin-card order-detail__panel">
            <h2 className="order-detail__panel-title">ดำเนินการ</h2>
            {actions.length > 0 ? (
              <div className="order-detail__actions">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={btnClass(action.tone)}
                    disabled={saving}
                    onClick={action.run}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="order-detail__waiting">
                <Icon name="clock" size={18} />
                {closed
                  ? 'คำสั่งซื้อนี้ปิดรายการแล้ว'
                  : ownerLabel
                    ? `รอ${ownerLabel}ดำเนินการขั้นตอนถัดไป`
                    : 'ไม่มีการดำเนินการสำหรับบทบาทของคุณ'}
              </p>
            )}
          </section>
        </div>

        <div className="order-detail__col order-detail__col--wide">
          <section className="admin-card order-detail__panel">
            <h2 className="order-detail__panel-title">รายการสินค้า</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>หนังสือ</th>
                    <th className="order-detail__num">ราคา/เล่ม</th>
                    <th className="order-detail__num">จำนวน</th>
                    <th className="order-detail__num">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((line) => (
                    <tr key={line.bookId}>
                      <td className="data-table__strong">{line.title}</td>
                      <td className="order-detail__num">{formatPrice(line.unitPrice)}</td>
                      <td className="order-detail__num">{line.quantity}</td>
                      <td className="order-detail__num">{formatPrice(orderItemTotal(line))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="order-detail__totals">
              <div>
                <dt>ยอดรวมสินค้า</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discountAmount > 0 && (
                <div>
                  <dt>ส่วนลด {order.promotionName ? `(${order.promotionName})` : ''}</dt>
                  <dd>-{formatPrice(order.discountAmount)}</dd>
                </div>
              )}
              <div className="order-detail__grand">
                <dt>ยอดสุทธิ</dt>
                <dd>{formatPrice(order.netAmount)}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-card order-detail__panel">
            <h2 className="order-detail__panel-title">ไทม์ไลน์สถานะ</h2>
            <ol className="order-detail__timeline">
              {[...order.timeline].reverse().map((entry, i) => (
                <li key={`${entry.status}-${i}`} className="order-detail__timeline-item">
                  <StatusBadge
                    tone={
                      entry.status === 'CANCELLED'
                        ? order.refundStatus === 'REFUNDED'
                          ? 'success'
                          : 'rose'
                        : ORDER_STATUS_TONES[entry.status]
                    }
                  >
                    {entry.status === 'CANCELLED'
                      ? order.refundStatus === 'REFUNDED'
                        ? 'คืนเงินแล้ว'
                        : 'ยกเลิกและรอคืนเงิน'
                      : ORDER_STATUS_LABELS[entry.status]}
                  </StatusBadge>
                  <span className="order-detail__timeline-date">{fmtDateTime(entry.changedDate)}</span>
                  {entry.note && <span className="order-detail__timeline-note">{entry.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {decision && (
        <Modal
          title={decision === 'CANCELLED' ? 'ยกเลิกคำสั่งซื้อ' : 'ปฏิเสธการชำระเงิน'}
          onClose={() => { if (!saving) setDecision(null) }}
          footer={
            <>
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setDecision(null)}>กลับ</button>
              <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={confirmDecision}>
                {saving ? 'กำลังบันทึก…' : 'ยืนยันพร้อมเหตุผล'}
              </button>
            </>
          }
        >
          <label className="admin-field">
            <span className="admin-field__label">เหตุผล <em>*</em></span>
            <textarea
              className="admin-input"
              value={reason}
              disabled={saving}
              rows={4}
              required
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? 'order-reason-error' : undefined}
              onChange={(event) => { setReason(event.target.value); setReasonError('') }}
            />
          </label>
          {reasonError && <p id="order-reason-error" className="admin-field__error" role="alert">{reasonError}</p>}
        </Modal>
      )}

      {shipOpen && (
        <Modal
          title={`บันทึกการจัดส่ง ${formatOrderCode(order.orderId)}`}
          onClose={() => setShipOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShipOpen(false)}
              >
                ยกเลิก
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={recordShipment}>
                <Icon name="truck" size={18} />
                บันทึกและเปลี่ยนเป็นจัดส่งแล้ว
              </button>
            </>
          }
        >
          <label className="admin-field">
            <span className="admin-field__label">บริษัทขนส่ง</span>
            <select
              className="admin-input"
              value={carrierId || carrierRows?.[0]?.carrierId || ''}
              onChange={(e) => setCarrierId(Number(e.target.value))}
            >
              {(carrierRows ?? []).map((c) => (
                <option key={c.carrierId} value={c.carrierId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field__label">
              หมายเลขติดตามพัสดุ <em>*</em>
            </span>
            <input
              className={'admin-input' + (trackingError ? ' admin-input--error' : '')}
              value={tracking}
              placeholder="เช่น TH1234567890"
              onChange={(e) => {
                setTracking(e.target.value)
                setTrackingError('')
              }}
            />
            {trackingError && <span className="admin-field__error">{trackingError}</span>}
          </label>
        </Modal>
      )}

      {slipModalOpen && order.slipFileName && (
        <Modal
          title={`หลักฐานการชำระเงิน ${formatOrderCode(order.orderId)} (${order.slipFileName})`}
          onClose={() => setSlipModalOpen(false)}
          footer={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                ยอดชำระ:{' '}
                <strong style={{ color: 'var(--text-heading)' }}>
                  {formatPrice(order.netAmount)}
                </strong>
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSlipModalOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          }
        >
          <div className="order-detail__modal-slip-container">
            <img
              src={slipSrc}
              alt={`สลิปโอนเงิน ${order.slipFileName}`}
              className="order-detail__modal-slip-img"
              onError={(e) => {
                const target = e.currentTarget
                if (!target.src.endsWith('/slips/default-slip.png')) {
                  target.src = '/slips/default-slip.png'
                }
              }}
            />
          </div>
        </Modal>
      )}

      {oosModalOpen && (
        <Modal
          title={`แจ้งสินค้าหมดสต็อก ${formatOrderCode(order.orderId)}`}
          onClose={() => setOosModalOpen(false)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOosModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={saving}
                onClick={() => {
                  if (!oosNote.trim()) {
                    setOosError('กรุณาระบุรายละเอียดสินค้าที่หมด')
                    return
                  }
                  void (async () => {
                    setSaving(true)
                    try {
                      await markOutOfStock(order.orderId, oosNote.trim(), oosEstimate.trim(), oosDate || undefined)
                      setOosModalOpen(false)
                      notify('success', 'ส่งแจ้งเตือนสินค้าหมดไปยังลูกค้าแล้ว')
                    } catch (err) {
                      notify('error', err instanceof Error ? err.message : 'แจ้งสินค้าหมดไม่สำเร็จ')
                    } finally {
                      setSaving(false)
                    }
                  })()
                }}
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันแจ้งสินค้าหมด'}
              </button>
            </div>
          }
        >
          <div className="order-detail__modal-form">
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
              ระบบจะแจ้งให้ลูกค้าทราบ และให้ลูกค้าเลือกว่าจะรอสินค้าเติมสต็อก, เปลี่ยนสินค้า, หรือยกเลิกคำสั่งซื้อ
            </p>
            <label className="admin-field">
              <span className="admin-field__label">
                รายละเอียดสินค้าที่หมด / ข้อความถึงลูกค้า <span className="admin-field__required">*</span>
              </span>
              <textarea
                className="admin-field__textarea"
                rows={3}
                value={oosNote}
                placeholder="เช่น สินค้าบางรายการหมดสต็อกชั่วคราว อยู่ระหว่างรอเติมของ"
                onChange={(e) => {
                  setOosNote(e.target.value)
                  setOosError('')
                }}
              />
              {oosError && <span className="admin-field__error">{oosError}</span>}
            </label>

            <div className="admin-field" style={{ marginTop: '12px' }}>
              <span className="admin-field__label">วันที่คาดว่าของจะเข้า (ถ้ามี)</span>
              <div style={{ display: 'flex', gap: '8px', margin: '6px 0 8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                  onClick={() => setDaysPreset(3)}
                >
                  +3 วัน
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                  onClick={() => setDaysPreset(7)}
                >
                  +7 วัน
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                  onClick={() => setDaysPreset(14)}
                >
                  +14 วัน
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                  onClick={() => setDaysPreset(30)}
                >
                  +30 วัน
                </button>
                {oosDate && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    style={{ fontSize: '12px', padding: '3px 8px' }}
                    onClick={() => {
                      setOosDate('')
                      setOosEstimate('')
                    }}
                  >
                    ล้างวันที่
                  </button>
                )}
              </div>
              <input
                type="date"
                className="admin-field__input"
                value={oosDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => handleOosDateChange(e.target.value)}
              />
              {oosDate && (
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--primary-deep)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="check-circle" size={14} /> คาดว่าจะเข้า: {new Date(oosDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            <label className="admin-field" style={{ marginTop: '12px' }}>
              <span className="admin-field__label">ข้อความระบุระยะเวลาที่จะแสดงให้ลูกค้าเห็น</span>
              <input
                type="text"
                className="admin-field__input"
                value={oosEstimate}
                placeholder="เช่น ประมาณ 7 วัน หรือ วันที่ 15 ก.ย. 2026"
                onChange={(e) => setOosEstimate(e.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}

      {staffExchangeModalOpen && (
        <BookPicker
          title="เลือกหนังสือใหม่ที่ลูกค้าต้องการเปลี่ยน"
          exclude={order.items.map((it) => it.bookId)}
          onClose={() => setStaffExchangeModalOpen(false)}
          onSelect={(book) => {
            void (async () => {
              setSaving(true)
              try {
                await approveExchange(order.orderId, book.bookId)
                setStaffExchangeModalOpen(false)
                notify('success', `เปลี่ยนสินค้าเป็น ${book.title} เรียบร้อยแล้ว`)
              } catch (err) {
                notify('error', err instanceof Error ? err.message : 'เปลี่ยนสินค้าไม่สำเร็จ')
              } finally {
                setSaving(false)
              }
            })()
          }}
        />
      )}
    </div>
  )
}
