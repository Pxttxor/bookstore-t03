import { Link } from 'react-router-dom'
import Icon from './Icon'
import { formatPrice, type Book } from '../data/books'
import { useCart } from '../cart/CartContext'
import './BookCard.css'

export default function BookCard({ book }: { book: Book }) {
  const { addItem } = useCart()

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(book, 1)
  }

  return (
    <Link to={`/book/${book.id}`} className="book-card">
      <div className="book-card__cover">
        <img src={book.cover} alt={book.title} loading="lazy" />
        <button
          type="button"
          className="book-card__add"
          onClick={handleAdd}
          aria-label={`Add ${book.title} to cart`}
        >
          <Icon name="plus" size={20} />
        </button>
      </div>
      <h3 className="book-card__title">{book.title}</h3>
      <p className="book-card__author">{book.author}</p>
      <div className="book-card__meta">
        <span className="book-card__price">{formatPrice(book.price)}</span>
        <span className="book-card__rating">
          <Icon name="star" size={14} filled />
          {book.rating.toFixed(1)}
        </span>
      </div>
    </Link>
  )
}
