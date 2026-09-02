import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import QuantityStepper from '../components/QuantityStepper'
import { getBook, formatPrice, type Review } from '../data/books'
import { useCart } from '../cart/CartContext'
import './BookDetailPage.css'

export default function BookDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const book = getBook(id)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  if (!book) {
    return (
      <div className="detail page-shell detail--missing">
        <p>Book not found.</p>
        <Link to="/" className="btn btn-outline">
          Back to catalog
        </Link>
      </div>
    )
  }

  const reviews: Review[] = book.reviews ?? []
  const synopsis = book.synopsis ?? [
    'A curated pick from the BookHaven shelves — a story readers keep coming back to.',
  ]

  const addToCart = () => {
    addItem(book, qty)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }
  const buyNow = () => {
    addItem(book, qty)
    navigate('/checkout/shipping')
  }

  return (
    <div className="detail page-shell">
      <div className="detail__bento">
        <div className="detail__cover-cell">
          <div className="detail__cover">
            <img src={book.cover} alt={book.title} decoding="async" />
          </div>
          <div className="detail__quick-meta">
            <div className="detail__meta-box">
              <span className="detail__meta-value">
                {book.rating.toFixed(1)}/5
              </span>
              <span className="detail__meta-label">คะแนน</span>
            </div>
            <div className="detail__meta-box">
              <span className="detail__meta-value">{book.language ?? 'ENG'}</span>
              <span className="detail__meta-label">ภาษา</span>
            </div>
          </div>
        </div>

        <div className="detail__content">
          <div>
            <h1 className="detail__title">{book.title}</h1>
            <p className="detail__author">{book.author}</p>
          </div>

          <div className="detail__purchase">
            <div className="detail__price">{formatPrice(book.price)}</div>
            <div className="detail__divider" />
            <div className="detail__buy">
              <p className="detail__stock">
                <Icon name="check-circle" size={18} />
                เหลือ {book.stock ?? 24} เล่ม
              </p>
              <div className="detail__qty-row">
                <span>จำนวน:</span>
                <QuantityStepper value={qty} onChange={setQty} />
              </div>
              <div className="detail__buttons">
                <button className="btn btn-primary detail__add" onClick={addToCart}>
                  <Icon name="cart" size={18} />
                  {added ? 'เพิ่มแล้ว ✓' : 'เพิ่มลงในตะกร้า'}
                </button>
                <button className="btn btn-outline detail__buynow" onClick={buyNow}>
                  ซื้อ
                </button>
              </div>
            </div>
          </div>

          <div className="detail__synopsis">
            <h3>คำอธิบาย</h3>
            {synopsis.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </div>

      <section className="detail__reviews">
        <div className="detail__reviews-head">
          <h3>รีวิว</h3>
          <button
            className="detail__write"
            disabled
            title="รีวิวเป็นส่วนของระบบสมาชิก (อยู่นอกขอบเขตต้นแบบนี้)"
          >
            เขียนรีวิว
            <Icon name="edit" size={16} />
          </button>
        </div>

        {reviews.length === 0 ? (
          <p className="detail__no-reviews">ยังไม่มีรีวิวสำหรับเล่มนี้</p>
        ) : (
          <div className="detail__review-list">
            {reviews.map((r, i) => (
              <article key={i} className="review-card">
                <header className="review-card__head">
                  <span className="review-card__avatar">{r.initials}</span>
                  <div className="review-card__who">
                    <strong>{r.name}</strong>
                    <span>{r.meta}</span>
                  </div>
                  <RatingStars value={r.rating} size={16} />
                </header>
                <p className="review-card__text">{r.text}</p>
                <footer className="review-card__actions">
                  <button>
                    <Icon name="thumbs-up" size={16} />
                    {r.helpful}
                  </button>
                  <button>
                    <Icon name="message" size={16} />
                    Reply
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}

        {book.ratingCount ? (
          <button className="detail__all-reviews">
            ดูรีวิวทั้งหมด ({book.ratingCount})
          </button>
        ) : null}
      </section>
    </div>
  )
}
