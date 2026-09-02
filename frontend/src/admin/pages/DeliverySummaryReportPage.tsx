import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import Breadcrumb from '../components/Breadcrumb'
import Pagination from '../components/Pagination'
import StatusBadge, { type BadgeTone } from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { useOrders } from '../orders/OrderContext'
import './DeliverySummaryReportPage.css'

export interface DeliveryRecord {
  id: string
  orderCode: string
  customerName: string
  carrier: 'Flash Express' | 'Kerry Express' | 'ไปรษณีย์ไทย' | 'J&T Express' | 'DHL Express'
  trackingNumber: string
  status: 'SHIPPED' | 'DELIVERED'
  date: string
  shippingFee: number
  orderValue: number
  shippingAddress: string
  itemCount: number
}

const CARRIER_COLORS: Record<
  string,
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

const CARRIER_TABS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'Flash Express', label: 'Flash Express' },
  { key: 'Kerry Express', label: 'Kerry Express' },
  { key: 'ไปรษณีย์ไทย', label: 'ไปรษณีย์ไทย' },
  { key: 'J&T Express', label: 'J&T Express' },
  { key: 'DHL Express', label: 'DHL Express' },
]

const STATUS_TEXT: Record<DeliveryRecord['status'], string> = {
  SHIPPED: 'จัดส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
}

const STATUS_TONES: Record<DeliveryRecord['status'], BadgeTone> = {
  SHIPPED: 'info',
  DELIVERED: 'success',
}

// Seed delivery records representing daily aggregated parcels (Focus on Delivered Orders)
const SEED_DELIVERIES: DeliveryRecord[] = [
  {
    id: 'DEL-001',
    orderCode: 'SO-1002',
    customerName: 'กัญญา ศรีสาย',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201482',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1250,
    shippingAddress: '199 หมู่ 4 ต.สุรนารี อ.เมือง จ.นครราชสีมา 30000',
    itemCount: 2,
  },
  {
    id: 'DEL-002',
    orderCode: 'SO-1003',
    customerName: 'สมศักดิ์ ใจดี',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237465TH',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 890,
    shippingAddress: '45/7 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    itemCount: 1,
  },
  {
    id: 'DEL-003',
    orderCode: 'SO-1004',
    customerName: 'ธนากร สุขเกษม',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201483',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 2450,
    shippingAddress: '120/15 ถ.พหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900',
    itemCount: 4,
  },
  {
    id: 'DEL-004',
    orderCode: 'SO-1005',
    customerName: 'ปวีณา อุดมศิลป์',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910394',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1680,
    shippingAddress: '78 หมู่ 2 ต.เสม็ด อ.เมือง จ.ชลบุรี 20000',
    itemCount: 3,
  },
  {
    id: 'DEL-005',
    orderCode: 'SO-1006',
    customerName: 'อภิสิทธิ์ วงศ์วิจิตร',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910395',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 920,
    shippingAddress: '333 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    itemCount: 2,
  },
  {
    id: 'DEL-006',
    orderCode: 'SO-1007',
    customerName: 'นริศรา ประเสริฐ',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201484',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1450,
    shippingAddress: '55/9 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240',
    itemCount: 2,
  },
  {
    id: 'DEL-007',
    orderCode: 'SO-1008',
    customerName: 'วรพล รัตนศิริ',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237466TH',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 560,
    shippingAddress: '12 หมู่ 5 ต.ตลาด อ.เมือง จ.สุราษฎร์ธานี 84000',
    itemCount: 1,
  },
  {
    id: 'DEL-008',
    orderCode: 'SO-1009',
    customerName: 'สุภาวดี ทองแท้',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910396',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 3200,
    shippingAddress: '99/4 ถ.ศรีนครินทร์ ต.บางเมือง อ.เมือง จ.สมุทรปราการ 10270',
    itemCount: 5,
  },
  {
    id: 'DEL-009',
    orderCode: 'SO-1010',
    customerName: 'ชัยวัฒน์ บุญลือ',
    carrier: 'J&T Express',
    trackingNumber: 'JNT928174620',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 790,
    shippingAddress: '88 ถ.เพชรเกษม ต.พระปฐมเจดีย์ อ.เมือง จ.นครปฐม 73000',
    itemCount: 1,
  },
  {
    id: 'DEL-010',
    orderCode: 'SO-1011',
    customerName: 'พิมพ์ชนก ชัยชนะ',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201485',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1100,
    shippingAddress: '24/1 ถ.แจ้งวัฒนะ ต.ปากเกร็ด อ.ปากเกร็ด จ.นนทบุรี 11120',
    itemCount: 2,
  },
  {
    id: 'DEL-011',
    orderCode: 'SO-1012',
    customerName: 'กิตติศักดิ์ พรหมมา',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237467TH',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1890,
    shippingAddress: '150 ถ.รอบเมือง ต.หมากแข้ง อ.เมือง จ.อุดรธานี 41000',
    itemCount: 3,
  },
  {
    id: 'DEL-012',
    orderCode: 'SO-1013',
    customerName: 'ลลิตา ธนภัทร',
    carrier: 'DHL Express',
    trackingNumber: 'DHL-481920381',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 4500,
    shippingAddress: '77/1 ถ.สาทรใต้ แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120',
    itemCount: 6,
  },
  {
    id: 'DEL-013',
    orderCode: 'SO-1014',
    customerName: 'พงศ์พิพัฒน์ ศิริพงษ์',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201486',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 640,
    shippingAddress: '14/2 ถ.สุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110',
    itemCount: 1,
  },
  {
    id: 'DEL-014',
    orderCode: 'SO-1015',
    customerName: 'ญาดา เลิศล้ำ',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910397',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1350,
    shippingAddress: '202 ถ.งามวงศ์วาน ต.บางเขน อ.เมือง จ.นนทบุรี 11000',
    itemCount: 2,
  },
  {
    id: 'DEL-015',
    orderCode: 'SO-1016',
    customerName: 'ศราวุธ วัฒนชัย',
    carrier: 'J&T Express',
    trackingNumber: 'JNT928174621',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 980,
    shippingAddress: '56 หมู่ 3 ต.บ้านคลอง อ.เมือง จ.พิษณุโลก 65000',
    itemCount: 2,
  },
  {
    id: 'DEL-016',
    orderCode: 'SO-1017',
    customerName: 'เบญจวรรณ พัฒนศิริ',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237468TH',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 2150,
    shippingAddress: '89/1 ถ.ศรีจันทร์ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    itemCount: 3,
  },
]

