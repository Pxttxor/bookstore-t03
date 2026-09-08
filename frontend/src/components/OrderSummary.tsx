import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon from './Icon'
import BookCover from './BookCover'
import { formatPrice } from '../data/money'
import { useCart } from '../cart/CartContext'
import { useToast } from '../admin/components/ToastContext'
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
  const {
    lines,
    subtotal,
    setQty,
    removeItem,
    appliedDiscount,
    discountError,
    applyDiscount,
    removeDiscount,
    setDiscountError,
    setDiscountSuccess,
  } = useCart()
  const toast = useToast()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [checkingCoupon, setCheckingCoupon] = useState(false)

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

  const rewardDiscount = appliedDiscount ? appliedDiscount.discountAmount : 0
  const totalDiscount = Math.min(subtotal, discount + rewardDiscount)
  const total = Math.max(0, subtotal - totalDiscount) + shipping

  const handleApplyCoupon = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const code = couponInput.trim()
    if (!code || checkingCoupon) return
    setCheckingCoupon(true)
    try {
      const res = await applyDiscount(code)
      setCouponInput('')
      toast.notify(
        'success',
        `ใช้โค้ดส่วนลด "${res.code}" สำเร็จ! ได้รับส่วนลด ${formatPrice(res.discountAmount)} (ใช้ร่วมกับโปรโมชั่นได้)`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถใช้โค้ดส่วนลดนี้ได้'
      toast.notify('error', `ไม่สามารถใช้โค้ดได้: ${msg}`)
    } finally {
      setCheckingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    const code = appliedDiscount?.code
    removeDiscount()
    setCouponInput('')
    if (code) {
      toast.notify('info', `ยกเลิกการใช้โค้ดส่วนลด "${code}" เรียบร้อยแล้ว`)
    }
  }

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

      {lines.length > 0 && (
        <div className="summary__coupon">
          <div className="summary__coupon-header">
            <span className="summary__coupon-label">
              <Icon name="tag" size={14} />
              โค้ดส่วนลดจากการแลกแต้ม
            </span>
            <span className="summary__coupon-hint">(ใช้ร่วมกับโปรโมชั่นได้)</span>
          </div>

          {appliedDiscount ? (
            <div className="summary__coupon-applied">
              <div className="summary__coupon-applied-info">
                <span className="summary__coupon-code">{appliedDiscount.code}</span>
                <span className="summary__coupon-name">{appliedDiscount.rewardName}</span>
                <span className="summary__coupon-val">(-{formatPrice(appliedDiscount.discountAmount)})</span>
              </div>
              <button
                type="button"
                className="summary__coupon-remove-btn"
                onClick={handleRemoveCoupon}
                title="ยกเลิกการใช้โค้ด"
                aria-label="ยกเลิกการใช้โค้ดส่วนลด"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ) : (
            <div className="summary__coupon-form">
              <input
                type="text"
                className={`summary__coupon-input ${discountError ? 'summary__coupon-input--error' : ''}`}
                placeholder="กรอกโค้ด เช่น RWD00001"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value)
                  if (discountError) setDiscountError(null)
                  setDiscountSuccess(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleApplyCoupon(e)
                  }
                }}
                disabled={checkingCoupon}
              />
              <button
                type="button"
                className="summary__coupon-btn"
                disabled={!couponInput.trim() || checkingCoupon}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void handleApplyCoupon(e)
                }}
              >
                {checkingCoupon ? 'กำลังตรวจ...' : 'ใช้โค้ด'}
              </button>
            </div>
          )}

          {appliedDiscount && (
            <div className="summary__coupon-feedback summary__coupon-feedback--success" role="status">
              <Icon name="check-circle" size={14} />
              <span>ใช้โค้ดสำเร็จ! ได้รับส่วนลด {formatPrice(appliedDiscount.discountAmount)} (ใช้ร่วมกับโปรโมชั่นได้)</span>
            </div>
          )}

          {discountError && !appliedDiscount && (
            <div className="summary__coupon-feedback summary__coupon-feedback--error" role="alert">
              <Icon name="alert-triangle" size={14} />
              <span>{discountError}</span>
            </div>
          )}
        </div>
      )}

      <div className="summary__totals">
        <div className="summary__row">
          <span>รวมค่าสินค้า</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {bestPromo && discount > 0 && (
          <div className="summary__row summary__row--discount">
            <span>ส่วนลดโปรโมชั่น ({bestPromo.name})</span>
            <span>-{formatPrice(discount)}</span>
          </div>
        )}
        {appliedDiscount && rewardDiscount > 0 && (
          <div className="summary__row summary__row--discount">
            <span>ส่วนลดโค้ดรางวัล ({appliedDiscount.code})</span>
            <span>-{formatPrice(rewardDiscount)}</span>
          </div>
        )}
        {bestPromo && discount > 0 && appliedDiscount && rewardDiscount > 0 && (
          <div className="summary__row summary__row--stack-note">
            <Icon name="check-circle" size={13} />
            <span>ใช้ร่วมกันได้: รวมประหยัด {formatPrice(totalDiscount)}</span>
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
