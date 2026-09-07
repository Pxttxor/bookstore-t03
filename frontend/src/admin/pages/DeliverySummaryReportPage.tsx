import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/money'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import {
  buildDeliveryRecords,
  carrierBreakdown,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  summaryDates,
  type Carrier,
  type DeliveryRecord,
  type DeliveryStatus,
} from '../delivery/delivery'
import { useOrders } from '../orders/OrderContext'
import { CARRIERS } from '../orders/orders'
import { can } from '../permissions'
import './DeliverySummaryReportPage.css'

// Each carrier keeps its own brand colour so a row can be picked out at a glance; the
// rest of the screen stays on the design tokens.
const CARRIER_COLORS: Record<
  Carrier | 'ALL',
  {
    bg: string
    text: string
    border: string
    bar: string
    activeBg: string
    activeText: string
    activeBorder: string
    badgeBg: string
    badgeText: string
  }
> = {
  ALL: {
    bg: 'var(--surface-alt)',
    text: 'var(--text-heading)',
    border: 'var(--border-soft)',
    bar: '#00B092',
    activeBg: '#e6f7f2',
    activeText: '#007965',
    activeBorder: '#00B092',
    badgeBg: '#00B092',
    badgeText: '#ffffff',
  },
  'Flash Express': {
    bg: '#fefce8',
    text: '#854d0e',
    border: '#fef08a',
    bar: '#FEE600', // สีเหลืองมะนาว
    activeBg: '#fefce8',
    activeText: '#713f12',
    activeBorder: '#eab308',
    badgeBg: '#FEE600',
    badgeText: '#18181b',
  },
  'Kerry Express': {
    bg: '#fff7ed',
    text: '#9a3412',
    border: '#fed7aa',
    bar: '#ED6B28', // สีส้ม Kerry
    activeBg: '#ffedd5',
    activeText: '#9a3412',
    activeBorder: '#ED6B28',
    badgeBg: '#ED6B28',
    badgeText: '#ffffff',
  },
  'ไปรษณีย์ไทย': {
    bg: '#fff1f2',
    text: '#9f1239',
    border: '#fecdd3',
    bar: '#C8102E', // สีแดงเข้ม ไปรษณีย์ไทย
    activeBg: '#ffe4e6',
    activeText: '#881337',
    activeBorder: '#C8102E',
    badgeBg: '#C8102E',
    badgeText: '#ffffff',
  },
  'J&T Express': {
    bg: '#fef2f2',
    text: '#991b1b',
    border: '#fecaca',
    bar: '#E52329', // สีแดงสว่าง J&T
    activeBg: '#fee2e2',
    activeText: '#991b1b',
    activeBorder: '#E52329',
    badgeBg: '#E52329',
    badgeText: '#ffffff',
  },
  'DHL Express': {
    bg: '#fffbeb',
    text: '#854d0e',
    border: '#fde68a',
    bar: '#FFCC00', // สีเหลืองมัสตาร์ด DHL
    activeBg: '#fffbeb',
    activeText: '#b45309',
    activeBorder: '#FFCC00',
    badgeBg: '#FFCC00',
    badgeText: '#18181b',
  },
}

const CARRIER_TABS: Array<{ key: Carrier | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'ทั้งหมด' },
  ...CARRIERS.map((carrier) => ({ key: carrier, label: carrier })),
]

