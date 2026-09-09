import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { formatBookCode } from '../inventory/inventory'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  COMPENSATION_LABELS,
  formatPOCode,
  formatReturnCode,
  RETURN_REASONS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  returnableQty,
  type Compensation,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatSupplierCode } from '../suppliers/suppliers'
import './PurchaseReturnPage.css'

// Evidence photos travel as data URLs into a `text` column, so they have to stay small.
const MAX_EVIDENCE_BYTES = 300_000

interface DraftLine {
  bookId: number
  received: number
  quantity: number
  reason: string
  evidence?: string
}

// ตัวห่อกันไว้ก่อนให้ฟอร์ม mount — ฟอร์มตั้งค่าเริ่มต้นของรายการด้วย useState
// ซึ่งอ่านค่าครั้งเดียวตอน mount · ถ้าปล่อยให้ mount ตั้งแต่ยังโหลดไม่เสร็จ
// รายการจะว่างเปล่าถาวรถึงแม้เอกสารจะโหลดมาครบทีหลังแล้วก็ตาม
export default function PurchaseReturnPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const { loading, error, reload } = usePurchasing()

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลใบส่งคืน…" />
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

  // ต้อง remount เมื่อเปลี่ยน id หรือ ?po= — ใบใหม่ที่อ้างอิง PO คนละใบก็ต้องเริ่มฟอร์มใหม่เหมือนกัน
  return <PurchaseReturnForm key={id ?? `new-${search.get('po') ?? ''}`} />
}

