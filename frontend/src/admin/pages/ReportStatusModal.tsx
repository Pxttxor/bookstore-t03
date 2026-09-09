import Icon, { type IconName } from '../../components/Icon'
import Modal from '../components/Modal'
import StatusBadge, { type BadgeTone } from '../components/StatusBadge'
import { REPORT_DECISION_LABELS } from '../reviews/reviews'
import type { Review } from '../reviews/reviews'
import './ReportStatusModal.css'

interface ReportStatusModalProps {
  review: Review
  onClose: () => void
}

// สถานะจริงของรายงาน — เดิมหน้านี้ฮาร์ดโค้ด "รอผู้จัดการตรวจสอบ" ไว้ตลอด
// ทำให้ฝ่ายขายไม่เห็นผลตัดสินที่ผู้จัดการทำไปแล้ว
const STATUS_META: Record<'PENDING' | 'APPROVED' | 'REJECTED', { icon: IconName; tone: BadgeTone; title: string; label: string }> = {
  PENDING: { icon: 'clock', tone: 'warning', title: 'ส่งรายงานให้ผู้จัดการแล้ว', label: 'รอผู้จัดการตรวจสอบ' },
  APPROVED: { icon: 'check-check', tone: 'danger', title: 'ผู้จัดการตัดสินรายงานแล้ว', label: REPORT_DECISION_LABELS.APPROVED },
  REJECTED: { icon: 'check-check', tone: 'neutral', title: 'ผู้จัดการตัดสินรายงานแล้ว', label: REPORT_DECISION_LABELS.REJECTED },
}

export default function ReportStatusModal({ review, onClose }: ReportStatusModalProps) {
  const report = review.report
  const meta = STATUS_META[report?.managerStatus ?? 'PENDING']

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
              <Icon name={meta.icon} size={20} />
            </div>
            <div>
              <p className="report-status-title">{meta.title}</p>
              <p className="report-status-sub">
                รหัสรีวิว: RV{String(review.reviewId).padStart(3, '0')} · {review.bookTitle}
              </p>
            </div>
          </div>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
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

            {report.managerStatus !== 'PENDING' && report.decidedBy && (
              <div className="report-status-footer-meta">
                <span>ตัดสินโดย: {report.decidedBy}</span>
                <span>
                  เมื่อ: {report.decidedDate ? new Date(report.decidedDate).toLocaleString('th-TH') : 'ไม่ระบุ'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
