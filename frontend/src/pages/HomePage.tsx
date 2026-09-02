import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookCard from '../components/BookCard'
import { books, CATEGORIES, type Category } from '../data/books'
import './HomePage.css'

const PAGE_SIZE = 12

export default function HomePage() {
  const [params] = useSearchParams()
  // ค้นแบบ case-insensitive contains บน title/author — เลียนแบบ Book.search() ของวุฒิภัทร
  // (storefront Book ไม่มี isbn จึงตัด isbn ออก) · ช่องค้นหาอยู่บน TopNav ส่งค่ามาทาง ?q=
  const query = params.get('q') ?? ''
  const term = query.trim().toLowerCase()

  const [category, setCategory] = useState<Category>('All Books')

  // "Load More" remembers which filter it was counting for, so changing the category or
  // the search term resets the page back to PAGE_SIZE by derivation — the คำค้นมาจาก URL
  // จึงเปลี่ยนได้โดยหน้านี้ไม่ได้เป็นคนสั่ง case that React's "You Might Not Need an
  // Effect" covers. Deriving beats both an effect and a render-phase setState here.
  const filterKey = `${category}|${term}`
  const [page, setPage] = useState({ key: filterKey, size: PAGE_SIZE })
  const visible = page.key === filterKey ? page.size : PAGE_SIZE

  // The needle is normalised again inside the memo rather than reusing `term` as a
  // dependency: `term` descends from the URLSearchParams object, which the React Compiler
  // lint cannot prove stable, and depending on it makes it skip this component entirely
  // (react-hooks/preserve-manual-memoization). Depending on the raw `query` string is
  // equivalent and keeps the memo.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return books.filter(
      (b) =>
        (category === 'All Books' || b.category === category) &&
        (needle === '' ||
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle)),
    )
  }, [category, query])

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  return (
    <div className="home page-shell">
      <section className="home__chips">
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
              onClick={() => setPage({ key: filterKey, size: visible + PAGE_SIZE })}
            >
              Load More
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
