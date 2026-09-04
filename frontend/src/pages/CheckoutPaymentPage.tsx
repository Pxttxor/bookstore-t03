import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { formatPrice } from '../data/money'
import { useCart } from '../cart/CartContext'
import { useOrders } from '../admin/orders/OrderContext'
import './CheckoutPaymentPage.css'

interface ShippingState {
  customerName?: string
  mobile?: string
  shippingAddress?: string
}

// ข้อจำกัดของไฟล์สลิป ตรงกับที่หน้าจอเขียนไว้ว่า "Supports JPG, PNG, PDF (Max 5MB)"
const MAX_SLIP_BYTES = 5 * 1024 * 1024
const SLIP_PATTERN = /\.(jpe?g|png|pdf)$/i

// Placeholder graphic only, this is not a scannable payment code.
function QrPlaceholder() {
  const cells = 21
  const filled = (r: number, c: number) => ((r * 7 + c * 13 + r * c) % 3 === 0)
  return (
    <svg className="pay__qr-svg" viewBox="0 0 21 21" role="img" aria-label="QR code">
      <rect width="21" height="21" fill="#fff" />
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((_, c) =>
          filled(r, c) ? (
            <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#1a1c1c" />
          ) : null,
        ),
      )}
      {[
        [0, 0],
        [14, 0],
        [0, 14],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="7" height="7" fill="#1a1c1c" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#1a1c1c" />
        </g>
      ))}
    </svg>
  )
}

export default function CheckoutPaymentPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { subtotal, lines, clear } = useCart()
  const { placeOrder } = useOrders()
  const fileRef = useRef<HTMLInputElement>(null)
  const [slip, setSlip] = useState<File | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  const amount = subtotal
  const shipping = (state ?? {}) as ShippingState
  const shippingAddress = shipping.shippingAddress?.trim() ?? ''

  // เก็บไฟล์ทั้งก้อนเพื่อตรวจชนิดและขนาดได้ · ที่ส่งขึ้นเซิร์ฟเวอร์ยังเป็นชื่อไฟล์อย่างเดียว
  // (โปรเจกต์นี้ไม่มีที่เก็บไฟล์ตามที่บันทึกไว้ใน frontend/CLAUDE.md)
  const pickSlip = (file: File | undefined) => {
    const reject = (message: string) => {
      setSlip(null)
      setError(message)
      // ล้างค่าใน input ไม่งั้นเลือกไฟล์เดิมซ้ำจะไม่ยิง onChange อีก
      if (fileRef.current) fileRef.current.value = ''
    }
    if (!file) {
      reject('กรุณาแนบหลักฐานการชำระเงิน')
      return
    }
    if (!SLIP_PATTERN.test(file.name)) {
      reject('รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF')
      return
    }
    if (file.size > MAX_SLIP_BYTES) {
      reject('ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB')
      return
    }
    setSlip(file)
    setError('')
  }

  const confirm = async () => {
    if (placing) return
    if (!slip) {
      setError('กรุณาแนบหลักฐานการชำระเงิน')
      return
    }
    setPlacing(true)
    setError('')
    try {
      // ชื่อลูกค้าและยอดเงินเซิร์ฟเวอร์คิดเอง (จากบัญชีที่ล็อกอินและราคาในตาราง book)
      // หน้าจอส่งแค่ที่อยู่จัดส่ง รายการหนังสือ และชื่อไฟล์สลิป
      const order = await placeOrder({
        shippingAddress,
        items: lines.map((line) => ({ bookId: line.book.bookId, quantity: line.qty })),
        slipFileName: slip.name,
      })
      clear()
      navigate(`/order/${order.orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      setPlacing(false)
    }
  }

  // เข้าหน้านี้ตรง ๆ ทาง URL (หรือรีเฟรช) จะไม่มีที่อยู่ติดมาใน location.state
  // ต้องกลับไปกรอกก่อน ไม่ใช่ปล่อยให้สั่งซื้อโดยไม่มีที่อยู่
  if (!shippingAddress) return <Navigate to="/checkout/shipping" replace />

  const blockedReason = lines.length === 0
    ? 'ตะกร้าสินค้าว่าง ยังสั่งซื้อไม่ได้'
    : !slip
      ? 'กรุณาแนบหลักฐานการชำระเงินก่อนกดยืนยัน'
      : ''

  return (
    <div className="pay page-shell">
      <header className="pay__head">
        <span className="pay__step">Step 2 of 2 · Payment</span>
        <h1>Scan to Pay</h1>
        <p>Complete your purchase using our secure QR verification.</p>
      </header>

      <div className="pay__grid">
        <section className="pay__card pay__scan">
          <div className="pay__qr">
            <QrPlaceholder />
          </div>
          <p className="pay__scan-note">Please scan the QR code above to pay.</p>
          <div className="pay__amount">
            <span>Amount</span>
            <strong>{formatPrice(lines.length ? amount : 0)}</strong>
          </div>
        </section>

        <section className="pay__card pay__verify">
          <span className="pay__label">VERIFICATION</span>
          <h2 className="pay__verify-title">Upload Payment Slip</h2>

          <button
            type="button"
            className="pay__drop"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="upload" size={32} />
            <span className="pay__drop-main">
              {slip ? (
                slip.name
              ) : (
                <>
                  Drag &amp; drop your receipt here or <b>browse</b>
                </>
              )}
            </span>
            <span className="pay__drop-sub">Supports JPG, PNG, PDF (Max 5MB)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              hidden
              onChange={(e) => pickSlip(e.target.files?.[0])}
            />
          </button>

          <p className="pay__verify-note">
            <Icon name="clock" size={16} />
            Our team will verify your payment within 24 hours. You will receive a
            confirmation email once verified.
          </p>
        </section>
      </div>

      {error && (
        <p className="pay__error" role="alert">
          <Icon name="help" size={16} />
          {error}
        </p>
      )}

      <button
        className="btn btn-primary pay__confirm"
        onClick={() => void confirm()}
        disabled={blockedReason !== '' || placing}
        title={blockedReason || undefined}
      >
        <Icon name="check" size={18} />
        Confirm Payment
      </button>

      {blockedReason && <p className="pay__hint">{blockedReason}</p>}

      <div className="pay__footer">
        <button className="pay__help">
          <Icon name="help" size={16} />
          Need help?
        </button>
        <span className="pay__secure">
          <Icon name="shield" size={16} />
          Secure Transaction
        </span>
      </div>
    </div>
  )
}
