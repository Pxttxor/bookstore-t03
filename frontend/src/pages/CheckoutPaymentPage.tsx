import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { formatPrice } from '../data/books'
import { useCart } from '../cart/CartContext'
import { useAuth } from '../auth/AuthContext'
import { useOrders } from '../admin/orders/OrderContext'
import './CheckoutPaymentPage.css'

interface ShippingState {
  customerName?: string
  mobile?: string
  shippingAddress?: string
}

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
  const { user } = useAuth()
  const { placeOrder } = useOrders()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('')

  const amount = subtotal

  const confirm = () => {
    const shipping = (state ?? {}) as ShippingState
    const order = placeOrder({
      customerName: shipping.customerName?.trim() || user?.name || 'ลูกค้าออนไลน์',
      customerEmail: user?.email,
      shippingAddress: shipping.shippingAddress?.trim() || '—',
      items: lines.map((line) => ({
        bookId: line.book.id,
        title: line.book.title,
        unitPrice: line.book.price,
        quantity: line.qty,
      })),
      subtotal,
      netAmount: subtotal,
      slipFileName: fileName || undefined,
    })
    clear()
    navigate(`/order/${order.orderId}`)
  }

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
            <strong>{lines.length ? formatPrice(amount) : '$0.00'}</strong>
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
              {fileName ? (
                fileName
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
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            />
          </button>

          <p className="pay__verify-note">
            <Icon name="clock" size={16} />
            Our team will verify your payment within 24 hours. You will receive a
            confirmation email once verified.
          </p>
        </section>
      </div>

      <button
        className="btn btn-primary pay__confirm"
        onClick={confirm}
        disabled={lines.length === 0}
      >
        <Icon name="check" size={18} />
        Confirm Payment
      </button>

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
