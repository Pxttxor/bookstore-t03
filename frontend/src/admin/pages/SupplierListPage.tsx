import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import { useSuppliers } from '../suppliers/SupplierContext'
import {
  formatSupplierCode,
  SUPPLIER_STATUS_LABELS,
  type SupplierStatus,
} from '../suppliers/suppliers'
import '../components/DataTable.css'
import './SupplierListPage.css'

type StatusFilter = SupplierStatus | 'ALL'

export default function SupplierListPage() {
  const { user } = useAuth()
  const { suppliers, loading, error, reload } = useSuppliers()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [publisher, setPublisher] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const role = user!.role
  const mayEdit = can.editSuppliers(role)

  const publishers = useMemo(() => {
    const names = new Set<string>()
    for (const supplier of suppliers) {
      for (const book of supplier.books) names.add(book.publisher)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'th'))
  }, [suppliers])

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return suppliers.filter((supplier) => {
      if (status !== 'ALL' && supplier.status !== status) return false
      if (publisher !== 'ALL' && !supplier.books.some((b) => b.publisher === publisher))
        return false
      if (!needle) return true
      return (
        supplier.companyName.toLowerCase().includes(needle) ||
        supplier.contactName.toLowerCase().includes(needle) ||
        supplier.phone.includes(needle) ||
        formatSupplierCode(supplier.supplierId).toLowerCase().includes(needle)
      )
    })
  }, [suppliers, term, status, publisher])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isFiltered = term.trim() !== '' || status !== 'ALL' || publisher !== 'ALL'

  const clearFilters = () => {
    setTerm('')
    setStatus('ALL')
    setPublisher('ALL')
    setPage(1)
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ผู้จัดจำหน่าย' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ผู้จัดจำหน่าย</h1>
          <p className="admin-page__subtitle">
            ค้นหาและเรียกดูข้อมูลผู้จัดจำหน่ายทั้งหมด {suppliers.length} ราย
          </p>
        </div>
        {mayEdit && (
          <div className="admin-page__actions">
            <Link to="/admin/suppliers/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={18} />
              เพิ่มผู้จัดจำหน่าย
            </Link>
          </div>
        )}
      </div>

      <section className="admin-card supplier-list">
        <div className="filter-bar">
          <label className="filter-bar__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={term}
              placeholder="ค้นหาชื่อบริษัท ผู้ติดต่อ เบอร์โทร หรือรหัส"
              onChange={(e) => {
                setTerm(e.target.value)
                setPage(1)
              }}
            />
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
              <option value="ACTIVE">{SUPPLIER_STATUS_LABELS.ACTIVE}</option>
              <option value="CANCELLED">{SUPPLIER_STATUS_LABELS.CANCELLED}</option>
            </select>
          </label>

          <label className="filter-bar__select">
            <span>สำนักพิมพ์</span>
            <select
              value={publisher}
              onChange={(e) => {
                setPublisher(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">ทั้งหมด</option>
              {publishers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
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
          <LoadingState label="กำลังโหลดรายชื่อผู้จัดจำหน่าย…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="ไม่พบข้อมูลที่ตรงกับคำค้น"
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
                    <th>ชื่อบริษัท</th>
                    <th>ผู้ติดต่อ</th>
                    <th>เบอร์โทร</th>
                    <th>จำนวนหนังสือ</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((supplier) => (
                    <tr key={supplier.supplierId}>
                      <td className="data-table__code">
                        {formatSupplierCode(supplier.supplierId)}
                      </td>
                      <td className="data-table__strong">{supplier.companyName}</td>
                      <td>{supplier.contactName}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.books.length} เล่ม</td>
                      <td>
                        <StatusBadge
                          tone={supplier.status === 'ACTIVE' ? 'success' : 'neutral'}
                        >
                          {SUPPLIER_STATUS_LABELS[supplier.status]}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="data-table__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="ดูรายละเอียด"
                            onClick={() => navigate(`/admin/suppliers/${supplier.supplierId}`)}
                          >
                            <Icon name="eye" size={17} />
                          </button>
                          {mayEdit && supplier.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="แก้ไข"
                              onClick={() =>
                                navigate(`/admin/suppliers/${supplier.supplierId}/edit`)
                              }
                            >
                              <Icon name="edit" size={17} />
                            </button>
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