export default function DeliverySummaryReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const { orders, loading, error, reload } = useOrders()

  const [selectedDate, setSelectedDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'ALL'>('ALL')
  const [carrierFilter, setCarrierFilter] = useState<Carrier | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedLabel, setSelectedLabel] = useState<DeliveryRecord | null>(null)
  const [showAllLabelsModal, setShowAllLabelsModal] = useState(false)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const role = user!.role

  const records = useMemo(() => buildDeliveryRecords(orders), [orders])

  // A summary belongs to one day (DeliverySummary.summaryDate). The picker opens on the
  // most recent day that actually has parcels instead of a fixed date, so the report is
  // never blank on first load.
  const summaryDate = useMemo(() => selectedDate || summaryDates(records)[0] || '', [
    records,
    selectedDate,
  ])

  const dayRecords = useMemo(
    () => records.filter((record) => record.date === summaryDate),
    [records, summaryDate],
  )

  const carrierStats = useMemo(() => carrierBreakdown(dayRecords), [dayRecords])

  const carrierCounts = useMemo(() => {
    const counts = Object.fromEntries(carrierStats.map((stat) => [stat.carrier, stat.count])) as
      Record<Carrier | 'ALL', number>
    counts.ALL = dayRecords.length
    return counts
  }, [carrierStats, dayRecords])

  const filteredDeliveries = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()
    return dayRecords.filter((record) => {
      if (statusFilter !== 'ALL' && record.status !== statusFilter) return false
      if (carrierFilter !== 'ALL' && record.carrier !== carrierFilter) return false
      if (!needle) return true
      return (
        record.orderCode.toLowerCase().includes(needle) ||
        record.customerName.toLowerCase().includes(needle) ||
        record.trackingNumber.toLowerCase().includes(needle) ||
        record.carrier.toLowerCase().includes(needle)
      )
    })
  }, [dayRecords, searchTerm, statusFilter, carrierFilter])

  if (!can.viewDeliveryReport(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูรายงานสรุปการจัดส่งพัสดุ"
            description="รายงานสรุปการจัดส่งเปิดให้พนักงานขาย พนักงานคลังสินค้า พนักงานจัดส่ง และผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  // DeliverySummary.totalParcels and the money that rode with them, for the chosen day.
  const totalParcels = dayRecords.length
  const totalRevenue = dayRecords.reduce((sum, record) => sum + record.orderValue, 0)
  const totalShipping = dayRecords.reduce((sum, record) => sum + record.shippingFee, 0)
  const activeCarriersCount = carrierStats.filter((stat) => stat.count > 0).length
  const trackedCount = dayRecords.filter((record) => record.trackingNumber.trim() !== '').length
  const trackedPercent = totalParcels === 0 ? 0 : Math.round((trackedCount / totalParcels) * 100)

  const pageCount = Math.max(1, Math.ceil(filteredDeliveries.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filteredDeliveries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // The prototype has no PDF writer behind it; the delay stands in for the round trip so
  // the button shows the state the real screen would.
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true)
    setTimeout(() => {
      setIsGeneratingPdf(false)
      notify('success', 'ดาวน์โหลดรายงานสรุปบัญชีพัสดุจัดส่งประจำวัน (PDF) เรียบร้อยแล้ว')
    }, 1000)
  }

  const handleCopyTracking = async (tracking: string) => {
    try {
      await navigator.clipboard.writeText(tracking)
      notify('info', `คัดลอกหมายเลขพัสดุ ${tracking} แล้ว`)
    } catch {
      notify('error', 'คัดลอกหมายเลขพัสดุไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง')
    }
  }

  return (
    <div className="admin-page delivery-report-page">
      <Breadcrumb
        items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'สรุปการจัดส่งพัสดุ' }]}
      />

      {/* Page Header */}
      <div className="delivery-report__head">
        <div className="delivery-report__title-wrap">
          <h1 className="admin-page__title">สรุปยอดการจัดส่งพัสดุ</h1>
          <p className="admin-page__subtitle">สรุปพัสดุจัดส่งประจำวัน แยกตามผู้ให้บริการ</p>
        </div>

        {/* Top Bar Actions */}
        <div className="delivery-report__actions">
          <div className="delivery-report__date-picker">
            <Icon name="clock" size={14} />
            <input
              type="date"
              value={summaryDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setPage(1)
              }}
              title="เลือกวันที่สรุปรายงาน"
            />
          </div>

          {/* Revenue Summary Modal Trigger Button */}
          <button
            type="button"
            className="btn btn-revenue-summary"
            onClick={() => setShowRevenueModal(true)}
            title="ดูสรุปยอดโอนรวมเฉพาะออเดอร์ที่จัดส่งแล้ว"
          >
            <Icon name="tag" size={15} />
            <span>ดูสรุปยอดรวมรายได้</span>
          </button>

          <button
            type="button"
            className="btn btn-outline delivery-report__btn-secondary"
            onClick={() => setShowAllLabelsModal(true)}
            title="พิมพ์ใบปะหน้าพัสดุทั้งหมด"
          >
            <Icon name="printer" size={15} />
            <span>พิมพ์ใบปะหน้า</span>
          </button>

          <button
            type="button"
            className="btn btn-primary delivery-report__btn-primary"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
          >
            <Icon name="download" size={15} />
            <span>{isGeneratingPdf ? 'กำลังสร้างรายงาน...' : 'ดาวน์โหลดรายงาน PDF'}</span>
          </button>
        </div>
      </div>

      {/* Compact Book Inventory Note Banner */}
      <section className="delivery-report__banner">
        <div className="delivery-report__banner-icon">
          <Icon name="package" size={15} />
        </div>
        <div className="delivery-report__banner-text">
          <strong>หมายเหตุการแพ็กหนังสือ:</strong>{' '}
          ตรวจสอบความสมบูรณ์ของกล่องพัสดุและเลข Tracking ทุกครั้งก่อนส่งมอบ
        </div>
      </section>

      {/* KPI Metrics Cards — the day chosen above */}
      <section className="delivery-report__kpis">
        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon">
            <Icon name="shopping-bag" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">ยอดออเดอร์จัดส่งประจำวัน</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">{totalParcels}</span>
              <span className="delivery-kpi-card__unit">ออเดอร์</span>
            </div>
            <span className="delivery-kpi-card__note">
              <Icon name="check-circle" size={12} /> เฉพาะรายการที่จัดส่งแล้ว
            </span>
          </div>
        </div>

        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon delivery-kpi-card__icon--revenue">
            <Icon name="tag" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">ยอดรวมรายได้ประจำวัน</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">{formatPrice(totalRevenue)}</span>
            </div>
            <div className="delivery-kpi-card__note-row">
              <span className="delivery-kpi-card__note">คิดจากยอดโอนจริง (ส่งฟรี)</span>
              <button
                type="button"
                className="delivery-kpi-card__link-btn"
                onClick={() => setShowRevenueModal(true)}
              >
                ดูสรุปยอด
              </button>
            </div>
          </div>
        </div>

        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon">
            <Icon name="truck" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">จำนวนบริษัทขนส่ง</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">{activeCarriersCount}</span>
              <span className="delivery-kpi-card__unit">ขนส่ง</span>
            </div>
            <span className="delivery-kpi-card__note">จากที่ใช้งานได้ {CARRIERS.length} ราย</span>
          </div>
        </div>

        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon delivery-kpi-card__icon--success">
            <Icon name="shield" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">พัสดุที่ระบุเลข Tracking</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">{trackedPercent}%</span>
            </div>
            <span className="delivery-kpi-card__note">
              {trackedCount} จาก {totalParcels} รายการ
            </span>
          </div>
        </div>
      </section>

      {/* Full-Width Parcel Table Card */}
      <div className="delivery-report__table-card admin-card">
        {/* Carrier Tabs Filter Bar */}
        <div className="carrier-tabs-bar">
          <div className="carrier-tabs">
            {CARRIER_TABS.map((tab) => {
              const isSelected = carrierFilter === tab.key
              const count = carrierCounts[tab.key] ?? 0
              const colorInfo = CARRIER_COLORS[tab.key]

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`carrier-tab ${isSelected ? 'carrier-tab--active' : ''}`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: colorInfo.activeBg,
                          borderColor: colorInfo.activeBorder,
                          color: colorInfo.activeText,
                          boxShadow: `0 2px 8px ${colorInfo.activeBorder}35`,
                        }
                      : undefined
                  }
                  onClick={() => {
                    setCarrierFilter(tab.key)
                    setPage(1)
                  }}
                  title={`กรองพัสดุเฉพาะ ${tab.label}`}
                >
                  <span
                    className="carrier-tab__dot"
                    style={{
                      backgroundColor: colorInfo.bar,
                      borderColor:
                        tab.key === 'Flash Express' || tab.key === 'DHL Express'
                          ? '#ca8a04'
                          : undefined,
                    }}
                  />
                  <span className="carrier-tab__label">{tab.label}</span>
                  <span
                    className={`carrier-tab__badge ${
                      isSelected ? 'carrier-tab__badge--active' : ''
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: colorInfo.badgeBg,
                            color: colorInfo.badgeText,
                            borderColor: colorInfo.badgeBg,
                          }
                        : undefined
                    }
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Table Controls & Title Header */}
        <div className="parcel-table__header">
          <div className="parcel-table__title-area">
            <h2 className="parcel-table__title">
              {carrierFilter === 'ALL'
                ? 'ตารางรายการพัสดุจัดส่งแล้วทั้งหมด'
                : `ตารางรายการพัสดุ (${carrierFilter})`}
            </h2>
            <span className="parcel-table__count-chip">{filteredDeliveries.length} รายการ</span>
          </div>

          {/* Search & Status Filter Controls */}
          <div className="parcel-table__controls">
            <div className="parcel-table__search">
              <Icon name="search" size={14} />
              <input
                type="search"
                placeholder="ค้นหาเลข SO ลูกค้า หรือ Tracking"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="parcel-table__filter-selects">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as DeliveryStatus | 'ALL')
                  setPage(1)
                }}
                className="parcel-table__select"
                title="กรองตามสถานะการจัดส่ง"
              >
                <option value="ALL">สถานะทั้งหมด</option>
                <option value="SHIPPED">{DELIVERY_STATUS_LABELS.SHIPPED}</option>
                <option value="DELIVERED">{DELIVERY_STATUS_LABELS.DELIVERED}</option>
              </select>

              {(carrierFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm parcel-table__reset-btn"
                  onClick={() => {
                    setCarrierFilter('ALL')
                    setStatusFilter('ALL')
                    setSearchTerm('')
                    setPage(1)
                  }}
                  title="ล้างตัวกรองทั้งหมด"
                >
                  <Icon name="close" size={13} />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Full Width Table Wrapper */}
        <div className="parcel-table__wrapper">
          <table className="parcel-table">
            <thead>
              <tr>
                <th>รหัสคำสั่งซื้อ</th>
                <th>ชื่อลูกค้า</th>
                <th>ชื่อขนส่ง</th>
                <th>หมายเลขพัสดุ (Tracking)</th>
                <th>ยอดเงินโอน (ส่งฟรี)</th>
                <th>สถานะการจัดส่ง</th>
                <th>วันที่</th>
                <th style={{ textAlign: 'center', width: '56px' }}>พิมพ์</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <LoadingState label="กำลังโหลดข้อมูลพัสดุ…" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8}>
                    <ErrorState message={error} onRetry={() => void reload()} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="parcel-table__empty">
                    ไม่พบข้อมูลพัสดุตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const colorInfo = CARRIER_COLORS[row.carrier]

                  return (
                    <tr key={row.id}>
                      <td>
                        {/* Only a parcel whose order is still in the system gets a link;
                            the seeded history has nothing to open. */}
                        {row.orderId === undefined ? (
                          <span className="parcel-table__order-code">{row.orderCode}</span>
                        ) : (
                          <Link
                            to={`/admin/orders/${row.orderId}`}
                            className="parcel-table__order-link"
                          >
                            {row.orderCode}
                          </Link>
                        )}
                      </td>
                      <td>
                        <div className="parcel-table__customer">
                          <span className="parcel-table__customer-avatar">
                            {row.customerName[0]}
                          </span>
                          <span className="parcel-table__customer-name">{row.customerName}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="parcel-carrier-pill"
                          style={{
                            backgroundColor: colorInfo.bg,
                            color: colorInfo.text,
                            borderColor: colorInfo.border,
                          }}
                        >
                          {row.carrier}
                        </span>
                      </td>
                      <td>
                        <div className="parcel-table__tracking-cell">
                          <code>{row.trackingNumber}</code>
                          <button
                            type="button"
                            className="parcel-table__copy-btn"
                            title="คัดลอกหมายเลขพัสดุ"
                            aria-label={`คัดลอกหมายเลขพัสดุ ${row.trackingNumber}`}
                            onClick={() => handleCopyTracking(row.trackingNumber)}
                          >
                            <Icon name="clipboard" size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="parcel-table__amount">{formatPrice(row.orderValue)}</span>
                      </td>
                      <td>
                        <StatusBadge tone={DELIVERY_STATUS_TONES[row.status]}>
                          {DELIVERY_STATUS_LABELS[row.status]}
                        </StatusBadge>
                      </td>
                      <td className="parcel-table__date">{row.date}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="parcel-table__icon-print-btn"
                          onClick={() => setSelectedLabel(row)}
                          title={`พิมพ์ใบปะหน้า ${row.orderCode}`}
                          aria-label={`พิมพ์ใบปะหน้า ${row.orderCode}`}
                        >
                          <Icon name="printer" size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="parcel-table__pagination">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={filteredDeliveries.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* Revenue Summary Modal — สรุปยอดรวมรายได้เฉพาะออเดอร์ที่จัดส่งแล้ว */}
      {showRevenueModal && (
        <div className="modal-backdrop" onClick={() => setShowRevenueModal(false)}>
          <div
            className="revenue-summary-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="revenue-summary-modal__head">
              <div>
                <h3 className="revenue-summary-modal__title">
                  สรุปยอดรวมรายได้จากการจัดส่งพัสดุ
                </h3>
                <p className="revenue-summary-modal__subtitle">
                  (บริการจัดส่งฟรีทั่วประเทศ) ประจำวันที่ {summaryDate}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowRevenueModal(false)}
                title="ปิด"
                aria-label="ปิด"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="revenue-summary-modal__body">
              {/* Stat Highlight Cards (2 cards side by side) */}
              <div className="revenue-summary__stat-grid">
                <div className="revenue-stat-box revenue-stat-box--primary">
                  <span className="revenue-stat-box__label">ยอดรวมรายได้ทั้งหมดต่อวัน</span>
                  <div className="revenue-stat-box__val">{formatPrice(totalRevenue)}</div>
                  <span className="revenue-stat-box__hint">เฉพาะออเดอร์ที่จัดส่งแล้ว</span>
                </div>

                <div className="revenue-stat-box">
                  <span className="revenue-stat-box__label">จำนวนออเดอร์ที่จัดส่งแล้ว</span>
                  <div className="revenue-stat-box__val">
                    {totalParcels} <small>ออเดอร์</small>
                  </div>
                  <span className="revenue-stat-box__hint">พร้อมระบุเลข Tracking</span>
                </div>
              </div>

              {/* Carrier Revenue Breakdown Table */}
              <div className="revenue-summary__section">
                <h4 className="revenue-summary__section-title">สรุปรายได้แยกตามบริษัทขนส่ง</h4>
                <div className="revenue-summary__table-wrap">
                  <table className="revenue-summary__table">
                    <thead>
                      <tr>
                        <th>บริษัทขนส่ง</th>
                        <th style={{ textAlign: 'center' }}>จำนวนพัสดุ</th>
                        <th style={{ textAlign: 'center' }}>สัดส่วน (%)</th>
                        <th style={{ textAlign: 'right' }}>ค่าจัดส่ง</th>
                        <th style={{ textAlign: 'right' }}>ยอดเงินโอนรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carrierStats.map((stat) => (
                        <tr key={stat.carrier}>
                          <td>
                            <strong>{stat.carrier}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>{stat.count} ออเดอร์</td>
                          <td style={{ textAlign: 'center' }}>{stat.percent}%</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatPrice(stat.shippingTotal)} (ส่งฟรี)
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: 'var(--text-heading)',
                            }}
                          >
                            {formatPrice(stat.totalValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>
                          <strong>รวมทั้งหมด</strong>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {totalParcels} ออเดอร์
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {totalParcels === 0 ? 0 : 100}%
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatPrice(totalShipping)} (ส่งฟรี)
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: 'var(--primary-deep)',
                            fontSize: '15px',
                          }}
                        >
                          {formatPrice(totalRevenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="revenue-summary-modal__actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRevenueModal(false)}
              >
                ปิด
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  window.print()
                  notify('success', 'สั่งพิมพ์รายงานสรุปยอดรายได้เรียบร้อยแล้ว')
                }}
              >
                <Icon name="printer" size={16} />
                <span>พิมพ์รายงานสรุปรายได้</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Shipping Label Modal */}
      {selectedLabel && (
        <div className="modal-backdrop" onClick={() => setSelectedLabel(null)}>
          <div
            className="shipping-label-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="shipping-label-modal__head">
              <h3>ใบปะหน้าพัสดุจัดส่ง (Shipping Label)</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedLabel(null)}
                title="ปิด"
                aria-label="ปิด"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="shipping-label-preview">
              <div className="label-box">
                {/* Label Header */}
                <div className="label-box__header">
                  <div className="label-box__brand">
                    <h2>BookHaven</h2>
                    <span>Online Bookstore</span>
                  </div>
                  <div className="label-box__carrier-tag">
                    <strong>{selectedLabel.carrier}</strong>
                  </div>
                </div>

                <div className="label-box__divider" />

                {/* Tracking & Barcode Simulation */}
                <div className="label-box__barcode-section">
                  <div className="barcode-graphic">
                    <div className="barcode-lines" />
                  </div>
                  <div className="label-box__tracking-code">
                    TRACKING: <strong>{selectedLabel.trackingNumber}</strong>
                  </div>
                </div>

                <div className="label-box__divider" />

                {/* Address Section */}
                <div className="label-box__parties">
                  <div className="label-party label-party--sender">
                    <span className="party-title">ผู้ส่ง (FROM):</span>
                    <p className="party-name">BookHaven Warehouse Hub</p>
                    <p className="party-addr">
                      123/45 ถนนราชพฤกษ์ แขวงบางระมาด เขตตลิ่งชัน กรุงเทพฯ 10170
                    </p>
                    <p className="party-tel">โทร. 02-999-8888</p>
                  </div>

                  <div className="label-party label-party--recipient">
                    <span className="party-title">ผู้รับ (TO):</span>
                    <p className="party-name">{selectedLabel.customerName}</p>
                    <p className="party-addr">{selectedLabel.shippingAddress}</p>
                    <p className="party-meta">
                      รหัสคำสั่งซื้อ: <strong>{selectedLabel.orderCode}</strong> | จำนวน:{' '}
                      {selectedLabel.itemCount} เล่ม
                    </p>
                  </div>
                </div>

                <div className="label-box__divider" />

                {/* Footer details */}
                <div className="label-box__footer">
                  <span>วันที่จัดส่ง: {selectedLabel.date}</span>
                  <span>สถานะ: {DELIVERY_STATUS_LABELS[selectedLabel.status]}</span>
                  <span>ช่องทาง: Standard Delivery (ส่งฟรี)</span>
                </div>
              </div>
            </div>

            <div className="shipping-label-modal__actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSelectedLabel(null)}
              >
                ปิด
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  window.print()
                  notify('success', `สั่งพิมพ์ใบปะหน้า ${selectedLabel.orderCode} สำเร็จ`)
                }}
              >
                <Icon name="printer" size={16} />
                <span>พิมพ์ใบปะหน้า (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Print All Labels Modal */}
      {showAllLabelsModal && (
        <div className="modal-backdrop" onClick={() => setShowAllLabelsModal(false)}>
          <div
            className="shipping-label-modal shipping-label-modal--batch"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="shipping-label-modal__head">
              <h3>พิมพ์ใบปะหน้าพัสดุทั้งหมด ({filteredDeliveries.length} รายการ)</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowAllLabelsModal(false)}
                title="ปิด"
                aria-label="ปิด"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="batch-labels-info">
              <p>
                ระบบเตรียมใบปะหน้าพัสดุสำหรับพิมพ์ต่อเนื่องทั้งหมด{' '}
                <strong>{filteredDeliveries.length} ชุด</strong> แยกตามขนาดกระดาษ 100x150 mm
                (Thermal Printer)
              </p>
              <div className="batch-carrier-pills">
                {carrierStats.map((stat) => (
                  <span key={stat.carrier} className="batch-pill">
                    {stat.carrier}: {stat.count} ใบ
                  </span>
                ))}
              </div>
            </div>

            <div className="shipping-label-modal__actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAllLabelsModal(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  window.print()
                  setShowAllLabelsModal(false)
                  notify(
                    'success',
                    `ส่งคำสั่งพิมพ์ใบปะหน้าพัสดุ ${filteredDeliveries.length} ชุด ไปยังเครื่องพิมพ์เรียบร้อยแล้ว`,
                  )
                }}
              >
                <Icon name="printer" size={18} />
                <span>ยืนยันพิมพ์ทั้งหมด ({filteredDeliveries.length} ใบ)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
