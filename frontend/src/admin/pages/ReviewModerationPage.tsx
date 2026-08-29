import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import RatingStars from '../../components/RatingStars'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import { useToast } from '../components/ToastContext'
import { getBook } from '../../data/books'
import { useReviews } from '../reviews/ReviewContext'
import type { Review } from '../reviews/reviews'
import ReviewDetailDrawer from './ReviewDetailDrawer'
import ReportToManagerModal from './ReportToManagerModal'
import ReportStatusModal from './ReportStatusModal'
import ReviewReplyModal from './ReviewReplyModal'
import './ReviewModerationPage.css'

type FilterStatus = 'ALL' | 'UNREPLIED' | 'REPLIED' | 'REPORTED'
type SortOrder = 'LATEST' | 'RATING_HIGH' | 'RATING_LOW'

export default function ReviewModerationPage() {
  const { user } = useAuth()
  const {
    reviews,
    unrepliedCount,
    repliedCount,
    reportedCount,
    reply,
    reportToManager,
  } = useReviews()
  const { notify } = useToast()

  const [term, setTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [sortBy, setSortBy] = useState<SortOrder>('LATEST')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [detailReview, setDetailReview] = useState<Review | null>(null)
  const [replyReview, setReplyReview] = useState<Review | null>(null)
  const [reportReview, setReportReview] = useState<Review | null>(null)
  const [statusReview, setStatusReview] = useState<Review | null>(null)

  const role = user!.role
  const mayModerate = can.moderateReview(role)

  const kpiTotal = 1248 - 5 + reviews.length
  const kpiUnreplied = 24 - 2 + unrepliedCount
  const kpiReplied = 1215 - 2 + repliedCount
  const kpiReported = 9 - 1 + reportedCount

  const filteredReviews = useMemo(() => {
    const needle = term.trim().toLowerCase()
    let result = reviews.filter((r) => {
      if (statusFilter === 'UNREPLIED' && r.reply) return false
      if (statusFilter === 'REPLIED' && !r.reply) return false
      if (statusFilter === 'REPORTED' && !r.report?.isReported) return false
      if (!needle) return true
      return (
        r.bookTitle.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        (r.username && r.username.toLowerCase().includes(needle)) ||
        (r.isbn && r.isbn.toLowerCase().includes(needle)) ||
        r.comment.toLowerCase().includes(needle) ||
        (r.headline && r.headline.toLowerCase().includes(needle))
      )
    })
    result = [...result].sort((a, b) => {
      if (sortBy === 'RATING_HIGH') return b.rating - a.rating
      if (sortBy === 'RATING_LOW') return a.rating - b.rating
      return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    })
    return result
  }, [reviews, term, statusFilter, sortBy])

  if (!mayModerate) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ตรวจสอบรีวิว"
            description="การตรวจสอบและจัดการรีวิวเป็นสิทธิ์ของพนักงานฝ่ายขายและผู้จัดการร้าน"
          />
        </section>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filteredReviews.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filteredReviews.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleReplySubmit = (text: string) => {
    const targetReview = replyReview || detailReview
    if (!targetReview) return
    reply(targetReview.reviewId, {
      replyText: text,
      repliedBy: user?.name || 'ฝ่ายขาย',
    })
    notify('success', `บันทึกคำตอบกลับถึง ${targetReview.customerName} เรียบร้อยแล้ว`)
    setReplyReview(null)
    if (detailReview?.reviewId === targetReview.reviewId) {
      setDetailReview((prev) =>
        prev
          ? {
              ...prev,
              reply: {
                replyId: (prev.reply?.replyId || 0) + 1,
                replyText: text,
                repliedDate: new Date().toISOString(),
                repliedBy: user?.name || 'ฝ่ายขาย',
              },
            }
          : null,
      )
    }
  }

  const handleReportSubmit = (reason: string, detailText: string) => {
    if (!reportReview) return
    reportToManager(reportReview.reviewId, {
      reason,
      detail: detailText,
      reportedBy: user?.name || 'ฝ่ายขาย',
    })
    notify('warning', `ส่งรายงานรีวิวของคุณ ${reportReview.customerName} ให้ผู้จัดการแล้ว`)
    setReportReview(null)
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name[0].toUpperCase()
  }

  return (
    <div className="review-mod-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ตรวจสอบรีวิว' }]} />

      {/* KPI Cards */}
      <section className="review-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap total"><Icon name="bar-chart" size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">รีวิวทั้งหมด</span>
            <span className="kpi-value total">{kpiTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap unreplied"><Icon name="clock" size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">รอตอบกลับ</span>
            <span className="kpi-value unreplied">{kpiUnreplied}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap replied"><Icon name="check-circle" size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">ตอบกลับแล้ว</span>
            <span className="kpi-value replied">{kpiReplied.toLocaleString()}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap reported"><Icon name="flag" size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">รายงานผู้จัดการแล้ว</span>
            <span className="kpi-value reported">{kpiReported}</span>
          </div>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="review-filter-bar">
        <div className="search-input-wrap">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={term}
            placeholder="ค้นหาชื่อหนังสือ, ชื่อผู้ใช้ หรือ ISBN..."
            onChange={(e) => { setTerm(e.target.value); setPage(1) }}
          />
        </div>
        <div className="filter-select-group">
          <div className="select-pill">
            <Icon name="filter" size={16} />
            <span>สถานะ:</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as FilterStatus); setPage(1) }}>
              <option value="ALL">ทั้งหมด</option>
              <option value="UNREPLIED">รอตอบกลับ</option>
              <option value="REPLIED">ตอบกลับแล้ว</option>
              <option value="REPORTED">รายงานผู้จัดการแล้ว</option>
            </select>
          </div>
          <div className="select-pill">
            <Icon name="sort" size={16} />
            <span>เรียงตาม:</span>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortOrder); setPage(1) }}>
              <option value="LATEST">ล่าสุด</option>
              <option value="RATING_HIGH">คะแนนสูงสุด</option>
              <option value="RATING_LOW">คะแนนต่ำสุด</option>
            </select>
          </div>
        </div>
      </section>

      {/* Review Cards */}
      <section className="review-cards-container">
        {rows.length === 0 ? (
          <EmptyState
            icon="star"
            title="ไม่พบข้อมูลรีวิว"
            description="ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองสถานะเพื่อดูรายการอีกครั้ง"
          />
        ) : (
          rows.map((review) => {
            const bookCover = review.coverUrl || getBook(review.bookId)?.cover
            const isReported = !!review.report?.isReported
            const isFlagged = review.flagged

            return (
              <article
                key={review.reviewId}
                className={[
                  'review-card',
                  isReported ? 'review-card--reported' : '',
                  isFlagged && !isReported ? 'review-card--flagged' : '',
                ].filter(Boolean).join(' ')}
              >
                {/* LEFT: Book cover + info side-by-side */}
                <div className="review-card-left">
                  <div className="review-book-cover">
                    {bookCover ? (
                      <img src={bookCover} alt={review.bookTitle} />
                    ) : (
                      <div className="review-book-cover-placeholder">
                        <Icon name="book" size={28} />
                      </div>
                    )}
                  </div>
                  <div className="review-book-meta">
                    <h3 className="review-book-title">{review.bookTitle}</h3>
                    <p className="review-book-author">{review.author || 'ไม่ระบุผู้แต่ง'}</p>
                    <p className="review-book-isbn">ISBN: {review.isbn || '978-0000000000'}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="review-card-divider" />

                {/* RIGHT: Review content & Actions */}
                <div className="review-card-right">
                  {/* UNDER REVIEW badge */}
                  {isReported && (
                    <div className="review-card-status-bar">
                      <span className="review-under-review-badge">
                        <Icon name="alert-triangle" size={13} />
                        UNDER REVIEW
                      </span>
                    </div>
                  )}

                  {/* Reviewer header */}
                  <div className="review-user-header">
                    <div className="review-user-profile">
                      <div className="review-user-avatar">{getInitials(review.customerName)}</div>
                      <div className="review-user-info">
                        <div className="review-user-name-row">
                          <span className="review-user-name">{review.customerName}</span>
                          {review.username && <span className="review-user-handle">{review.username}</span>}
                          {review.verifiedPurchase && <span className="review-verified-badge">ผู้ซื้อที่ยืนยันแล้ว</span>}
                        </div>
                        <p className="review-post-date">
                          {new Date(review.createdDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="review-stars-wrap">
                      <RatingStars value={review.rating} size={16} />
                    </div>
                  </div>

                  {/* Review body */}
                  <div className="review-comment-box">
                    <span className="quote-watermark">"</span>

                    {review.headline && (
                      <h4 className={`review-headline${isFlagged ? ' review-headline--italic' : ''}`}>
                        {review.headline}
                      </h4>
                    )}

                    <p className={`review-comment-text${isReported ? ' review-comment-text--muted' : ''}`}>
                      {isReported ? `[ ${review.comment} ]` : review.comment}
                    </p>

                    {/* Inline report detail box (only when already reported) */}
                    {isReported && review.report && (
                      <div className="review-report-detail-box">
                        <div className="review-report-detail-title">
                          <Icon name="alert-triangle" size={15} />
                          พบเนื้อหาที่อาจไม่เหมาะสม — รอผู้จัดการตรวจสอบ
                        </div>
                        <p className="review-report-detail-row">
                          <strong>Reason:</strong> {review.report.reason}
                        </p>
                        <p className="review-report-detail-row">
                          <strong>Reported By:</strong> {review.report.reportedBy || 'ฝ่ายขาย'}
                        </p>
                        <p className="review-report-detail-row">
                          <strong>Date:</strong>{' '}
                          {review.report.reportedDate
                            ? new Date(review.report.reportedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'ไม่ระบุ'}
                        </p>
                      </div>
                    )}

                    {/* Flagged but not yet reported — warning banner */}
                    {isFlagged && !isReported && (
                      <div className="review-flagged-warning">
                        <Icon name="alert-triangle" size={14} />
                        <span>ระบบตรวจพบข้อความมีปัญหา — กด "รายงานให้ผู้จัดการ" เพื่อดำเนินการ</span>
                      </div>
                    )}

                    {/* Staff reply */}
                    {review.reply && (
                      <div className="review-staff-reply-nested">
                        <div className="review-reply-label">ฝ่ายขายตอบกลับ:</div>
                        <p className="review-reply-content">{review.reply.replyText}</p>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="review-card-actions">
                    <div className="actions-left">
                      {!review.reply && !isReported && (
                        <button type="button" className="btn-reply-action" onClick={() => setReplyReview(review)}>
                          ตอบกลับรีวิว
                        </button>
                      )}
                      <button type="button" className="btn-detail-action" onClick={() => setDetailReview(review)}>
                        ดูรายละเอียด
                      </button>
                    </div>
                    <div className="actions-right">
                      {isReported ? (
                        <button type="button" className="btn-reported-status" onClick={() => setStatusReview(review)}>
                          <Icon name="clock" size={15} />
                          รอผู้จัดการตรวจสอบ (คลิกดูสถานะ)
                        </button>
                      ) : (
                        <button type="button" className="btn-report-action" onClick={() => setReportReview(review)}>
                          <Icon name="flag" size={15} />
                          รายงานให้ผู้จัดการ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>

      {filteredReviews.length > pageSize && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filteredReviews.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      )}

      {detailReview && (
        <ReviewDetailDrawer review={detailReview} onClose={() => setDetailReview(null)} onReply={handleReplySubmit} />
      )}
      {replyReview && (
        <ReviewReplyModal review={replyReview} onClose={() => setReplyReview(null)} onSubmit={handleReplySubmit} />
      )}
      {reportReview && (
        <ReportToManagerModal review={reportReview} onClose={() => setReportReview(null)} onSubmit={handleReportSubmit} />
      )}
      {statusReview && (
        <ReportStatusModal review={statusReview} onClose={() => setStatusReview(null)} />
      )}
    </div>
  )
}
