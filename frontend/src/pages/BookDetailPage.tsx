import { useCallback, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import QuantityStepper from '../components/QuantityStepper'
import BookCover from '../components/BookCover'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import { useResource } from '../api/useResource'
import { loadCatalogueBook, type CatalogueDetail, type CatalogueReview } from '../data/catalogue'
import { formatPrice } from '../data/money'
import { useCart } from '../cart/CartContext'
import './BookDetailPage.css'

// initialsOf — อักษรย่อบนการ์ดรีวิว · ตาราง review เก็บแต่ชื่อเต็มของลูกค้า
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[1][0]
}

export default function BookDetailPage() {
  const { bookId } = useParams()
  const id = Number(bookId)

  // `load` ต้องมีอ้างอิงคงที่ ไม่งั้น useResource จะยิงซ้ำทุก render
  const load = useCallback(() => loadCatalogueBook(id), [id])
  const { data: book, loading, error, reload } = useResource(load, Number.isFinite(id))

  if (loading) return <LoadingState label="กำลังโหลดข้อมูลหนังสือ…" />
  if (error) {
    return (
      <div className="detail page-shell">
        <ErrorState message={error} onRetry={() => void reload()} />
        <p className="detail__back">
          <Link to="/" className="btn btn-outline">
            กลับไปหน้ารายการหนังสือ
          </Link>
        </p>
      </div>
    )
  }
  if (!book) {
    return (
      <div className="detail page-shell detail--missing">
        <p>ไม่พบหนังสือเล่มนี้</p>
        <Link to="/" className="btn btn-outline">
          กลับไปหน้ารายการหนังสือ
        </Link>
      </div>
    )
  }

  return <BookDetailView book={book} />
}

