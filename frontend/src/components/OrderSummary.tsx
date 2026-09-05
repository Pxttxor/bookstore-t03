import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon from './Icon'
import BookCover from './BookCover'
import { formatPrice } from '../data/money'
import { useCart } from '../cart/CartContext'
import type { Promotion } from '../admin/promotions/promotions'
import { fetchActivePromotions, findBestPromotion } from '../services/promotionService'
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
  const { lines, subtotal, setQty, removeItem } = useCart()
  const [promotions, setPromotions] = useState<Promotion[]>([])

  useEffect(() => {
    let unmounted = false
    fetchActivePromotions().then((list) => {
      if (!unmounted) setPromotions(list)
    })
    return () => {
      unmounted = true
    }
  }, [])

  const totalQty = useMemo(() => lines.reduce((sum, line) => sum + line.qty, 0), [lines])
  const { promotion: bestPromo, discount } = useMemo(
    () => findBestPromotion(promotions, subtotal, totalQty),
    [promotions, subtotal, totalQty],
  )
  const total = Math.max(0, subtotal - discount) + shipping

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
                <div className="summary__controls">
                  <div className="summary__stepper">
                    <button
                      type="button"
                      className="summary__step-btn"
                      aria-label="ลดจำนวน"
                      disabled={qty <= 1}
                      onClick={() => setQty(book.bookId, qty - 1)}
                    >
                      <Icon name="minus" size={12} />
                    </button>
                    <span className="summary__step-qty">{qty}</span>
                    <button
                      type="button"
                      className="summary__step-btn"
                      aria-label="เพิ่มจำนวน"
                      disabled={qty >= book.quantityOnHand}
                      title={qty >= book.quantityOnHand ? 'สินค้าในสต็อกมีเท่านี้แล้ว' : undefined}
                      onClick={() => setQty(book.bookId, qty + 1)}
                    >
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="summary__remove-btn"
                    aria-label={`ลบ ${book.title} ออกจากตะกร้า`}
                    title="ลบออกจากตะกร้า"
                    onClick={() => removeItem(book.bookId)}
                  >
                    <Icon name="trash" size={14} />
                    <span>ลบ</span>
                  </button>
                </div>
              </div>
              <span className="summary__price">
                {formatPrice(book.price * qty)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {bestPromo && discount > 0 && (
        <div className="summary__promo-badge">
          <Icon name="tag" size={14} />
          <span>ใช้โปรโมชั่นอัตโนมัติ: <strong>{bestPromo.name}</strong></span>
        </div>
      )}

      <div className="summary__totals">
        <div className="summary__row">
          <span>รวมค่าสินค้า</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {bestPromo && discount > 0 && (
          <div className="summary__row summary__row--discount">
            <span>ส่วนลด ({bestPromo.name})</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
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
