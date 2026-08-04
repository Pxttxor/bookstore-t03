import type { ReactNode } from 'react'
import { formatPrice } from '../data/books'
import { useCart } from '../cart/CartContext'
import './OrderSummary.css'

interface OrderSummaryProps {
  title?: string
  footer?: ReactNode
  shipping?: number
}

export default function OrderSummary({
  title = 'Order Summary',
  footer,
  shipping = 0,
}: OrderSummaryProps) {
  const { lines, subtotal } = useCart()
  const total = subtotal + shipping

  return (
    <aside className="summary">
      <h2 className="summary__title">{title}</h2>

      {lines.length === 0 ? (
        <p className="summary__empty">ตะกร้าของคุณยังว่างอยู่</p>
      ) : (
        <ul className="summary__list">
          {lines.map(({ book, qty }) => (
            <li key={book.id} className="summary__item">
              <div className="summary__thumb">
                <img src={book.cover} alt={book.title} />
                {qty > 1 && <span className="summary__qty">{qty}</span>}
              </div>
              <div className="summary__info">
                <span className="summary__name">{book.title}</span>
                <span className="summary__author">{book.author}</span>
              </div>
              <span className="summary__price">
                {formatPrice(book.price * qty)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="summary__totals">
        <div className="summary__row">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="summary__row">
          <span>Shipping</span>
          <span className={shipping === 0 ? 'summary__free' : undefined}>
            {shipping === 0 ? 'FREE' : formatPrice(shipping)}
          </span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {footer && <div className="summary__footer">{footer}</div>}
    </aside>
  )
}
