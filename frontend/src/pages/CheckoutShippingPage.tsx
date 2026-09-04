import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import OrderSummary from '../components/OrderSummary'
import { useCart } from '../cart/CartContext'
import './CheckoutShippingPage.css'

function Field({
  label,
  placeholder,
  required,
  type = 'text',
  value,
  onChange,
  error,
}: {
  label: ReactNode
  placeholder?: string
  required?: boolean
  type?: string
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

// ป้ายไทยของแต่ละช่อง ใช้ประกอบข้อความ "กรุณากรอก…"
const LABELS: Record<FieldName, string> = {
  fullName: 'ชื่อ-นามสกุล',
  mobile: 'เบอร์โทรศัพท์',
  address: 'ที่อยู่จัดส่ง',
  soi: 'ซอย',
  subDistrict: 'ตำบล/แขวง',
  district: 'อำเภอ/เขต',
  province: 'จังหวัด',
  postalCode: 'รหัสไปรษณีย์',
}

// ซอยเป็นช่องเดียวที่ไม่บังคับ ที่เหลือต้องกรอกครบก่อนไปหน้าชำระเงิน
const REQUIRED: FieldName[] = [
  'fullName',
  'mobile',
  'address',
  'subDistrict',
  'district',
  'province',
  'postalCode',
]

export default function CheckoutShippingPage() {
  const navigate = useNavigate()
  const { lines } = useCart()

  const [form, setForm] = useState<Record<FieldName, string>>({
    fullName: '',
    mobile: '',
    address: '',
    soi: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  })
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})

  const set = (key: FieldName) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // ตรวจเองแทน required ของ HTML เพราะข้อความของเบราว์เซอร์เป็นภาษาของเบราว์เซอร์ ไม่ใช่ไทย
  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {}
    for (const field of REQUIRED) {
      if (!form[field].trim()) found[field] = `กรุณากรอก${LABELS[field]}`
    }
    const digits = form.mobile.replace(/\D/g, '')
    if (!found.mobile && (digits.length < 9 || digits.length > 10)) {
      found.mobile = 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง'
    }
    if (!found.postalCode && !/^\d{5}$/.test(form.postalCode.trim())) {
      found.postalCode = 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    // Assemble the delivery address the order and tracking page will display.
    const soi = form.soi.trim()
    const shippingAddress = [
      form.address.trim(),
      soi && `ซอย ${soi}`,
      form.subDistrict.trim(),
      form.district.trim(),
      form.province.trim(),
      form.postalCode.trim(),
    ]
      .filter(Boolean)
      .join(' ')
    navigate('/checkout/payment', {
      state: {
        customerName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        shippingAddress,
      },
    })
  }

  return (
    <div className="checkout page-shell">
      <header className="checkout__head">
        <h1>Checkout</h1>
        <p>Please provide your shipping details to complete the order.</p>
      </header>

      <form className="checkout__grid" onSubmit={submit} noValidate>
        <section className="checkout__form-card">
          <h2 className="checkout__section-title">
            <Icon name="truck" size={20} />
            Shipping Information
          </h2>

          <div className="checkout__fields">
            <div className="field-row">
              <Field
                label="Full Name"
                placeholder="John Doe"
                required
                value={form.fullName}
                onChange={set('fullName')}
                error={errors.fullName}
              />
              <Field
                label="Mobile Number"
                placeholder="081-234-5678"
                required
                value={form.mobile}
                onChange={set('mobile')}
                error={errors.mobile}
              />
            </div>
            <Field
              label="Address (House No., Village)"
              placeholder="123/45 ..."
              required
              value={form.address}
              onChange={set('address')}
              error={errors.address}
            />
            <Field
              label="Soi / Alley"
              placeholder="Optional"
              value={form.soi}
              onChange={set('soi')}
            />
            <div className="field-row">
              <Field
                label="Sub-district / Khwaeng"
                required
                value={form.subDistrict}
                onChange={set('subDistrict')}
                error={errors.subDistrict}
              />
              <Field
                label="District / Khet"
                required
                value={form.district}
                onChange={set('district')}
                error={errors.district}
              />
            </div>
            <div className="field-row">
              <Field
                label="Province"
                required
                value={form.province}
                onChange={set('province')}
                error={errors.province}
              />
              <Field
                label="Postal Code"
                placeholder="10110"
                required
                value={form.postalCode}
                onChange={set('postalCode')}
                error={errors.postalCode}
              />
            </div>

            <label className="checkout__save">
              <input type="checkbox" />
              <span>Save this address for next time</span>
            </label>
          </div>

          <div className="checkout__secure">
            <Icon name="lock" size={20} />
            <p>
              Your data is protected. We use industry-standard encryption to keep
              your information safe and private.
            </p>
          </div>
        </section>

        <OrderSummary
          footer={
            <button
              type="submit"
              className="btn btn-primary checkout__pay"
              disabled={lines.length === 0}
            >
              Proceed to Payment
              <Icon name="arrow-right" size={18} />
            </button>
          }
        />
      </form>
    </div>
  )
}