export default function DeliverySummaryReportPage() {
  const { notify } = useToast()
  const { orders } = useOrders()

  const [selectedDate, setSelectedDate] = useState('2026-08-29')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedLabel, setSelectedLabel] = useState<DeliveryRecord | null>(null)
  const [showAllLabelsModal, setShowAllLabelsModal] = useState(false)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Merge live orders (only SHIPPED and DELIVERED with tracking) with seed deliveries
  const deliveredDeliveries = useMemo(() => {
    const liveDeliveredOrders = orders
      .filter((o) => o.status === 'SHIPPED' || o.status === 'DELIVERED')
      .map((o, idx): DeliveryRecord => ({
        id: `LIVE-${o.orderId}`,
        orderCode: `SO-${o.orderId}`,
        customerName: o.customerName,
        carrier: (o.shipment?.carrier as any) || (idx % 2 === 0 ? 'Flash Express' : 'Kerry Express'),
        trackingNumber: o.shipment?.trackingNumber || `TH-FL${99000000 + o.orderId}`,
        status: o.status === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED',
        date: o.orderDate || '2026-08-29',
        shippingFee: 0, // สินค้าส่งฟรี
        orderValue: Math.round(o.netAmount * 35),
        shippingAddress: o.shippingAddress,
        itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
      }))

    // Combine distinct by orderCode
    const existingCodes = new Set(liveDeliveredOrders.map((d) => d.orderCode))
    const filteredSeeds = SEED_DELIVERIES.filter((s) => !existingCodes.has(s.orderCode))
    return [...liveDeliveredOrders, ...filteredSeeds]
  }, [orders])

  // Total metrics calculated strictly for delivered orders (สินค้าส่งฟรี คิดจากยอดเงินโอนจริง)
  const totalDeliveredOrders = deliveredDeliveries.length
  const totalRevenue = useMemo(
    () => deliveredDeliveries.reduce((sum, item) => sum + item.orderValue, 0),
    [deliveredDeliveries],
  )
  const averageOrderValue = totalDeliveredOrders > 0 ? Math.round(totalRevenue / totalDeliveredOrders) : 0

  // Carrier Stats for Left Column Breakdown (Dynamically aggregated from delivered orders only)
  const carrierStats = useMemo(() => {
    const carriersList: DeliveryRecord['carrier'][] = [
      'Flash Express',
      'Kerry Express',
      'ไปรษณีย์ไทย',
      'J&T Express',
      'DHL Express',
    ]

    const map: Record<string, { count: number; totalValue: number }> = {}
    carriersList.forEach((c) => {
      map[c] = { count: 0, totalValue: 0 }
    })

    deliveredDeliveries.forEach((item) => {
      if (map[item.carrier]) {
        map[item.carrier].count += 1
        map[item.carrier].totalValue += item.orderValue
      }
    })

    const total = totalDeliveredOrders || 1
    return carriersList.map((carrierName) => {
      const data = map[carrierName] || { count: 0, totalValue: 0 }
      return {
        name: carrierName,
        count: data.count,
        totalValue: data.totalValue,
        percent: Math.round((data.count / total) * 1000) / 10,
        colorKey: carrierName,
      }
    })
  }, [deliveredDeliveries, totalDeliveredOrders])

  // Carrier Counts for Carrier Filter Tabs
  const carrierCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: deliveredDeliveries.length,
      'Flash Express': 0,
      'Kerry Express': 0,
      'ไปรษณีย์ไทย': 0,
      'J&T Express': 0,
      'DHL Express': 0,
    }
    deliveredDeliveries.forEach((d) => {
      if (counts[d.carrier] !== undefined) {
        counts[d.carrier] += 1
      }
    })
    return counts
  }, [deliveredDeliveries])

  const activeCarriersCount = carrierStats.filter((c) => c.count > 0).length

  // Filtered deliveries for Table
  const filteredDeliveries = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()
    return deliveredDeliveries.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (carrierFilter !== 'ALL' && item.carrier !== carrierFilter) return false
      if (!needle) return true
      return (
        item.orderCode.toLowerCase().includes(needle) ||
        item.customerName.toLowerCase().includes(needle) ||
        item.trackingNumber.toLowerCase().includes(needle) ||
        item.carrier.toLowerCase().includes(needle)
      )
    })
  }, [deliveredDeliveries, searchTerm, statusFilter, carrierFilter])

  const pageCount = Math.max(1, Math.ceil(filteredDeliveries.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filteredDeliveries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Top Bar Action: Download PDF Report
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true)
    setTimeout(() => {
      setIsGeneratingPdf(false)
      notify('success', 'ดาวน์โหลดรายงานสรุปบัญชีพัสดุจัดส่งประจำวัน (PDF) เรียบร้อยแล้ว')
    }, 1000)
  }

  // Top Bar Action: Print Shipping Labels
  const handlePrintLabels = () => {
    setShowAllLabelsModal(true)
  }

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking)
    notify('info', `คัดลอกหมายเลขพัสดุ ${tracking} แล้ว`)
  }

  return (
    <div className="admin-page delivery-report-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'สรุปการจัดส่งพัสดุ' },
        ]}
      />

      {/* Page Header */}
      <div className="delivery-report__head">
        <div className="delivery-report__title-wrap">
          <h1 className="admin-page__title">สรุปยอดการจัดส่งพัสดุ</h1>
          <p className="admin-page__subtitle">
            จัดทำรายงานสรุปบัญชีพัสดุจัดส่ง และสรุปยอดคัดแยกประเภทการส่งมอบพัสดุประจำวัน
          </p>
        </div>

        {/* Top Bar Actions */}
        <div className="delivery-report__actions">
          <div className="delivery-report__date-picker">
            <Icon name="clock" size={14} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
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
            onClick={handlePrintLabels}
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
            <span>{isGeneratingPdf ? 'กำลังสร้างรายงาน...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Compact Book Inventory Note Banner */}
      <section className="delivery-report__banner">
        <div className="delivery-report__banner-icon">
          <Icon name="package" size={15} />
        </div>
        <div className="delivery-report__banner-text">
          <strong>Book Inventory Note:</strong> ตรวจสอบความสมบูรณ์ของกล่องพัสดุและเลข Tracking ทุกครั้งก่อนส่งมอบ
        </div>
      </section>

      {/* KPI Metrics Cards (Top Row - Focus on Delivered Orders) */}
      <section className="delivery-report__kpis">
        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon">
            <Icon name="shopping-bag" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">ยอดออเดอร์จัดส่งประจำวัน</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">{totalDeliveredOrders}</span>
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
              <span className="delivery-kpi-card__value">฿ {totalRevenue.toLocaleString()}</span>
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
            <span className="delivery-kpi-card__note">Flash, Kerry, ปณท, J&T, DHL</span>
          </div>
        </div>

        <div className="delivery-kpi-card">
          <div className="delivery-kpi-card__icon delivery-kpi-card__icon--success">
            <Icon name="shield" size={18} />
          </div>
          <div className="delivery-kpi-card__content">
            <span className="delivery-kpi-card__label">สถานะการจัดส่ง</span>
            <div className="delivery-kpi-card__val-row">
              <span className="delivery-kpi-card__value">100%</span>
            </div>
            <span className="delivery-kpi-card__note">
              ระบุเลข Tracking ครบถ้วน
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
              const count = carrierCounts[tab.key] || 0
              const colorInfo = CARRIER_COLORS[tab.key] || CARRIER_COLORS['ALL']

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
            <span className="parcel-table__count-chip">
              {filteredDeliveries.length} รายการ
            </span>
          </div>

          {/* Search & Status Filter Controls */}
          <div className="parcel-table__controls">
            <div className="parcel-table__search">
              <Icon name="search" size={14} />
              <input
                type="search"
                placeholder="ค้นหา SO-, ลูกค้า หรือ Tracking..."
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
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="parcel-table__select"
                title="กรองตามสถานะการจัดส่ง"
              >
                <option value="ALL">สถานะทั้งหมด</option>
                <option value="SHIPPED">จัดส่งแล้ว</option>
                <option value="DELIVERED">ส่งถึงแล้ว</option>
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="parcel-table__empty">
                    ไม่พบข้อมูลพัสดุตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const colorInfo =
                    CARRIER_COLORS[row.carrier] || CARRIER_COLORS['Flash Express']

                  return (
                    <tr key={row.id}>
                      <td>
                        <Link
                          to={`/admin/orders/${row.orderCode.replace('SO-', '')}`}
                          className="parcel-table__order-link"
                        >
                          {row.orderCode}
                        </Link>
                      </td>
                      <td>
                        <div className="parcel-table__customer">
                          <span className="parcel-table__customer-avatar">
                            {row.customerName[0]}
                          </span>
                          <span className="parcel-table__customer-name">
                            {row.customerName}
                          </span>
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
                            onClick={() => handleCopyTracking(row.trackingNumber)}
                          >
                            <Icon name="check" size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="parcel-table__amount">
                          ฿ {row.orderValue.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <StatusBadge tone={STATUS_TONES[row.status]}>
                          {STATUS_TEXT[row.status]}
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
        {filteredDeliveries.length > pageSize && (
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
        )}
      </div>

      {/* Revenue Summary Modal (Modal สรุปยอดรวมรายได้เฉพาะออเดอร์ที่จัดส่งแล้ว) */}
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
                  (บริการจัดส่งฟรีทั่วประเทศ) ประจำวันที่ {selectedDate}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowRevenueModal(false)}
                title="ปิด"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="revenue-summary-modal__body">
              {/* Stat Highlight Cards (2 cards side by side) */}
              <div className="revenue-summary__stat-grid">
                <div className="revenue-stat-box revenue-stat-box--primary">
                  <span className="revenue-stat-box__label">ยอดรวมรายได้ทั้งหมดต่อวัน</span>
                  <div className="revenue-stat-box__val">฿ {totalRevenue.toLocaleString()}</div>
                  <span className="revenue-stat-box__hint">เฉพาะออเดอร์ที่จัดส่งแล้ว</span>
                </div>

                <div className="revenue-stat-box">
                  <span className="revenue-stat-box__label">จำนวนออเดอร์ที่จัดส่งแล้ว</span>
                  <div className="revenue-stat-box__val">{totalDeliveredOrders} <small>ออเดอร์</small></div>
                  <span className="revenue-stat-box__hint">พร้อมระบุเลข Tracking</span>
                </div>
              </div>

              {/* Carrier Revenue Breakdown Table */}
              <div className="revenue-summary__section">
                <h4 className="revenue-summary__section-title">
                  สรุปรายได้แยกตามบริษัทขนส่ง
                </h4>
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
                      {carrierStats.map((c) => (
                        <tr key={c.name}>
                          <td>
                            <strong>{c.name}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>{c.count} ออเดอร์</td>
                          <td style={{ textAlign: 'center' }}>{c.percent}%</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            ฿ 0 (ส่งฟรี)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-heading)' }}>
                            ฿ {c.totalValue.toLocaleString()}
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
                          {totalDeliveredOrders} ออเดอร์
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>100%</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>฿ 0 (ส่งฟรี)</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-deep)', fontSize: '15px' }}>
                          ฿ {totalRevenue.toLocaleString()}
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
                  <span>สถานะ: {STATUS_TEXT[selectedLabel.status]}</span>
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
          >
            <div className="shipping-label-modal__head">
              <h3>พิมพ์ใบปะหน้าพัสดุทั้งหมด ({filteredDeliveries.length} รายการ)</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowAllLabelsModal(false)}
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
                {carrierStats.map((c) => (
                  <span key={c.name} className="batch-pill">
                    {c.name}: {c.count} ใบ
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

