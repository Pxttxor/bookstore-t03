import { useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../components/Modal'
import type { Review } from '../reviews/reviews'

interface ReviewReplyModalProps {
  review: Review
  onClose: () => void
  onSubmit: (text: string) => void
}

export default function ReviewReplyModal({
  review,
  onClose,
  onSubmit,
}: ReviewReplyModalProps) {
  const [replyText, setReplyText] = useState(review.reply?.replyText || '')

  const handleSubmit = () => {
    if (!replyText.trim()) return
    onSubmit(replyText.trim())
  }

  return (
    <Modal
      title={`ตอบกลับรีวิว - ${review.bookTitle}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!replyText.trim()}
            onClick={handleSubmit}
          >
            <Icon name="check" size={15} />
            บันทึกคำตอบกลับ
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
            รีวิวโดย {review.customerName} ({review.username || '@user'})
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
            "{review.comment}"
          </p>
        </div>

        <label className="admin-field">
          <span className="admin-field__label">ข้อความตอบกลับถึงลูกค้า *</span>
          <textarea
            className="admin-input"
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="พิมพ์ข้อความตอบกลับอย่างเป็นทางการถึงลูกค้า..."
            autoFocus
          />
        </label>
      </div>
    </Modal>
  )
}
