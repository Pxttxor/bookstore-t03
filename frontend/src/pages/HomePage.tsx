import { useMemo, useState } from 'react'
import BookCard from '../components/BookCard'
import { books, CATEGORIES, type Category } from '../data/books'
import './HomePage.css'

const PAGE_SIZE = 12

export default function HomePage() {
  const [category, setCategory] = useState<Category>('All Books')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(
    () =>
      category === 'All Books'
        ? books
        : books.filter((b) => b.category === category),
    [category],
  )

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  const pickCategory = (c: Category) => {
    setCategory(c)
    setVisible(PAGE_SIZE)
  }

  return (
    <div className="home page-shell">
      <section className="home__chips">
        <h2 className="home__chips-title">เลือกตามหมวดหมู่</h2>
        <div className="home__chip-row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={'chip' + (c === category ? ' chip--active' : '')}
              onClick={() => pickCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="home__catalog">
        <div className="home__grid">
          {shown.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="home__empty">No books in this category yet.</p>
        )}

        {hasMore && (
          <div className="home__load-more">
            <button
              className="btn btn-ghost"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Load More
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
