import Icon from '../../components/Icon'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import type { Review } from '../reviews/reviews'
import './ReportStatusModal.css'

interface ReportStatusModalProps {
  review: Review
  onClose: () => void
}

export default function ReportStatusModal({ review, onClose }: ReportStatusModalProps) {
  const report = review.report

  return (
    <Modal
      title="สถานะการรายงานผู้จัดการ"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          ปิด
        </button>
      }
    >
      <div className="report-status-modal-content">
        <div className="report-status-card">
          <div className="report-status-card-header">
            <div className="report-status-icon">
              <Icon name="clock" size={20} />
            </div>
            <div>
              <p className="report-status-title">ส่งรายงานให้ผู้จัดการแล้ว</p>
              <p className="report-status-sub">
                รหัสรีวิว: RV{String(review.reviewId).padStart(3, '0')} · {review.bookTitle}
              </p>
            </div>
          </div>
          <StatusBadge tone="warning">รอผู้จัดการตรวจสอบ</StatusBadge>
        </div>

        {report && (
          <div className="report-status-detail-card">
            <div className="report-status-field">
              <span className="report-field-label">เหตุผลที่รายงาน:</span>
              <p className="report-field-value bold">{report.reason}</p>
            </div>

            {report.detail && (
              <div className="report-status-field">
                <span className="report-field-label">รายละเอียดเพิ่มเติม:</span>
                <p className="report-field-value">{report.detail}</p>
              </div>
            )}

            <div className="report-status-footer-meta">
              <span>รายงานโดย: {report.reportedBy || 'ฝ่ายขาย'}</span>
              <span>
                เมื่อ: {report.reportedDate ? new Date(report.reportedDate).toLocaleString('th-TH') : 'ไม่ระบุ'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
