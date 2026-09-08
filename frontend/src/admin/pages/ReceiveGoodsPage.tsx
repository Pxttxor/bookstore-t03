import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useToast } from '../components/ToastContext'
import { formatBookCode } from '../inventory/inventory'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  CONDITION_LABELS,
  formatPOCode,
  poDisplayStatus,
  type ItemCondition,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatSupplierCode } from '../suppliers/suppliers'
import './ReceiveGoodsPage.css'

interface DraftLine {
  bookId: number
  ordered: number
  outstanding: number
  receivedQty: number
  condition: ItemCondition
  note: string
}

// ตัวห่อกันไว้ก่อนให้ฟอร์ม mount — ฟอร์มตั้งค่าเริ่มต้นของรายการด้วย useState
// ซึ่งอ่านค่าครั้งเดียวตอน mount · ถ้าปล่อยให้ mount ตั้งแต่ยังโหลดไม่เสร็จ
// รายการจะว่างเปล่าถาวรถึงแม้เอกสารจะโหลดมาครบทีหลังแล้วก็ตาม
export default function ReceiveGoodsPage() {
  const { id } = useParams()
  const { loading, error, reload } = usePurchasing()

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลใบสั่งซื้อ…" />
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

  // ต้อง remount เมื่อเปลี่ยน id — เข้าชุดเดียวกับ BookFormPage/SupplierFormPage
  return <ReceiveGoodsForm key={id ?? 'new'} />
}

function ReceiveGoodsForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const { findOrder, receiveGoods } = usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const role = user!.role
  const order = findOrder(Number(id))

  const [deliveryNoteNo, setDeliveryNoteNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>(() =>
    (order?.items ?? []).map((line) => ({
      bookId: line.bookId,
      ordered: line.quantity,
      outstanding: Math.max(0, line.quantity - line.receivedQty),
      receivedQty: Math.max(0, line.quantity - line.receivedQty),
      condition: 'NORMAL' as ItemCondition,
      note: '',
    })),
  )

  if (!order) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="package"
            title="ไม่พบใบสั่งซื้อ"
            description="เลขที่ที่ระบุอาจถูกลบไปแล้วหรือพิมพ์ไม่ถูกต้อง"
            action={{
              label: 'กลับไปหน้าเอกสารจัดซื้อ',
              onClick: () => navigate('/admin/purchasing'),
            }}
          />
        </section>
      </div>
    )
  }

  if (!can.receiveGoods(role)) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'รับสินค้า' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์บันทึกรับสินค้า"
            description="การตรวจรับสินค้าเข้าคลังเป็นหน้าที่ของพนักงานคลังสินค้า"
          />
        </section>
      </div>
    )
  }

  const supplier = suppliers.find((entry) => entry.supplierId === order.supplierId)
  const display = poDisplayStatus(order)
  const closed = display === 'RECEIVED_FULL' || display === 'RETURNED' || display === 'CANCELLED'

  const titleOf = (bookId: number) =>
    supplier?.books.find((book) => book.bookId === bookId)?.title ?? formatBookCode(bookId)

  const update = (bookId: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.bookId === bookId ? { ...line, ...patch } : line)),
    )

  const totalOutstanding = lines.reduce((sum, line) => sum + line.outstanding, 0)
  const totalReceiving = lines.reduce((sum, line) => sum + line.receivedQty, 0)
  const damaged = lines.filter((line) => line.condition === 'DAMAGED' && line.receivedQty > 0)

  const save = async () => {
    if (totalReceiving === 0) {
      notify('error', 'กรุณาระบุจำนวนที่รับจริงอย่างน้อยหนึ่งรายการ')
      return
    }
    if (saving) return
    setSaving(true)
    try {
      // ผู้รับของมาจาก JWT · เซิร์ฟเวอร์เพิ่มยอดสต็อกและแจ้งเตือนในทรานแซกชันเดียวกัน
      await receiveGoods(order.poId, {
        deliveryNoteNo: deliveryNoteNo.trim(),
        lines: lines
          .filter((line) => line.receivedQty > 0)
          .map((line) => ({
            bookId: line.bookId,
            receivedQty: line.receivedQty,
            condition: line.condition,
            note: line.note.trim(),
          })),
      })
      notify('success', `บันทึกรับสินค้าของ ${formatPOCode(order.poId)} แล้ว · ปรับสต็อกอัตโนมัติ`)
      navigate(`/admin/purchasing/po/${order.poId}`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกรับสินค้าไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
          { label: formatPOCode(order.poId), to: `/admin/purchasing/po/${order.poId}` },
          { label: 'รับสินค้า' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">รับสินค้า — อ้างอิง {formatPOCode(order.poId)}</h1>
          <p className="admin-page__subtitle">
            ผู้จัดจำหน่าย {formatSupplierCode(order.supplierId)}
            {supplier && ` ${supplier.companyName}`} · กำหนดส่ง {order.expectedDeliveryDate}
          </p>
        </div>
      </div>

      {closed ? (
        <section className="admin-card">
          <EmptyState
            icon="check-circle"
            title="ใบสั่งซื้อนี้รับสินค้าครบแล้ว"
            description="ไม่มีรายการคงค้างให้ตรวจรับเพิ่มเติม"
            action={{
              label: 'กลับไปหน้าใบสั่งซื้อ',
              onClick: () => navigate(`/admin/purchasing/po/${order.poId}`),
            }}
          />
        </section>
      ) : (
        <>
          <section className="admin-card receive">
            <label className="admin-field receive__note-no">
              <span className="admin-field__label">เลขใบส่งของ</span>
              <input
                type="text"
                className="admin-input"
                value={deliveryNoteNo}
                placeholder="เช่น DN-2026-0812"
                onChange={(e) => setDeliveryNoteNo(e.target.value)}
              />
            </label>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>หนังสือ</th>
                    <th className="receive__num">สั่ง</th>
                    <th className="receive__num">รับจริง</th>
                    <th>สภาพ</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.bookId}>
                      <td className="data-table__strong">
                        <span className="receive__code">{formatBookCode(line.bookId)}</span>
                        {titleOf(line.bookId)}
                        {line.outstanding < line.ordered && (
                          <span className="receive__outstanding">
                            คงค้าง {line.outstanding} จาก {line.ordered}
                          </span>
                        )}
                      </td>
                      <td className="receive__num">{line.ordered}</td>
                      <td className="receive__num">
                        <input
                          type="number"
                          min={0}
                          max={line.outstanding}
                          className="admin-input receive__input"
                          value={line.receivedQty}
                          onChange={(e) =>
                            update(line.bookId, {
                              receivedQty: Math.max(
                                0,
                                Math.min(line.outstanding, Number(e.target.value) || 0),
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <div className="receive__conditions">
                          {(['NORMAL', 'DAMAGED'] as ItemCondition[]).map((value) => (
                            <label key={value} className="receive__radio">
                              <input
                                type="radio"
                                name={`condition-${line.bookId}`}
                                checked={line.condition === value}
                                onChange={() => update(line.bookId, { condition: value })}
                              />
                              {CONDITION_LABELS[value]}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="admin-input receive__note"
                          value={line.note}
                          placeholder="ระบุรายละเอียด (ถ้ามี)"
                          onChange={(e) => update(line.bookId, { note: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {damaged.length > 0 && (
            <p className="receive__banner receive__banner--warning">
              <Icon name="alert-triangle" size={18} />
              พบสินค้าขาด/ชำรุด {damaged.length} รายการ
              <button
                type="button"
                className="receive__link"
                onClick={() =>
                  navigate(`/admin/purchasing/returns/new?po=${order.poId}`, {
                    state: { bookIds: damaged.map((line) => line.bookId) },
                  })
                }
              >
                เปิดใบส่งคืน
              </button>
            </p>
          )}

          <div className="receive__actions">
            <span className="receive__summary">
              สรุป: รับ <strong>{totalReceiving}</strong>/{totalOutstanding}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(`/admin/purchasing/po/${order.poId}`)}
            >
              ยกเลิก
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>
              <Icon name="package" size={18} />
              บันทึกการรับ
            </button>
          </div>
        </>
      )}
    </div>
  )
}
