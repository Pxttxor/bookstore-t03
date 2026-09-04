import { useEffect, useState } from 'react'
import { coverFor } from '../../data/covers'
import Icon from '../../components/Icon'
import RatingStars from '../../components/RatingStars'
import StatusBadge from '../components/StatusBadge'
import type { Review } from '../reviews/reviews'
import './ReviewDetailDrawer.css'

interface ReviewDetailDrawerProps {
  review: Review
  onClose: () => void
  onReply: (text: string) => void
}

export default function ReviewDetailDrawer({
  review,
  onClose,
  onReply,
}: ReviewDetailDrawerProps) {
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  // รูปปกอยู่ในโปรเจกต์ ไม่ใช่คอลัมน์ในตาราง book — ค้นจาก bookId ตรง ๆ
  const coverFromCatalogue = coverFor(review.bookId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSaveReply = () => {
    if (!replyText.trim()) return
    onReply(replyText.trim())
    setReplyText('')
    setIsReplying(false)
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name[0].toUpperCase()
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <header className="drawer-header">
          <div>
            <span className="drawer-tag">Order & Product Details</span>
            <h2 className="drawer-title">ข้อมูลสินค้าและคำสั่งซื้อ</h2>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            aria-label="ปิด Drawer"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="drawer-body">
          {/* Section 1: Book Cover & Details */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Icon name="book" size={18} />
              รูปปกหนังสือ & รายละเอียด
            </h3>
            <div className="drawer-book-card">
              <div className="drawer-book-cover">
                {(review.coverUrl || coverFromCatalogue) ? (
                  <img
                    src={review.coverUrl || coverFromCatalogue}
                    alt={review.bookTitle}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="drawer-book-cover-placeholder">
                    <Icon name="book" size={32} />
                  </div>
                )}
              </div>
              <div className="drawer-book-info">
                <h4 className="drawer-book-title">{review.bookTitle}</h4>
                <p className="drawer-book-author">ผู้แต่ง: {review.author || 'ไม่ระบุ'}</p>
                <div className="drawer-book-meta-pills">
                  <span className="drawer-meta-pill">
                    <strong>ISBN:</strong> {review.isbn || '978-0000000000'}
                  </span>
                  {review.price && (
                    <span className="drawer-meta-pill price">
                      <strong>ราคา:</strong> ฿{review.price}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Order Information */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Icon name="shopping-bag" size={18} />
              ข้อมูลคำสั่งซื้อ (Order Details)
            </h3>
            <div className="drawer-order-grid">
              <div className="drawer-order-item">
                <span className="drawer-order-label">เลขที่คำสั่งซื้อ (Order ID)</span>
                <span className="drawer-order-val code">{review.orderId || 'ORD-2026-08501'}</span>
              </div>
              <div className="drawer-order-item">
                <span className="drawer-order-label">วันที่สั่งซื้อ</span>
                <span className="drawer-order-val">
                  {review.orderDate
                    ? new Date(review.orderDate).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '02 ส.ค. 2026 14:15 น.'}
                </span>
              </div>
              <div className="drawer-order-item full">
                <span className="drawer-order-label">สถานะการจัดส่ง</span>
                <div className="drawer-order-status">
                  <StatusBadge tone="success">
                    <Icon name="truck" size={14} />
                    {review.deliveryStatus || 'จัดส่งสำเร็จแล้ว'}
                  </StatusBadge>
                  <span className="drawer-order-hint">
                    (บริบทกรณีตรวจสอบลูกค้าบ่นเรื่องส่งช้า/หนังสือชำรุด)
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Full Review Information */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">
              <Icon name="message" size={18} />
              ข้อมูลรีวิวแบบฉบับเต็ม (Full Review)
            </h3>
            <div className="drawer-review-card">
              <div className="drawer-reviewer-header">
                <div className="drawer-reviewer-profile">
                  <div className="drawer-avatar">{getInitials(review.customerName)}</div>
                  <div>
                    <div className="drawer-reviewer-name-row">
                      <span className="drawer-reviewer-name">{review.customerName}</span>
                      {review.username && (
                        <span className="drawer-reviewer-handle">{review.username}</span>
                      )}
                    </div>
                    {review.verifiedPurchase && (
                      <span className="drawer-verified-badge">
                        <Icon name="check" size={12} />
                        ผู้ซื้อที่ยืนยันแล้ว
                      </span>
                    )}
                  </div>
                </div>
                <div className="drawer-rating">
                  <RatingStars value={review.rating} size={18} />
                  <span className="drawer-rating-num">{review.rating}/5</span>
                </div>
              </div>

              <div className="drawer-review-content">
                {review.headline && (
                  <h4 className="drawer-review-headline">{review.headline}</h4>
                )}
                <p className="drawer-review-comment">{review.comment}</p>
                <p className="drawer-review-date">
                  โพสต์เมื่อ:{' '}
                  {new Date(review.createdDate).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Staff Reply History & Action */}
          <section className="drawer-section">
            <div className="drawer-section-header">
              <h3 className="drawer-section-title">
                <Icon name="edit" size={18} />
                ประวัติการตอบกลับของฝ่ายขาย (Staff Reply History)
              </h3>
              <StatusBadge tone={review.reply ? 'success' : 'warning'}>
                {review.reply ? 'ตอบกลับแล้ว' : 'ยังไม่ได้ตอบกลับ'}
              </StatusBadge>
            </div>

            {review.reply ? (
              <div className="drawer-staff-reply-box">
                <div className="drawer-reply-box-head">
                  <span className="drawer-reply-by">
                    <Icon name="user" size={15} />
                    ฝ่ายขายตอบกลับ ({review.reply.repliedBy})
                  </span>
                  <span className="drawer-reply-date">
                    {new Date(review.reply.repliedDate).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p className="drawer-reply-text">{review.reply.replyText}</p>

                {!isReplying && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm drawer-edit-reply-btn"
                    onClick={() => {
                      setReplyText(review.reply?.replyText || '')
                      setIsReplying(true)
                    }}
                  >
                    <Icon name="edit" size={15} />
                    แก้ไขข้อความตอบกลับ
                  </button>
                )}
              </div>
            ) : (
              !isReplying && (
                <div className="drawer-no-reply">
                  <p>ยังไม่มีข้อความตอบกลับสำหรับรีวิวนี้</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsReplying(true)}
                  >
                    <Icon name="message" size={15} />
                    ตอบกลับรีวิว
                  </button>
                </div>
              )
            )}

            {/* Inline reply form when writing/editing */}
            {isReplying && (
              <div className="drawer-reply-form">
                <label className="admin-field">
                  <span className="admin-field__label">ข้อความตอบกลับถึงลูกค้า</span>
                  <textarea
                    className="admin-input"
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="พิมพ์ข้อความตอบกลับถึงลูกค้าที่นี่..."
                    autoFocus
                  />
                </label>
                <div className="drawer-reply-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsReplying(false)}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!replyText.trim()}
                    onClick={handleSaveReply}
                  >
                    <Icon name="check" size={15} />
                    บันทึกคำตอบกลับ
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* NOTE: Strict Boundary Enforced - NO Report info displayed in this Drawer! */}
        </div>

        <footer className="drawer-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </footer>
      </aside>
    </div>
  )
}
