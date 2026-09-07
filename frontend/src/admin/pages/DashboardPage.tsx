import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABELS } from '../../auth/roles'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Meter from '../components/Meter'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import { buildDeliveryRecords, summaryDates } from '../delivery/delivery'
import { useInventory } from '../inventory/InventoryContext'
import { stockLevel } from '../inventory/inventory'
import { useOrders } from '../orders/OrderContext'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPRCode,
  poDisplayStatus,
} from '../purchasing/purchasing'
import { useReviews } from '../reviews/ReviewContext'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import './DashboardPage.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const supplier = useSuppliers()
  const book = useBooks()
  const inventory = useInventory()
  const purchasing = usePurchasing()
  const order = useOrders()
  const review = useReviews()

  const { suppliers } = supplier
  const { books } = book
  const { belowReorder, items, pendingReports } = inventory
  const { requisitions, orders, returns, budget } = purchasing
  const { orders: customerOrders } = order
  const { unrepliedCount, reportedCount } = review

  const role = user!.role
  // Wait only for resources used by this role. A forbidden subsystem must not
  // prevent sales or delivery staff from opening their own dashboard.
  const sources: { loading: boolean; error: string | null; reload: () => Promise<void> }[] = [order]
  if (can.viewSuppliers(role)) sources.push(supplier)
  if (can.viewBooks(role)) sources.push(book)
  if (can.viewStock(role)) sources.push(inventory)
  if (can.viewPurchasing(role)) sources.push(purchasing)
  if (can.moderateReview(role)) sources.push(review)
  const loading = sources.some((source) => source.loading)
  const failed = sources.find((source) => source.error)

  const outOfStock = items.filter((item) => stockLevel(item) === 'OUT').length
  const lowStock = items.filter((item) => stockLevel(item) === 'LOW').length

  const pending = requisitions.filter((pr) => pr.status === 'SUBMITTED')
  const rejected = requisitions.filter((pr) => pr.status === 'REJECTED')
  const awaitingSend = orders.filter((po) => poDisplayStatus(po) === 'AWAITING_SEND')
  const awaitingConfirm = orders.filter((po) => poDisplayStatus(po) === 'AWAITING_CONFIRM')
  const readyToReceive = orders.filter((po) => {
    const display = poDisplayStatus(po)
    return display === 'CONFIRMED' || display === 'RECEIVED_PARTIAL'
  })
  const openReturns = returns.filter((entry) => entry.status !== 'CLOSED')

  // Customer order aggregations
  const ordersToPack = customerOrders.filter(
    (o) => o.status === 'PAID' || o.status === 'PACKING',
  )
  const salesPendingOrders = customerOrders.filter(
    (o) => o.status === 'PENDING_CONFIRM' || o.status === 'VERIFYING_PAYMENT',
  )
  const deliveryReadyOrders = customerOrders.filter(
    (o) => o.status === 'READY_TO_SHIP' || o.status === 'SHIPPED',
  )
  const pendingRefundOrders = customerOrders.filter(
    (o) =>
      o.status === 'CANCELLED' &&
      (o.refundStatus === 'PENDING' || (!o.refundStatus && o.netAmount > 0)),
  )

  // Same reading as the delivery summary report, which also opens on the latest day.
  const deliveryRecords = buildDeliveryRecords(customerOrders)
  const latestSummaryDate = summaryDates(deliveryRecords)[0]
  const latestSummaryParcels = deliveryRecords.filter(
    (record) => record.date === latestSummaryDate,
  ).length

  // งบประมาณมาจาก `GET /api/purchasing/budget` เหมือนแถบบน SCR-23 ไม่ใช่ค่าคงที่ฝั่งหน้าจอ
  const remaining = budget.remaining
  const remainingPercent = budget.budget > 0 ? (remaining / budget.budget) * 100 : 0
  const budgetTone = remaining < 0 ? 'danger' : remainingPercent <= 30 ? 'warning' : 'accent'

  const activeSuppliers = suppliers.filter((entry) => entry.status === 'ACTIVE')
  const supplierName = (supplierId: number) =>
    suppliers.find((entry) => entry.supplierId === supplierId)?.companyName ?? '—'

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลสรุปประจำวัน…" />
        </section>
      </div>
    )
  }

  if (failed?.error) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={failed.error} onRetry={() => void failed.reload()} />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">สวัสดี {user!.name}</h1>
          <p className="admin-page__subtitle">
            {ROLE_LABELS[role]} · สรุปงานที่ต้องดำเนินการวันนี้
          </p>
        </div>
      </div>

      {can.approveRequisition(role) && (
        <>
          <section className="dash__row">
            <StatTile
              label="จัดการรีวิวที่มีปัญหา"
              value={reportedCount}
              note={
                reportedCount > 0
                  ? `พบรีวิวที่ถูกรายงาน ${reportedCount} รายการ`
                  : 'ไม่มีรีวิวที่มีปัญหา'
              }
              icon="alert-triangle"
              tone={reportedCount > 0 ? 'danger' : 'default'}
              to="/admin/reviews/manage"
            />
            <StatTile
              label="ตรวจสอบรีวิว"
              value={unrepliedCount}
              note={
                unrepliedCount > 0 ? `รอตอบกลับ ${unrepliedCount} รายการ` : 'ไม่มีรีวิวค้างตรวจสอบ'
              }
              icon="star"
              tone={unrepliedCount > 0 ? 'warning' : 'default'}
              to="/admin/reviews"
            />
            <StatTile
              label="ใบสั่งซื้อรออนุมัติ"
              value={pending.length}
              note="รอการพิจารณาของผู้จัดการร้าน"
              icon="file-text"
              tone={pending.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
            />
            <StatTile
              label="คำสั่งซื้อลูกค้า"
              value={customerOrders.length}
              icon="shopping-bag"
              to="/admin/orders"
            />
            <StatTile
              label="รายการคืนเงิน"
              value={pendingRefundOrders.length}
              note={
                pendingRefundOrders.length > 0
                  ? `รอการโอนเงินคืน ${pendingRefundOrders.length} รายการ`
                  : 'ไม่มีรายการรอคืนเงิน'
              }
              icon="dollar-sign"
              tone={pendingRefundOrders.length > 0 ? 'warning' : 'default'}
              to="/admin/refunds"
            />
            <StatTile
              label="ผู้จัดจำหน่ายที่ใช้งานอยู่"
              value={activeSuppliers.length}
              note={`จากทั้งหมด ${suppliers.length} ราย`}
              icon="building"
              to="/admin/suppliers"
            />
            <StatTile
              label="รายงานผลต่างรออนุมัติ"
              value={pendingReports.length}
              note="ยอดหนังสือไม่ตรงจากการตรวจนับ"
              icon="alert-triangle"
              tone={pendingReports.length > 0 ? 'warning' : 'default'}
              to="/admin/stock/discrepancies"
            />
            <article className="dash__budget">
              <header className="dash__budget-head">
                <Icon name="shield" size={18} />
                <h3>งบประมาณจัดซื้อคงเหลือ</h3>
              </header>
              <p className="dash__budget-value">฿ {formatBaht(remaining)}</p>
              <Meter
                percent={remainingPercent}
                tone={budgetTone}
                label={`งบประมาณคงเหลือ ${Math.round(remainingPercent)} เปอร์เซ็นต์`}
              />
              <p className="dash__budget-note">
                คงเหลือ {Math.round(remainingPercent)}% จากงบทั้งหมด ฿{' '}
                {formatBaht(budget.budget)}
              </p>
            </article>
          </section>

          <section className="admin-card dash__inbox">
            <h2 className="dash__inbox-title">กล่องงานรออนุมัติ</h2>
            {pending.length === 0 ? (
              <p className="dash__empty">ไม่มีใบขอสั่งซื้อรอการพิจารณา</p>
            ) : (
              <ul className="dash__list">
                {pending.map((pr) => (
                  <li key={pr.prId}>
                    <span className="dash__code">{formatPRCode(pr.prId)}</span>
                    <span className="dash__name">
                      {formatSupplierCode(pr.supplierId)} · {supplierName(pr.supplierId)}
                    </span>
                    <span className="dash__amount">
                      ฿ {formatBaht(documentTotal(pr.items))}
                    </span>
                    <span className="dash__meta">ผู้ขอ {pr.requestedBy}</span>
                    <StatusBadge tone="warning">รออนุมัติ</StatusBadge>
                    <Link
                      to={`/admin/purchasing/pr/${pr.prId}/approve`}
                      className="btn btn-outline btn-sm"
                    >
                      เปิดพิจารณา
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {can.createRequisition(role) && (
        <>
          <section className="dash__row">
            <StatTile
              label="สินค้าถึงจุดสั่งซื้อ"
              value={belowReorder.length}
              note="ต่ำกว่าจุดสั่งซื้อ"
              icon="bell"
              tone={belowReorder.length > 0 ? 'danger' : 'default'}
              to="/admin/alerts"
            />
            <StatTile
              label="คำสั่งซื้อลูกค้า"
              value={ordersToPack.length}
              note={
                ordersToPack.length > 0 ? `รอแพ็ก ${ordersToPack.length} รายการ` : 'ไม่มีคำสั่งซื้อที่ต้องจัดเตรียม'
              }
              icon="shopping-bag"
              tone={ordersToPack.length > 0 ? 'accent' : 'default'}
              to="/admin/orders"
            />
            <StatTile
              label="ใบสั่งซื้อรอส่ง"
              value={awaitingSend.length}
              note={`รอผู้จัดจำหน่ายยืนยันอีก ${awaitingConfirm.length} ใบ`}
              icon="mail"
              tone={awaitingSend.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
            />
            <StatTile
              label="รอรับสินค้าเข้าคลัง"
              value={readyToReceive.length}
              note="พร้อมตรวจรับ"
              icon="package"
              tone={readyToReceive.length > 0 ? 'accent' : 'default'}
              to="/admin/purchasing/receipts"
            />
            <StatTile
              label="ใบส่งคืนที่ยังไม่ปิด"
              value={openReturns.length}
              note="รอการชดเชย"
              icon="truck"
              tone={openReturns.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
            />
            <StatTile
              label="หนังสือหมดสต็อก"
              value={outOfStock}
              icon="alert-triangle"
              tone={outOfStock > 0 ? 'danger' : 'default'}
              to="/admin/stock/low"
            />
            <StatTile
              label="หนังสือใกล้หมด"
              value={lowStock}
              icon="trending-down"
              tone={lowStock > 0 ? 'warning' : 'default'}
              to="/admin/stock/low"
            />
          </section>

          {rejected.length > 0 && (
            <section className="admin-card dash__inbox">
              <h2 className="dash__inbox-title">ใบขอสั่งซื้อที่ถูกตีกลับ</h2>
              <ul className="dash__list">
                {rejected.map((pr) => (
                  <li key={pr.prId}>
                    <span className="dash__code">{formatPRCode(pr.prId)}</span>
                    <span className="dash__name">
                      {formatSupplierCode(pr.supplierId)} · {supplierName(pr.supplierId)}
                    </span>
                    <span className="dash__meta">{pr.rejectionReason}</span>
                    <StatusBadge tone="danger">ตีกลับ</StatusBadge>
                    <Link to={`/admin/purchasing/pr/${pr.prId}`} className="btn btn-outline btn-sm">
                      แก้ไข
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="admin-card dash__shortcuts">
            <h2 className="dash__inbox-title">ทางลัด</h2>
            <div className="dash__shortcut-row">
              <Link to="/admin/purchasing/pr/new" className="btn btn-primary btn-sm">
                <Icon name="plus" size={18} />
                สร้างใบขอสั่งซื้อ
              </Link>
              <Link to="/admin/orders" className="btn btn-ghost btn-sm">
                <Icon name="shopping-bag" size={18} />
                คำสั่งซื้อลูกค้า
              </Link>
              <Link to="/admin/contacts" className="btn btn-ghost btn-sm">
                <Icon name="mail" size={18} />
                ศูนย์การติดต่อ
              </Link>
              <Link to="/admin/suppliers/new" className="btn btn-ghost btn-sm">
                <Icon name="building" size={18} />
                เพิ่มผู้จัดจำหน่าย
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Sales is read-only: it gets the supplier picture and nothing from purchasing. */}
      {can.viewSuppliers(role) && !can.viewPurchasing(role) && (
        <section className="dash__row">
          <StatTile
            label="คำสั่งซื้อลูกค้า"
            value={salesPendingOrders.length}
            note="รอยืนยันสต็อกและตรวจสอบชำระเงิน"
            icon="shopping-bag"
            tone={salesPendingOrders.length > 0 ? 'warning' : 'default'}
            to="/admin/orders"
          />
          <StatTile
            label="รายการคืนเงิน"
            value={pendingRefundOrders.length}
            note={
              pendingRefundOrders.length > 0
                ? `รอการโอนเงินคืน ${pendingRefundOrders.length} รายการ`
                : 'ไม่มีรายการรอคืนเงิน'
            }
            icon="dollar-sign"
            tone={pendingRefundOrders.length > 0 ? 'warning' : 'default'}
            to="/admin/refunds"
          />
          <StatTile
            label="ตรวจสอบรีวิว"
            value={unrepliedCount}
            note={
              unrepliedCount > 0 ? `รอตอบกลับ ${unrepliedCount} รายการ` : 'ไม่มีรีวิวค้างตรวจสอบ'
            }
            icon="star"
            tone={unrepliedCount > 0 ? 'warning' : 'default'}
            to="/admin/reviews"
          />
          <StatTile
            label="ผู้จัดจำหน่ายที่ใช้งานอยู่"
            value={activeSuppliers.length}
            note={`จากทั้งหมด ${suppliers.length} ราย`}
            icon="building"
            to="/admin/suppliers"
          />
          <StatTile
            label="รายการหนังสือในระบบ"
            value={books.length}
            icon="book"
            to="/admin/books"
          />
          <StatTile
            label="ทำเนียบผู้ติดต่อ"
            value={suppliers.length}
            icon="mail"
            to="/admin/contacts"
          />
        </section>
      )}

      {/* พนักงานจัดส่ง — the only role outside the supplier screens. It gets the two
          things it acts on: parcels waiting to go out, and the daily summary report. */}
      {!can.viewSuppliers(role) && (
        <section className="dash__row">
          <StatTile
            label="คำสั่งซื้อลูกค้า"
            value={deliveryReadyOrders.length}
            note="พัสดุพร้อมจัดส่งและนำจ่าย"
            icon="truck"
            tone={deliveryReadyOrders.length > 0 ? 'accent' : 'default'}
            to="/admin/orders"
          />
          <StatTile
            label="รายงานสรุปพัสดุจัดส่ง"
            value={latestSummaryParcels}
            note={
              latestSummaryDate
                ? `สรุปพัสดุจัดส่งประจำวันที่ ${latestSummaryDate}`
                : 'ยังไม่มีพัสดุที่จัดส่ง'
            }
            icon="file-text"
            tone="default"
            to="/admin/delivery-report"
          />
        </section>
      )}

    </div>
  )
}
