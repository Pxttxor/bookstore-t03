import { useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../components/Modal'
import type { Review } from '../reviews/reviews'
import './ReportToManagerModal.css'

interface ReportToManagerModalProps {
  review: Review
  onClose: () => void
  onSubmit: (reason: string, detail: string) => void
}

const REPORT_REASONS = [
  'เนื้อหาไม่เหมาะสม / มีคำหยาบคาย',
  'สแปม / โฆษณา / ลิงก์ภายนอก',
  'รีวิวไม่ตรงกับสินค้า',
  'ลูกค้าให้คะแนนผิด / บ่นเรื่องขนส่งสินค้า',
  'อื่นๆ',
]

export default function ReportToManagerModal({
  review,
  onClose,
  onSubmit,
}: ReportToManagerModalProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [detail, setDetail] = useState('')

  const handleSubmit = () => {
    if (!reason) return
    onSubmit(reason, detail.trim())
  }

  return (
    <Modal
      title="รายงานรีวิวให้ผู้จัดการร้าน"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleSubmit}
          >
            <Icon name="flag" size={15} />
            ส่งรายงานให้ผู้จัดการ
          </button>
        </>
      }
    >
      <div className="report-modal-body">
        <div className="report-modal-alert">
          <div className="report-modal-alert__icon">
            <Icon name="alert-triangle" size={18} />
          </div>
          <div>
            <p className="report-modal-alert__title">
              รายงานรีวิวหนังสือ: {review.bookTitle}
            </p>
            <p className="report-modal-alert__meta">
              โดยคุณ {review.customerName} ({review.username || '@user'})
            </p>
          </div>
        </div>

        <label className="admin-field">
          <span className="admin-field__label">เหตุผลในการรายงาน *</span>
          <select
            className="admin-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span className="admin-field__label">รายละเอียดเพิ่มเติมส่งถึงผู้จัดการ</span>
          <textarea
            className="admin-input"
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="เหตุผลหรือข้อมูลเพิ่มเติมสำหรับผู้จัดการ"
          />
        </label>
      </div>
    </Modal>
  )
}
