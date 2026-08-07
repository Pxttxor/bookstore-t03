import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABELS } from '../../auth/roles'
import EmptyState from '../components/EmptyState'
import Meter from '../components/Meter'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import { useInventory } from '../inventory/InventoryContext'
import { stockLevel } from '../inventory/inventory'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  committedAmount,
  documentTotal,
  formatPRCode,
  poDisplayStatus,
  PURCHASE_BUDGET,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import './DashboardPage.css'

export default function DashboardPage() {
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { books } = useBooks()
  const { belowReorder, items, pendingReports } = useInventory()
  const { requisitions, orders, returns } = usePurchasing()

  const role = user!.role

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

  const remaining = PURCHASE_BUDGET - committedAmount(orders)
  const remainingPercent = (remaining / PURCHASE_BUDGET) * 100
  const budgetTone = remaining < 0 ? 'danger' : remainingPercent <= 30 ? 'warning' : 'accent'

  const activeSuppliers = suppliers.filter((entry) => entry.status === 'ACTIVE')
  const supplierName = (supplierId: number) =>
    suppliers.find((entry) => entry.supplierId === supplierId)?.companyName ?? '—'

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
              label="ใบสั่งซื้อรออนุมัติ"
              value={pending.length}
              note="รอการพิจารณาของผู้จัดการร้าน"
              icon="file-text"
              tone={pending.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
              linkLabel="เปิดกล่องงานรออนุมัติ"
            />
            <StatTile
              label="ผู้จัดจำหน่ายที่ใช้งานอยู่"
              value={activeSuppliers.length}
              note={`จากทั้งหมด ${suppliers.length} ราย`}
              icon="building"
              to="/admin/suppliers"
              linkLabel="ดูรายการผู้จัดจำหน่าย"
            />
            <StatTile
              label="รายงานผลต่างรออนุมัติ"
              value={pendingReports.length}
              note="ยอดหนังสือไม่ตรงจากการตรวจนับ"
              icon="alert-triangle"
              tone={pendingReports.length > 0 ? 'warning' : 'default'}
              to="/admin/stock/discrepancies"
              linkLabel="เปิดรายงานผลต่าง"
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
                {formatBaht(PURCHASE_BUDGET)}
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
              note="ยอดคงเหลือต่ำกว่าหรือเท่ากับจุดสั่งซื้อ"
              icon="bell"
              tone={belowReorder.length > 0 ? 'danger' : 'default'}
              to="/admin/alerts"
              linkLabel="ดูรายการแจ้งเตือน"
            />
            <StatTile
              label="ใบสั่งซื้อรอส่ง"
              value={awaitingSend.length}
              note={`รอผู้จัดจำหน่ายยืนยันอีก ${awaitingConfirm.length} ใบ`}
              icon="mail"
              tone={awaitingSend.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
              linkLabel="เปิดเอกสารจัดซื้อ"
            />
            <StatTile
              label="รอรับสินค้าเข้าคลัง"
              value={readyToReceive.length}
              note="ผู้จัดจำหน่ายยืนยันแล้ว พร้อมตรวจรับ"
              icon="package"
              tone={readyToReceive.length > 0 ? 'accent' : 'default'}
              to="/admin/purchasing/receipts"
              linkLabel="ไปหน้ารับสินค้า"
            />
            <StatTile
              label="ใบส่งคืนที่ยังไม่ปิด"
              value={openReturns.length}
              note="อยู่ระหว่างติดตามการชดเชย"
              icon="truck"
              tone={openReturns.length > 0 ? 'warning' : 'default'}
              to="/admin/purchasing"
              linkLabel="ดูเอกสารจัดซื้อ"
            />
            <StatTile
              label="หนังสือหมดสต็อก"
              value={outOfStock}
              note="ยอดคงเหลือเป็น 0"
              icon="alert-triangle"
              tone={outOfStock > 0 ? 'danger' : 'default'}
              to="/admin/stock/low"
              linkLabel="ดูรายงานหนังสือใกล้หมด"
            />
            <StatTile
              label="หนังสือใกล้หมด"
              value={lowStock}
              note="เหลือน้อยแต่ยังไม่หมด"
              icon="trending-down"
              tone={lowStock > 0 ? 'warning' : 'default'}
              to="/admin/stock/low"
              linkLabel="ดูรายงานหนังสือใกล้หมด"
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
            label="ผู้จัดจำหน่ายที่ใช้งานอยู่"
            value={activeSuppliers.length}
            note={`จากทั้งหมด ${suppliers.length} ราย`}
            icon="building"
            to="/admin/suppliers"
            linkLabel="ค้นหาผู้จัดจำหน่าย"
          />
          <StatTile
            label="รายการหนังสือในระบบ"
            value={books.length}
            note="ใช้ตอบคำถามลูกค้าและแก้ไขข้อมูลหนังสือ"
            icon="book"
            to="/admin/books"
            linkLabel="ดูรายการหนังสือ"
          />
          <StatTile
            label="ทำเนียบผู้ติดต่อ"
            value={suppliers.length}
            note="ข้อมูลติดต่อผู้จัดจำหน่ายทั้งหมด"
            icon="mail"
            to="/admin/contacts"
            linkLabel="เปิดศูนย์การติดต่อ"
          />
        </section>
      )}

      {/* พนักงานจัดส่ง appears in no screen list in §2 of the spec, so the back office
          has nothing for them beyond this explanation. */}
      {!can.viewSuppliers(role) && (
        <section className="admin-card">
          <EmptyState
            icon="truck"
            title="ตำแหน่งงานของคุณยังไม่มีเมนูในระบบหลังร้าน"
            description="ระบบหลังร้านครอบคลุมงานผู้จัดจำหน่ายและงานจัดซื้อ หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อผู้จัดการร้าน"
          />
        </section>
      )}
    </div>
  )
}
