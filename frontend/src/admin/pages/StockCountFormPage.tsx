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
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import type { Book } from '../books/books'
import { useInventory } from '../inventory/InventoryContext'
import { computeVariance, formatBookCode } from '../inventory/inventory'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './StockCountFormPage.css'

interface Row {
  bookId: number
  title: string
  systemQty: number
  /** Text so the field can sit empty until the counter types a figure. */
  counted: string
}

export default function StockCountFormPage() {
  const { user } = useAuth()
  const { findByBookId, saveStockCount, loading, error, reload } = useInventory()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState<Row[]>([])
  const [picking, setPicking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const role = user!.role

  if (!can.countStock(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์ตรวจนับสินค้าคงคลัง"
            description="การตรวจนับเป็นสิทธิ์ของพนักงานคลังสินค้าเท่านั้น"
            action={{ label: 'กลับไปหน้ารอบตรวจนับ', onClick: () => navigate('/admin/stock/counts') }}
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
        systemQty: findByBookId(book.bookId)?.quantityOnHand ?? 0,
        counted: '',
      },
    ])
    setPicking(false)
  }

  const counted = (row: Row) => Number(row.counted)
  const ready = rows.filter((row) => row.counted.trim() !== '' && Number.isFinite(counted(row)))
  const complete = rows.length > 0 && ready.length === rows.length
  const mismatches = ready.filter((row) => computeVariance(row.systemQty, counted(row)) !== 0)

  const submit = () => {
    if (!complete) {
      notify('error', 'กรุณาใส่จำนวนที่นับได้จริงให้ครบทุกรายการ')
      return
    }
    // The flow only warns about notifying the manager when something is off; a clean
    // round saves straight away.
    if (mismatches.length === 0) {
      void persist()
      return
    }
    setConfirming(true)
  }

  const persist = async () => {
    if (saving) return
    setSaving(true)
    let count
    try {
      // ผู้ตรวจนับมาจาก JWT · ยอดในระบบเซิร์ฟเวอร์อ่านเองตอนบันทึก
      // (ค่าที่หน้าจอถืออยู่อาจล้าสมัยไปแล้วถ้ามีการเคลื่อนไหวระหว่างนับ)
      count = await saveStockCount({
        items: rows.map((row) => ({
          bookId: row.bookId,
          countedQty: counted(row),
        })),
      })
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกรอบตรวจนับไม่สำเร็จ')
      setSaving(false)
      return
    }
    setConfirming(false)
    notify('success', 'บันทึกเสร็จสิ้น')
    navigate(`/admin/stock/counts/${count.countId}`)
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ตรวจนับสต็อก', to: '/admin/stock/counts' },
          { label: 'ตรวจนับหนังสือ' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ตรวจนับหนังสือ</h1>
          <p className="admin-page__subtitle">
            เพิ่มหนังสือที่ต้องการนับ แล้วใส่จำนวนที่นับได้จริง ๆ ระบบจะเทียบกับยอดในระบบให้อัตโนมัติ
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
            disabled={!complete}
            title={complete ? undefined : 'กรุณาใส่จำนวนที่นับได้จริงให้ครบทุกรายการ'}
            onClick={submit}
          >
            บันทึกการตรวจสอบ
          </button>
        </div>
      </div>

      {mismatches.length > 0 && (
        <p className="stock-count__banner">
          <Icon name="alert-triangle" size={18} />
          พบจำนวนหนังสือคลาดเคลื่อน {mismatches.length} รายการ
        </p>
      )}

      <section className="admin-card stock-count__card">
        {rows.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="ยังไม่ได้เลือกหนังสือที่จะนับ"
            description="กด &quot;เพิ่มหนังสือ&quot; เพื่อค้นหาและเลือกเล่มที่ต้องการตรวจนับ"
            action={{ label: 'เพิ่มหนังสือ', onClick: () => setPicking(true) }}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>หนังสือ</th>
                  <th className="stock-count__num">จำนวนในระบบ</th>
                  <th className="stock-count__num">จำนวนที่นับได้จริง</th>
                  <th className="stock-count__num">ผลต่าง</th>
                  <th>ผลการเทียบ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const filled = row.counted.trim() !== '' && Number.isFinite(counted(row))
                  const variance = filled ? computeVariance(row.systemQty, counted(row)) : 0
                  return (
                    <tr key={row.bookId}>
                      <td className="data-table__code">{formatBookCode(row.bookId)}</td>
                      <td className="data-table__strong">{row.title}</td>
                      <td className="stock-count__num">{row.systemQty}</td>
                      <td className="stock-count__num">
                        <input
                          type="number"
                          min={0}
                          className="admin-input stock-count__input"
                          placeholder="ใส่จำนวน"
                          value={row.counted}
                          onChange={(e) =>
                            setRows((current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, counted: e.target.value } : entry,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="stock-count__num">
                        {filled ? (variance > 0 ? `+${variance}` : variance) : '—'}
                      </td>
                      <td>
                        {!filled ? (
                          <span className="stock-count__pending">ยังไม่ได้นับ</span>
                        ) : variance === 0 ? (
                          <StatusBadge tone="success">✓ เท่ากัน</StatusBadge>
                        ) : (
                          <StatusBadge tone="danger">X ไม่เท่ากัน</StatusBadge>
                        )}
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
          title="ค้นหาหนังสือ"
          exclude={rows.map((row) => row.bookId)}
          onSelect={addBook}
          onClose={() => setPicking(false)}
        />
      )}

      {confirming && (
        <Modal
          title="ยืนยันการบันทึก"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirming(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saving}
                onClick={() => void persist()}
              >
                ตกลง
              </button>
            </>
          }
        >
          <p>หากกดบันทึก จะส่งแจ้งเตือนไปยังผู้จัดการ</p>
          <ul className="stock-count__summary">
            {mismatches.map((row) => (
              <li key={row.bookId}>
                <span className="data-table__code">{formatBookCode(row.bookId)}</span>
                <span>{row.title}</span>
                <span className="stock-count__summary-var">
                  ผลต่าง {computeVariance(row.systemQty, counted(row)) > 0 ? '+' : ''}
                  {computeVariance(row.systemQty, counted(row))}
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  )
}
