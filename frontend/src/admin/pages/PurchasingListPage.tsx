import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import type { BadgeTone } from '../components/StatusBadge'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { can } from '../permissions'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPOCode,
  formatPRCode,
  PO_STATUS_LABELS,
  PO_STATUS_TONES,
  poDisplayStatus,
  PR_STATUS_LABELS,
  PR_STATUS_TONES,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatBaht, formatSupplierCode } from '../suppliers/suppliers'
import '../components/Tabs.css'
import '../components/DataTable.css'
import './PurchasingListPage.css'

type Tab = 'ALL' | 'PENDING' | 'PO' | 'RECEIVING'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'PENDING', label: 'รออนุมัติ' },
  { key: 'PO', label: 'PO' },
  { key: 'RECEIVING', label: 'รับสินค้า' },
]

interface DocumentRow {
  key: string
  kind: 'PR' | 'PO'
  code: string
  supplierId: number
  total: number
  label: string
  tone: BadgeTone
  updated: string
  detailPath: string
  /** The one action the current role can take on this document right now. */
  action?: { label: string; to: string }
}

export default function PurchasingListPage() {
  const { user } = useAuth()
  const { requisitions, orders } = usePurchasing()
  const { suppliers } = useSuppliers()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('ALL')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role
  const mayApprove = can.approveRequisition(role)
  const mayHandleOrders = can.sendOrder(role)

  const supplierName = (supplierId: number) =>
    suppliers.find((entry) => entry.supplierId === supplierId)?.companyName ?? '—'

  // The จัดการ column varies by status *and* role: the manager sees อนุมัติ, the
  // warehouse sees ส่ง / รับ / แก้ไข (spec SCR-22).
  const rows = useMemo<DocumentRow[]>(() => {
    const prRows = requisitions.map<DocumentRow>((pr) => ({
      key: `PR-${pr.prId}`,
      kind: 'PR',
      code: formatPRCode(pr.prId),
      supplierId: pr.supplierId,
      total: documentTotal(pr.items),
      label: PR_STATUS_LABELS[pr.status],
      tone: PR_STATUS_TONES[pr.status],
      updated: pr.createdDate,
      detailPath: `/admin/purchasing/pr/${pr.prId}`,
      action:
        pr.status === 'SUBMITTED' && mayApprove
          ? { label: 'อนุมัติ', to: `/admin/purchasing/pr/${pr.prId}/approve` }
          : (pr.status === 'DRAFT' || pr.status === 'REJECTED') && can.createRequisition(role)
            ? { label: 'แก้ไข', to: `/admin/purchasing/pr/${pr.prId}` }
            : undefined,
    }))

    const poRows = orders.map<DocumentRow>((po) => {
      const display = poDisplayStatus(po)
      const detailPath = `/admin/purchasing/po/${po.poId}`
      return {
        key: `PO-${po.poId}`,
        kind: 'PO',
        code: formatPOCode(po.poId),
        supplierId: po.supplierId,
        total: documentTotal(po.items),
        label: PO_STATUS_LABELS[display],
        tone: PO_STATUS_TONES[display],
        updated: (po.confirmedAt ?? po.sentAt)?.slice(0, 10) ?? po.orderDate,
        detailPath,
        action: !mayHandleOrders
          ? undefined
          : display === 'AWAITING_SEND'
            ? { label: 'ส่ง', to: detailPath }
            : display === 'AWAITING_CONFIRM'
              ? { label: 'ยืนยัน', to: detailPath }
              : display === 'CONFIRMED' || display === 'RECEIVED_PARTIAL'
                ? { label: 'รับ', to: `${detailPath}/receive` }
                : undefined,
      }
    })

    return [...prRows, ...poRows].sort((a, b) => b.updated.localeCompare(a.updated))
  }, [requisitions, orders, mayApprove, mayHandleOrders, role])

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    const nameOf = (supplierId: number) =>
      suppliers.find((entry) => entry.supplierId === supplierId)?.companyName ?? ''

    return rows.filter((row) => {
      if (tab === 'PENDING' && !(row.kind === 'PR' && row.label === PR_STATUS_LABELS.SUBMITTED))
        return false
      if (tab === 'PO' && row.kind !== 'PO') return false
      if (
        tab === 'RECEIVING' &&
        !(
          row.kind === 'PO' &&
          (row.label === PO_STATUS_LABELS.CONFIRMED ||
            row.label === PO_STATUS_LABELS.RECEIVED_PARTIAL)
        )
      )
        return false
      if (!needle) return true
      return (
        row.code.toLowerCase().includes(needle) ||
        nameOf(row.supplierId).toLowerCase().includes(needle) ||
        formatSupplierCode(row.supplierId).toLowerCase().includes(needle)
      )
    })
  }, [rows, tab, term, suppliers])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'เอกสารจัดซื้อ' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">เอกสารจัดซื้อ</h1>
          <p className="admin-page__subtitle">
            ติดตามใบขอสั่งซื้อและใบสั่งซื้อทั้งหมด {rows.length} รายการ
          </p>
        </div>
        {can.createRequisition(role) && (
          <div className="admin-page__actions">
            <Link to="/admin/purchasing/pr/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={18} />
              สร้างใบขอสั่งซื้อ
            </Link>
          </div>
        )}
      </div>

      <section className="admin-card">
        <div className="admin-tabs" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              className={'admin-tabs__tab' + (tab === entry.key ? ' admin-tabs__tab--active' : '')}
              onClick={() => {
                setTab(entry.key)
                setPage(1)
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาเลขที่เอกสารหรือผู้จัดจำหน่าย"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="ไม่พบเอกสารในหมวดนี้"
            description="ลองเปลี่ยนแท็บหรือปรับคำค้นเพื่อดูรายการอื่น"
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>ผู้จัดจำหน่าย</th>
                    <th className="po-list__num">ยอดรวม</th>
                    <th>สถานะ</th>
                    <th>อัปเดต</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.key}>
                      <td className="data-table__code">{row.code}</td>
                      <td className="data-table__strong">
                        {formatSupplierCode(row.supplierId)} · {supplierName(row.supplierId)}
                      </td>
                      <td className="po-list__num">{formatBaht(row.total)}</td>
                      <td>
                        <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
                      </td>
                      <td>{row.updated}</td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ดูรายละเอียด"
                            onClick={() => navigate(row.detailPath)}
                          >
                            <Icon name="eye" size={17} />
                          </button>
                          {row.action && (
                            <Link to={row.action.to} className="btn btn-outline btn-sm">
                              {row.action.label}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </div>
  )
}
