import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import BookPicker from '../components/BookPicker'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useToast } from '../components/ToastContext'
import type { Book } from '../books/books'
import { useOrders } from '../orders/OrderContext'
import { formatOrderCode } from '../orders/orders'
import { useInventory, type AdjustLine } from '../inventory/InventoryContext'
import { formatBookCode } from '../inventory/inventory'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './StockAdjustPage.css'

interface Row {
  bookId: number
  title: string
  onHand: number
  /** Kept as text so the field can be empty or hold a lone minus sign while typing. */
  change: string
  reason: string
}

export default function StockAdjustPage() {
  const { user } = useAuth()
  const { findByBookId, adjustStock, loading, error, reload } = useInventory()
  const { orders } = useOrders()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState<Row[]>([])
  const [orderRef, setOrderRef] = useState('')
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)

  const role = user!.role

  if (!can.adjustStock(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ปรับปรุงจำนวนสินค้าคงคลัง"
            description="การแก้ไขจำนวนหนังสือเป็นสิทธิ์ของพนักงานคลังสินค้าเท่านั้น"
            action={{ label: 'กลับไปหน้ายอดคงเหลือ', onClick: () => navigate('/admin/stock') }}
          />
        </section>
      </div>
    )
  }

  // ยอดในระบบของแต่ละเล่มมาจาก useInventory() — ถ้ายังโหลดไม่เสร็จจะอ่านได้ 0 ทุกเล่ม
  // แล้วผลต่างที่คำนวณได้จะผิดทั้งใบ จึงต้องรอให้ข้อมูลมาครบก่อนเปิดฟอร์ม
  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดยอดคงเหลือ…" />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={error} onRetry={() => void reload()} />
        </section>
      </div>
    )
  }

  const addBook = (book: Book) => {
    setRows((current) => [
      ...current,
      {
        bookId: book.bookId,
        title: book.title,
        onHand: findByBookId(book.bookId)?.quantityOnHand ?? 0,
        change: '',
        reason: '',
      },
    ])
    setPicking(false)
  }

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const changeOf = (row: Row) => (row.change.trim() === '' ? 0 : Number(row.change))
  const resultOf = (row: Row) => row.onHand + changeOf(row)

  const invalid = rows.some((row) => !Number.isFinite(changeOf(row)) || resultOf(row) < 0)
  const empty = rows.length === 0 || rows.every((row) => changeOf(row) === 0)
  const blockedReason = invalid
    ? 'ยอดคงเหลือติดลบ ไม่สามารถบันทึกได้'
    : empty
      ? 'ยังไม่มีรายการที่มีการเปลี่ยนแปลงจำนวน'
      : undefined

  const save = async () => {
    if (saving) return
    if (blockedReason) {
      notify('error', blockedReason)
      return
    }

    const lines: AdjustLine[] = rows
      .filter((row) => changeOf(row) !== 0)
      .map((row) => ({
        bookId: row.bookId,
        quantityChange: changeOf(row),
        reason: row.reason.trim() || 'ปรับปรุงจำนวนโดยพนักงานคลังสินค้า',
        // The order reference is recorded as text only. Customer orders key their books
        // by storefront slug and never touch inventory, so this stays a paper trail.
        referenceDoc: orderRef,
      }))

    // ต้อง await — abnormal flow "ยอดคงเหลือติดลบ → ไม่อนุญาตให้บันทึก" ตัดสินฝั่งเซิร์ฟเวอร์แล้ว
    // (`ApplyStrictStockChanges` + `assertNoNegativeStock`) ถ้าไม่รอผล error จะหายเงียบ
    // แล้วหน้าจอจะขึ้น "บันทึกเสร็จสิ้น" ทั้งที่เซิร์ฟเวอร์ปฏิเสธ
    setSaving(true)
    try {
      await adjustStock(lines)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ')
      setSaving(false)
      return
    }

    notify('success', 'บันทึกเสร็จสิ้น')
    navigate('/admin/stock')
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'สินค้าคงคลัง', to: '/admin/stock' },
          { label: 'ปรับปรุงจำนวน' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">แก้ไขจำนวนหนังสือ</h1>
          <p className="admin-page__subtitle">
            เพิ่มหนังสือที่ต้องการ แล้วระบุจำนวนที่เปลี่ยนแปลง — ใส่ค่าติดลบเพื่อหักออกจากคลัง
          </p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} />
            เพิ่มหนังสือ
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={blockedReason !== undefined || saving}
            title={blockedReason}
            onClick={() => void save()}
          >
            บันทึก
          </button>
        </div>
      </div>

      {invalid && (
        <p className="stock-adjust__banner">
          <Icon name="alert-triangle" size={18} />
          ยอดคงเหลือติดลบ ไม่สามารถบันทึกได้ — กรุณาแก้ไขจำนวนให้ยอดคงเหลือใหม่ไม่ต่ำกว่า 0
        </p>
      )}

      <section className="admin-card stock-adjust__card">
        <label className="admin-field stock-adjust__ref">
          <span className="admin-field__label">อ้างอิงคำสั่งซื้อ (Order ID)</span>
          <select
            className="admin-input"
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
          >
            <option value="">ไม่อ้างอิงคำสั่งซื้อ</option>
            {orders.map((order) => (
              <option key={order.orderId} value={formatOrderCode(order.orderId)}>
                {formatOrderCode(order.orderId)} · {order.customerName}
              </option>
            ))}
          </select>
          <span className="admin-field__hint">
            เลือกคำสั่งซื้อที่เป็นเหตุให้จำนวนเปลี่ยนแปลง ระบบจะบันทึกไว้เป็นเอกสารอ้างอิงของรายการเคลื่อนไหว
          </span>
        </label>
      </section>

      <section className="admin-card stock-adjust__card">
        {rows.length === 0 ? (
          <EmptyState
            icon="package"
            title="ยังไม่ได้เลือกหนังสือ"
            description="กด &quot;เพิ่มหนังสือ&quot; เพื่อค้นหาและเลือกเล่มที่ต้องการแก้ไขจำนวน"
            action={{ label: 'เพิ่มหนังสือ', onClick: () => setPicking(true) }}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>หนังสือ</th>
                  <th className="stock-adjust__num">คงเหลือปัจจุบัน</th>
                  <th className="stock-adjust__num">จำนวนที่เปลี่ยน (+/-)</th>
                  <th className="stock-adjust__num">คงเหลือใหม่</th>
                  <th>เหตุผล</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const result = resultOf(row)
                  const bad = !Number.isFinite(changeOf(row)) || result < 0
                  return (
                    <tr key={row.bookId}>
                      <td className="data-table__code">{formatBookCode(row.bookId)}</td>
                      <td className="data-table__strong">{row.title}</td>
                      <td className="stock-adjust__num">{row.onHand}</td>
                      <td className="stock-adjust__num">
                        <input
                          type="number"
                          className={'admin-input stock-adjust__input' + (bad ? ' admin-input--error' : '')}
                          value={row.change}
                          onChange={(e) => setRow(index, { change: e.target.value })}
                        />
                      </td>
                      <td
                        className={
                          'stock-adjust__num' + (bad ? ' stock-adjust__num--bad' : '')
                        }
                      >
                        {Number.isFinite(result) ? result : '—'}
                      </td>
                      <td>
                        <input
                          className="admin-input"
                          value={row.reason}
                          placeholder="เช่น รับคืนจากลูกค้า, หนังสือชำรุด"
                          onChange={(e) => setRow(index, { reason: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="ลบรายการนี้"
                          onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {picking && (
        <BookPicker
          title="เพิ่มหนังสือ"
          exclude={rows.map((row) => row.bookId)}
          onSelect={addBook}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
