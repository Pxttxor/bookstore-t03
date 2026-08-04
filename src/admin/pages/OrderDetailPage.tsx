import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import LineItemsTable from '../components/LineItemsTable'
import StatusBadge from '../components/StatusBadge'
import Stepper from '../components/Stepper'
import { useToast } from '../components/ToastContext'
import { formatBookCode } from '../inventory/inventory'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatGRCode,
  formatPOCode,
  formatPRCode,
  formatReturnCode,
  GR_STATUS_LABELS,
  PO_STATUS_LABELS,
  PO_STATUS_TONES,
  poDisplayStatus,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  SEND_CHANNELS,
  type PODisplayStatus,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './OrderDetailPage.css'

// Position on รออนุมัติ → อนุมัติ → ส่ง → ยืนยัน → รับ.
const STEP: Record<PODisplayStatus, number> = {
  PENDING_APPROVAL: 0,
  AWAITING_SEND: 2,
  AWAITING_CONFIRM: 3,
  CONFIRMED: 4,
  RECEIVED_PARTIAL: 4,
  RECEIVED_FULL: 5,
  RETURNED: 5,
  CANCELLED: 5,
}

// The supplier is chased for a confirmation once this many days have passed.
const CONFIRM_GRACE_DAYS = 3

export default function OrderDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { findOrder, receiptsForOrder, returnsForOrder, sendOrder, confirmOrder } =
    usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [channel, setChannel] = useState<string>(SEND_CHANNELS[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [dateError, setDateError] = useState('')
  // The clock is captured once on mount: how long the supplier has been silent only
  // needs to be right when the screen opens, and reading it during render is impure.
  const [now] = useState(() => Date.now())

  const role = user!.role
  const order = findOrder(Number(id))

  if (!order) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="file-text"
            title="ไม่พบใบสั่งซื้อ"
            description="เลขที่ที่ระบุอาจถูกลบไปแล้วหรือพิมพ์ไม่ถูกต้อง"
            action={{
              label: 'กลับไปหน้าเอกสารจัดซื้อ',
              onClick: () => navigate('/admin/purchasing'),
            }}
          />
        </section>
      </div>
    )
  }

  const supplier = suppliers.find((entry) => entry.supplierId === order.supplierId)
  const display = poDisplayStatus(order)
  const receipts = receiptsForOrder(order.poId)
  const returns = returnsForOrder(order.poId)
  const mayHandle = can.sendOrder(role)

  const daysSinceSent = order.sentAt
    ? Math.floor((now - new Date(order.sentAt).getTime()) / 86400000)
    : 0
  const chaseConfirmation = display === 'AWAITING_CONFIRM' && daysSinceSent >= CONFIRM_GRACE_DAYS

  const send = () => {
    sendOrder(order.poId)
    notify('success', `ส่ง ${formatPOCode(order.poId)} ให้ผู้จัดจำหน่ายทาง${channel}แล้ว`)
  }

  const confirm = () => {
    if (!deliveryDate) {
      setDateError('กรุณาระบุกำหนดวันส่งที่ผู้จัดจำหน่ายยืนยัน')
      return
    }
    confirmOrder(order.poId, deliveryDate)
    notify('success', `บันทึกการยืนยันของผู้จัดจำหน่ายแล้ว กำหนดส่ง ${deliveryDate}`)
  }

  return (
    <div className="admin-page po-detail">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
          { label: formatPOCode(order.poId) },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            ใบสั่งซื้อ {formatPOCode(order.poId)}
            <StatusBadge tone={PO_STATUS_TONES[display]}>{PO_STATUS_LABELS[display]}</StatusBadge>
          </h1>
          <p className="admin-page__subtitle">
            ผู้จัดจำหน่าย {formatSupplierCode(order.supplierId)}
            {supplier && ` ${supplier.companyName}`} · วันที่สั่ง {order.orderDate} · กำหนดส่ง{' '}
            {order.expectedDeliveryDate}
            {order.prId !== undefined && ` · อ้างอิง ${formatPRCode(order.prId)}`}
          </p>
        </div>
        <div className="admin-page__actions po-detail__no-print">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Icon name="file-text" size={18} />
            ดาวน์โหลด PDF
          </button>
        </div>
      </div>

      <section className="admin-card po-detail__stepper">
        <Stepper current={STEP[display]} />
      </section>

      {chaseConfirmation && (
        <p className="po-detail__banner po-detail__banner--warning po-detail__no-print">
          <Icon name="alert-triangle" size={18} />
          ส่งไปแล้ว {daysSinceSent} วันแต่ผู้จัดจำหน่ายยังไม่ยืนยัน ให้ติดตามการยืนยัน
        </p>
      )}

      <section className="admin-card">
        <LineItemsTable lines={order.items} books={supplier?.books ?? []} readOnly />
      </section>

      {mayHandle && display === 'AWAITING_SEND' && (
        <section className="admin-card po-detail__panel po-detail__no-print">
          <h2 className="po-detail__panel-title">ส่งใบสั่งซื้อให้ผู้จัดจำหน่าย</h2>
          <div className="po-detail__send">
            <label className="admin-field po-detail__channel">
              <span className="admin-field__label">ช่องทางส่ง</span>
              <select
                className="admin-input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {SEND_CHANNELS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <span className="admin-field__hint">
                ส่งถึง {supplier?.email ?? '—'} พร้อมแนบไฟล์ใบสั่งซื้อ
              </span>
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={send}>
              <Icon name="mail" size={18} />
              ส่งให้ผู้จัดจำหน่าย
            </button>
          </div>
        </section>
      )}

      {display === 'AWAITING_CONFIRM' && (
        <section className="admin-card po-detail__panel po-detail__no-print">
          <h2 className="po-detail__panel-title">หลังส่ง</h2>
          <p className="po-detail__waiting">
            <Icon name="clock" size={18} />
            สถานะการยืนยัน: รอผู้จัดจำหน่ายยืนยัน
          </p>

          {mayHandle && (
            <div className="po-detail__send">
              <label className="admin-field po-detail__channel">
                <span className="admin-field__label">
                  กำหนดวันส่ง (ผู้จัดจำหน่ายกรอก/ยืนยัน) <em>*</em>
                </span>
                <input
                  type="date"
                  className={'admin-input' + (dateError ? ' admin-input--error' : '')}
                  value={deliveryDate}
                  onChange={(e) => {
                    setDeliveryDate(e.target.value)
                    setDateError('')
                  }}
                />
                {dateError && <span className="admin-field__error">{dateError}</span>}
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={confirm}>
                <Icon name="check" size={18} />
                บันทึกการยืนยัน
              </button>
            </div>
          )}
        </section>
      )}

      {mayHandle && (display === 'CONFIRMED' || display === 'RECEIVED_PARTIAL') && (
        <section className="admin-card po-detail__panel po-detail__no-print">
          <h2 className="po-detail__panel-title">ขั้นตอนถัดไป</h2>
          <p className="po-detail__waiting">
            <Icon name="check-circle" size={18} />
            ผู้จัดจำหน่ายยืนยันแล้ว กำหนดส่ง {order.expectedDeliveryDate}
          </p>
          <Link
            to={`/admin/purchasing/po/${order.poId}/receive`}
            className="btn btn-primary btn-sm po-detail__next"
          >
            <Icon name="package" size={18} />
            บันทึกรับสินค้าเข้าคลัง
          </Link>
        </section>
      )}

      {receipts.length > 0 && (
        <section className="admin-card po-detail__panel">
          <h2 className="po-detail__panel-title">ประวัติการรับสินค้า</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่รับ</th>
                  <th>เลขใบส่งของ</th>
                  <th>ผู้รับ</th>
                  <th className="po-detail__num">รับ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.grId}>
                    <td className="data-table__code">{formatGRCode(receipt.grId)}</td>
                    <td>{receipt.receivedDate}</td>
                    <td>{receipt.deliveryNoteNo || '—'}</td>
                    <td>{receipt.receivedBy}</td>
                    <td className="po-detail__num">
                      {receipt.items.reduce((sum, line) => sum + line.receivedQty, 0)} เล่ม
                    </td>
                    <td>
                      <StatusBadge tone={receipt.status === 'FULL' ? 'success' : 'warning'}>
                        {GR_STATUS_LABELS[receipt.status]}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {returns.length > 0 && (
        <section className="admin-card po-detail__panel">
          <h2 className="po-detail__panel-title">ใบส่งคืนที่เกี่ยวข้อง</h2>
          <ul className="po-detail__returns">
            {returns.map((entry) => (
              <li key={entry.returnId}>
                <Link to={`/admin/purchasing/returns/${entry.returnId}`}>
                  {formatReturnCode(entry.returnId)}
                </Link>
                <span>{entry.returnDate}</span>
                <span>
                  {entry.items.reduce((sum, line) => sum + line.quantity, 0)} เล่ม ·{' '}
                  {entry.items.map((line) => formatBookCode(line.bookId)).join(', ')}
                </span>
                <StatusBadge tone={RETURN_STATUS_TONES[entry.status]}>
                  {RETURN_STATUS_LABELS[entry.status]}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="po-detail__total">
        ยอดรวมใบสั่งซื้อ <strong>฿ {formatBaht(documentTotal(order.items))}</strong>
      </p>
    </div>
  )
}
