import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { formatPrice } from '../../data/money'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { useOrders } from '../orders/OrderContext'
import {
  formatOrderCode,
  formatOrderDate,
  type CustomerOrder,
} from '../orders/orders'
import './RefundsListPage.css'

type RefundFilter = 'ALL' | 'PENDING' | 'REFUNDED'

export default function RefundsListPage() {
  const { orders, loading, error, reload, confirmRefund } = useOrders()

  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState<RefundFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [refundNote, setRefundNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [modalError, setModalError] = useState('')
  const [copiedAccount, setCopiedAccount] = useState<number | null>(null)

  // Filter only cancelled orders that require refund or have refund info
  const refundOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'CANCELLED' &&
        (o.refundStatus === 'PENDING' ||
          o.refundStatus === 'REFUNDED' ||
          o.refundAccountNo ||
          o.netAmount > 0),
    )
  }, [orders])

  // Statistics
  const pendingRefunds = useMemo(
    () => refundOrders.filter((o) => o.refundStatus === 'PENDING' || !o.refundStatus),
    [refundOrders],
  )
  const pendingTotal = useMemo(
    () => pendingRefunds.reduce((sum, o) => sum + (o.netAmount || 0), 0),
    [pendingRefunds],
  )

  const completedRefunds = useMemo(
    () => refundOrders.filter((o) => o.refundStatus === 'REFUNDED'),
    [refundOrders],
  )
  const completedTotal = useMemo(
    () => completedRefunds.reduce((sum, o) => sum + (o.netAmount || 0), 0),
    [completedRefunds],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return refundOrders
      .filter((order) => {
        if (filter === 'PENDING' && order.refundStatus === 'REFUNDED') return false
        if (filter === 'REFUNDED' && order.refundStatus !== 'REFUNDED') return false
        if (!needle) return true
        return (
          formatOrderCode(order.orderId).toLowerCase().includes(needle) ||
          order.customerName.toLowerCase().includes(needle) ||
          (order.refundBankName || '').toLowerCase().includes(needle) ||
          (order.refundAccountNo || '').toLowerCase().includes(needle) ||
          (order.refundAccountName || '').toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => {
        // Pending first, then newest
        if (a.refundStatus !== 'REFUNDED' && b.refundStatus === 'REFUNDED') return -1
        if (a.refundStatus === 'REFUNDED' && b.refundStatus !== 'REFUNDED') return 1
        return b.orderId - a.orderId
      })
  }, [refundOrders, term, filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleCopy = (orderId: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAccount(orderId)
    setTimeout(() => setCopiedAccount(null), 2000)
  }

  const handleOpenRefundModal = (order: CustomerOrder) => {
    setSelectedOrder(order)
    setRefundNote('')
    setModalError('')
  }

  const handleConfirmRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return
    setConfirming(true)
    setModalError('')
    try {
      await confirmRefund(selectedOrder.orderId, refundNote.trim())
      setSelectedOrder(null)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'การคืนเงินลูกค้า (Refund)' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">รายการคืนเงินลูกค้า (Refund Management)</h1>
          <p className="admin-page__subtitle">คำสั่งซื้อที่ยกเลิกแล้ว {refundOrders.length} รายการ</p>
        </div>
      </div>

      <section className="refunds__stats">
        <StatTile
          label="รอการคืนเงิน"
          value={pendingRefunds.length}
          note={`ยอดรวมที่ต้องโอนคืน ฿ ${formatPrice(pendingTotal)}`}
          icon="dollar-sign"
          tone={pendingRefunds.length > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="คืนเงินแล้ว"
          value={completedRefunds.length}
          note={`ยอดรวมที่คืนแล้ว ฿ ${formatPrice(completedTotal)}`}
          icon="check-circle"
          tone="accent"
        />
        <StatTile
          label="คำสั่งซื้อที่ยกเลิกทั้งหมด"
          value={refundOrders.length}
          note={`ยอดสุทธิรวม ฿ ${formatPrice(pendingTotal + completedTotal)}`}
          icon="shopping-bag"
        />
      </section>

      <section className="admin-card admin-card--flush refunds-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="ค้นหารหัสคำสั่งซื้อ ลูกค้า หรือบัญชีธนาคาร"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <div className="admin-tabs">
            <button
              type="button"
              className={'admin-tabs__tab' + (filter === 'ALL' ? ' admin-tabs__tab--active' : '')}
              onClick={() => {
                setFilter('ALL')
                setPage(1)
              }}
            >
              ทั้งหมด ({refundOrders.length})
            </button>
            <button
              type="button"
              className={'admin-tabs__tab' + (filter === 'PENDING' ? ' admin-tabs__tab--active' : '')}
              onClick={() => {
                setFilter('PENDING')
                setPage(1)
              }}
            >
              รอคืนเงิน ({pendingRefunds.length})
            </button>
            <button
              type="button"
              className={'admin-tabs__tab' + (filter === 'REFUNDED' ? ' admin-tabs__tab--active' : '')}
              onClick={() => {
                setFilter('REFUNDED')
                setPage(1)
              }}
            >
              คืนเงินแล้ว ({completedRefunds.length})
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดรายการคืนเงิน…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="dollar-sign"
            title="ไม่พบรายการคืนเงิน"
            description="ไม่มีรายการคืนเงินที่ตรงกับเงื่อนไขการค้นหา"
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table refunds-table">
                <thead>
                  <tr>
                    <th>รหัสคำสั่งซื้อ</th>
                    <th>วันที่ยกเลิก / สั่งซื้อ</th>
                    <th>ลูกค้า</th>
                    <th className="refunds-table__amount-col">ยอดเงินคืน</th>
                    <th>สถานะ</th>
                    <th>การทำงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => {
                    const isRefunded = order.refundStatus === 'REFUNDED'
                    const hasBankDetails = Boolean(
                      order.refundBankName && order.refundAccountNo,
                    )

                    return (
                      <tr key={order.orderId} className={isRefunded ? 'row--refunded' : ''}>
                        <td className="data-table__code">
                          <Link
                            to={`/admin/orders/${order.orderId}`}
                            className="refunds-table__order-link"
                          >
                            {formatOrderCode(order.orderId)}
                          </Link>
                        </td>
                        <td>
                          <span className="refunds-table__date">
                            {formatOrderDate(order.orderDate)}
                          </span>
                        </td>
                        <td>
                          <div className="refunds-table__customer">
                            <span className="refunds-table__cust-name">{order.customerName}</span>
                            {order.customerEmail && (
                              <span className="refunds-table__cust-email">
                                {order.customerEmail}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="refunds-table__amount-col">
                          <span className="refunds-table__amount">
                            ฿ {formatPrice(order.netAmount)}
                          </span>
                        </td>
                        <td>
                          {isRefunded ? (
                            <StatusBadge tone="success">คืนเงินแล้ว</StatusBadge>
                          ) : hasBankDetails ? (
                            <StatusBadge tone="warning">รอคืนเงิน (พร้อมโอน)</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">รอลูกค้าระบุบัญชี</StatusBadge>
                          )}
                        </td>
                        <td>
                          <div className="data-table__actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title="ดูรายละเอียดการคืนเงิน"
                              onClick={() => handleOpenRefundModal(order)}
                            >
                              <Icon name="eye" size={17} />
                            </button>
                            {!isRefunded && hasBankDetails && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm refunds-table__action-btn"
                                onClick={() => handleOpenRefundModal(order)}
                                title="บันทึกยืนยันการคืนเงิน"
                              >
                                <Icon name="check" size={14} /> คืนเงิน
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </section>

      {/* Modal ดูรายละเอียดและบันทึกการคืนเงินลูกค้า */}
      {selectedOrder && (
        <Modal
          title={
            selectedOrder.refundStatus === 'REFUNDED'
              ? `รายละเอียดการคืนเงิน — ${formatOrderCode(selectedOrder.orderId)}`
              : `รายละเอียดและบันทึกการคืนเงิน — ${formatOrderCode(selectedOrder.orderId)}`
          }
          onClose={() => setSelectedOrder(null)}
        >
          {selectedOrder.refundStatus === 'REFUNDED' ? (
            <div className="refund-modal__view">
              <div className="refund-modal__alert refund-modal__alert--success">
                <Icon name="check-circle" size={20} />
                <div>
                  <strong>คืนเงินเรียบร้อยแล้ว</strong>
                  {selectedOrder.refundedAt && (
                    <span className="refund-modal__alert-sub">
                      {' '}เมื่อ {formatOrderDate(selectedOrder.refundedAt)}
                    </span>
                  )}
                  {selectedOrder.refundedBy && (
                    <span className="refund-modal__alert-sub">
                      {' '}โดย {selectedOrder.refundedBy}
                    </span>
                  )}
                </div>
              </div>

              <div className="refund-modal__summary-card">
                <div className="refund-modal__row">
                  <span className="refund-modal__label">รหัสคำสั่งซื้อ:</span>
                  <span className="refund-modal__val">
                    <Link
                      to={`/admin/orders/${selectedOrder.orderId}`}
                      className="refunds-table__order-link"
                      onClick={() => setSelectedOrder(null)}
                    >
                      {formatOrderCode(selectedOrder.orderId)}
                    </Link>
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ลูกค้า:</span>
                  <span className="refund-modal__val">
                    {selectedOrder.customerName}
                    {selectedOrder.customerEmail ? ` (${selectedOrder.customerEmail})` : ''}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">วันที่สั่งซื้อ:</span>
                  <span className="refund-modal__val">
                    {formatOrderDate(selectedOrder.orderDate)}
                  </span>
                </div>
                {selectedOrder.cancelReason && (
                  <div className="refund-modal__row">
                    <span className="refund-modal__label">เหตุผลที่ยกเลิก:</span>
                    <span className="refund-modal__val refund-modal__val--reason">
                      {selectedOrder.cancelReason}
                    </span>
                  </div>
                )}
                <div className="refund-modal__divider" />
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ยอดเงินที่คืน:</span>
                  <span className="refund-modal__val refund-modal__val--amount">
                    ฿ {formatPrice(selectedOrder.netAmount)}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ธนาคาร / ช่องทาง:</span>
                  <span className="refund-modal__val">
                    {selectedOrder.refundBankName || '—'}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">เลขที่บัญชี:</span>
                  <span className="refund-modal__val refund-modal__val--acc">
                    {selectedOrder.refundAccountNo || '—'}
                    {selectedOrder.refundAccountNo && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm refund-modal__copy-btn"
                        onClick={() =>
                          handleCopy(selectedOrder.orderId, selectedOrder.refundAccountNo || '')
                        }
                      >
                        <Icon
                          name={copiedAccount === selectedOrder.orderId ? 'check' : 'clipboard'}
                          size={13}
                        />
                        {copiedAccount === selectedOrder.orderId ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    )}
                  </span>
                </div>
                {selectedOrder.refundAccountName && (
                  <div className="refund-modal__row">
                    <span className="refund-modal__label">ชื่อบัญชีผู้รับ:</span>
                    <span className="refund-modal__val">{selectedOrder.refundAccountName}</span>
                  </div>
                )}
                {selectedOrder.refundNote && (
                  <div className="refund-modal__row">
                    <span className="refund-modal__label">หมายเหตุการโอน:</span>
                    <span className="refund-modal__val">{selectedOrder.refundNote}</span>
                  </div>
                )}
              </div>

              <div className="refund-modal__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSelectedOrder(null)}
                >
                  ปิด
                </button>
              </div>
            </div>
          ) : (
            <form
              className="refund-modal__form"
              onSubmit={(e) => void handleConfirmRefundSubmit(e)}
            >
              {selectedOrder.refundBankName && selectedOrder.refundAccountNo ? (
                <div className="refund-modal__alert refund-modal__alert--info">
                  <Icon name="dollar-sign" size={20} />
                  <span>
                    กรุณาตรวจสอบข้อมูลบัญชีของลูกค้าและดำเนินการโอนเงินให้เรียบร้อยก่อนกดยืนยัน
                  </span>
                </div>
              ) : (
                <div className="refund-modal__alert refund-modal__alert--warning">
                  <Icon name="alert-triangle" size={20} />
                  <span>
                    ลูกค้ารายนี้ยังไม่ได้ระบุข้อมูลบัญชีธนาคารสำหรับรับเงินคืน กรุณาติดต่อลูกค้าหรือรอลูกค้าระบุข้อมูล
                  </span>
                </div>
              )}

              <div className="refund-modal__summary-card">
                <div className="refund-modal__row">
                  <span className="refund-modal__label">รหัสคำสั่งซื้อ:</span>
                  <span className="refund-modal__val">
                    <Link
                      to={`/admin/orders/${selectedOrder.orderId}`}
                      className="refunds-table__order-link"
                      onClick={() => setSelectedOrder(null)}
                    >
                      {formatOrderCode(selectedOrder.orderId)}
                    </Link>
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ลูกค้า:</span>
                  <span className="refund-modal__val">
                    {selectedOrder.customerName}
                    {selectedOrder.customerEmail ? ` (${selectedOrder.customerEmail})` : ''}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">วันที่สั่งซื้อ:</span>
                  <span className="refund-modal__val">
                    {formatOrderDate(selectedOrder.orderDate)}
                  </span>
                </div>
                {selectedOrder.cancelReason && (
                  <div className="refund-modal__row">
                    <span className="refund-modal__label">เหตุผลที่ยกเลิก:</span>
                    <span className="refund-modal__val refund-modal__val--reason">
                      {selectedOrder.cancelReason}
                    </span>
                  </div>
                )}
                <div className="refund-modal__divider" />
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ยอดเงินที่ต้องโอนคืน:</span>
                  <span className="refund-modal__val refund-modal__val--amount">
                    ฿ {formatPrice(selectedOrder.netAmount)}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">ธนาคาร:</span>
                  <span className="refund-modal__val">
                    {selectedOrder.refundBankName || (
                      <span className="refund-modal__pending-text">รอลูกค้าระบุข้อมูล</span>
                    )}
                  </span>
                </div>
                <div className="refund-modal__row">
                  <span className="refund-modal__label">เลขที่บัญชี:</span>
                  <span className="refund-modal__val refund-modal__val--acc">
                    {selectedOrder.refundAccountNo ? (
                      <>
                        {selectedOrder.refundAccountNo}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm refund-modal__copy-btn"
                          onClick={() =>
                            handleCopy(selectedOrder.orderId, selectedOrder.refundAccountNo || '')
                          }
                        >
                          <Icon
                            name={copiedAccount === selectedOrder.orderId ? 'check' : 'clipboard'}
                            size={13}
                          />
                          {copiedAccount === selectedOrder.orderId ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </>
                    ) : (
                      <span className="refund-modal__pending-text">รอลูกค้าระบุข้อมูล</span>
                    )}
                  </span>
                </div>
                {selectedOrder.refundAccountName && (
                  <div className="refund-modal__row">
                    <span className="refund-modal__label">ชื่อบัญชีผู้รับ:</span>
                    <span className="refund-modal__val">{selectedOrder.refundAccountName}</span>
                  </div>
                )}
              </div>

              {selectedOrder.refundBankName && selectedOrder.refundAccountNo && (
                <label className="refund-modal__input-label">
                  <span>หมายเหตุเพิ่มเติม / รหัสอ้างอิงการโอนเงิน (ถ้ามี)</span>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="เช่น โอนคืนผ่าน K-Plus สลิปอ้างอิง 123456"
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                  />
                </label>
              )}

              {modalError && <p className="refund-modal__error">{modalError}</p>}

              <div className="refund-modal__actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={confirming}
                  onClick={() => setSelectedOrder(null)}
                >
                  {selectedOrder.refundBankName && selectedOrder.refundAccountNo ? 'ยกเลิก' : 'ปิด'}
                </button>
                {selectedOrder.refundBankName && selectedOrder.refundAccountNo && (
                  <button type="submit" className="btn btn-primary" disabled={confirming}>
                    <Icon name="check-circle" size={16} />
                    {confirming ? 'กำลังบันทึก…' : 'ยืนยันว่าคืนเงินลูกค้าแล้ว'}
                  </button>
                )}
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
