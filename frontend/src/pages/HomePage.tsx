import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookCard from '../components/BookCard'
import Icon from '../components/Icon'
import { books, CATEGORIES, type Category } from '../data/books'
import './HomePage.css'

const PAGE_SIZE = 12

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  // ค้นแบบ case-insensitive contains บน title/author — เลียนแบบ Book.search() ของวุฒิภัทร
  // (storefront Book ไม่มี isbn จึงตัด isbn ออก)
  const term = query.trim().toLowerCase()

  const [category, setCategory] = useState<Category>('All Books')
  const [visible, setVisible] = useState(PAGE_SIZE)

  // คำค้น/หมวดหมู่เปลี่ยน → รีเซ็ตจำนวนที่โชว์ระหว่าง render (รองรับทั้งช่องหน้านี้และช่องใน TopNav)
  // ตามแนวทาง React "You Might Not Need an Effect"
  const filterKey = `${category}|${term}`
  const [shownKey, setShownKey] = useState(filterKey)
  if (filterKey !== shownKey) {
    setShownKey(filterKey)
    setVisible(PAGE_SIZE)
  }

  const filtered = useMemo(
    () =>
      books.filter(
        (b) =>
          (category === 'All Books' || b.category === category) &&
          (term === '' ||
            b.title.toLowerCase().includes(term) ||
            b.author.toLowerCase().includes(term)),
      ),
    [category, term],
  )

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  const onSearch = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <div className="home page-shell">
      <section className="home__chips">
        <label className="home__search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ค้นหาชื่อหนังสือหรือผู้แต่ง..."
            aria-label="ค้นหาหนังสือ"
          />
        </label>

        <h2 className="home__chips-title">เลือกตามหมวดหมู่</h2>
        <div className="home__chip-row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={'chip' + (c === category ? ' chip--active' : '')}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="home__catalog">
        {term !== '' && (
          <h3 className="home__result-title">
            ผลการค้นหา "{query.trim()}" ({filtered.length})
          </h3>
        )}

        <div className="home__grid">
          {shown.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="home__empty">
            {term !== ''
              ? `ไม่พบหนังสือที่ตรงกับ "${query.trim()}"`
              : 'No books in this category yet.'}
          </p>
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
