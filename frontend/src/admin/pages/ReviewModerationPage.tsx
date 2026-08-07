import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import RatingStars from '../../components/RatingStars'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { useReviews } from '../reviews/ReviewContext'
import {
  formatReviewCode,
  MODERATE_ACTION_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_TONES,
  type ModerateAction,
  type Review,
  type ReviewStatus,
} from '../reviews/reviews'
import ReviewDetailModal from './ReviewDetailModal'
import '../components/DataTable.css'
import './ReviewModerationPage.css'

type StatusFilter = ReviewStatus | 'ALL'

export default function ReviewModerationPage() {
  const { user } = useAuth()
  const { reviews, pendingCount, moderate, reply } = useReviews()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [openId, setOpenId] = useState<number | null>(null)

  const role = user!.role
  const mayModerate = can.moderateReview(role)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return reviews.filter((review) => {
      if (status !== 'ALL' && review.status !== status) return false
      if (!needle) return true
      return (
        review.bookTitle.toLowerCase().includes(needle) ||
        review.customerName.toLowerCase().includes(needle) ||
        review.comment.toLowerCase().includes(needle) ||
        formatReviewCode(review.reviewId).toLowerCase().includes(needle)
      )
    })
  }, [reviews, term, status])

  if (!mayModerate) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ตรวจสอบรีวิว"
            description="การตรวจสอบและจัดการรีวิวเป็นสิทธิ์ของพนักงานฝ่ายขายและผู้จัดการร้าน"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isFiltered = term.trim() !== '' || status !== 'ALL'

  const clearFilters = () => {
    setTerm('')
    setStatus('ALL')
    setPage(1)
  }

  const open = openId !== null ? reviews.find((r) => r.reviewId === openId) : undefined

  const handleModerate = (review: Review, action: ModerateAction) => {
    moderate(review.reviewId, action)
    notify('success', `${MODERATE_ACTION_LABELS[action]}รีวิวของ ${review.customerName} แล้ว`)
    setOpenId(null)
  }

  const handleReply = (review: Review, text: string) => {
    reply(review.reviewId, { replyText: text, repliedBy: user!.name })
    notify('success', `บันทึกคำตอบกลับถึง ${review.customerName} แล้ว`)
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'รีวิวลูกค้า' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ตรวจสอบรีวิวลูกค้า</h1>
          <p className="admin-page__subtitle">
            รีวิวทั้งหมด {reviews.length} รายการ · รอตรวจสอบ {pendingCount} รายการ
          </p>
        </div>
      </div>

      <section className="admin-card review-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาชื่อหนังสือ ลูกค้า ข้อความ หรือรหัส"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="filter-bar__select">
            <span>สถานะ</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="PENDING">{REVIEW_STATUS_LABELS.PENDING}</option>
              <option value="PUBLISHED">{REVIEW_STATUS_LABELS.PUBLISHED}</option>
              <option value="HIDDEN">{REVIEW_STATUS_LABELS.HIDDEN}</option>
              <option value="REMOVED">{REVIEW_STATUS_LABELS.REMOVED}</option>
            </select>
          </label>

          {isFiltered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="filter" size={16} />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="star"
            title="ไม่พบรีวิวที่ตรงกับคำค้น"
            description="ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมดอีกครั้ง"
            action={isFiltered ? { label: 'ล้างตัวกรอง', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>หนังสือ</th>
                    <th>ลูกค้า</th>
                    <th>คะแนน</th>
                    <th>ความเห็น</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((review) => (
                    <tr key={review.reviewId}>
                      <td className="data-table__code">{formatReviewCode(review.reviewId)}</td>
                      <td className="data-table__strong">{review.bookTitle}</td>
                      <td>{review.customerName}</td>
                      <td>
                        <RatingStars value={review.rating} size={15} />
                      </td>
                      <td className="review-list__comment">
                        {review.flagged && (
                          <span className="review-list__flag" title="ตรวจพบคำที่อาจไม่เหมาะสม">
                            <Icon name="alert-triangle" size={15} />
                          </span>
                        )}
                        <span>{review.comment}</span>
                      </td>
                      <td>
                        <StatusBadge tone={REVIEW_STATUS_TONES[review.status]}>
                          {REVIEW_STATUS_LABELS[review.status]}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ตรวจสอบและจัดการ"
                            onClick={() => setOpenId(review.reviewId)}
                          >
                            <Icon name="eye" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </section>

      {open && (
        <ReviewDetailModal
          review={open}
          canModerate={mayModerate}
          onClose={() => setOpenId(null)}
          onModerate={(action) => handleModerate(open, action)}
          onReply={(text) => handleReply(open, text)}
        />
      )}
    </div>
  )
}
