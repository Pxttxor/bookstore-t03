import { useState } from 'react'
import Icon from '../../components/Icon'
import Modal from '../components/Modal'
import type { Review } from '../reviews/reviews'
import '../components/AdminForm.css'

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
      <div className="report-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }}>
            <Icon name="alert-triangle" size={18} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#991b1b' }}>
              รายงานรีวิวหนังสือ: {review.bookTitle}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>
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
            placeholder="อธิบายเหตุผลหรือข้อมูลบริบทเพิ่มเติมเพื่อให้ผู้จัดการพิจารณา..."
          />
        </label>
      </div>
    </Modal>
  )
}
