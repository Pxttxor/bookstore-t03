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
import {
  formatThaiRelativeTime,
  type Review,
} from '../reviews/reviews'
import ReviewDetailDrawer from './ReviewDetailDrawer'
import ReviewReplyModal from './ReviewReplyModal'
import './ReviewManagerPage.css'

type TabType = 'PENDING' | 'APPROVED' | 'DELETED'
type SortOrder = 'LATEST' | 'OLDEST' | 'RATING_HIGH' | 'RATING_LOW' | 'MOST_REPORTED'

export default function ReviewManagerPage() {
  const { user } = useAuth()
  const {
    reviews,
    pendingCount,
    approvedCount,
    deletedCount,
    approveReview,
    hideReview,
    removeReview,
    reply,
    loading,
    error,
    reload,
  } = useReviews()
  const { notify } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('PENDING')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOrder>('LATEST')
  const [filterOpen, setFilterOpen] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<number | 'ALL'>('ALL')
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [detailReview, setDetailReview] = useState<Review | null>(null)
  const [replyReview, setReplyReview] = useState<Review | null>(null)

  const role = user!.role
  const mayManage = can.manageReportedReviews(role)

  // Filter reviews by tab, search, and additional filter criteria
  const filteredReviews = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()

    let result = reviews.filter((r) => {
      // Tab filter
      if (activeTab === 'PENDING') {
        if (r.status !== 'PENDING') return false
      } else if (activeTab === 'APPROVED') {
        if (r.status !== 'PUBLISHED') return false
      } else if (activeTab === 'DELETED') {
        if (r.status !== 'REMOVED' && r.status !== 'HIDDEN') return false
      }

      // Rating filter
      if (ratingFilter !== 'ALL' && r.rating !== ratingFilter) return false

      // Verified filter
      if (verifiedFilter !== 'ALL' && !!r.verifiedPurchase !== verifiedFilter) return false

      // Search term
      if (!needle) return true
      return (
        r.bookTitle.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        (r.username && r.username.toLowerCase().includes(needle)) ||
        (r.isbn && r.isbn.toLowerCase().includes(needle)) ||
        r.comment.toLowerCase().includes(needle) ||
        (r.headline && r.headline.toLowerCase().includes(needle)) ||
        (r.report?.reason && r.report.reason.toLowerCase().includes(needle))
      )
    })

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'RATING_HIGH') return b.rating - a.rating
      if (sortBy === 'RATING_LOW') return a.rating - b.rating
      if (sortBy === 'OLDEST') {
        return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
      }
      if (sortBy === 'MOST_REPORTED') {
        const countA = a.report?.reportCount || (a.report?.isReported ? 1 : 0)
        const countB = b.report?.reportCount || (b.report?.isReported ? 1 : 0)
        return countB - countA
      }
      // Default: LATEST
      return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    })

    return result
  }, [reviews, activeTab, searchTerm, ratingFilter, verifiedFilter, sortBy])

  if (!mayManage) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์จัดการรีวิวที่มีปัญหา"
            description="หน้านี้สงวนสิทธิ์สำหรับผู้จัดการร้าน (Store Manager) เท่านั้น"
          />
        </section>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filteredReviews.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filteredReviews.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Manager Actions
  //
  // การตัดสินรายงานที่ยังค้างเกิดพร้อมกันในทรานแซกชันเดียวฝั่งเซิร์ฟเวอร์
  // (เผยแพร่ = รายงานไม่เป็นผล · ซ่อน/ลบ = รายงานเป็นผล) หน้าจอไม่ต้องแตะรายงานเอง
  const handleApprove = async (review: Review) => {
    try {
      await approveReview(review.reviewId)
      notify('success', `อนุมัติรีวิวของคุณ ${review.customerName} เรียบร้อยแล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อนุมัติรีวิวไม่สำเร็จ')
    }
  }

  const handleHide = async (review: Review) => {
    try {
      await hideReview(review.reviewId)
      notify('warning', `ซ่อนรีวิวของคุณ ${review.customerName} ถาวรแล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ซ่อนรีวิวไม่สำเร็จ')
    }
  }

  const handleRemove = async (review: Review) => {
    try {
      await removeReview(review.reviewId)
      notify('error', `ลบรีวิวของคุณ ${review.customerName} เรียบร้อยแล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ลบรีวิวไม่สำเร็จ')
    }
  }

  // ผู้ตอบกลับมาจาก JWT · เซิร์ฟเวอร์ดันสถานะเป็น PUBLISHED และออก replyId ให้เอง
  // จึงไม่ประกอบแถวคำตอบกลับเองอีก รอ reload() แทน
  const handleReplySubmit = async (text: string) => {
    const target = replyReview || detailReview
    if (!target) return
    try {
      await reply(target.reviewId, { replyText: text })
      notify('success', `บันทึกคำตอบกลับถึงคุณ ${target.customerName} เรียบร้อยแล้ว`)
      setReplyReview(null)
      setDetailReview(null)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกคำตอบกลับไม่สำเร็จ')
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name[0].toUpperCase()
  }

  const getAvatarBgClass = (review: Review) => {
    if (review.avatarColor) return `avatar--${review.avatarColor}`
    const charCode = (review.customerName || 'U').charCodeAt(0) % 4
    if (charCode === 0) return 'avatar--orange'
    if (charCode === 1) return 'avatar--green'
    if (charCode === 2) return 'avatar--blue'
    return 'avatar--purple'
  }

  return (
    <div className="review-mod-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'จัดการรีวิวที่มีปัญหา' },
        ]}
      />

      {/* Top Header & Filter Controls Bar */}
      <header className="review-header-section">
        <div className="review-header-left">
          <p className="review-header-desc">
            ตรวจสอบรีวิวที่ถูกรายงาน และจัดการการแสดงผลพร้อมตอบกลับลูกค้าอย่างเป็นทางการเพื่อรักษามาตรฐานชุมชนนักอ่าน
          </p>
        </div>

        <div className="review-header-controls">
          <button
            type="button"
            className={`btn-control-filter ${filterOpen ? 'active' : ''}`}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Icon name="filter" size={16} />
            <span>กรอง</span>
          </button>

          <div className="select-sort-wrapper">
            <Icon name="sort" size={16} />
            <span>เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOrder)
                setPage(1)
              }}
              className="select-sort-input"
            >
              <option value="LATEST">ใหม่ล่าสุด</option>
              <option value="OLDEST">เก่าที่สุด</option>
              <option value="RATING_HIGH">คะแนนสูงสุด</option>
              <option value="RATING_LOW">คะแนนต่ำสุด</option>
              <option value="MOST_REPORTED">ถูกรายงานมากสุด</option>
            </select>
          </div>
        </div>
      </header>

      {/* Expandable Filter Box */}
      {filterOpen && (
        <div className="review-filter-expandable">
          <div className="filter-field">
            <label>ค้นหาคำหรือชื่อ:</label>
            <div className="filter-search-wrap">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="ชื่อหนังสือ, ผู้ใช้, ISBN หรือข้อความ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>ระดับคะแนนดาว:</label>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด (1 - 5 ดาว)</option>
              <option value="1">1 ดาว</option>
              <option value="2">2 ดาว</option>
              <option value="3">3 ดาว</option>
              <option value="4">4 ดาว</option>
              <option value="5">5 ดาว</option>
            </select>
          </div>

          <div className="filter-field">
            <label>การยืนยันการซื้อ:</label>
            <select
              value={String(verifiedFilter)}
              onChange={(e) => {
                const val = e.target.value
                setVerifiedFilter(val === 'ALL' ? 'ALL' : val === 'true')
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="true">ผู้ซื้อที่ยืนยันแล้วเท่านั้น</option>
              <option value="false">ผู้ใช้ทั่วไป</option>
            </select>
          </div>

          {(searchTerm || ratingFilter !== 'ALL' || verifiedFilter !== 'ALL') && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={() => {
                setSearchTerm('')
                setRatingFilter('ALL')
                setVerifiedFilter('ALL')
                setPage(1)
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {/* KPI Cards (3 Cards matching Design) */}
      <section className="review-kpi-grid">
        <div
          className={`kpi-card ${activeTab === 'PENDING' ? 'kpi-card--active' : ''}`}
          onClick={() => {
            setActiveTab('PENDING')
            setPage(1)
          }}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-content">
            <span className="kpi-label">รอตรวจสอบ (Pending)</span>
            <span className="kpi-value">{pendingCount}</span>
          </div>
          <div className="kpi-icon-wrap kpi-icon--pending">
            <Icon name="clock" size={22} />
          </div>
        </div>

        <div
          className={`kpi-card ${activeTab === 'APPROVED' ? 'kpi-card--active' : ''}`}
          onClick={() => {
            setActiveTab('APPROVED')
            setPage(1)
          }}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-content">
            <span className="kpi-label">ตรวจสอบสำเร็จ (Approved)</span>
            <span className="kpi-value">{approvedCount}</span>
          </div>
          <div className="kpi-icon-wrap kpi-icon--approved">
            <Icon name="check-circle" size={22} />
          </div>
        </div>

        <div
          className={`kpi-card ${activeTab === 'DELETED' ? 'kpi-card--active' : ''}`}
          onClick={() => {
            setActiveTab('DELETED')
            setPage(1)
          }}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-content">
            <span className="kpi-label">รีวิวที่ถูกลบ (Deleted)</span>
            <span className="kpi-value">{deletedCount}</span>
          </div>
          <div className="kpi-icon-wrap kpi-icon--deleted">
            <Icon name="trash" size={22} />
          </div>
        </div>
      </section>

      {/* Filter Tabs Bar */}
      <nav className="review-tabs-nav" aria-label="สถานะรีวิว">
        <div className="review-tabs-list">
          <button
            type="button"
            className={`review-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('PENDING')
              setPage(1)
            }}
          >
            <span>รอตรวจสอบ</span>
            <span className="tab-badge tab-badge--danger">{pendingCount}</span>
          </button>

          <button
            type="button"
            className={`review-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('APPROVED')
              setPage(1)
            }}
          >
            <span>ตรวจสอบสำเร็จ</span>
            <span className="tab-badge tab-badge--neutral">{approvedCount}</span>
          </button>

          <button
            type="button"
            className={`review-tab-btn ${activeTab === 'DELETED' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('DELETED')
              setPage(1)
            }}
          >
            <span>รีวิวที่ถูกลบ</span>
            <span className="tab-badge tab-badge--neutral">{deletedCount}</span>
          </button>
        </div>
      </nav>

      {/* Review Cards List */}
      <section className="review-cards-container">
        {loading ? (
          <LoadingState label="กำลังโหลดรีวิว…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="star"
            title="ไม่พบรายการรีวิวในหมวดนี้"
            description="ไม่มีรีวิวที่ตรงกับเงื่อนไขหรือตัวกรองที่เลือกในขณะนี้"
          />
        ) : (
          rows.map((review) => {
            // รูปปกอยู่ในโปรเจกต์ ไม่ใช่คอลัมน์ในตาราง book — ค้นจาก bookId ตรง ๆ
            const bookCover = review.coverUrl || coverFor(review.bookId)
            const report = review.report
            const isSpam = report?.category === 'spam' || report?.reason?.includes('สแปม')
            const isService = report?.category === 'service' || report?.reason?.includes('บริการ') || report?.reason?.includes('ขนส่ง')

            return (
              <article key={review.reviewId} className="review-card">
                {/* LEFT SIDE: Book Cover & Book Meta */}
                <div
                  className="review-card-left"
                  onClick={() => setDetailReview(review)}
                  title="คลิกเพื่อดูรายละเอียดสินค้าและคำสั่งซื้อ"
                >
                  <div className="review-book-cover-frame">
                    {bookCover ? (
                      <img
                        src={bookCover}
                        alt={review.bookTitle}
                        className="review-book-cover-img"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="review-book-cover-placeholder">
                        <Icon name="book" size={32} />
                      </div>
                    )}
                  </div>
                  <div className="review-book-meta">
                    <h3 className="review-book-title">{review.bookTitle}</h3>
                    <p className="review-book-author">
                      โดย {review.author || 'ไม่ระบุผู้แต่ง'}
                    </p>
                    <div className="review-book-isbn-wrap">
                      <span className="isbn-label">ISBN</span>
                      <span className="isbn-value">
                        {review.isbn || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vertical Divider Line */}
                <div className="review-card-divider" />

                {/* RIGHT SIDE: Review Moderation Content & Actions */}
                <div className="review-card-right">
                  {/* Top Header Row: User Info & Report Tag */}
                  <div className="review-user-header">
                    <div className="review-user-profile">
                      <div className={`review-user-avatar ${getAvatarBgClass(review)}`}>
                        {getInitials(review.customerName)}
                      </div>
                      <div className="review-user-info">
                        <div className="review-user-name-row">
                          <span className="review-user-handle">
                            {review.username || `@${review.customerName.toLowerCase().replace(/\s+/g, '')}`}
                          </span>
                          {review.verifiedPurchase && (
                            <span className="review-verified-badge">
                              ผู้ซื้อที่ยืนยันแล้ว
                            </span>
                          )}
                        </div>
                        <div className="review-rating-row">
                          <div className="review-stars-wrap">
                            <RatingStars value={review.rating} size={15} />
                          </div>
                          <span className="review-post-time">
                            {formatThaiRelativeTime(review.createdDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Report Tag Pill on right */}
                    {report?.isReported && (
                      <div
                        className={`review-report-tag ${isSpam
                          ? 'report-tag--spam'
                          : isService
                            ? 'report-tag--service'
                            : 'report-tag--warning'
                          }`}
                      >
                        <Icon
                          name={isSpam ? 'flag' : 'alert-triangle'}
                          size={14}
                        />
                        <span>{report.reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Review Speech/Quote Bubble Box */}
                  <div className="review-comment-box">
                    <span className="quote-watermark">”</span>

                    {review.headline && (
                      <h4 className="review-headline">{review.headline}</h4>
                    )}

                    <p className="review-comment-text">{review.comment}</p>

                    {/* Staff Reply Section if already replied */}
                    {review.reply && (
                      <div className="review-reply-attached">
                        <div className="review-reply-header">
                          <Icon name="message" size={14} />
                          <span>
                            คำตอบกลับอย่างเป็นทางการ ({review.reply.repliedBy}):
                          </span>
                        </div>
                        <p className="review-reply-text">{review.reply.replyText}</p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Row (4 Buttons matching Design) */}
                  <div className="review-card-actions">
                    <div className="actions-right-group">
                      <button
                        type="button"
                        className="btn-card-action btn-action--delete"
                        onClick={() => void handleRemove(review)}
                      >
                        <Icon name="trash-x" size={16} />
                        <span>ลบรีวิว</span>
                      </button>

                      <button
                        type="button"
                        className="btn-card-action btn-action--hide"
                        onClick={() => void handleHide(review)}
                      >
                        <Icon name="eye-off" size={16} />
                        <span>ซ่อนถาวร</span>
                      </button>

                      <button
                        type="button"
                        className="btn-card-action btn-action--approve"
                        onClick={() => void handleApprove(review)}
                      >
                        <Icon name="check-check" size={16} />
                        <span>อนุมัติ</span>
                      </button>

                      <button
                        type="button"
                        className="btn-card-action btn-action--reply"
                        onClick={() => setReplyReview(review)}
                      >
                        <Icon name="message-plus" size={16} />
                        <span>ตอบกลับรีวิว</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>

      {/* Pagination */}
      {filteredReviews.length > pageSize && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filteredReviews.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}

      {/* Detail Drawer (opened on clicking book or detail) */}
      {detailReview && (
        <ReviewDetailDrawer
          review={detailReview}
          onClose={() => setDetailReview(null)}
          onReply={(text) => void handleReplySubmit(text)}
        />
      )}

      {/* Reply Modal */}
      {replyReview && (
        <ReviewReplyModal
          review={replyReview}
          onClose={() => setReplyReview(null)}
          onSubmit={(text) => void handleReplySubmit(text)}
        />
      )}
    </div>
  )
}
