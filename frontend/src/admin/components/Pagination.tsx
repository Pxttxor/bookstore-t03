import Icon from '../../components/Icon'
import './Pagination.css'

interface PaginationProps {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

const PAGE_SIZES = [10, 20, 50]

// A list this long (SO-1001..SO-1418 style datasets run past 40 pages) rendered every
// page number in a row and blew the `.pagination` container far past the card's edge.
// Windowing to the current page's neighbours plus the first/last page keeps the strip
// inside its frame regardless of how many pages exist.
const PAGE_WINDOW = 1

function pageList(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const start = Math.max(2, page - PAGE_WINDOW)
  const end = Math.min(pageCount - 1, page + PAGE_WINDOW)
  const pages: (number | 'ellipsis')[] = [1]
  if (start > 2) pages.push('ellipsis')
  for (let n = start; n <= end; n++) pages.push(n)
  if (end < pageCount - 1) pages.push('ellipsis')
  pages.push(pageCount)
  return pages
}

export default function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="pagination">
      <span className="pagination__count">
        แสดง {first}-{last} จาก {total} รายการ
      </span>

      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__step"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="หน้าก่อนหน้า"
        >
          <Icon name="chevron-left" size={18} />
        </button>

        {pageList(page, pageCount).map((n, index) =>
          n === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="pagination__ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={'pagination__page' + (n === page ? ' pagination__page--active' : '')}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}

        <button
          type="button"
          className="pagination__step"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="หน้าถัดไป"
        >
          <Icon name="chevron-right" size={18} />
        </button>

        <label className="pagination__size">
          แสดง
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
