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

        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={'pagination__page' + (n === page ? ' pagination__page--active' : '')}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}

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
