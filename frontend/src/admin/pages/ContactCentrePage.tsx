import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import Breadcrumb from '../components/Breadcrumb'
import ContactCard from '../components/ContactCard'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import { useNotifications } from '../notifications/NotificationContext'
import { can } from '../permissions'
import { useSuppliers } from '../suppliers/SupplierContext'
import { formatSupplierCode } from '../suppliers/suppliers'
import './ContactCentrePage.css'

type Tab = 'directory' | 'routing' | 'notifications'

// §B of SCR-27: which document goes to whom, through which channel, and whether the
// system sends it automatically or a person has to press the button.
const ROUTING = [
  {
    document: 'ใบขอสั่งซื้อ (PR)',
    recipient: 'ผู้จัดการร้าน',
    channel: 'ในระบบ + อีเมล',
    trigger: 'อัตโนมัติ',
    auto: true,
  },
  {
    document: 'ผลอนุมัติ/ตีกลับ',
    recipient: 'พนักงานคลัง (ผู้ขอ)',
    channel: 'ในระบบ + อีเมล',
    trigger: 'อัตโนมัติ เมื่อผู้จัดการร้านตัดสิน',
    auto: true,
  },
  {
    document: 'ใบสั่งซื้อ (PO)',
    recipient: 'ผู้จัดจำหน่าย',
    channel: 'อีเมล (แนบ PDF)',
    trigger: 'กด "ส่งให้ผู้จัดจำหน่าย"',
    auto: false,
  },
  {
    document: 'ใบรับสินค้า (GRN)',
    recipient: 'บันทึกภายใน / สรุปถึงผู้จัดการร้าน',
    channel: 'ในระบบ',
    trigger: 'อัตโนมัติ เมื่อบันทึกรับ',
    auto: true,
  },
  {
    document: 'ใบส่งคืน',
    recipient: 'ผู้จัดจำหน่าย',
    channel: 'อีเมล + แนบหลักฐาน',
    trigger: 'กด "ส่งเรื่องคืน"',
    auto: false,
  },
  {
    document: 'ส่งต่อผู้จัดการ (กรณีปฏิเสธคืน)',
    recipient: 'ผู้จัดการร้าน',
    channel: 'ในระบบ + อีเมล',
    trigger: 'กด "ส่งเรื่องให้ผู้จัดการร้านพิจารณา"',
    auto: false,
  },
  {
    document: 'แจ้งเตือนถึงจุดสั่งซื้อ',
    recipient: 'พนักงานคลัง',
    channel: 'ในระบบ (กระดิ่ง)',
    trigger: 'อัตโนมัติ ตามรอบเวลา',
    auto: true,
  },
]

