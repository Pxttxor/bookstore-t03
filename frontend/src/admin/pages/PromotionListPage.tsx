import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/ToastContext'
import { usePromotions } from '../promotions/PromotionContext'
import {
  formatDiscount,
  formatPromotionCode,
  PROMOTION_STATUS_LABELS,
  PROMOTION_STATUS_TONES,
  PROMOTION_TYPE_LABELS,
  promoDisplayStatus,
  type Promotion,
  type PromotionStatus,
  type PromotionType,
} from '../promotions/promotions'
import '../components/DataTable.css'
import './PromotionListPage.css'

type StatusFilter = PromotionStatus | 'ALL'
type TypeFilter = PromotionType | 'ALL'

export default function PromotionListPage() {
  const { user } = useAuth()
  const { promotions, setActive, remove, loading, error, reload } = usePromotions()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [toDelete, setToDelete] = useState<Promotion | null>(null)

  const role = user!.role
  const mayManage = can.managePromotion(role)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return promotions.filter((promo) => {
      if (status !== 'ALL' && promoDisplayStatus(promo) !== status) return false
      if (type !== 'ALL' && promo.type !== type) return false
      if (!needle) return true
      return (
        promo.name.toLowerCase().includes(needle) ||
        promo.conditionDetail.toLowerCase().includes(needle) ||
        formatPromotionCode(promo.promotionId).toLowerCase().includes(needle)
      )
    })
  }, [promotions, term, status, type])

  if (!can.viewPromotions(role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์จัดการโปรโมชั่น"
            description="การจัดการโปรโมชั่นและส่วนลดเป็นสิทธิ์ของผู้จัดการร้านเท่านั้น"
            action={{ label: 'กลับไปหน้าหลัก', onClick: () => navigate('/admin') }}
          />
        </section>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isFiltered = term.trim() !== '' || status !== 'ALL' || type !== 'ALL'

  const clearFilters = () => {
    setTerm('')
    setStatus('ALL')
    setType('ALL')
    setPage(1)
  }

  const toggleActive = async (promo: Promotion) => {
    const next = promoDisplayStatus(promo) === 'ACTIVE' ? false : true
    try {
      await setActive(promo.promotionId, next)
      notify(
        'success',
        next
          ? `เปิดใช้งานโปรโมชั่น "${promo.name}" แล้ว`
          : `ปิดใช้งานโปรโมชั่น "${promo.name}" แล้ว`,
      )
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เปลี่ยนสถานะโปรโมชั่นไม่สำเร็จ')
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    try {
      await remove(toDelete.promotionId)
      notify('success', `ลบโปรโมชั่น "${toDelete.name}" ออกจากระบบแล้ว`)
      setToDelete(null)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ลบโปรโมชั่นไม่สำเร็จ')
    }
  }

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'โปรโมชั่นและส่วนลด' }]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">โปรโมชั่นและส่วนลด</h1>
          <p className="admin-page__subtitle">
            จัดการโปรโมชั่นและส่วนลดทั้งหมด {promotions.length} รายการ
          </p>
        </div>
        {mayManage && (
          <div className="admin-page__actions">
            <Link to="/admin/promotions/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={18} />
              เพิ่มโปรโมชั่น
            </Link>
          </div>
        )}
      </div>

      <section className="admin-card promotion-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาชื่อโปรโมชั่น เงื่อนไข หรือรหัส"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
          </label>

          <label className="filter-bar__select">
            <span>ประเภท</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as TypeFilter)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="FESTIVAL_DISCOUNT">{PROMOTION_TYPE_LABELS.FESTIVAL_DISCOUNT}</option>
              <option value="COUPON">{PROMOTION_TYPE_LABELS.COUPON}</option>
              <option value="BUY_X_QTY">{PROMOTION_TYPE_LABELS.BUY_X_QTY}</option>
            </select>
          </label>

          <label className="filter-bar__select">
            <span>สถานะ</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="ACTIVE">{PROMOTION_STATUS_LABELS.ACTIVE}</option>
              <option value="INACTIVE">{PROMOTION_STATUS_LABELS.INACTIVE}</option>
              <option value="EXPIRED">{PROMOTION_STATUS_LABELS.EXPIRED}</option>
            </select>
          </label>

          {isFiltered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <Icon name="filter" size={16} />
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดโปรโมชั่น…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="tag"
            title="ไม่พบโปรโมชั่นที่ตรงกับคำค้น"
            description="ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมดอีกครั้ง"
            action={isFiltered ? { label: 'ล้างตัวกรอง', onClick: clearFilters } : undefined}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ชื่อโปรโมชั่น</th>
                    <th>ประเภท</th>
                    <th>ส่วนลด</th>
                    <th>ระยะเวลา</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((promo) => {
                    const display = promoDisplayStatus(promo)
                    return (
                      <tr key={promo.promotionId}>
                        <td className="data-table__code">
                          {formatPromotionCode(promo.promotionId)}
                        </td>
                        <td className="data-table__strong">
                          {promo.name}
                          <span className="promotion-list__condition">
                            {promo.conditionDetail}
                          </span>
                        </td>
                        <td>{PROMOTION_TYPE_LABELS[promo.type]}</td>
                        <td className="promotion-list__discount">{formatDiscount(promo)}</td>
                        <td className="promotion-list__dates">
                          {promo.startDate} — {promo.endDate}
                        </td>
                        <td>
                          <StatusBadge tone={PROMOTION_STATUS_TONES[display]}>
                            {PROMOTION_STATUS_LABELS[display]}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="data-table__actions">
                            {mayManage && display !== 'EXPIRED' && (
                              <button
                                type="button"
                                className="icon-btn"
                                title="แก้ไข"
                                onClick={() =>
                                  navigate(`/admin/promotions/${promo.promotionId}/edit`)
                                }
                              >
                                <Icon name="edit" size={17} />
                              </button>
                            )}
                            {mayManage && display !== 'EXPIRED' && (
                              <button
                                type="button"
                                className="icon-btn"
                                title={display === 'ACTIVE' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                onClick={() => void toggleActive(promo)}
                              >
                                <Icon
                                  name={display === 'ACTIVE' ? 'eye-off' : 'eye'}
                                  size={17}
                                />
                              </button>
                            )}
                            {mayManage && (
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                title="ลบ"
                                onClick={() => setToDelete(promo)}
                              >
                                <Icon name="trash" size={17} />
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

      {toDelete && (
        <Modal
          title="ลบโปรโมชั่น"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setToDelete(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void confirmDelete()}
              >
                ยืนยันการลบ
              </button>
            </>
          }
        >
          <p className="promotion-list__confirm">
            ต้องการลบโปรโมชั่น <strong>{toDelete.name}</strong> ({formatPromotionCode(toDelete.promotionId)})
            ออกจากระบบใช่หรือไม่? การลบไม่สามารถย้อนกลับได้ หากเพียงต้องการหยุดใช้งานชั่วคราว
            ให้เลือก &quot;ปิดใช้งาน&quot; แทน
          </p>
        </Modal>
      )}
    </div>
  )
}
