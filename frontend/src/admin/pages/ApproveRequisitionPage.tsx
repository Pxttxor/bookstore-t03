import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import LineItemsTable from '../components/LineItemsTable'
import Meter from '../components/Meter'
import StatusBadge from '../components/StatusBadge'
import Stepper from '../components/Stepper'
import { useToast } from '../components/ToastContext'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPOCode,
  formatPRCode,
  PR_STATUS_LABELS,
  PR_STATUS_TONES,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './ApproveRequisitionPage.css'

export default function ApproveRequisitionPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { findRequisition, budget, approveRequisition, rejectRequisition, loading, error, reload } =
    usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [overBudgetNote, setOverBudgetNote] = useState('')
  const [overBudgetError, setOverBudgetError] = useState('')
  const [working, setWorking] = useState(false)

  const role = user!.role
  const requisition = findRequisition(Number(id))

  if (!can.approveRequisition(role)) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'อนุมัติใบสั่งซื้อ' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์อนุมัติใบสั่งซื้อ"
            description="การอนุมัติและการตีกลับเป็นสิทธิ์ของผู้จัดการร้านเท่านั้น"
            action={{
              label: 'กลับไปหน้าเอกสารจัดซื้อ',
              onClick: () => navigate('/admin/purchasing'),
            }}
          />
        </section>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดใบขอสั่งซื้อ…" />
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

  if (!requisition) {
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
            title="ไม่พบใบขอสั่งซื้อ"
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

  const supplier = suppliers.find((entry) => entry.supplierId === requisition.supplierId)
  const total = documentTotal(requisition.items)
  // งบประมาณมาจาก `GET /api/purchasing/budget` แล้ว ไม่ใช่ค่าคงที่ฝั่งหน้าจอ
  // เซิร์ฟเวอร์คิด committed จากใบสั่งซื้อจริงทั้งหมด จึงตรงกับที่ใช้ตัดสินตอนอนุมัติ
  const remaining = budget.remaining
  const remainingAfter = remaining - total
  const overBudget = remainingAfter < 0
  const remainingPercent = budget.budget > 0 ? (remaining / budget.budget) * 100 : 0
  const decided = requisition.status !== 'SUBMITTED'

  const tone = overBudget ? 'danger' : remainingPercent <= 30 ? 'warning' : 'accent'

  const approve = async () => {
    // U7 abnormal flow: over budget must be adjusted down or justified in writing.
    if (overBudget && overBudgetNote.trim() === '') {
      setOverBudgetError('ยอดเกินงบประมาณ กรุณาบันทึกเหตุผลก่อนอนุมัติ')
      return
    }
    if (working) return
    setWorking(true)
    try {
      // เซิร์ฟเวอร์ออกใบสั่งซื้อ ปรับสถานะใบขอ และแจ้งเตือน ในทรานแซกชันเดียว
      const order = await approveRequisition(
        requisition.prId,
        overBudget ? overBudgetNote.trim() : undefined,
      )
      notify(
        'success',
        `อนุมัติ ${formatPRCode(requisition.prId)} แล้ว · ระบบออก ${formatPOCode(order.poId)} รอส่งให้ผู้จัดจำหน่าย`,
      )
      navigate('/admin/purchasing')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อนุมัติไม่สำเร็จ')
      setWorking(false)
    }
  }

  const reject = async () => {
    if (reason.trim() === '') {
      setReasonError('กรุณาระบุเหตุผลที่ตีกลับให้แก้ไข')
      return
    }
    if (working) return
    setWorking(true)
    try {
      await rejectRequisition(requisition.prId, reason.trim())
      notify('warning', `ตีกลับ ${formatPRCode(requisition.prId)} ให้พนักงานคลังแก้ไขแล้ว`)
      navigate('/admin/purchasing')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ตีกลับไม่สำเร็จ')
      setWorking(false)
    }
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
          { label: formatPRCode(requisition.prId) },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            ใบขอสั่งซื้อ {formatPRCode(requisition.prId)}
            <StatusBadge tone={PR_STATUS_TONES[requisition.status]}>
              {PR_STATUS_LABELS[requisition.status]}
            </StatusBadge>
          </h1>
          <p className="admin-page__subtitle">
            ผู้จัดจำหน่าย {formatSupplierCode(requisition.supplierId)}
            {supplier && ` ${supplier.companyName}`} · ผู้ขอ: {requisition.requestedBy} · วันที่{' '}
            {requisition.createdDate}
          </p>
        </div>
      </div>

      <section className="admin-card approve__stepper">
        <Stepper current={decided ? 1 : 0} stopped={requisition.status === 'REJECTED'} />
      </section>

      {overBudget && !decided && (
        <p className="approve__banner approve__banner--danger">
          <Icon name="alert-triangle" size={18} />
          เกินงบประมาณ {formatBaht(Math.abs(remainingAfter))} บาท —
          ต้องปรับลดรายการหรือบันทึกเหตุผลก่อนอนุมัติ
        </p>
      )}

      <section className="admin-card approve">
        <LineItemsTable lines={requisition.items} books={supplier?.books ?? []} readOnly />

        <div className="approve__budget">
          <div className="approve__budget-figures">
            <span className="approve__budget-label">ยอดรวม</span>
            <strong className="approve__budget-total">฿ {formatBaht(total)}</strong>
          </div>

          <div className="approve__budget-meter">
            <div className="approve__budget-figures">
              <span className="approve__budget-label">งบประมาณคงเหลือ</span>
              <strong>
                ฿ {formatBaht(remaining)} · {Math.round(remainingPercent)}%
              </strong>
            </div>
            <Meter
              percent={remainingPercent}
              tone={tone}
              label={`งบประมาณคงเหลือ ${Math.round(remainingPercent)} เปอร์เซ็นต์`}
            />
            <p className="approve__budget-note">
              คงเหลือหลังอนุมัติใบนี้ ฿ {formatBaht(remainingAfter)} จากงบทั้งหมด ฿{' '}
              {formatBaht(budget.budget)}
            </p>
          </div>
        </div>
      </section>

      {decided ? (
        <p className="approve__banner approve__banner--info">
          <Icon name="check-circle" size={18} />
          ใบขอสั่งซื้อนี้พิจารณาแล้ว สถานะปัจจุบันคือ{' '}
          {PR_STATUS_LABELS[requisition.status]}
          {requisition.rejectionReason && ` · เหตุผล: ${requisition.rejectionReason}`}
        </p>
      ) : (
        <section className="admin-card approve__decision">
          {overBudget && (
            <label className="admin-field">
              <span className="admin-field__label">
                เหตุผลที่อนุมัติทั้งที่เกินงบประมาณ <em>*</em>
              </span>
              <textarea
                className={'admin-input' + (overBudgetError ? ' admin-input--error' : '')}
                rows={2}
                value={overBudgetNote}
                placeholder="เช่น เป็นหนังสือขายดีที่ต้องเติมสต็อกเร่งด่วน"
                onChange={(e) => {
                  setOverBudgetNote(e.target.value)
                  setOverBudgetError('')
                }}
              />
              {overBudgetError && (
                <span className="admin-field__error">{overBudgetError}</span>
              )}
            </label>
          )}

          <label className="admin-field">
            <span className="admin-field__label">เหตุผล (กรณีตีกลับ)</span>
            <textarea
              className={'admin-input' + (reasonError ? ' admin-input--error' : '')}
              rows={2}
              value={reason}
              placeholder="ระบุสิ่งที่ต้องแก้ไขก่อนส่งกลับมาใหม่"
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError('')
              }}
            />
            {reasonError && <span className="admin-field__error">{reasonError}</span>}
          </label>

          <div className="approve__actions">
            <button type="button" className="btn btn-danger btn-sm" onClick={reject}>
              ตีกลับให้แก้ไข
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={approve}>
              <Icon name="check" size={18} />
              อนุมัติ
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
