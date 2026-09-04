import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import RatingStars from '../../components/RatingStars'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import { useToast } from '../components/ToastContext'
import { coverFor } from '../../data/covers'
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
    loading,
    error,
    reload,
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

  const kpiTotal = reviews.length
  const kpiUnreplied = unrepliedCount
  const kpiReplied = repliedCount
  const kpiReported = reportedCount

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

  // ผู้ตอบกลับมาจาก JWT ฝั่งเซิร์ฟเวอร์แล้ว หน้าจอไม่ต้องส่ง repliedBy ไปเอง
  // และไม่ต้องประกอบแถวคำตอบกลับเองเพื่อ optimistic update — รอ reload() แทน
  // ไม่งั้นตัวเลข replyId ที่เดาขึ้นมาจะไม่ตรงกับที่ฐานข้อมูลออกให้จริง
  const handleReplySubmit = async (text: string) => {
    const targetReview = replyReview || detailReview
    if (!targetReview) return
    try {
      await reply(targetReview.reviewId, { replyText: text })
      notify('success', `บันทึกคำตอบกลับถึง ${targetReview.customerName} เรียบร้อยแล้ว`)
      setReplyReview(null)
      setDetailReview(null)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกคำตอบกลับไม่สำเร็จ')
    }
  }

  const handleReportSubmit = async (reason: string, detailText: string) => {
    if (!reportReview) return
    try {
      await reportToManager(reportReview.reviewId, { reason, detail: detailText })
      notify('warning', `ส่งรายงานรีวิวของคุณ ${reportReview.customerName} ให้ผู้จัดการแล้ว`)
      setReportReview(null)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ส่งรายงานไม่สำเร็จ')
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name[0].toUpperCase()
  }

  return (
    <div className="review-mod-page-sales">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ตรวจสอบรีวิว' }]} />

      {/* KPI Cards */}
      <section className="review-kpi-grid-sales">
        <div className="kpi-card-sales">
          <div className="kpi-icon-wrap-sales total"><Icon name="bar-chart" size={20} /></div>
          <div className="kpi-content-sales">
            <span className="kpi-label-sales">รีวิวทั้งหมด</span>
            <span className="kpi-value-sales total">{kpiTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="kpi-card-sales">
          <div className="kpi-icon-wrap-sales unreplied"><Icon name="clock" size={20} /></div>
          <div className="kpi-content-sales">
            <span className="kpi-label-sales">รอตอบกลับ</span>
            <span className="kpi-value-sales unreplied">{kpiUnreplied}</span>
          </div>
        </div>
        <div className="kpi-card-sales">
          <div className="kpi-icon-wrap-sales replied"><Icon name="check-circle" size={20} /></div>
          <div className="kpi-content-sales">
            <span className="kpi-label-sales">ตอบกลับแล้ว</span>
            <span className="kpi-value-sales replied">{kpiReplied.toLocaleString()}</span>
          </div>
        </div>
        <div className="kpi-card-sales">
          <div className="kpi-icon-wrap-sales reported"><Icon name="flag" size={20} /></div>
          <div className="kpi-content-sales">
            <span className="kpi-label-sales">รายงานผู้จัดการแล้ว</span>
            <span className="kpi-value-sales reported">{kpiReported}</span>
          </div>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="review-filter-bar-sales">
        <div className="search-input-wrap-sales">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={term}
            placeholder="ค้นหาชื่อหนังสือ, ชื่อผู้ใช้ หรือ ISBN..."
            onChange={(e) => { setTerm(e.target.value); setPage(1) }}
          />
        </div>
        <div className="filter-select-group-sales">
          <div className="select-pill-sales">
            <Icon name="filter" size={16} />
            <span>สถานะ:</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as FilterStatus); setPage(1) }}>
              <option value="ALL">ทั้งหมด</option>
              <option value="UNREPLIED">รอตอบกลับ</option>
              <option value="REPLIED">ตอบกลับแล้ว</option>
              <option value="REPORTED">รายงานผู้จัดการแล้ว</option>
            </select>
          </div>
          <div className="select-pill-sales">
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
      <section className="review-cards-container-sales">
        {loading ? (
          <LoadingState label="กำลังโหลดรีวิว…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="star"
            title="ไม่พบข้อมูลรีวิว"
            description="ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองสถานะเพื่อดูรายการอีกครั้ง"
          />
        ) : (
          rows.map((review) => {
            // รูปปกอยู่ในโปรเจกต์ ไม่ใช่คอลัมน์ในตาราง book — ค้นจาก bookId ตรง ๆ
            const bookCover = review.coverUrl || coverFor(review.bookId)
            const isReported = !!review.report?.isReported
            const isFlagged = review.flagged

            return (
              <article
                key={review.reviewId}
                className={[
                  'review-card-sales',
                  isReported ? 'review-card-sales--reported' : '',
                  isFlagged && !isReported ? 'review-card-sales--flagged' : '',
                ].filter(Boolean).join(' ')}
              >
                {/* LEFT: Book cover + info side-by-side */}
                <div className="review-card-left-sales">
                  <div className="review-book-cover-sales">
                    {bookCover ? (
                      <img
                        src={bookCover}
                        alt={review.bookTitle}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="review-book-cover-placeholder-sales">
                        <Icon name="book" size={28} />
                      </div>
                    )}
                  </div>
                  <div className="review-book-meta-sales">
                    <h3 className="review-book-title-sales">{review.bookTitle}</h3>
                    <p className="review-book-author-sales">{review.author || 'ไม่ระบุผู้แต่ง'}</p>
                    <p className="review-book-isbn-sales">ISBN: {review.isbn || '—'}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="review-card-divider-sales" />

                {/* RIGHT: Review content & Actions */}
                <div className="review-card-right-sales">
                  {/* UNDER REVIEW badge */}
                  {isReported && (
                    <div className="review-card-status-bar-sales">
                      <span className="review-under-review-badge-sales">
                        <Icon name="alert-triangle" size={13} />
                        UNDER REVIEW
                      </span>
                    </div>
                  )}

                  {/* Reviewer header */}
                  <div className="review-user-header-sales">
                    <div className="review-user-profile-sales">
                      <div className="review-user-avatar-sales">{getInitials(review.customerName)}</div>
                      <div className="review-user-info-sales">
                        <div className="review-user-name-row-sales">
                          <span className="review-user-name-sales">{review.customerName}</span>
                          {review.username && <span className="review-user-handle-sales">{review.username}</span>}
                          {review.verifiedPurchase && <span className="review-verified-badge-sales">ผู้ซื้อที่ยืนยันแล้ว</span>}
                        </div>
                        <p className="review-post-date-sales">
                          {new Date(review.createdDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="review-stars-wrap-sales">
                      <RatingStars value={review.rating} size={16} />
                    </div>
                  </div>

                  {/* Review body */}
                  <div className="review-comment-box-sales">
                    <span className="quote-watermark-sales">"</span>

                    {review.headline && (
                      <h4 className={`review-headline-sales${isFlagged ? ' review-headline-sales--italic' : ''}`}>
                        {review.headline}
                      </h4>
                    )}

                    <p className={`review-comment-text-sales${isReported ? ' review-comment-text-sales--muted' : ''}`}>
                      {isReported ? `[ ${review.comment} ]` : review.comment}
                    </p>

                    {/* Inline report detail box (only when already reported) */}
                    {isReported && review.report && (
                      <div className="review-report-detail-box-sales">
                        <div className="review-report-detail-title-sales">
                          <Icon name="alert-triangle" size={15} />
                          พบเนื้อหาที่อาจไม่เหมาะสม — รอผู้จัดการตรวจสอบ
                        </div>
                        <p className="review-report-detail-row-sales">
                          <strong>Reason:</strong> {review.report.reason}
                        </p>
                        <p className="review-report-detail-row-sales">
                          <strong>Reported By:</strong> {review.report.reportedBy || 'ฝ่ายขาย'}
                        </p>
                        <p className="review-report-detail-row-sales">
                          <strong>Date:</strong>{' '}
                          {review.report.reportedDate
                            ? new Date(review.report.reportedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'ไม่ระบุ'}
                        </p>
                      </div>
                    )}

                    {/* Flagged but not yet reported — warning banner */}
                    {isFlagged && !isReported && (
                      <div className="review-flagged-warning-sales">
                        <Icon name="alert-triangle" size={14} />
                        <span>ระบบตรวจพบข้อความมีปัญหา — กด "รายงานให้ผู้จัดการ" เพื่อดำเนินการ</span>
                      </div>
                    )}

                    {/* Staff reply */}
                    {review.reply && (
                      <div className="review-staff-reply-nested-sales">
                        <div className="review-reply-label-sales">ฝ่ายขายตอบกลับ:</div>
                        <p className="review-reply-content-sales">{review.reply.replyText}</p>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="review-card-actions-sales">
                    <div className="actions-left-sales">
                      {!review.reply && !isReported && (
                        <button type="button" className="btn-reply-action-sales" onClick={() => setReplyReview(review)}>
                          ตอบกลับรีวิว
                        </button>
                      )}
                      <button type="button" className="btn-detail-action-sales" onClick={() => setDetailReview(review)}>
                        ดูรายละเอียด
                      </button>
                    </div>
                    <div className="actions-right-sales">
                      {isReported ? (
                        <button type="button" className="btn-reported-status-sales" onClick={() => setStatusReview(review)}>
                          <Icon name="clock" size={15} />
                          รอผู้จัดการตรวจสอบ (คลิกดูสถานะ)
                        </button>
                      ) : (
                        <button type="button" className="btn-report-action-sales" onClick={() => setReportReview(review)}>
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
        <ReviewDetailDrawer review={detailReview} onClose={() => setDetailReview(null)} onReply={(text) => void handleReplySubmit(text)} />
      )}
      {replyReview && (
        <ReviewReplyModal review={replyReview} onClose={() => setReplyReview(null)} onSubmit={(text) => void handleReplySubmit(text)} />
      )}
      {reportReview && (
        <ReportToManagerModal review={reportReview} onClose={() => setReportReview(null)} onSubmit={(reason, detail) => void handleReportSubmit(reason, detail)} />
      )}
      {statusReview && (
        <ReportStatusModal review={statusReview} onClose={() => setStatusReview(null)} />
      )}
    </div>
  )
}