// แยกเป็นคอมโพเนนต์ของตัวเองเพราะ `qty` ตั้งค่าเริ่มต้นจากข้อมูลที่โหลดมา —
// hook ทำงานก่อน early return เสมอ ถ้าเขียนรวมไว้ข้างบน ค่าตั้งต้นจะจับ undefined
// (แพตเทิร์นเดียวกับ BookFormPage / ReceiveGoodsPage ของหลังร้าน)
function BookDetailView({ book }: { book: CatalogueDetail }) {
  const navigate = useNavigate()
  const { addItem, qtyInCart } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const reviews: CatalogueReview[] = book.reviews
  const soldOut = book.quantityOnHand === 0
  const remaining = book.quantityOnHand - qtyInCart(book.bookId)

  // เพดานของตัวนับคือ "ยอดที่ยังหยิบได้" ไม่ใช่ 99 ที่เป็นค่าปริยายของ QuantityStepper —
  // ไม่งั้นผู้ใช้กดเป็น 10 ทั้งที่เหลือ 3 แล้ว addItem จะตัดให้เหลือ 3 เงียบ ๆ
  // พร้อมขึ้น "เพิ่มแล้ว ✓" เหมือนได้ครบ · หนีบค่าตอนอ่านแทน useEffect เพราะ
  // remaining หดลงทุกครั้งที่หยิบใส่ตะกร้า และค่าที่แสดงต้องหดตามในเรนเดอร์เดียวกัน
  const maxQty = Math.max(1, remaining)
  const safeQty = Math.min(qty, maxQty)

  const addToCart = () => {
    if (addItem(book, safeQty) === 0) return
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }
  const buyNow = () => {
    if (addItem(book, safeQty) === 0) return
    navigate('/checkout/shipping')
  }

  const blocked = soldOut
    ? 'สินค้าหมด'
    : remaining <= 0
      ? 'หยิบครบจำนวนที่มีอยู่แล้ว'
      : ''

  return (
    <div className="detail page-shell">
      <div className="detail__bento">
        <div className="detail__cover-cell">
          <div className="detail__cover">
            <BookCover bookId={book.bookId} title={book.title} author={book.author} />
          </div>
          <div className="detail__quick-meta">
            <div className="detail__meta-box">
              <span className="detail__meta-value">
                {book.ratingCount > 0 ? `${book.ratingAverage.toFixed(1)}/5` : '—'}
              </span>
              <span className="detail__meta-label">คะแนน</span>
            </div>
            <div className="detail__meta-box">
              <span className="detail__meta-value">{book.categoryName}</span>
              <span className="detail__meta-label">หมวดหมู่</span>
            </div>
          </div>
        </div>

        <div className="detail__content">
          <div>
            <h1 className="detail__title">{book.title}</h1>
            <p className="detail__author">{book.author}</p>
            <p className="detail__publisher">
              {book.publisher} · ISBN {book.isbn}
            </p>
          </div>

          <div className="detail__purchase">
            <div className="detail__price">{formatPrice(book.price)}</div>
            <div className="detail__divider" />
            <div className="detail__buy">
              <p className={'detail__stock' + (soldOut ? ' detail__stock--out' : '')}>
                <Icon name={soldOut ? 'alert-triangle' : 'check-circle'} size={18} />
                {soldOut ? 'สินค้าหมด' : `เหลือ ${book.quantityOnHand} เล่ม`}
              </p>
              <div className="detail__qty-row">
                <span>จำนวน:</span>
                <QuantityStepper value={safeQty} onChange={setQty} max={maxQty} />
              </div>
              <div className="detail__buttons">
                <button
                  className="btn btn-primary detail__add"
                  onClick={addToCart}
                  disabled={blocked !== ''}
                  title={blocked || undefined}
                >
                  <Icon name="cart" size={18} />
                  {added ? 'เพิ่มแล้ว ✓' : 'เพิ่มลงในตะกร้า'}
                </button>
                <button
                  className="btn btn-outline detail__buynow"
                  onClick={buyNow}
                  disabled={blocked !== ''}
                  title={blocked || undefined}
                >
                  ซื้อ
                </button>
              </div>
              {/* ปุ่มที่ disabled ไม่โชว์ title ในเบราว์เซอร์ส่วนใหญ่ ต้องมีข้อความบนหน้าจอด้วย */}
              {blocked && <p className="detail__blocked">{blocked}</p>}
            </div>
          </div>

          <div className="detail__synopsis">
            <h3>คำอธิบาย</h3>
            <p>{book.description || 'ยังไม่มีคำอธิบายสำหรับหนังสือเล่มนี้'}</p>
          </div>
        </div>
      </div>

      <section className="detail__reviews">
        <div className="detail__reviews-head">
          <h3>รีวิว {book.ratingCount > 0 && `(${book.ratingCount})`}</h3>
          <button
            className="detail__write"
            disabled
            title="เขียนรีวิวได้จากหน้าติดตามคำสั่งซื้อที่จัดส่งถึงแล้ว"
          >
            เขียนรีวิว
            <Icon name="edit" size={16} />
          </button>
        </div>

        {reviews.length === 0 ? (
          <p className="detail__no-reviews">ยังไม่มีรีวิวสำหรับเล่มนี้</p>
        ) : (
          <div className="detail__review-list">
            {reviews.map((r) => (
              <article key={r.reviewId} className="review-card">
                <header className="review-card__head">
                  <span className="review-card__avatar">{initialsOf(r.customerName)}</span>
                  <div className="review-card__who">
                    <strong>{r.customerName}</strong>
                    <span>
                      {r.verifiedPurchase && 'ซื้อสินค้าจริง · '}
                      {r.createdDate.slice(0, 10)}
                    </span>
                  </div>
                  <RatingStars value={r.rating} size={16} />
                </header>
                {r.headline && <p className="review-card__headline">{r.headline}</p>}
                <p className="review-card__text">{r.comment}</p>
                {r.replies.map((reply) => (
                  <div key={reply.replyId} className="review-card__reply">
                    <strong>ตอบกลับจาก {reply.repliedBy}</strong>
                    <p>{reply.replyText}</p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