function PurchaseReturnForm() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const { user } = useAuth()
  const { suppliers } = useSuppliers()
  const {
    findReturn,
    findOrder,
    returnsForOrder,
    receiptsForOrder,
    createReturn,
    escalateReturn,
    recordCompensation,
  } = usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const role = user!.role
  const existing = id ? findReturn(Number(id)) : undefined
  const orderId = existing?.poId ?? Number(search.get('po'))
  const order = findOrder(orderId)

  const [reason, setReason] = useState(RETURN_REASONS[0])
  const [escalation, setEscalation] = useState('')
  const [working, setWorking] = useState(false)
  const [compensationType, setCompensationType] =
    useState<Compensation['type']>('REPLACEMENT')
  const [compensationNote, setCompensationNote] = useState('')
  // ตั้งต้นจาก "จำนวนที่ยังคืนได้" (รับจริง − เคยคืนไปแล้ว) ไม่ใช่ receivedQty ดิบ ๆ
  // ตรงกับกฎ RETURN_EXCEEDS_RECEIVED ฝั่งเซิร์ฟเวอร์ — กันคืนซ้ำเกินโควตาที่คีย์ผ่าน client ได้
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!order) return []
    // จำนวนที่ชำรุดจากใบรับที่บันทึกแล้ว — ใช้ตั้งต้นช่องจำนวนคืน เหมือนกันทุกทางเข้า
    // (PO ที่ยังไม่เคยรับสินค้าเลยไม่มีใบรับให้อ่าน ช่องนี้จึงตั้งต้นเป็น 0 ตามปกติ)
    const damagedQty = new Map<number, number>()
    for (const grn of receiptsForOrder(order.poId)) {
      for (const line of grn.items) {
        if (line.condition !== 'DAMAGED') continue
        damagedQty.set(line.bookId, (damagedQty.get(line.bookId) ?? 0) + line.receivedQty)
      }
    }
    const remaining = returnableQty(order, returnsForOrder(order.poId))
    return order.items
      .filter((line) => (remaining.get(line.bookId) ?? 0) > 0)
      .map((line) => {
        const received = remaining.get(line.bookId) ?? 0
        return {
          bookId: line.bookId,
          received,
          quantity: Math.min(damagedQty.get(line.bookId) ?? 0, received),
          reason: RETURN_REASONS[0],
        }
      })
  })

  if (!can.createReturn(role)) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
            { label: 'ส่งคืนสินค้า' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์บันทึกการส่งคืน"
            description="การส่งคืนสินค้าเป็นหน้าที่ของพนักงานคลังสินค้า"
          />
        </section>
      </div>
    )
  }

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
            icon="file-text"
            title="ไม่พบใบสั่งซื้อที่อ้างอิง"
            description="ใบส่งคืนต้องอ้างอิงใบสั่งซื้อที่มีการรับสินค้าแล้ว"
            action={{
              label: 'กลับไปหน้าเอกสารจัดซื้อ',
              onClick: () => navigate('/admin/purchasing'),
            }}
          />
        </section>
      </div>
    )
  }

  const supplier = suppliers.find((entry) => entry.supplierId === order.supplierId)
  const titleOf = (bookId: number) =>
    supplier?.books.find((book) => book.bookId === bookId)?.title ?? formatBookCode(bookId)

  const rows = existing?.items ?? lines
  const hasNoRows = rows.length === 0

  const update = (bookId: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.bookId === bookId ? { ...line, ...patch } : line)),
    )

  const attach = (bookId: number, file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_EVIDENCE_BYTES) {
      notify('error', 'ไฟล์หลักฐานต้องมีขนาดไม่เกิน 300 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => update(bookId, { evidence: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    const chosen = lines.filter((line) => line.quantity > 0)
    if (chosen.length === 0) {
      notify('error', 'กรุณาระบุจำนวนที่ต้องการส่งคืนอย่างน้อยหนึ่งรายการ')
      return
    }
    if (working) return
    setWorking(true)
    try {
      // ผู้เปิดใบมาจาก JWT · เซิร์ฟเวอร์ตัดสต็อกและปิด PO ถ้าคืนครบ ในทรานแซกชันเดียว
      const entry = await createReturn(order.poId, {
        reason,
        items: chosen.map((line) => ({
          bookId: line.bookId,
          quantity: line.quantity,
          reason: line.reason,
          evidence: line.evidence,
        })),
      })
      notify(
        'success',
        `ส่งเรื่องคืน ${formatReturnCode(entry.returnId)} ให้ผู้จัดจำหน่ายทางอีเมลแล้ว`,
      )
      navigate(`/admin/purchasing/returns/${entry.returnId}`, { replace: true })
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เปิดใบส่งคืนไม่สำเร็จ')
      setWorking(false)
    }
  }

  const escalate = async () => {
    if (!existing || working) return
    if (escalation.trim() === '') {
      notify('error', 'กรุณาระบุรายละเอียดก่อนส่งเรื่องให้ผู้จัดการร้าน')
      return
    }
    setWorking(true)
    try {
      await escalateReturn(existing.returnId, escalation.trim())
      notify('warning', 'ส่งเรื่องให้ผู้จัดการร้านพิจารณาแล้ว')
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ส่งเรื่องไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  // at / by เซิร์ฟเวอร์เติมจาก JWT ให้เอง (`toBody` ใน PurchasingContext ส่งแค่ type กับ note)
  // การชดเชยแบบ REPLACEMENT ทำให้สต็อกเพิ่มกลับในทรานแซกชันเดียวกัน จึงต้องรอผลจริง
  const close = async () => {
    if (!existing || working) return
    setWorking(true)
    try {
      await recordCompensation(existing.returnId, {
        type: compensationType,
        note: compensationNote.trim(),
      })
      notify('success', `ปิดรายการ ${formatReturnCode(existing.returnId)} เรียบร้อยแล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ปิดรายการไม่สำเร็จ')
    } finally {
      setWorking(false)
    }
  }

  const heading = existing
    ? `ใบส่งคืนสินค้า ${formatReturnCode(existing.returnId)} — อ้างอิง ${formatPOCode(order.poId)}`
    : `ใบส่งคืนสินค้า — อ้างอิง ${formatPOCode(order.poId)}`

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'เอกสารจัดซื้อ', to: '/admin/purchasing' },
          { label: formatPOCode(order.poId), to: `/admin/purchasing/po/${order.poId}` },
          { label: existing ? formatReturnCode(existing.returnId) : 'ส่งคืนสินค้า' },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">
            {heading}
            {existing && (
              <StatusBadge tone={RETURN_STATUS_TONES[existing.status]}>
                {RETURN_STATUS_LABELS[existing.status]}
              </StatusBadge>
            )}
          </h1>
          <p className="admin-page__subtitle">
            ผู้จัดจำหน่าย {formatSupplierCode(order.supplierId)}
            {supplier && ` ${supplier.companyName}`}
            {existing && ` · วันที่ส่งคืน ${existing.returnDate} · ผู้บันทึก ${existing.createdBy}`}
          </p>
        </div>
      </div>

      <section className="admin-card ret">
        {hasNoRows ? (
          <EmptyState
            icon="package"
            title="ยังไม่มีสินค้าที่ส่งคืนได้"
            description="ใบส่งคืนต้องอ้างอิงสินค้าที่รับเข้าคลังแล้ว — บันทึกรับสินค้าของใบสั่งซื้อนี้ก่อน"
            action={{
              label: 'ไปหน้าบันทึกรับสินค้า',
              onClick: () => navigate(`/admin/purchasing/po/${order.poId}/receive`),
            }}
          />
        ) : (
          <>
            {!existing && (
              <label className="admin-field ret__reason">
                <span className="admin-field__label">เหตุผลรวมของใบส่งคืน</span>
                <select
                  className="admin-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {RETURN_REASONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>หนังสือ</th>
                    <th className="ret__num">จำนวนคืน</th>
                    <th>เหตุผล</th>
                    <th>หลักฐาน</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((line) => {
                    const draft = 'received' in line ? (line as DraftLine) : undefined
                    return (
                      <tr key={line.bookId}>
                        <td className="data-table__strong">
                          <span className="ret__code">{formatBookCode(line.bookId)}</span>
                          {titleOf(line.bookId)}
                          {draft && (
                            <span className="ret__received">คืนได้ {draft.received} เล่ม</span>
                          )}
                        </td>
                        <td className="ret__num">
                          {draft ? (
                            <input
                              type="number"
                              min={0}
                              max={draft.received}
                              className="admin-input ret__input"
                              value={draft.quantity}
                              onChange={(e) =>
                                update(line.bookId, {
                                  quantity: Math.max(
                                    0,
                                    Math.min(draft.received, Number(e.target.value) || 0),
                                  ),
                                })
                              }
                            />
                          ) : (
                            line.quantity
                          )}
                        </td>
                        <td>
                          {draft ? (
                            <select
                              className="admin-input ret__select"
                              value={draft.reason}
                              onChange={(e) => update(line.bookId, { reason: e.target.value })}
                            >
                              {RETURN_REASONS.map((entry) => (
                                <option key={entry} value={entry}>
                                  {entry}
                                </option>
                              ))}
                            </select>
                          ) : (
                            line.reason
                          )}
                        </td>
                        <td>
                          {draft ? (
                            <label className="ret__attach">
                              <Icon name="upload" size={16} />
                              {draft.evidence ? 'เปลี่ยนรูป' : 'แนบรูป'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => attach(line.bookId, e.target.files?.[0])}
                              />
                            </label>
                          ) : line.evidence ? (
                            <img
                              className="ret__thumb"
                              src={line.evidence}
                              alt="หลักฐานการส่งคืน"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="ret__none">ไม่มี</span>
                          )}
                          {draft?.evidence && (
                            <img
                              className="ret__thumb"
                              src={draft.evidence}
                              alt="หลักฐานการส่งคืน"
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {existing ? (
        <section className="admin-card ret__track">
          <h2 className="ret__track-title">ติดตามการชดเชย</h2>

          <p className="ret__status">
            <Icon
              name={existing.status === 'CLOSED' ? 'check-circle' : 'clock'}
              size={18}
            />
            สถานะ: {existing.status === 'TRACKING' && 'รอผู้จัดจำหน่ายตอบรับ'}
            {existing.status === 'ESCALATED' && `ส่งต่อผู้จัดการร้าน · ${existing.escalationNote}`}
            {existing.status === 'CLOSED' &&
              `ปิดรายการแล้ว · ${COMPENSATION_LABELS[existing.compensation!.type]}${
                existing.compensation!.note ? ` · ${existing.compensation!.note}` : ''
              }`}
          </p>

          {existing.status !== 'CLOSED' && (
            <>
              <div className="ret__compensate">
                <label className="admin-field">
                  <span className="admin-field__label">รูปแบบการชดเชย</span>
                  <select
                    className="admin-input"
                    value={compensationType}
                    onChange={(e) =>
                      setCompensationType(e.target.value as Compensation['type'])
                    }
                  >
                    {(Object.keys(COMPENSATION_LABELS) as Compensation['type'][]).map(
                      (entry) => (
                        <option key={entry} value={entry}>
                          {COMPENSATION_LABELS[entry]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="admin-field ret__grow">
                  <span className="admin-field__label">รายละเอียด</span>
                  <input
                    type="text"
                    className="admin-input"
                    value={compensationNote}
                    placeholder="เช่น ผู้จัดจำหน่ายส่งสินค้าทดแทนครบแล้ว"
                    onChange={(e) => setCompensationNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={working}
                  onClick={() => void close()}
                >
                  บันทึกการชดเชย
                </button>
              </div>

              {existing.status === 'TRACKING' && (
                <div className="ret__escalate">
                  <label className="admin-field ret__grow">
                    <span className="admin-field__label">
                      กรณีผู้จัดจำหน่ายปฏิเสธการรับคืน
                    </span>
                    <input
                      type="text"
                      className="admin-input"
                      value={escalation}
                      placeholder="ระบุเหตุผลที่ผู้จัดจำหน่ายแจ้งกลับมา"
                      onChange={(e) => setEscalation(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={working}
                    onClick={() => void escalate()}
                  >
                    ส่งเรื่องให้ผู้จัดการร้านพิจารณา
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="ret__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/admin/purchasing/po/${order.poId}`)}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={working}
            onClick={() => void submit()}
          >
            <Icon name="mail" size={18} />
            ส่งเรื่องคืน
          </button>
        </div>
      )}
    </div>
  )
}
