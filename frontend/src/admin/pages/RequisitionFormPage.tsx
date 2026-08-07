import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import LineItemsTable, { type LineRow } from '../components/LineItemsTable'
import StatusBadge from '../components/StatusBadge'
import Stepper from '../components/Stepper'
import { useToast } from '../components/ToastContext'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPRCode,
  PR_STATUS_LABELS,
  PR_STATUS_TONES,
  type RequisitionSeedState,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './RequisitionFormPage.css'

export default function RequisitionFormPage() {
  const { id } = useParams()
  const { state } = useLocation() as { state: RequisitionSeedState | null }
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { findRequisition, saveDraft, submitRequisition } = usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const existing = id ? findRequisition(Number(id)) : undefined
  const editable = !existing || existing.status === 'DRAFT' || existing.status === 'REJECTED'

  const [supplierId, setSupplierId] = useState<number | ''>(
    existing?.supplierId ?? state?.supplierId ?? '',
  )
  const [lines, setLines] = useState<LineRow[]>(existing?.items ?? state?.lines ?? [])

  const role = user!.role
  const supplier = suppliers.find((entry) => entry.supplierId === supplierId)
  const total = documentTotal(lines)

  const activeSuppliers = useMemo(
    () => suppliers.filter((entry) => entry.status === 'ACTIVE'),
    [suppliers],
  )

  // U6 abnormal flow: a price that no longer matches the supplier's catalogue must be
  // flagged before the requisition is saved.
  const offCatalogue = lines.filter((line) => {
    const book = supplier?.books.find((entry) => entry.bookId === line.bookId)
    return book !== undefined && book.supplyPrice !== line.unitPrice
  })

  if (id && !existing) {
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

  if (!can.createRequisition(role)) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'ใบขอสั่งซื้อ' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์สร้างใบขอสั่งซื้อ"
            description="เฉพาะพนักงานคลังสินค้าเท่านั้นที่จัดทำใบขอสั่งซื้อได้"
          />
        </section>
      </div>
    )
  }

  // Spec SCR-27 §C: submitting with no supplier or a zero total would fire an empty
  // notification at the manager, so the button stays disabled until both are set.
  const blocked = supplier === undefined || total === 0
  const blockedReason =
    supplier === undefined
      ? 'กรุณาเลือกผู้จัดจำหน่ายก่อนส่งขออนุมัติ'
      : total === 0
        ? 'ยอดรวมต้องมากกว่า 0 ก่อนส่งขออนุมัติ'
        : undefined

  const onSaveDraft = () => {
    if (supplier === undefined) {
      notify('error', 'กรุณาเลือกผู้จัดจำหน่ายก่อนบันทึกร่าง')
      return
    }
    const saved = saveDraft(
      { supplierId: supplier.supplierId, items: lines },
      user!.name,
      existing?.prId,
    )
    notify('success', `บันทึกร่าง ${formatPRCode(saved.prId)} แล้ว`)
    navigate(`/admin/purchasing/pr/${saved.prId}`, { replace: true })
  }

  const submit = () => {
    if (supplier === undefined) return
    const saved = submitRequisition(
      { supplierId: supplier.supplierId, items: lines },
      user!.name,
      existing?.prId,
    )
    notify(
      'success',
      `ส่ง ${formatPRCode(saved.prId)} ขออนุมัติแล้ว · แจ้งผู้จัดการร้านอัตโนมัติ`,
    )
    navigate('/admin/purchasing')
  }

  const title = existing ? `ใบขอสั่งซื้อ ${formatPRCode(existing.prId)}` : 'สร้างใบขอสั่งซื้อ'

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
          { label: existing ? formatPRCode(existing.prId) : 'สร้างใบขอสั่งซื้อ' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            {title}
            {existing && (
              <StatusBadge tone={PR_STATUS_TONES[existing.status]}>
                {PR_STATUS_LABELS[existing.status]}
              </StatusBadge>
            )}
          </h1>
          <p className="admin-page__subtitle">
            {existing
              ? `ผู้ขอ ${existing.requestedBy} · วันที่ ${existing.createdDate}`
              : 'เลือกผู้จัดจำหน่าย เพิ่มรายการหนังสือ แล้วส่งให้ผู้จัดการร้านพิจารณา'}
          </p>
        </div>
      </div>

      {existing && (
        <section className="admin-card pr-form__stepper">
          <Stepper
            current={existing.status === 'DRAFT' ? 0 : existing.status === 'SUBMITTED' ? 0 : 1}
            stopped={existing.status === 'REJECTED'}
          />
        </section>
      )}

      {existing?.status === 'REJECTED' && (
        <p className="pr-form__banner pr-form__banner--danger">
          <Icon name="alert-triangle" size={18} />
          ผู้จัดการร้านตีกลับให้แก้ไข · เหตุผล: {existing.rejectionReason}
        </p>
      )}

      <section className="admin-card pr-form">
        <div className="pr-form__header">
          <label className="admin-field pr-form__supplier">
            <span className="admin-field__label">
              ผู้จัดจำหน่าย <em>*</em>
            </span>
            <select
              className="admin-input"
              value={supplierId}
              disabled={!editable}
              onChange={(e) => {
                setSupplierId(e.target.value === '' ? '' : Number(e.target.value))
                setLines([])
              }}
            >
              <option value="">ค้นหา / เลือกผู้จัดจำหน่าย</option>
              {activeSuppliers.map((entry) => (
                <option key={entry.supplierId} value={entry.supplierId}>
                  {formatSupplierCode(entry.supplierId)} · {entry.companyName}
                </option>
              ))}
            </select>
            <span className="admin-field__hint">
              แสดงเฉพาะผู้จัดจำหน่ายที่ยังใช้งานอยู่ รายที่ถูกปิดใช้งานจะเลือกไม่ได้
            </span>
          </label>

          <div className="pr-form__terms">
            <span className="admin-field__label">เงื่อนไข</span>
            {supplier ? (
              <>
                <p>{supplier.creditTerms}</p>
                <p className="pr-form__terms-note">{supplier.tradeTerms}</p>
              </>
            ) : (
              <p className="pr-form__terms-note">เลือกผู้จัดจำหน่ายเพื่อดูเงื่อนไขการค้า</p>
            )}
          </div>
        </div>

        <LineItemsTable
          lines={lines}
          books={supplier?.books ?? []}
          readOnly={!editable}
          onChange={setLines}
          priceWarning={
            offCatalogue.length > 0
              ? `มี ${offCatalogue.length} รายการที่ราคาไม่ตรงกับเงื่อนไขการค้าของผู้จัดจำหน่าย กรุณาตรวจสอบก่อนบันทึก`
              : undefined
          }
        />
      </section>

      {editable && (
        <div className="pr-form__actions">
          <span className="pr-form__summary">
            ยอดรวม PR: <strong>฿ {formatBaht(total)}</strong>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSaveDraft}>
            บันทึกร่าง
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={blocked}
            title={blockedReason}
            onClick={submit}
          >
            <Icon name="arrow-right" size={18} />
            ส่งขออนุมัติ
          </button>
        </div>
      )}
    </div>
  )
}
