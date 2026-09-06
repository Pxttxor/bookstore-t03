import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useResource } from '../../api/useResource'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatTile from '../components/StatTile'
import StatusBadge from '../components/StatusBadge'
import { useBooks } from '../books/BookContext'
import {
  BOOK_FIELD_LABELS,
  BOOK_STATUS_LABELS,
  BOOK_STATUS_TONES,
  bookFieldLabel,
  formatPriceBaht,
} from '../books/books'
import { useInventory } from '../inventory/InventoryContext'
import {
  formatBookCode,
  STOCK_LEVEL_LABELS,
  STOCK_TXN_TYPE_LABELS,
  STOCK_TXN_TYPE_TONES,
  stockLevel,
} from '../inventory/inventory'
import '../components/DataTable.css'
import '../components/Tabs.css'
import './BookDetailPage.css'

type Tab = 'changes' | 'movements'

const whenText = (iso: string) => new Date(iso).toLocaleString('th-TH')

export default function BookDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { findById, categoryName, changeLogs, loading, error, reload } = useBooks()
  const { findByBookId, transactionsForBook } = useInventory()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('changes')

  const bookId = Number(id)

  // ประวัติการแก้ไขไม่ได้ติดมากับ GET /api/books — เป็น endpoint ของตัวเอง
  // (`bookDTO` ฝั่ง Go ไม่มีฟิลด์นี้) จึงโหลดแยกตรงนี้
  const loadChanges = useCallback(() => changeLogs(bookId), [changeLogs, bookId])
  const { data: changeRows } = useResource(loadChanges, Number.isInteger(bookId))

  // รายการเคลื่อนไหวสต็อกก็เป็น endpoint ของตัวเองเช่นกัน — ไม่มีลิสต์รวมทั้งระบบให้ดึง
  const loadMovements = useCallback(
    () => transactionsForBook(bookId),
    [transactionsForBook, bookId],
  )
  const { data: movementRows } = useResource(loadMovements, Number.isInteger(bookId))

  const book = findById(bookId)

  // ต้องมาก่อนการเช็ค "ไม่พบข้อมูล" ไม่งั้นระหว่างโหลดจะขึ้นว่าไม่พบทุกครั้งที่เปิดหน้า
  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลหนังสือ…" />
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

  if (!book) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'ข้อมูลหนังสือ', to: '/admin/books' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="book"
            title="ไม่พบข้อมูลหนังสือ"
            description="รหัสหนังสือที่ระบุไม่มีอยู่ในระบบ"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/books') }}
          />
        </section>
      </div>
    )
  }

  const item = findByBookId(book.bookId)
  const movements = movementRows ?? []
  const changes = [...(changeRows ?? [])].reverse()
  const level = item ? stockLevel(item) : undefined

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ข้อมูลหนังสือ', to: '/admin/books' },
          { label: book.title },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{book.title}</h1>
          <p className="admin-page__subtitle">
            รหัส {formatBookCode(book.bookId)} · ISBN {book.isbn}
          </p>
        </div>
        <div className="admin-page__actions">
          <StatusBadge tone={BOOK_STATUS_TONES[book.status]}>
            {BOOK_STATUS_LABELS[book.status]}
          </StatusBadge>
          {can.editBooks(user!.role) && (
            <Link to={`/admin/books/${book.bookId}/edit`} className="btn btn-primary btn-sm">
              <Icon name="edit" size={18} />
              แก้ไขข้อมูลหนังสือ
            </Link>
          )}
        </div>
      </div>

      <div className="book-detail__tiles">
        <StatTile
          label="ยอดคงเหลือปัจจุบัน"
          value={item ? `${item.quantityOnHand} เล่ม` : 'ไม่มีข้อมูลคลัง'}
          note={
            level
              ? `สถานะสต็อก: ${STOCK_LEVEL_LABELS[level]}`
              : 'ยังไม่ได้ผูกกับรายการสินค้าคงคลัง'
          }
          icon="package"
          tone={level === 'OUT' ? 'danger' : level === 'LOW' ? 'warning' : 'default'}
        />
        <StatTile
          label="จุดสั่งซื้อ"
          value={item?.reorderPoint ?? 'ยังไม่ตั้งค่า'}
          note={
            item?.lastUpdated
              ? `อัปเดตล่าสุด ${whenText(item.lastUpdated)}`
              : 'ยังไม่เคยมีการเคลื่อนไหว'
          }
          icon="bell"
        />
        <StatTile label="ราคาปก" value={`${formatPriceBaht(book.price)} บาท`} icon="tag" />
      </div>

      <section className="admin-card book-detail__card">
        <h2 className="admin-card__title">ข้อมูลหนังสือ</h2>
        <dl className="book-detail__facts">
          <div>
            <dt>{BOOK_FIELD_LABELS.author}</dt>
            <dd>{book.author}</dd>
          </div>
          <div>
            <dt>{BOOK_FIELD_LABELS.publisher}</dt>
            <dd>{book.publisher}</dd>
          </div>
          <div>
            <dt>{BOOK_FIELD_LABELS.categoryId}</dt>
            <dd>{categoryName(book.categoryId)}</dd>
          </div>
          <div>
            <dt>{BOOK_FIELD_LABELS.isbn}</dt>
            <dd className="book-detail__mono">{book.isbn}</dd>
          </div>
          <div className="book-detail__facts-wide">
            <dt>{BOOK_FIELD_LABELS.description}</dt>
            <dd>{book.description || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card book-detail__card">
        <div className="admin-tabs">
          <button
            type="button"
            className={'admin-tabs__tab' + (tab === 'changes' ? ' admin-tabs__tab--active' : '')}
            onClick={() => setTab('changes')}
          >
            ประวัติการแก้ไข ({changes.length})
          </button>
          <button
            type="button"
            className={'admin-tabs__tab' + (tab === 'movements' ? ' admin-tabs__tab--active' : '')}
            onClick={() => setTab('movements')}
          >
            ประวัติการเคลื่อนไหวสต็อก ({movements.length})
          </button>
        </div>

        {tab === 'changes' ? (
          changes.length === 0 ? (
            <EmptyState
              icon="clock"
              title="ยังไม่มีประวัติการแก้ไข"
              description="ระบบจะบันทึกทุกช่องที่เปลี่ยนแปลงไว้ที่นี่เมื่อมีการแก้ไขข้อมูลหนังสือ"
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>วันเวลา</th>
                    <th>ช่องที่แก้ไข</th>
                    <th>ค่าเดิม</th>
                    <th>ค่าใหม่</th>
                    <th>ผู้แก้ไข</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((log) => (
                    <tr key={log.logId}>
                      <td className="data-table__code">{whenText(log.changedDate)}</td>
                      <td className="data-table__strong">{bookFieldLabel(log.changedField)}</td>
                      <td>{log.oldValue || '—'}</td>
                      <td>{log.newValue || '—'}</td>
                      <td>{log.changedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : movements.length === 0 ? (
          <EmptyState
            icon="package"
            title="ยังไม่มีการเคลื่อนไหวสต็อก"
            description="รายการรับเข้า ขายออก ส่งคืน และการปรับปรุงยอดของหนังสือเล่มนี้จะแสดงที่นี่"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>ประเภท</th>
                  <th className="book-detail__num">จำนวน</th>
                  <th>เหตุผล</th>
                  <th>เอกสารอ้างอิง</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((txn) => (
                  <tr key={txn.txnId}>
                    <td className="data-table__code">{whenText(txn.txnDate)}</td>
                    <td>
                      <StatusBadge tone={STOCK_TXN_TYPE_TONES[txn.type]}>
                        {STOCK_TXN_TYPE_LABELS[txn.type]}
                      </StatusBadge>
                    </td>
                    <td
                      className={
                        'book-detail__num' +
                        (txn.quantityChange < 0 ? ' book-detail__num--out' : '')
                      }
                    >
                      {txn.quantityChange > 0 ? `+${txn.quantityChange}` : txn.quantityChange}
                    </td>
                    <td>{txn.reason}</td>
                    <td className="data-table__code">{txn.referenceDoc || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
