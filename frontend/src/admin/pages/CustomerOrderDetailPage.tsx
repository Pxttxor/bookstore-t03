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
import { can } from '../permissions'
import { useOrders } from '../orders/OrderContext'
import {
  CHANNEL_LABELS,
  formatOrderCode,
  isClosedOrder,
  milestoneOf,
  ORDER_MILESTONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  orderItemTotal,
  SHIPMENT_STATUS_LABELS,
  type OrderStatus,
} from '../orders/orders'
import '../components/AdminForm.css'
import '../components/DataTable.css'
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
}

interface CarrierOption {
  carrierId: number
  name: string
}

const loadCarriers = () => apiGet<CarrierOption[]>('/api/carriers')

export default function CustomerOrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { findOrder, updateStatus, loading, error, reload } = useOrders()
  // บริษัทขนส่งอยู่ในตาราง shipping_company · พัสดุเป็นคนละ endpoint กับใบสั่งซื้อ
  const { data: carrierRows } = useResource(loadCarriers)
  const { notify } = useToast()
  const navigate = useNavigate()

  const [shipOpen, setShipOpen] = useState(false)
  const [tracking, setTracking] = useState('')
  const [carrierId, setCarrierId] = useState<number>(0)
  const [trackingError, setTrackingError] = useState('')

  const role = user!.role
  const order = findOrder(Number(id))

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
  const advance = async (next: OrderStatus, message: string) => {
    try {
      await updateStatus(order.orderId, next)
      notify('success', message)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ')
    }
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
      label: 'ตรวจสอบการชำระเงิน',
      tone: 'primary',
      run: () => void advance('VERIFYING_PAYMENT', 'เริ่มตรวจสอบการชำระเงิน'),
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
      run: () => void advance('REJECTED', 'ปฏิเสธคำสั่งซื้อ (สลิปไม่ถูกต้อง)'),
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
  if (!closed && order.status !== 'SHIPPED' && can.cancelOrder(role)) {
    actions.push({
      label: 'ยกเลิกคำสั่งซื้อ',
      tone: 'outline',
      run: () => void advance('CANCELLED', 'ยกเลิกคำสั่งซื้อแล้ว'),
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
            <StatusBadge tone={ORDER_STATUS_TONES[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </StatusBadge>
          </h1>
          <p className="admin-page__subtitle">
            ลูกค้า {order.customerName} · ช่องทาง {CHANNEL_LABELS[order.channel]} · วันที่{' '}
            {order.orderDate}
          </p>
        </div>
      </div>

      {order.status === 'CANCELLED' && (
        <p className="order-detail__banner order-detail__banner--muted">
          <Icon name="close" size={18} /> คำสั่งซื้อนี้ถูกยกเลิกแล้ว
        </p>
      )}
      {order.status === 'REJECTED' && (
        <p className="order-detail__banner order-detail__banner--danger">
          <Icon name="alert-triangle" size={18} /> คำสั่งซื้อนี้ถูกปฏิเสธ (การชำระเงินไม่ผ่าน)
        </p>
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
              <dt>ที่อยู่จัดส่ง</dt>
              <dd>{order.shippingAddress}</dd>
              <dt>สลิปการชำระเงิน</dt>
              <dd>{order.slipFileName ?? '—'}</dd>
            </dl>
          </section>

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
                  <dt>ส่วนลด</dt>
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
                  <StatusBadge tone={ORDER_STATUS_TONES[entry.status]}>
                    {ORDER_STATUS_LABELS[entry.status]}
                  </StatusBadge>
                  <span className="order-detail__timeline-date">{fmtDateTime(entry.changedDate)}</span>
                  {entry.note && <span className="order-detail__timeline-note">{entry.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

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
    </div>
  )
}
