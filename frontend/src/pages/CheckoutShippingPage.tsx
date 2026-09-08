import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import OrderSummary from '../components/OrderSummary'
import LoadingState from '../admin/components/LoadingState'
import { useResource } from '../api/useResource'
import { ApiError } from '../api/client'
import { loadMyProfile, saveMyAddress, type MyProfile } from '../data/profile'
import { formatPhoneNumber } from '../data/phone'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../cart/CartContext'
import './CheckoutShippingPage.css'

function Field({
  label,
  placeholder,
  required,
  type = 'text',
  maxLength,
  value,
  onChange,
  error,
}: {
  label: ReactNode
  placeholder?: string
  required?: boolean
  type?: string
  maxLength?: number
  value?: string
  onChange?: (value: string) => void
  error?: string
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <em>*</em>}
      </span>
      <input
        className={'field__input' + (error ? ' field__input--error' : '')}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
      {error && <span className="field__error">{error}</span>}
    </label>
  )
}

type FieldName =
  | 'fullName'
  | 'mobile'
  | 'address'
  | 'soi'
  | 'subDistrict'
  | 'district'
  | 'province'
  | 'postalCode'

// ป้ายไทยของแต่ละช่อง — ป้ายบนหน้าจอกับข้อความ "กรุณากรอก…" อ่านจาก map เดียวกัน
// (เดิมป้ายเขียน "Full Name" แต่ error ใต้ช่องขึ้น "กรุณากรอกชื่อ-นามสกุล" ไม่ตรงกัน)
const LABELS: Record<FieldName, string> = {
  fullName: 'ชื่อ-นามสกุลผู้รับ',
  mobile: 'เบอร์โทรศัพท์',
  address: 'ที่อยู่ (บ้านเลขที่ หมู่บ้าน)',
  soi: 'ซอย',
  subDistrict: 'ตำบล/แขวง',
  district: 'อำเภอ/เขต',
  province: 'จังหวัด',
  postalCode: 'รหัสไปรษณีย์',
}

// ซอยเป็นช่องเดียวที่ไม่บังคับ ที่เหลือต้องกรอกครบก่อนไปหน้าชำระเงิน
const CONTACT_FIELDS: FieldName[] = ['fullName', 'mobile']
const ADDRESS_FIELDS: FieldName[] = ['address', 'subDistrict', 'district', 'province', 'postalCode']

const EMPTY_FORM: Record<FieldName, string> = {
  fullName: '',
  mobile: '',
  address: '',
  soi: '',
  subDistrict: '',
  district: '',
  province: '',
  postalCode: '',
}

// ตัวห่อ — โหลดโปรไฟล์ให้เสร็จก่อนค่อยสร้างฟอร์ม
//
// ฟอร์มตั้งค่าเริ่มต้นจากโปรไฟล์ ถ้ากันด้วย early return ในตัวฟอร์มเอง hook `useState`
// จะทำงานก่อนแล้วจับ `undefined` ฟอร์มจึงเปิดมาว่างถาวร (กฎใน frontend/CLAUDE.md
// หัวข้อ deviations · แพตเทิร์นเดียวกับ BookFormPage / ReceiveGoodsPage)
export default function CheckoutShippingPage() {
  const { user, initialising } = useAuth()
  const isCustomer = user?.role === 'customer'

  const { data: profile, loading } = useResource(loadMyProfile, isCustomer)

  if (initialising) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: '/checkout/shipping', back: '/' }} replace />
  }

  if (isCustomer && loading) return <LoadingState label="กำลังโหลดข้อมูลผู้รับ…" />

  // โหลดโปรไฟล์ไม่สำเร็จไม่ปิดทางสั่งซื้อ — ฟอร์มเปล่ายังกรอกเองได้
  return <ShippingForm profile={profile} />
}

