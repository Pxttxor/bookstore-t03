import { useState } from 'react'
import Icon from '../../components/Icon'
import RatingStars from '../../components/RatingStars'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import {
  formatReviewCode,
  MODERATE_ACTION_LABELS,
  MODERATE_ACTION_STATUS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_TONES,
  type ModerateAction,
  type Review,
} from '../reviews/reviews'
import '../components/AdminForm.css'
import './ReviewDetailModal.css'

interface ReviewDetailModalProps {
  review: Review
  canModerate: boolean
  onClose: () => void
  onModerate: (action: ModerateAction) => void
  onReply: (text: string) => void
}

const ACTIONS: { action: ModerateAction; className: string }[] = [
  { action: 'PUBLISH', className: 'btn-primary' },
  { action: 'HIDE', className: 'btn-ghost' },
  { action: 'REMOVE', className: 'btn-danger' },
]

export default function ReviewDetailModal({
  review,
  canModerate,
  onClose,
  onModerate,
  onReply,
}: ReviewDetailModalProps) {
  const [replyText, setReplyText] = useState('')

  const submitReply = () => {
    if (!replyText.trim()) return
    onReply(replyText.trim())
    setReplyText('')
  }

  return (
    <Modal
      title={`รีวิว ${formatReviewCode(review.reviewId)}`}
      onClose={onClose}
      footer={
        canModerate ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              ปิด
            </button>
            {ACTIONS.map(({ action, className }) => (
              <button
                key={action}
                type="button"
                className={`btn ${className} btn-sm`}
                disabled={review.status === MODERATE_ACTION_STATUS[action]}
                onClick={() => onModerate(action)}
              >
                {MODERATE_ACTION_LABELS[action]}
              </button>
            ))}
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ปิด
          </button>
        )
      }
    >
      <div className="review-detail__head">
        <div>
          <p className="review-detail__book">{review.bookTitle}</p>
          <p className="review-detail__meta">
            โดย {review.customerName} · {new Date(review.createdDate).toLocaleString('th-TH')}
          </p>
        </div>
        <StatusBadge tone={REVIEW_STATUS_TONES[review.status]}>
          {REVIEW_STATUS_LABELS[review.status]}
        </StatusBadge>
      </div>

      <div className="review-detail__rating">
        <RatingStars value={review.rating} size={18} />
        <span>{review.rating}/5</span>
      </div>

      {review.flagged && (
        <div className="review-detail__flag">
          <Icon name="alert-triangle" size={18} />
          <span>ระบบตรวจพบคำที่อาจไม่เหมาะสม โปรดพิจารณาซ่อนหรือลบรีวิวนี้</span>
        </div>
      )}

      <p className="review-detail__comment">{review.comment}</p>

      {review.reply && (
        <div className="review-detail__reply">
          <p className="review-detail__reply-head">
            <Icon name="message" size={16} />
            คำตอบกลับจากร้าน
          </p>
          <p className="review-detail__reply-text">{review.reply.replyText}</p>
          <p className="review-detail__reply-meta">
            โดย {review.reply.repliedBy} ·{' '}
            {new Date(review.reply.repliedDate).toLocaleString('th-TH')}
          </p>
        </div>
      )}

      {canModerate && (
        <label className="admin-field review-detail__reply-form">
          <span className="admin-field__label">
            {review.reply ? 'แก้ไขคำตอบกลับ' : 'ตอบกลับรีวิว'}
          </span>
          <textarea
            className="admin-input"
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="พิมพ์ข้อความตอบกลับถึงลูกค้า"
          />
          <div className="review-detail__reply-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!replyText.trim()}
              onClick={submitReply}
            >
              บันทึกคำตอบกลับ
            </button>
          </div>
        </label>
      )}
    </Modal>
  )
}
