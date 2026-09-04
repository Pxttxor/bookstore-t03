import type { ReactNode } from 'react'
import BookCover from './BookCover'
import { formatPrice } from '../data/money'
import { useCart } from '../cart/CartContext'
import './OrderSummary.css'

interface OrderSummaryProps {
  title?: string
  footer?: ReactNode
  shipping?: number
}

export default function OrderSummary({
  title = 'สรุปคำสั่งซื้อ',
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
            <li key={book.bookId} className="summary__item">
              <div className="summary__thumb">
                <BookCover
                  bookId={book.bookId}
                  title={book.title}
                  author={book.author}
                  size="sm"
                />
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
          <span>รวมค่าสินค้า</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="summary__row">
          <span>ค่าจัดส่ง</span>
          <span className={shipping === 0 ? 'summary__free' : undefined}>
            {shipping === 0 ? 'ส่งฟรี' : formatPrice(shipping)}
          </span>
        </div>
        <div className="summary__row summary__row--total">
          <span>ยอดชำระทั้งสิ้น</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {footer && <div className="summary__footer">{footer}</div>}
    </aside>
  )
}
