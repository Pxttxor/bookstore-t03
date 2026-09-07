import { useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPOCode,
  outstandingOrders,
  PO_STATUS_LABELS,
  PO_STATUS_TONES,
  poDisplayStatus,
} from '../purchasing/purchasing'
import { DEACTIVATION_REASONS, formatBaht, type Supplier } from '../suppliers/suppliers'
import './DeactivateSupplierModal.css'

interface DeactivateSupplierModalProps {
  supplier: Supplier
  onClose: () => void
  onConfirm: (reason: string, note: string) => void
}

export default function DeactivateSupplierModal({
  supplier,
  onClose,
  onConfirm,
}: DeactivateSupplierModalProps) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [reasonError, setReasonError] = useState('')
  const { ordersForSupplier, loading, error } = usePurchasing()

  const pending = outstandingOrders(ordersForSupplier(supplier.supplierId))

  // กล่องนี้เล็กเกินกว่าจะขึ้นจอโหลดเต็ม แต่ปล่อยให้กดยืนยันไม่ได้เช่นกัน —
  // ระหว่างที่ยังไม่รู้ว่ามีใบสั่งซื้อคงค้างหรือไม่ ผลลัพธ์ที่นับได้คือ 0 เสมอ
  // ซึ่งจะบอกผู้ใช้ว่าปิดใช้งานได้ทั้งที่เซิร์ฟเวอร์อาจปฏิเสธ (SUPPLIER_HAS_OPEN_PO)
  const unverified = loading || error !== null
  const blocked = unverified || pending.length > 0

  const confirm = () => {
    if (!reason) {
      setReasonError('กรุณาเลือกเหตุผลในการปิดใช้งาน')
      return
    }
    onConfirm(reason, note.trim())
  }

  return (
    <Modal
      title="ปิดใช้งานผู้จัดจำหน่าย"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={blocked}
            onClick={confirm}
          >
            ยืนยันปิดใช้งาน
          </button>
        </>
      }
    >
      <div className={'deactivate__notice' + (blocked ? ' deactivate__notice--blocked' : '')}>
        <Icon name={blocked ? 'alert-triangle' : 'check-circle'} size={20} />
        <span>
          {loading
            ? 'กำลังตรวจสอบใบสั่งซื้อคงค้าง…'
            : error
            ? `ตรวจสอบใบสั่งซื้อคงค้างไม่สำเร็จ: ${error}`
            : `ตรวจพบใบสั่งซื้อคงค้าง ${pending.length} รายการ`}
          {!unverified && blocked && ' — ต้องปิดรายการคงค้างให้ครบก่อนจึงจะปิดใช้งานได้'}
        </span>
      </div>

      {/* รายการคงค้างจะว่างตอนที่ยังตรวจไม่ได้ ต้องเช็ค pending เอง ไม่ใช่ blocked */}
      {pending.length > 0 && (
        <ul className="deactivate__orders">
          {pending.map((po) => {
            const display = poDisplayStatus(po)
            return (
              <li key={po.poId}>
                <span className="deactivate__po">{formatPOCode(po.poId)}</span>
                <span>{po.orderDate}</span>
                <span>{formatBaht(documentTotal(po.items))} บาท</span>
                <StatusBadge tone={PO_STATUS_TONES[display]}>
                  {PO_STATUS_LABELS[display]}
                </StatusBadge>
              </li>
            )
          })}
        </ul>
      )}

      <label className="admin-field">
        <span className="admin-field__label">
          เหตุผล <em>*</em>
        </span>
        <select
          className={'admin-input' + (reasonError ? ' admin-input--error' : '')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setReasonError('')
          }}
        >
          <option value="">เลือกเหตุผล</option>
          {DEACTIVATION_REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {reasonError && <span className="admin-field__error">{reasonError}</span>}
      </label>

      <label className="admin-field">
        <span className="admin-field__label">หมายเหตุ</span>
        <textarea
          className="admin-input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
        />
      </label>

      <p className="deactivate__hint">
        เมื่อปิดใช้งานแล้ว สถานะจะเปลี่ยนเป็น &quot;ยกเลิก&quot; ระบบยังคงเก็บประวัติทั้งหมดไว้
        แต่จะเลือกผู้จัดจำหน่ายรายนี้ในใบสั่งซื้อใหม่ไม่ได้
      </p>
    </Modal>
  )
}
