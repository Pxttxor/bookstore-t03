import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BookCard from '../components/BookCard'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import { useCatalogue } from '../catalogue/CatalogueContext'
import { matchesSearch } from '../data/catalogue'
import './HomePage.css'

const PAGE_SIZE = 12

// 0 = "ทั้งหมด" — หมวดหมู่จริงในตาราง category เริ่มที่ 1 จึงใช้ 0 เป็นค่าไม่กรองได้
const ALL_CATEGORIES = 0

export default function HomePage() {
  const [params] = useSearchParams()
  // ช่องค้นหาอยู่บน TopNav ส่งค่ามาทาง ?q= · ค้นแบบเดียวกับ Book.search()
  // (ชื่อเรื่อง / ผู้แต่ง / ISBN แบบไม่สนตัวพิมพ์)
  const query = params.get('q') ?? ''
  const term = query.trim().toLowerCase()

  const { books, categories, loading, error, reload } = useCatalogue()
  const [categoryId, setCategoryId] = useState<number>(ALL_CATEGORIES)

  // "Load More" remembers which filter it was counting for, so changing the category or
  // the search term resets the page back to PAGE_SIZE by derivation — the คำค้นมาจาก URL
  // จึงเปลี่ยนได้โดยหน้านี้ไม่ได้เป็นคนสั่ง case that React's "You Might Not Need an
  // Effect" covers. Deriving beats both an effect and a render-phase setState here.
  const filterKey = `${categoryId}|${term}`
  const [page, setPage] = useState({ key: filterKey, size: PAGE_SIZE })
  const visible = page.key === filterKey ? page.size : PAGE_SIZE

  // The needle is normalised again inside the memo rather than reusing `term` as a
  // dependency: `term` descends from the URLSearchParams object, which the React Compiler
  // lint cannot prove stable, and depending on it makes it skip this component entirely
  // (react-hooks/preserve-manual-memoization). Depending on the raw `query` string is
  // equivalent and keeps the memo.
  const filtered = useMemo(() => {
    return books.filter(
      (b) =>
        (categoryId === ALL_CATEGORIES || b.categoryId === categoryId) &&
        matchesSearch(b, query),
    )
  }, [books, categoryId, query])

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  // ลำดับ loading → error → ว่าง ตามกติกาใน frontend/CLAUDE.md
  if (loading) return <LoadingState label="กำลังโหลดรายการหนังสือ…" />
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />

  return (
    <div className="home page-shell">
      <section className="home__chips">
        <h2 className="home__chips-title">เลือกตามหมวดหมู่</h2>
        <div className="home__chip-row">
          <button
            className={'chip' + (categoryId === ALL_CATEGORIES ? ' chip--active' : '')}
            onClick={() => setCategoryId(ALL_CATEGORIES)}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.categoryId}
              className={'chip' + (c.categoryId === categoryId ? ' chip--active' : '')}
              onClick={() => setCategoryId(c.categoryId)}
            >
              {c.name}
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
            <BookCard key={book.bookId} book={book} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="home__empty">
            {term !== ''
              ? `ไม่พบหนังสือที่ตรงกับ "${query.trim()}"`
              : 'ยังไม่มีหนังสือในหมวดหมู่นี้'}
          </p>
        )}

        {hasMore && (
          <div className="home__load-more">
            <button
              className="btn btn-ghost"
              onClick={() => setPage({ key: filterKey, size: visible + PAGE_SIZE })}
            >
              ดูเพิ่มเติม
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
