import { Link } from 'react-router-dom'
import Icon from './Icon'
import BookCover from './BookCover'
import { formatPrice } from '../data/money'
import type { CatalogueBook } from '../data/catalogue'
import { useCart } from '../cart/CartContext'
import './BookCard.css'

export default function BookCard({ book }: { book: CatalogueBook }) {
  const { addItem, qtyInCart } = useCart()

  // ของหมด หรือหยิบครบยอดคงเหลือไปแล้ว — ปุ่มเพิ่มต้องกดไม่ได้
  const soldOut = book.quantityOnHand === 0
  const full = qtyInCart(book.bookId) >= book.quantityOnHand

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(book, 1)
  }

  return (
    <Link to={`/book/${book.bookId}`} className="book-card">
      <div className="book-card__cover">
        <BookCover bookId={book.bookId} title={book.title} author={book.author} size="sm" />
        {soldOut && <span className="book-card__soldout">สินค้าหมด</span>}
        <button
          type="button"
          className="book-card__add"
          onClick={handleAdd}
          disabled={soldOut || full}
          title={soldOut ? 'สินค้าหมด' : full ? 'หยิบครบจำนวนที่มีอยู่แล้ว' : undefined}
          aria-label={`เพิ่ม ${book.title} ลงในตะกร้า`}
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
      <h3 className="book-card__title">{book.title}</h3>
      <p className="book-card__author">{book.author}</p>
      <div className="book-card__meta">
        <span className="book-card__price">{formatPrice(book.price)}</span>
        {book.ratingCount > 0 ? (
          <span className="book-card__rating">
            <Icon name="star" size={14} filled />
            {book.ratingAverage.toFixed(1)}
          </span>
        ) : (
          // เล่มที่ยังไม่มีรีวิวไม่โชว์ดาว — เดิมขึ้นคะแนนปลอมให้ทุกเล่ม
          <span className="book-card__rating book-card__rating--none">ยังไม่มีรีวิว</span>
        )}
      </div>
    </Link>
  )
}
