import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
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
import './RequisitionFormPage.css'

// ตัวห่อกันไว้ก่อนให้ฟอร์ม mount — ฟอร์มตั้งค่าเริ่มต้นของรายการด้วย useState
// ซึ่งอ่านค่าครั้งเดียวตอน mount · ถ้าปล่อยให้ mount ตั้งแต่ยังโหลดไม่เสร็จ
// รายการจะว่างเปล่าถาวรถึงแม้เอกสารจะโหลดมาครบทีหลังแล้วก็ตาม
export default function RequisitionFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { loading, error, reload } = usePurchasing()
  const role = user!.role

  // ต้องเช็คสิทธิ์ *ก่อน* loading/error เสมอ — PurchasingProvider โหลดทุก role ที่เข้า AdminLayout
  // และ endpoint ใน loadPurchasing() ทั้งหมดเป็น rolePurchasing (warehouse/manager) เท่านั้น
  // สำหรับ sales/delivery ค่า error จึงถูกเซ็ตเป็น 403 ภาษาไทยไว้แล้วตั้งแต่โหลด ถ้า gate อยู่หลัง
  // error สองบทบาทนั้นจะเจอ ErrorState แทนหน้า "ไม่มีสิทธิ์" ที่ควรเห็น
  if (!id && !can.createRequisition(role)) {
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

  if (!can.viewPurchasing(role)) {
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
            title="บทบาทของคุณไม่มีสิทธิ์ดูเอกสารจัดซื้อ"
            description="เฉพาะพนักงานคลังสินค้าและผู้จัดการร้านเท่านั้นที่ดูเอกสารจัดซื้อได้"
          />
        </section>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลใบขอสั่งซื้อ…" />
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

  // ต้อง remount เมื่อเปลี่ยน id — ฟอร์มตั้งค่าเริ่มต้นของ supplier/รายการด้วย useState
  // ซึ่งอ่านค่าครั้งเดียวตอน mount · React Router ไม่ remount เองเมื่อ param เปลี่ยนบน route
  // เดียวกัน (เช่น เปิดใบที่ถูกตีกลับสองใบติดจากกระดิ่งแจ้งเตือน) ไม่งั้นฟอร์มจะค้างข้อมูลใบเก่า
  return <RequisitionForm key={id ?? 'new'} />
}

function RequisitionForm() {
  const { id } = useParams()
  const { state } = useLocation() as { state: RequisitionSeedState | null }
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { findRequisition, saveDraft, submitRequisition } = usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const existing = id ? findRequisition(Number(id)) : undefined
  const role = user!.role
  // สิทธิ์ *แก้* = createRequisition (warehouse) + สถานะที่ยังแก้ได้เท่านั้น — ตัวห่อด้านบน
  // อนุญาต viewPurchasing ให้เข้าหน้านี้แล้ว ผู้ที่มาถึงตรงนี้แต่ไม่มีสิทธิ์สร้างจึงเห็นเอกสารแบบ
  // อ่านอย่างเดียวโดยอัตโนมัติผ่านตัวแปรเดียวนี้ ไม่ต้องเช็คซ้ำที่ JSX
  const editable =
    can.createRequisition(role) &&
    (!existing || existing.status === 'DRAFT' || existing.status === 'REJECTED')

  const [supplierId, setSupplierId] = useState<number | ''>(
    existing?.supplierId ?? state?.supplierId ?? '',
  )
  const [lines, setLines] = useState<LineRow[]>(existing?.items ?? state?.lines ?? [])
  const [working, setWorking] = useState(false)

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

  // Spec SCR-27 §C: submitting with no supplier or a zero total would fire an empty
  // notification at the manager, so the button stays disabled until both are set.
  const blocked = supplier === undefined || total === 0
  const blockedReason =
    supplier === undefined
      ? 'กรุณาเลือกผู้จัดจำหน่ายก่อนส่งขออนุมัติ'
      : total === 0
        ? 'ยอดรวมต้องมากกว่า 0 ก่อนส่งขออนุมัติ'
        : undefined

  // ผู้ขอซื้อมาจาก JWT ฝั่งเซิร์ฟเวอร์ ไม่ต้องส่ง user.name ไปแล้ว
  const onSaveDraft = async () => {
    if (supplier === undefined) {
      notify('error', 'กรุณาเลือกผู้จัดจำหน่ายก่อนบันทึกร่าง')
      return
    }
    if (working) return
    setWorking(true)
    try {
      const saved = await saveDraft(
        { supplierId: supplier.supplierId, items: lines },
        existing?.prId,
      )
      notify('success', `บันทึกร่าง ${formatPRCode(saved.prId)} แล้ว`)
      navigate(`/admin/purchasing/pr/${saved.prId}`, { replace: true })
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกร่างไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  const submit = async () => {
    if (supplier === undefined) return
    if (working) return
    setWorking(true)
    try {
      // เซิร์ฟเวอร์แจ้งผู้จัดการร้านให้เองในทรานแซกชันเดียวกับการส่งขออนุมัติ
      const saved = await submitRequisition(
        { supplierId: supplier.supplierId, items: lines },
        existing?.prId,
      )
      notify(
        'success',
        `ส่ง ${formatPRCode(saved.prId)} ขออนุมัติแล้ว · แจ้งผู้จัดการร้านอัตโนมัติ`,
      )
      navigate('/admin/purchasing')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ส่งขออนุมัติไม่สำเร็จ')
      setWorking(false)
    }
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
        {existing && existing.status === 'SUBMITTED' && can.approveRequisition(role) && (
          <div className="admin-page__actions">
            <Link
              to={`/admin/purchasing/pr/${existing.prId}/approve`}
              className="btn btn-primary btn-sm"
            >
              <Icon name="check" size={18} />
              อนุมัติ
            </Link>
          </div>
        )}
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
