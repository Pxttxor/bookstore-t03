import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useToast } from '../components/ToastContext'
import { formatBookCode, isBelowReorder } from '../inventory/inventory'
import { useInventory } from '../inventory/InventoryContext'
import { can } from '../permissions'
import type { RequisitionSeedState } from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { findSupplierBook, formatSupplierCode } from '../suppliers/suppliers'
import '../components/DataTable.css'
import './ReorderAlertsPage.css'

// Order back up to twice the reorder point so the title does not reappear here next week.
function suggestedQuantity(onHand: number, reorderPoint: number | undefined) {
  return Math.max(1, (reorderPoint ?? 10) * 2 - onHand)
}

export default function ReorderAlertsPage() {
  const { user } = useAuth()
  const { items, setReorderPoint, loading, error, reload } = useInventory()
  const { suppliers } = useSuppliers()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<number[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [draftPoint, setDraftPoint] = useState('')

  const role = user!.role
  const mayEdit = can.setReorderPoint(role)

  // Everything at or below its reorder point, plus the titles that have no reorder
  // point set at all — the spec lists those with a ⚠ tag instead of skipping them.
  const rows = useMemo(
    () =>
      items
        .filter((item) => isBelowReorder(item) || item.reorderPoint === undefined)
        .map((item) => {
          const ref = findSupplierBook(suppliers, item.bookId)
          return {
            item,
            title: ref?.book.title ?? formatBookCode(item.bookId),
            supplier: ref?.supplier,
            unitPrice: ref?.book.supplyPrice ?? 0,
          }
        }),
    [items, suppliers],
  )

  // ต้องตรวจหลัง hook ทั้งหมดทำงานแล้ว ไม่ใช่ early return ก่อน useMemo — ไม่งั้นชน Rules of Hooks
  // ข้อมูล SCR-20 เป็นสิทธิ์ของคลังสินค้าเท่านั้น (can.viewStock ที่ InventoryProvider ใช้กรองการโหลด
  // กว้างกว่านี้ — ครอบคลุมผู้จัดการและฝ่ายขายด้วย ซึ่งไม่ควรเห็นหน้านี้)
  if (!can.viewAlerts(role)) {
    return (
      <div className="admin-page">
        <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'แจ้งเตือนสต็อก' }]} />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ดูแจ้งเตือนสินค้าถึงจุดสั่งซื้อ"
            description="หน้านี้เป็นสิทธิ์ของพนักงานคลังสินค้าเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const selectable = rows.filter((row) => row.supplier?.status === 'ACTIVE')
  const chosen = rows.filter((row) => selected.includes(row.item.bookId))
  const supplierIds = [...new Set(chosen.map((row) => row.supplier?.supplierId))]
  const mixedSuppliers = supplierIds.length > 1

  const toggle = (bookId: number) =>
    setSelected((current) =>
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId],
    )

  const toggleAll = () =>
    setSelected(
      selected.length === selectable.length
        ? []
        : selectable.map((row) => row.item.bookId),
    )

  const startEditing = (bookId: number, current: number | undefined) => {
    setEditing(bookId)
    setDraftPoint(current === undefined ? '' : String(current))
  }

  const saveReorderPoint = async (bookId: number) => {
    const value = Number(draftPoint)
    if (!Number.isFinite(value) || value < 0) {
      notify('error', 'จุดสั่งซื้อต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป')
      return
    }
    try {
      await setReorderPoint(bookId, value)
      setEditing(null)
      notify('success', `ตั้งจุดสั่งซื้อ ${formatBookCode(bookId)} เป็น ${value} เล่มแล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ตั้งจุดสั่งซื้อไม่สำเร็จ')
    }
  }

  const createRequisition = () => {
    const supplierId = chosen[0]?.supplier?.supplierId
    if (supplierId === undefined) return
    const state: RequisitionSeedState = {
      supplierId,
      lines: chosen.map((row) => ({
        bookId: row.item.bookId,
        quantity: suggestedQuantity(row.item.quantityOnHand, row.item.reorderPoint),
        unitPrice: row.unitPrice,
      })),
    }
    navigate('/admin/purchasing/pr/new', { state })
  }

  const blockedReason = mixedSuppliers
    ? 'ใบขอสั่งซื้อหนึ่งใบสั่งได้จากผู้จัดจำหน่ายรายเดียว กรุณาเลือกเฉพาะหนังสือของผู้จัดจำหน่ายรายเดียวกัน'
    : undefined

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'แจ้งเตือนสต็อก' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">แจ้งเตือนสินค้าถึงจุดสั่งซื้อ</h1>
          <p className="admin-page__subtitle">
            ระบบตรวจสอบยอดคงเหลือเทียบจุดสั่งซื้อตามรอบเวลา พบ {rows.length} รายการที่ต้องดำเนินการ
          </p>
        </div>
        {can.createRequisition(role) && (
          <div className="admin-page__actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={chosen.length === 0 || mixedSuppliers}
              title={blockedReason}
              onClick={createRequisition}
            >
              <Icon name="file-text" size={18} />
              สร้าง PR จากที่เลือก{chosen.length > 0 && ` (${chosen.length})`}
            </button>
          </div>
        )}
      </div>

      {blockedReason && (
        <p className="alerts__banner alerts__banner--warning">
          <Icon name="alert-triangle" size={18} />
          {blockedReason}
        </p>
      )}

      <section className="admin-card">
        {loading ? (
          <LoadingState label="กำลังโหลดรายการที่ถึงจุดสั่งซื้อ…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="ยังไม่มีสินค้าถึงจุดสั่งซื้อ"
            description="ยอดคงเหลือของทุกรายการยังสูงกว่าจุดสั่งซื้อที่ตั้งไว้"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="alerts__check">
                    <input
                      type="checkbox"
                      aria-label="เลือกทั้งหมด"
                      checked={selectable.length > 0 && selected.length === selectable.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>รหัส</th>
                  <th>ชื่อหนังสือ</th>
                  <th className="alerts__num">คงเหลือ</th>
                  <th className="alerts__num">จุดสั่งซื้อ</th>
                  <th>ผู้จัดจำหน่ายแนะนำ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, title, supplier }) => {
                  const cancelled = supplier?.status !== 'ACTIVE'
                  return (
                    <tr key={item.bookId}>
                      <td className="alerts__check">
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${title}`}
                          disabled={cancelled}
                          checked={selected.includes(item.bookId)}
                          onChange={() => toggle(item.bookId)}
                        />
                      </td>
                      <td className="data-table__code">{formatBookCode(item.bookId)}</td>
                      <td className="data-table__strong">{title}</td>
                      <td className="alerts__num">
                        <span
                          className={
                            'alerts__stock' + (item.quantityOnHand === 0 ? ' alerts__stock--out' : '')
                          }
                        >
                          {item.quantityOnHand}
                        </span>
                      </td>
                      <td className="alerts__num">
                        {editing === item.bookId ? (
                          <span className="alerts__edit">
                            <input
                              type="number"
                              min={0}
                              autoFocus
                              className="admin-input alerts__input"
                              value={draftPoint}
                              onChange={(e) => setDraftPoint(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveReorderPoint(item.bookId)
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn"
                              title="บันทึก"
                              onClick={() => void saveReorderPoint(item.bookId)}
                            >
                              <Icon name="check" size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title="ยกเลิก"
                              onClick={() => setEditing(null)}
                            >
                              <Icon name="close" size={17} />
                            </button>
                          </span>
                        ) : item.reorderPoint === undefined ? (
                          <span className="alerts__unset">
                            <Icon name="alert-triangle" size={15} />
                            ยังไม่ตั้งค่า
                            {mayEdit && (
                              <button
                                type="button"
                                className="alerts__link"
                                onClick={() => startEditing(item.bookId, undefined)}
                              >
                                ตั้งค่าจุดสั่งซื้อ
                              </button>
                            )}
                          </span>
                        ) : mayEdit ? (
                          <button
                            type="button"
                            className="alerts__link"
                            title="แก้ไขจุดสั่งซื้อ"
                            onClick={() => startEditing(item.bookId, item.reorderPoint)}
                          >
                            {item.reorderPoint}
                          </button>
                        ) : (
                          item.reorderPoint
                        )}
                      </td>
                      <td>
                        {supplier ? (
                          <span className="alerts__supplier">
                            <select
                              className="admin-input alerts__select"
                              value={supplier.supplierId}
                              disabled
                              title="ผู้จัดจำหน่ายที่มีหนังสือเล่มนี้ในแคตตาล็อก"
                            >
                              <option value={supplier.supplierId}>
                                {formatSupplierCode(supplier.supplierId)} · {supplier.companyName}
                              </option>
                            </select>
                            {cancelled && (
                              <span className="alerts__blocked">ผู้จัดจำหน่ายถูกปิดใช้งาน</span>
                            )}
                          </span>
                        ) : (
                          <span className="alerts__unset">
                            <Icon name="alert-triangle" size={15} />
                            ไม่พบผู้จัดจำหน่าย
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
    </div>
  )
}
