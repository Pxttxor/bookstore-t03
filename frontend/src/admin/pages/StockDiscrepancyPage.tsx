import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { useBooks } from '../books/BookContext'
import { useInventory } from '../inventory/InventoryContext'
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_TONES,
  formatBookCode,
  formatCountCode,
  formatReportCode,
} from '../inventory/inventory'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import '../components/Tabs.css'
import './StockDiscrepancyPage.css'

type Tab = 'PENDING' | 'ALL'

export default function StockDiscrepancyPage() {
  const { user } = useAuth()
  const { findById } = useBooks()
  const { reports, findByBookId, findCount, resolveDiscrepancy, rejectDiscrepancy } = useInventory()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('PENDING')
  const [openId, setOpenId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string>()

  const role = user!.role

  if (!can.viewDiscrepancies(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูรายงานผลต่างสต็อก"
            description="รายงานผลต่างเปิดให้พนักงานคลังสินค้าและผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const mayDecide = can.resolveDiscrepancy(role)
  const rows = [...reports]
    .filter((report) => tab === 'ALL' || report.approvalStatus === 'PENDING')
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || b.reportId - a.reportId)

  const open = reports.find((report) => report.reportId === openId)
  const openCounted = open
    ? findCount(open.countId)?.items.find((item) => item.bookId === open.bookId)?.countedQty
    : undefined
  const openOnHand = open ? (findByBookId(open.bookId)?.quantityOnHand ?? 0) : 0

  const close = () => {
    setOpenId(null)
    setNote('')
    setNoteError(undefined)
  }

  const decide = (approve: boolean) => {
    if (!open) return
    if (!note.trim()) {
      setNoteError('กรุณาระบุสาเหตุก่อนบันทึก')
      return
    }
    if (approve) {
      resolveDiscrepancy(open.reportId, note.trim(), user!.name)
    } else {
      rejectDiscrepancy(open.reportId, note.trim(), user!.name)
    }
    notify('success', 'แก้ไขเสร็จสิ้น')
    close()
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ยอดหนังสือไม่ตรง' }]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">หนังสือที่จำนวนคลาดเคลื่อน</h1>
          <p className="admin-page__subtitle">
            แสดงรายงานหนังสือที่มีจำนวนคลาดเคลื่อนและยังไม่ได้รับการแก้ไข
          </p>
        </div>
      </div>

      <section className="admin-card discrepancy">
        <div className="discrepancy__tabs">
          <div className="admin-tabs">
            <button
              type="button"
              className={'admin-tabs__tab' + (tab === 'PENDING' ? ' admin-tabs__tab--active' : '')}
              onClick={() => setTab('PENDING')}
            >
              รอดำเนินการ ({reports.filter((r) => r.approvalStatus === 'PENDING').length})
            </button>
            <button
              type="button"
              className={'admin-tabs__tab' + (tab === 'ALL' ? ' admin-tabs__tab--active' : '')}
              onClick={() => setTab('ALL')}
            >
              ทั้งหมด ({reports.length})
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="ไม่มีรายงานผลต่างที่รอดำเนินการ"
            description="เมื่อการตรวจนับพบจำนวนคลาดเคลื่อน ระบบจะเปิดรายงานและแจ้งเตือนผู้จัดการร้านที่นี่"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสรายงาน</th>
                  <th>รอบตรวจนับ</th>
                  <th>หนังสือ</th>
                  <th className="discrepancy__num">ผลต่าง</th>
                  <th>ผู้แจ้ง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((report) => {
                  const book = findById(report.bookId)
                  const pending = report.approvalStatus === 'PENDING'
                  return (
                    <tr key={report.reportId}>
                      <td className="data-table__code">{formatReportCode(report.reportId)}</td>
                      <td>
                        <Link
                          to={`/admin/stock/counts/${report.countId}`}
                          className="data-table__code"
                        >
                          {formatCountCode(report.countId)}
                        </Link>
                      </td>
                      <td className="data-table__strong">
                        {book ? (
                          <Link to={`/admin/books/${book.bookId}`}>{book.title}</Link>
                        ) : (
                          formatBookCode(report.bookId)
                        )}
                      </td>
                      <td className="discrepancy__num">
                        <span className="discrepancy__variance">
                          {report.variance > 0 ? `+${report.variance}` : report.variance}
                        </span>
                      </td>
                      <td>{report.reportedBy}</td>
                      <td>
                        <StatusBadge tone={APPROVAL_STATUS_TONES[report.approvalStatus]}>
                          {APPROVAL_STATUS_LABELS[report.approvalStatus]}
                        </StatusBadge>
                      </td>
                      <td>
                        {pending ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={!mayDecide}
                            title={
                              mayDecide
                                ? undefined
                                : 'ผู้จัดการร้านเท่านั้นที่อนุมัติรายงานผลต่างได้'
                            }
                            onClick={() => {
                              setOpenId(report.reportId)
                              setNote('')
                              setNoteError(undefined)
                            }}
                          >
                            ตรวจสอบ
                          </button>
                        ) : (
                          <span className="discrepancy__resolved">
                            {report.note} · โดย {report.resolvedBy}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && (
        <Modal
          title={`รายงานผลต่าง ${formatReportCode(open.reportId)}`}
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => decide(false)}
              >
                ปฏิเสธรายงาน
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => decide(true)}
              >
                <Icon name="check" size={17} />
                รับทราบและอัพเดทจำนวน
              </button>
            </>
          }
        >
          <dl className="discrepancy__facts">
            <div>
              <dt>หนังสือ</dt>
              <dd>
                {findById(open.bookId)?.title ?? formatBookCode(open.bookId)} (
                {formatBookCode(open.bookId)})
              </dd>
            </div>
            <div>
              <dt>รอบตรวจนับ</dt>
              <dd>{formatCountCode(open.countId)}</dd>
            </div>
            <div>
              <dt>จำนวนในระบบตอนนี้</dt>
              <dd>{openOnHand} เล่ม</dd>
            </div>
            <div>
              <dt>จำนวนที่นับได้จริง</dt>
              <dd>{openCounted ?? '—'} เล่ม</dd>
            </div>
          </dl>

          <p className="discrepancy__hint">
            หากกด &quot;รับทราบและอัพเดทจำนวน&quot; ระบบจะแก้ไขจำนวนหนังสือในระบบให้เท่ากับจำนวนที่นับได้จริง
            และเปลี่ยนสถานะรายงานเป็นแก้ไขแล้ว
          </p>

          <label className="admin-field">
            <span className="admin-field__label">
              กรอกสาเหตุที่จำนวนไม่ตรง <em>*</em>
            </span>
            <textarea
              rows={3}
              autoFocus
              className={'admin-input' + (noteError ? ' admin-input--error' : '')}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteError(undefined)
              }}
            />
            {noteError && <span className="admin-field__error">{noteError}</span>}
          </label>
        </Modal>
      )}
    </div>
  )
}