export default function ContactCentrePage() {
  const { user } = useAuth()
  const { suppliers, loading: supplierLoading, error: supplierError, reload: reloadSuppliers } =
    useSuppliers()
  const {
    listFor,
    loading: notificationLoading,
    error: notificationError,
    reload: reloadNotifications,
  } = useNotifications()
  const [tab, setTab] = useState<Tab>('directory')

  const role = user!.role
  // Sales gets the directory only, read-only (spec SCR-27 §2.3).
  const mayViewRouting = can.viewDocumentRouting(role)
  const notifications = listFor(role)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'directory', label: 'ผู้ติดต่อ' },
    ...(mayViewRouting
      ? ([
          { key: 'routing', label: 'เส้นทางเอกสาร' },
          { key: 'notifications', label: 'การแจ้งเตือน' },
        ] as { key: Tab; label: string }[])
      : []),
  ]

  const activeSuppliers = suppliers.filter((entry) => entry.status === 'ACTIVE')

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'ศูนย์การติดต่อ' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">ศูนย์การติดต่อ &amp; การส่งเอกสาร</h1>
          <p className="admin-page__subtitle">เอกสาร · ผู้รับ · ช่องทาง · ทริกเกอร์</p>
        </div>
      </div>

      <section className="admin-card admin-card--flush">
        <div className="admin-tabs admin-tabs--inset" role="tablist">
          {tabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              className={'admin-tabs__tab' + (tab === entry.key ? ' admin-tabs__tab--active' : '')}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'directory' && (
          <div className="contacts__panel">
            <div className="contacts__grid">
              <ContactCard
                icon="user"
                name="ผู้จัดการร้าน"
                duty="ขออนุมัติ PR/PO, งบประมาณ, ส่งต่อกรณีปัญหา"
                channels={[
                  { icon: 'bell', label: 'ในระบบ' },
                  { icon: 'mail', label: 'อีเมล' },
                ]}
              />
              <ContactCard
                icon="message"
                name="พนักงานฝ่ายขาย"
                duty="ประสาน/สอบถามสถานะสต็อกและหนังสือ"
                channels={[{ icon: 'bell', label: 'ในระบบ' }]}
              />
            </div>

            <h2 className="contacts__heading">ผู้จัดจำหน่าย</h2>
            {/* ต้องเช็คก่อน activeSuppliers.length ไม่งั้นระหว่างโหลดจะขึ้นว่ายังไม่มีผู้จัดจำหน่าย */}
            {supplierLoading ? (
              <LoadingState label="กำลังโหลดรายชื่อผู้จัดจำหน่าย…" />
            ) : supplierError ? (
              <ErrorState message={supplierError} onRetry={() => void reloadSuppliers()} />
            ) : activeSuppliers.length === 0 ? (
              <EmptyState
                icon="building"
                title="ยังไม่มีผู้จัดจำหน่ายในระบบ"
                description="เพิ่มผู้จัดจำหน่ายก่อนจึงจะติดต่อและสั่งซื้อได้"
              />
            ) : (
              <div className="contacts__grid">
                {activeSuppliers.map((supplier) => (
                  <ContactCard
                    key={supplier.supplierId}
                    icon="building"
                    name={supplier.companyName}
                    duty={`ส่ง PO, แจ้งส่งคืน, ติดตามยืนยัน/กำหนดส่ง · ผู้ติดต่อ ${supplier.contactName}`}
                    channels={[
                      { icon: 'mail', label: supplier.email },
                      { icon: 'message', label: supplier.phone },
                    ]}
                    to={`/admin/suppliers/${supplier.supplierId}`}
                    linkLabel={`ดูข้อมูล ${formatSupplierCode(supplier.supplierId)}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'routing' && mayViewRouting && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เอกสาร</th>
                  <th>ผู้รับ</th>
                  <th>ช่องทาง</th>
                  <th>ทริกเกอร์</th>
                </tr>
              </thead>
              <tbody>
                {ROUTING.map((row) => (
                  <tr key={row.document}>
                    <td className="data-table__strong">{row.document}</td>
                    <td>{row.recipient}</td>
                    <td>{row.channel}</td>
                    <td>
                      <StatusBadge tone={row.auto ? 'success' : 'neutral'}>
                        {row.auto ? 'อัตโนมัติ' : 'ผู้ใช้กดส่ง'}
                      </StatusBadge>
                      <span className="contacts__trigger">{row.trigger}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'notifications' && mayViewRouting && (
          <div className="contacts__panel">
            <p className="contacts__note">
              <Icon name="help" size={16} />
              รายการนี้แสดงทั้งการแจ้งเตือนในระบบและสำเนาอีเมลที่ระบบบันทึกไว้
              ระบบบันทึกเส้นทางเอกสารลงฐานข้อมูลจริง แต่ยังไม่ได้ส่งอีเมลออกจริง
            </p>

            {notificationLoading ? (
              <LoadingState label="กำลังโหลดการแจ้งเตือน…" />
            ) : notificationError ? (
              <ErrorState
                message={notificationError}
                onRetry={() => void reloadNotifications()}
              />
            ) : notifications.length === 0 ? (
              <EmptyState
                icon="bell"
                title="ยังไม่มีการแจ้งเตือน"
                description="เมื่อมีการส่งใบขอสั่งซื้อหรือบันทึกรับสินค้า รายการจะปรากฏที่นี่"
              />
            ) : (
              <ul className="contacts__feed">
                {notifications.map((entry) => (
                  <li key={entry.id}>
                    <StatusBadge tone={entry.channel === 'email' ? 'neutral' : 'info'}>
                      {entry.channel === 'email' ? 'อีเมล' : 'ในระบบ'}
                    </StatusBadge>
                    <div className="contacts__feed-body">
                      <span className="contacts__feed-title">{entry.title}</span>
                      <span className="contacts__feed-text">{entry.body}</span>
                    </div>
                    <span className="contacts__feed-time">
                      {entry.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                    <Link to={entry.link} className="btn btn-outline btn-sm">
                      เปิดเอกสาร
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
