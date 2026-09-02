import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useToast } from '../components/ToastContext'
import { usePromotions, type PromotionDraft } from '../promotions/PromotionContext'
import {
  formatPromotionCode,
  isoDate,
  overlaps,
  PROMOTION_TYPE_LABELS,
  promoDisplayStatus,
  type PromotionType,
} from '../promotions/promotions'
import '../components/AdminForm.css'
import './PromotionFormPage.css'

const TYPES: PromotionType[] = ['FESTIVAL_DISCOUNT', 'COUPON', 'BUY_X_QTY']

// The form seeds its state from the promotion being edited, so it has to be remounted
// when the route switches to a different id.
export default function PromotionFormPage() {
  const { id } = useParams()
  const { loading, error, reload } = usePromotions()

  // ต้องกันไว้ที่ตัวห่อ ไม่ใช่ในฟอร์ม — ฟอร์มตั้งค่าเริ่มต้นของช่องกรอกด้วย useState
  // ซึ่งอ่านค่าครั้งเดียวตอน mount · ถ้าปล่อยให้ mount ตั้งแต่ยังโหลดไม่เสร็จ
  // หน้าแก้ไขจะเปิดมาเป็นช่องว่างทั้งใบและไม่เติมค่าให้ทีหลัง
  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลโปรโมชั่น…" />
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

  return <PromotionForm key={id ?? 'new'} id={id} />
}

interface Errors {
  name?: string
  discountValue?: string
  endDate?: string
}

function PromotionForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const { promotions, findById, findByName, add, update } = usePromotions()
  const { notify } = useToast()
  const navigate = useNavigate()

  const editing = id !== undefined
  const existing = editing ? findById(Number(id)) : undefined

  const today = isoDate(new Date())
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<PromotionType>(existing?.type ?? 'FESTIVAL_DISCOUNT')
  const [conditionDetail, setConditionDetail] = useState(existing?.conditionDetail ?? '')
  const [isPercent, setIsPercent] = useState(existing?.isPercent ?? true)
  const [discountValue, setDiscountValue] = useState(
    existing ? String(existing.discountValue) : '',
  )
  const [minQty, setMinQty] = useState(existing ? String(existing.minQty) : '0')
  const [minAmount, setMinAmount] = useState(existing ? String(existing.minAmount) : '0')
  const [startDate, setStartDate] = useState(existing?.startDate ?? today)
  const [endDate, setEndDate] = useState(existing?.endDate ?? today)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const draft: PromotionDraft = useMemo(
    () => ({
      name: name.trim(),
      type,
      conditionDetail: conditionDetail.trim(),
      isPercent,
      discountValue: Number(discountValue) || 0,
      minQty: Number(minQty) || 0,
      minAmount: Number(minAmount) || 0,
      startDate,
      endDate,
    }),
    [name, type, conditionDetail, isPercent, discountValue, minQty, minAmount, startDate, endDate],
  )

  // Promotion.overlaps() — warn (do not block) when this promotion shares a date window
  // with another active promotion of the same type.
  const clashes = useMemo(() => {
    const probe = { ...draft, promotionId: existing?.promotionId ?? 0, status: 'ACTIVE' as const }
    return promotions.filter(
      (p) =>
        p.promotionId !== existing?.promotionId &&
        promoDisplayStatus(p) !== 'EXPIRED' &&
        overlaps(probe, p),
    )
  }, [draft, promotions, existing])

  if (!can.managePromotion(user!.role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์จัดการโปรโมชั่น"
            description="การเพิ่มและแก้ไขโปรโมชั่นเป็นสิทธิ์ของผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/promotions') }}
          />
        </section>
      </div>
    )
  }

  if (editing && !existing) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'โปรโมชั่นและส่วนลด', to: '/admin/promotions' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="tag"
            title="ไม่พบข้อมูลโปรโมชั่น"
            description="ไม่สามารถเปิดฟอร์มแก้ไขได้เพราะไม่พบรหัสที่ระบุ"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/promotions') }}
          />
        </section>
      </div>
    )
  }

  const validate = () => {
    const found: Errors = {}
    if (!name.trim()) found.name = 'กรุณากรอกชื่อโปรโมชั่น'
    const value = Number(discountValue)
    if (!discountValue.trim() || Number.isNaN(value) || value <= 0) {
      found.discountValue = 'กรุณากรอกมูลค่าส่วนลดให้มากกว่า 0'
    } else if (isPercent && value > 100) {
      found.discountValue = 'ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100'
    }
    if (endDate < startDate) found.endDate = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น'
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!validate()) return

    const duplicate = findByName(draft.name, existing?.promotionId)
    if (duplicate) {
      notify('error', `พบชื่อโปรโมชั่นซ้ำ: "${duplicate.name}" มีอยู่ในระบบแล้ว`)
      return
    }

    setSaving(true)
    try {
      if (existing) {
        await update(existing.promotionId, draft)
        notify('success', `บันทึกการแก้ไขโปรโมชั่น "${draft.name}" เรียบร้อยแล้ว`)
      } else {
        const created = await add(draft)
        notify('success', `เพิ่มโปรโมชั่นสำเร็จ (รหัส ${formatPromotionCode(created.promotionId)})`)
      }
      navigate('/admin/promotions')
    } catch (err) {
      // ข้อความไทยจาก backend (ชื่อซ้ำ · ช่วงวันที่ไม่ถูกต้อง ฯลฯ)
      notify('error', err instanceof Error ? err.message : 'บันทึกโปรโมชั่นไม่สำเร็จ')
      setSaving(false)
    }
  }

  const title = existing ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่น'

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'โปรโมชั่นและส่วนลด', to: '/admin/promotions' },
          { label: title },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{title}</h1>
          <p className="admin-page__subtitle">
            {existing
              ? `รหัส ${formatPromotionCode(existing.promotionId)} · ผู้จัดการร้านสามารถแก้ไขและปิดใช้งานได้`
              : 'ระบบจะออกรหัสโปรโมชั่นและตั้งสถานะเป็น "ใช้งาน" ให้อัตโนมัติ'}
          </p>
        </div>
      </div>

      <form className="promotion-form" onSubmit={submit} noValidate>
        <section className="admin-card promotion-form__card">
          <h2 className="admin-card__title">ข้อมูลโปรโมชั่น</h2>

          <div className="promotion-form__grid">
            <label className="admin-field promotion-form__wide">
              <span className="admin-field__label">
                ชื่อโปรโมชั่น <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.name ? ' admin-input--error' : '')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((c) => ({ ...c, name: undefined }))
                }}
                placeholder="เช่น ลดรับเทศกาลปีใหม่"
              />
              {errors.name && <span className="admin-field__error">{errors.name}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">ประเภท</span>
              <select
                className="admin-input"
                value={type}
                onChange={(e) => setType(e.target.value as PromotionType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROMOTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-field__label">รูปแบบส่วนลด</span>
              <select
                className="admin-input"
                value={isPercent ? 'percent' : 'baht'}
                onChange={(e) => setIsPercent(e.target.value === 'percent')}
              >
                <option value="percent">เปอร์เซ็นต์ (%)</option>
                <option value="baht">จำนวนเงิน (บาท)</option>
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                มูลค่าส่วนลด <em>*</em>
              </span>
              <div className="promotion-form__value">
                <input
                  type="number"
                  min={0}
                  step={isPercent ? 1 : 0.01}
                  className={'admin-input' + (errors.discountValue ? ' admin-input--error' : '')}
                  value={discountValue}
                  onChange={(e) => {
                    setDiscountValue(e.target.value)
                    setErrors((c) => ({ ...c, discountValue: undefined }))
                  }}
                />
                <span className="promotion-form__unit">{isPercent ? '%' : 'บาท'}</span>
              </div>
              {errors.discountValue && (
                <span className="admin-field__error">{errors.discountValue}</span>
              )}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">ยอดซื้อขั้นต่ำ (บาท)</span>
              <input
                type="number"
                min={0}
                className="admin-input"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </label>

            <label className="admin-field">
              <span className="admin-field__label">จำนวนขั้นต่ำ (เล่ม)</span>
              <input
                type="number"
                min={0}
                className="admin-input"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
            </label>

            <label className="admin-field">
              <span className="admin-field__label">วันเริ่มต้น</span>
              <input
                type="date"
                className="admin-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setErrors((c) => ({ ...c, endDate: undefined }))
                }}
              />
            </label>

            <label className="admin-field">
              <span className="admin-field__label">วันสิ้นสุด</span>
              <input
                type="date"
                className={'admin-input' + (errors.endDate ? ' admin-input--error' : '')}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setErrors((c) => ({ ...c, endDate: undefined }))
                }}
              />
              {errors.endDate && <span className="admin-field__error">{errors.endDate}</span>}
            </label>

            <label className="admin-field promotion-form__wide">
              <span className="admin-field__label">รายละเอียดเงื่อนไข</span>
              <textarea
                rows={2}
                className="admin-input"
                value={conditionDetail}
                onChange={(e) => setConditionDetail(e.target.value)}
                placeholder="เช่น ใช้ได้กับหนังสือทุกหมวด ยกเว้นสินค้าลดราคา"
              />
            </label>
          </div>

          {clashes.length > 0 && (
            <div className="promotion-form__warn">
              <Icon name="alert-triangle" size={18} />
              <span>
                ช่วงเวลานี้ทับซ้อนกับโปรโมชั่นประเภทเดียวกันที่ยังใช้งานอยู่:{' '}
                {clashes.map((p) => p.name).join(', ')} — ตรวจสอบก่อนบันทึกเพื่อเลี่ยงส่วนลดซ้อน
              </span>
            </div>
          )}
        </section>

        <div className="promotion-form__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            ยกเลิก
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            บันทึก
          </button>
        </div>
      </form>
    </div>
  )
}
