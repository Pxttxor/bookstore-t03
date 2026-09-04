import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { usePurchasing } from '../purchasing/PurchasingContext'
import {
  documentTotal,
  formatPOCode,
  outstandingOrders,
  PO_STATUS_LABELS,
  PO_STATUS_TONES,
  poDisplayStatus,
} from '../purchasing/purchasing'
import { useSuppliers } from '../suppliers/SupplierContext'
import {
  formatBaht,
  formatSupplierCode,
  SUPPLIER_STATUS_LABELS,
} from '../suppliers/suppliers'
import DeactivateSupplierModal from './DeactivateSupplierModal'
import '../components/DataTable.css'
import './SupplierDetailPage.css'

type Tab = 'books' | 'orders'

export default function SupplierDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { findById, deactivate, loading, error, reload } = useSuppliers()
  const { ordersForSupplier } = usePurchasing()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('books')
  const [confirming, setConfirming] = useState(false)

  const supplier = findById(Number(id))

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลผู้จัดจำหน่าย…" />
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

  if (!supplier) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'ผู้จัดจำหน่าย', to: '/admin/suppliers' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="building"
            title="ไม่พบข้อมูลผู้จัดจำหน่าย"
            description="รหัสที่ระบุอาจถูกลบไปแล้วหรือพิมพ์ไม่ถูกต้อง"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/suppliers') }}
          />
        </section>
      </div>
    )
  }

  const role = user!.role
  const code = formatSupplierCode(supplier.supplierId)
  const active = supplier.status === 'ACTIVE'
  const mayEdit = can.editSuppliers(role) && active
  const mayDeactivate = can.deactivateSupplier(role) && active
  const orders = ordersForSupplier(supplier.supplierId)
  const pendingCount = outstandingOrders(orders).length

  const onConfirmDeactivate = async (reason: string, note: string) => {
    try {
      // at / by เซิร์ฟเวอร์เติมจาก JWT ให้เอง หน้าจอส่งแค่เหตุผลกับหมายเหตุ
      await deactivate(supplier.supplierId, {
        reason,
        note,
        at: new Date().toISOString(),
        by: user!.name,
      })
      setConfirming(false)
      notify('success', `ปิดใช้งาน ${supplier.companyName} เรียบร้อยแล้ว`)
    } catch (err) {
      // abnormal flow ของ U3: ยังมีใบสั่งซื้อคงค้าง → เซิร์ฟเวอร์ปฏิเสธพร้อมข้อความไทย
      notify('error', err instanceof Error ? err.message : 'ปิดใช้งานไม่สำเร็จ')
    }
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ผู้จัดจำหน่าย', to: '/admin/suppliers' },
          { label: supplier.companyName },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <p className="supplier-detail__code">{code}</p>
          <h1 className="admin-page__title">
            {supplier.companyName}{' '}
            <StatusBadge tone={active ? 'success' : 'neutral'}>
              {SUPPLIER_STATUS_LABELS[supplier.status]}
            </StatusBadge>
          </h1>
        </div>

        <div className="admin-page__actions">
          {mayEdit && (
            <Link
              to={`/admin/suppliers/${supplier.supplierId}/edit`}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="edit" size={17} />
              แก้ไข
            </Link>
          )}
          {mayDeactivate && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setConfirming(true)}
            >
              <Icon name="power" size={17} />
              ปิดใช้งาน
            </button>
          )}
        </div>
      </div>

      {!active && supplier.deactivation && (
        <div className="supplier-detail__banner">
          <Icon name="alert-triangle" size={20} />
          <div>
            <strong>ผู้จัดจำหน่ายรายนี้ถูกปิดใช้งานแล้ว</strong>
            <p>
              เหตุผล: {supplier.deactivation.reason}
              {supplier.deactivation.note && ` · ${supplier.deactivation.note}`} · โดย{' '}
              {supplier.deactivation.by}
            </p>
          </div>
        </div>
      )}

      <div className="supplier-detail__cards">
        <section className="admin-card supplier-detail__card">
          <h2 className="admin-card__title">ข้อมูลติดต่อ</h2>
          <dl className="supplier-detail__list">
            <div>
              <dt>ผู้ติดต่อ</dt>
              <dd>{supplier.contactName}</dd>
            </div>
            <div>
              <dt>เบอร์โทร</dt>
              <dd>{supplier.phone}</dd>
            </div>
            <div>
              <dt>อีเมล</dt>
              <dd>{supplier.email}</dd>
            </div>
            <div>
              <dt>ที่อยู่</dt>
              <dd>{supplier.address}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-card supplier-detail__card">
          <h2 className="admin-card__title">เงื่อนไขการค้า</h2>
          <dl className="supplier-detail__list">
            <div>
              <dt>เงื่อนไขการค้า</dt>
              <dd>{supplier.tradeTerms || '—'}</dd>
            </div>
            <div>
              <dt>เงื่อนไขเครดิต</dt>
              <dd>{supplier.creditTerms || '—'}</dd>
            </div>
            <div>
              <dt>ใบสั่งซื้อคงค้าง</dt>
              <dd>{pendingCount} รายการ</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="admin-card supplier-detail__tabs-card">
        <div className="supplier-detail__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'books'}
            className={'supplier-detail__tab' + (tab === 'books' ? ' supplier-detail__tab--active' : '')}
            onClick={() => setTab('books')}
          >
            รายการหนังสือ ({supplier.books.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'orders'}
            className={'supplier-detail__tab' + (tab === 'orders' ? ' supplier-detail__tab--active' : '')}
            onClick={() => setTab('orders')}
          >
            ประวัติการสั่งซื้อ ({orders.length})
          </button>
        </div>

        {tab === 'books' &&
          (supplier.books.length === 0 ? (
            <EmptyState icon="book" title="ยังไม่มีรายการหนังสือของผู้จัดจำหน่ายรายนี้" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ISBN</th>
                    <th>ชื่อหนังสือ</th>
                    <th>ผู้แต่ง</th>
                    <th>สำนักพิมพ์</th>
                    <th>ราคาส่ง</th>
                    <th>ระยะเวลาส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.books.map((book) => (
                    <tr key={book.bookId}>
                      <td className="data-table__code">{book.isbn}</td>
                      <td className="data-table__strong">{book.title}</td>
                      <td>{book.author}</td>
                      <td>{book.publisher}</td>
                      <td>{formatBaht(book.supplyPrice)} บาท</td>
                      <td>{book.leadTimeDays} วัน</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'orders' &&
          (orders.length === 0 ? (
            <EmptyState icon="file-text" title="ยังไม่มีประวัติการสั่งซื้อ" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่ใบสั่งซื้อ</th>
                    <th>วันที่สั่ง</th>
                    <th>กำหนดส่ง</th>
                    <th>ยอดรวม</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => {
                    const display = poDisplayStatus(po)
                    return (
                      <tr key={po.poId}>
                        <td className="data-table__code">{formatPOCode(po.poId)}</td>
                        <td>{po.orderDate}</td>
                        <td>{po.expectedDeliveryDate}</td>
                        <td>{formatBaht(documentTotal(po.items))} บาท</td>
                        <td>
                          <StatusBadge tone={PO_STATUS_TONES[display]}>
                            {PO_STATUS_LABELS[display]}
                          </StatusBadge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      {confirming && (
        <DeactivateSupplierModal
          supplier={supplier}
          onClose={() => setConfirming(false)}
          onConfirm={onConfirmDeactivate}
        />
      )}
    </div>
  )
}