function ShippingForm({ profile }: { profile: MyProfile | undefined }) {
  const navigate = useNavigate()
  const { lines } = useCart()

  const [form, setForm] = useState<Record<FieldName, string>>(() => ({
    ...EMPTY_FORM,
    fullName: profile?.name ?? '',
    mobile: formatPhoneNumber(profile?.phone ?? ''),
  }))
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})

  const savedAddress = profile?.address.trim() ?? ''
  // เปิดมาใช้ที่อยู่ที่บันทึกไว้ก่อนถ้ามี — ลูกค้าประจำจะได้ไม่ต้องกรอกซ้ำทุกใบ
  const [useSaved, setUseSaved] = useState(savedAddress !== '')
  const [saveAddress, setSaveAddress] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key: FieldName) => (value: string) => {
    const formatted = key === 'mobile' ? formatPhoneNumber(value) : value
    setForm((prev) => ({ ...prev, [key]: formatted }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // ตรวจเองแทน required ของ HTML เพราะข้อความของเบราว์เซอร์เป็นภาษาของเบราว์เซอร์ ไม่ใช่ไทย
  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {}
    const needed = useSaved ? CONTACT_FIELDS : [...CONTACT_FIELDS, ...ADDRESS_FIELDS]
    for (const field of needed) {
      if (!form[field].trim()) found[field] = `กรุณากรอก${LABELS[field]}`
    }
    const digits = form.mobile.replace(/\D/g, '')
    if (!found.mobile && digits.length !== 10) {
      found.mobile = 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก'
    }
    if (!useSaved && !found.postalCode && !/^\d{5}$/.test(form.postalCode.trim())) {
      found.postalCode = 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  // Assemble the delivery address the order and tracking page will display.
  const composeAddress = () => {
    if (useSaved) return savedAddress
    const soi = form.soi.trim()
    return [
      form.address.trim(),
      soi && `ซอย ${soi}`,
      form.subDistrict.trim(),
      form.district.trim(),
      form.province.trim(),
      form.postalCode.trim(),
    ]
      .filter(Boolean)
      .join(' ')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!validate()) return

    const shippingAddress = composeAddress()
    const mobile = form.mobile.trim()

    // บันทึกโปรไฟล์ก่อนไปหน้าถัดไป แต่ **ไม่ให้ความล้มเหลวบล็อกการสั่งซื้อ** —
    // การจำที่อยู่เป็นความสะดวก ไม่ใช่เงื่อนไขของคำสั่งซื้อ
    if (saveAddress && profile) {
      setSubmitting(true)
      try {
        await saveMyAddress(profile, mobile, shippingAddress)
      } catch (err) {
        setSaveError(
          err instanceof ApiError ? err.message : 'บันทึกที่อยู่ไม่สำเร็จ แต่สั่งซื้อต่อได้',
        )
      } finally {
        setSubmitting(false)
      }
    }

    navigate('/checkout/payment', {
      state: { customerName: form.fullName.trim(), mobile, shippingAddress },
    })
  }

  return (
    <div className="checkout page-shell">
      <header className="checkout__head">
        <h1>ยืนยันการสั่งซื้อ</h1>
        <p>กรอกข้อมูลผู้รับและที่อยู่จัดส่งเพื่อดำเนินการต่อ</p>
      </header>

      <form className="checkout__grid" onSubmit={(e) => void submit(e)} noValidate>
        <section className="checkout__form-card">
          <h2 className="checkout__section-title">
            <Icon name="truck" size={20} />
            ข้อมูลการจัดส่ง
          </h2>

          <div className="checkout__fields">
            <div className="field-row">
              <Field
                label={LABELS.fullName}
                placeholder="เช่น ณภัทร วงศ์สว่าง"
                required
                value={form.fullName}
                onChange={set('fullName')}
                error={errors.fullName}
              />
              <Field
                label={LABELS.mobile}
                placeholder="081-234-5678"
                type="tel"
                maxLength={12}
                required
                value={form.mobile}
                onChange={set('mobile')}
                error={errors.mobile}
              />
            </div>

            {savedAddress !== '' && (
              <div className="checkout__saved">
                <span className="checkout__saved-title">ที่อยู่ที่บันทึกไว้</span>
                <label className="checkout__saved-choice">
                  <input
                    type="radio"
                    name="addressChoice"
                    checked={useSaved}
                    onChange={() => setUseSaved(true)}
                  />
                  <span>{savedAddress}</span>
                </label>
                <label className="checkout__saved-choice">
                  <input
                    type="radio"
                    name="addressChoice"
                    checked={!useSaved}
                    onChange={() => setUseSaved(false)}
                  />
                  <span>กรอกที่อยู่ใหม่</span>
                </label>
              </div>
            )}

            {!useSaved && (
              <>
                <Field
                  label={LABELS.address}
                  placeholder="123/45 หมู่บ้านกรีนวิลล์"
                  required
                  value={form.address}
                  onChange={set('address')}
                  error={errors.address}
                />
                <Field
                  label={LABELS.soi}
                  placeholder="ไม่บังคับ"
                  value={form.soi}
                  onChange={set('soi')}
                />
                <div className="field-row">
                  <Field
                    label={LABELS.subDistrict}
                    required
                    value={form.subDistrict}
                    onChange={set('subDistrict')}
                    error={errors.subDistrict}
                  />
                  <Field
                    label={LABELS.district}
                    required
                    value={form.district}
                    onChange={set('district')}
                    error={errors.district}
                  />
                </div>
                <div className="field-row">
                  <Field
                    label={LABELS.province}
                    required
                    value={form.province}
                    onChange={set('province')}
                    error={errors.province}
                  />
                  <Field
                    label={LABELS.postalCode}
                    placeholder="10110"
                    required
                    value={form.postalCode}
                    onChange={set('postalCode')}
                    error={errors.postalCode}
                  />
                </div>
              </>
            )}

            {/* แขกที่ยังไม่ล็อกอินไม่มีบัญชีให้บันทึก จึงซ่อนทั้งอันแทนที่จะปิดใช้งาน */}
            {profile && (
              <label className="checkout__save">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => {
                    setSaveAddress(e.target.checked)
                    setSaveError('')
                  }}
                />
                <span>บันทึกที่อยู่นี้ไว้ใช้ครั้งต่อไป</span>
              </label>
            )}
            {saveError && <p className="checkout__save-error">{saveError}</p>}
          </div>

          <div className="checkout__secure">
            <Icon name="lock" size={20} />
            <p>ข้อมูลของคุณได้รับการปกป้อง ระบบเข้ารหัสข้อมูลตามมาตรฐานเพื่อความปลอดภัย</p>
          </div>
        </section>

        <OrderSummary
          footer={
            <button
              type="submit"
              className="btn btn-primary checkout__pay"
              disabled={lines.length === 0 || submitting}
            >
              {submitting ? 'กำลังบันทึก…' : 'ไปหน้าชำระเงิน'}
              <Icon name="arrow-right" size={18} />
            </button>
          }
        />
      </form>
    </div>
  )
}
