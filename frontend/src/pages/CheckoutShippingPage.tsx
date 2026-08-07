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
}: {
  label: ReactNode
  placeholder?: string
  required?: boolean
  type?: string
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <em>*</em>}
      </span>
      <input
        className="field__input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </label>
  )
}

export default function CheckoutShippingPage() {
  const navigate = useNavigate()
  const { lines } = useCart()

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    address: '',
    soi: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  })
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Assemble the delivery address the order and tracking page will display.
    const shippingAddress = [
      form.address,
      form.soi && `ซอย ${form.soi}`,
      form.subDistrict,
      form.district,
      form.province,
      form.postalCode,
    ]
      .filter(Boolean)
      .join(' ')
    navigate('/checkout/payment', {
      state: { customerName: form.fullName, mobile: form.mobile, shippingAddress },
    })
  }

  return (
    <div className="checkout page-shell">
      <header className="checkout__head">
        <h1>Checkout</h1>
        <p>Please provide your shipping details to complete the order.</p>
      </header>

      <form className="checkout__grid" onSubmit={submit}>
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
              />
              <Field
                label="Mobile Number"
                placeholder="081-234-5678"
                required
                value={form.mobile}
                onChange={set('mobile')}
              />
            </div>
            <Field
              label="Address (House No., Village)"
              placeholder="123/45 ..."
              required
              value={form.address}
              onChange={set('address')}
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
              />
              <Field
                label="District / Khet"
                required
                value={form.district}
                onChange={set('district')}
              />
            </div>
            <div className="field-row">
              <Field
                label="Province"
                required
                value={form.province}
                onChange={set('province')}
              />
              <Field
                label="Postal Code"
                placeholder="10110"
                required
                value={form.postalCode}
                onChange={set('postalCode')}
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
