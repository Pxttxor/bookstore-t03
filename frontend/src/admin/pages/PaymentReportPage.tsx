import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/money'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatTile from '../components/StatTile'
import { useToast } from '../components/ToastContext'
import { can } from '../permissions'
import { usePayments } from '../payments/PaymentContext'
import { formatPaymentCode, paymentDate, summarise } from '../payments/payments'
import { formatOrderCode } from '../orders/orders'
import { useOrders } from '../orders/OrderContext'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './PaymentReportPage.css'

const fmtDateTime = (iso: string) =>
  iso.includes('T') ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso

/** ค่าเริ่มต้นของช่วงรายงาน = ตั้งแต่ต้นเดือนถึงวันนี้ */
function defaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(start), to: iso(now) }
}

export default function PaymentReportPage() {
  const { user } = useAuth()
  const { payments, reports, generateReport, loading, error: loadError, reload } = usePayments()
  const { orders } = useOrders()
  const { notify } = useToast()

  const initial = defaultPeriod()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const role = user!.role
  const mayGenerate = can.managePaymentReports(role)

  // สรุปสด ๆ ตามช่วงที่เลือก ผู้จัดการจึงเห็นตัวเลขก่อนกดบันทึกรายงาน
  const preview = useMemo(() => summarise(payments, from, to), [payments, from, to])

  const save = async () => {
    if (!from || !to) {
      setError('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด')
      return
    }
    if (from > to) {
      setError('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')
      return
    }
    setSaving(true)
    try {
      const report = await generateReport(from, to)
      setError('')
      notify(
        'success',
        `ออกรายงาน ${report.code} แล้ว · รับจริง ${formatPrice(report.totalReceived)}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ออกรายงานไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดรายงานรับชำระเงิน…" />
        </section>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={loadError} onRetry={() => void reload()} />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page payment-report">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ตรวจสอบการชำระเงิน', to: '/admin/payments' },
          { label: 'รายงานสรุปรับชำระเงิน' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">รายงานสรุปรับชำระเงิน</h1>
          <p className="admin-page__subtitle">
            สรุปยอดรับชำระจริงตามช่วงเวลา นับเฉพาะรายการที่ตรวจสอบผ่านแล้ว
          </p>
        </div>
      </div>

      <section className="admin-card payment-report__filters">
        <label className="admin-field">
          <span className="admin-field__label">ตั้งแต่วันที่</span>
          <input
            type="date"
            className="admin-input"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setError('')
            }}
          />
        </label>
        <label className="admin-field">
          <span className="admin-field__label">ถึงวันที่</span>
          <input
            type="date"
            className="admin-input"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setError('')
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm payment-report__save"
          onClick={() => void save()}
          disabled={!mayGenerate || saving}
          title={mayGenerate ? undefined : 'เฉพาะผู้จัดการร้านที่ออกรายงานได้'}
        >
          <Icon name="file-text" size={18} />
          ออกรายงาน
        </button>
      </section>
      {error && <p className="payment-report__error">{error}</p>}

      <section className="payment-report__tiles">
        <StatTile
          label="ยอดรับชำระจริง"
          value={formatPrice(preview.totalReceived)}
          note={`ช่วง ${from} ถึง ${to}`}
          icon="credit-card"
          tone="accent"
        />
        <StatTile
          label="จำนวนรายการ"
          value={preview.itemCount}
          note="รายการที่ตรวจสอบผ่าน"
          icon="check-circle"
        />
        <StatTile
          label="รายงานที่ออกแล้ว"
          value={reports.length}
          note="ฉบับสะสมทั้งหมด"
          icon="file-text"
        />
      </section>

      <section className="admin-card payment-report__panel">
        <h2 className="payment-report__panel-title">รายการที่นับรวมในรายงาน</h2>
        {preview.payments.length === 0 ? (
          <EmptyState
            icon="credit-card"
            title="ไม่มีรายการรับชำระในช่วงเวลานี้"
            description="ลองขยายช่วงวันที่ หรือตรวจสอบว่ามีรายการที่ยืนยันแล้วหรือยัง"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสการชำระ</th>
                  <th>คำสั่งซื้อ</th>
                  <th>ลูกค้า</th>
                  <th>วันที่โอน</th>
                  <th>ผู้ตรวจสอบ</th>
                  <th className="payment-report__num">ยอดเงิน</th>
                </tr>
              </thead>
              <tbody>
                {preview.payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td className="data-table__code">{formatPaymentCode(payment.paymentId)}</td>
                    <td>{formatOrderCode(payment.orderId)}</td>
                    <td className="data-table__strong">
                      {orders.find((order) => order.orderId === payment.orderId)?.customerName ?? '—'}
                    </td>
                    <td>{paymentDate(payment)}</td>
                    <td>{payment.verifiedBy ?? '—'}</td>
                    <td className="payment-report__num">{formatPrice(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="payment-report__total-label">
                    รวมรับจริง {preview.itemCount} รายการ
                  </td>
                  <td className="payment-report__num payment-report__total">
                    {formatPrice(preview.totalReceived)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card payment-report__panel">
        <h2 className="payment-report__panel-title">ประวัติรายงานที่ออกแล้ว</h2>
        {reports.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="ยังไม่มีรายงานที่ออก"
            description="เลือกช่วงเวลาแล้วกดออกรายงานเพื่อบันทึกฉบับแรก"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ช่วงเวลา</th>
                  <th className="payment-report__num">จำนวนรายการ</th>
                  <th className="payment-report__num">ยอดรับจริง</th>
                  <th>ออกเมื่อ</th>
                  <th>ผู้ออกรายงาน</th>
                </tr>
              </thead>
              <tbody>
                {[...reports]
                  .sort((a, b) => b.reportId - a.reportId)
                  .map((report) => (
                    <tr key={report.reportId}>
                      <td className="data-table__code">{report.code}</td>
                      <td>
                        {report.periodStart} ถึง {report.periodEnd}
                      </td>
                      <td className="payment-report__num">{report.itemCount}</td>
                      <td className="payment-report__num">{formatPrice(report.totalReceived)}</td>
                      <td>{fmtDateTime(report.generatedDate)}</td>
                      <td>{report.generatedBy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
