import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from '../../components/Icon'
import type { Role } from '../../auth/roles'
import { useInventory } from '../inventory/InventoryContext'
import { useReviews } from '../reviews/ReviewContext'
import { can } from '../permissions'
import './AdminSidebar.css'

interface MenuItem {
  label: string
  to: string
  icon: IconName
  allowed: (role: Role) => boolean
  /** Renders a red dot when the named queue has something waiting on this screen. */
  dot?: 'reorder' | 'reviews' | 'reportedReviews'
  end?: boolean
}

interface MenuGroup {
  heading: string
  items: MenuItem[]
}

const MENU: MenuGroup[] = [
  {
    heading: 'ภาพรวม',
    items: [
      {
        label: 'หน้าหลัก',
        to: '/admin',
        icon: 'shield',
        allowed: () => true,
        end: true,
      },
    ],
  },
  {
    heading: 'คำสั่งซื้อลูกค้า',
    items: [
      {
        label: 'คำสั่งซื้อลูกค้า',
        to: '/admin/orders',
        icon: 'shopping-bag',
        allowed: can.viewOrders,
      },
    ],
  },
  {
    heading: 'การจัดส่งพัสดุ',
    items: [
      {
        label: 'สรุปการจัดส่งพัสดุ',
        to: '/admin/delivery-report',
        icon: 'truck',
        allowed: can.viewDeliveryReport,
      },
    ],
  },
  {
    heading: 'จัดการผู้จัดจำหน่าย',
    items: [
      {
        label: 'รายการผู้จัดจำหน่าย',
        to: '/admin/suppliers',
        icon: 'building',
        allowed: can.viewSuppliers,
      },
    ],
  },
  {
    heading: 'จัดซื้อ',
    items: [
      {
        label: 'เอกสารจัดซื้อ',
        to: '/admin/purchasing',
        icon: 'file-text',
        allowed: can.viewPurchasing,
      },
      {
        label: 'รับสินค้าเข้าคลัง',
        to: '/admin/purchasing/receipts',
        icon: 'shopping-bag',
        allowed: can.receiveGoods,
      },
    ],
  },
  {
    heading: 'แจ้งเตือน',
    items: [
      {
        label: 'สินค้าถึงจุดสั่งซื้อ',
        to: '/admin/alerts',
        icon: 'bell',
        allowed: can.viewAlerts,
        dot: 'reorder',
      },
    ],
  },
  {
    heading: 'โปรโมชั่น',
    items: [
      {
        label: 'โปรโมชั่นและส่วนลด',
        to: '/admin/promotions',
        icon: 'tag',
        allowed: can.viewPromotions,
      },
    ],
  },
  {
    heading: 'รีวิวลูกค้า',
    items: [
      {
        label: 'ตรวจสอบรีวิว',
        to: '/admin/reviews',
        icon: 'star',
        allowed: can.moderateReview,
        dot: 'reviews',
        end: true,
      },
      {
        label: 'จัดการรีวิวที่มีปัญหา',
        to: '/admin/reviews/manage',
        icon: 'alert-triangle',
        allowed: can.manageReportedReviews,
        dot: 'reportedReviews',
      },
    ],
  },
  {
    heading: 'การติดต่อ',
    items: [
      {
        label: 'ศูนย์การติดต่อ',
        to: '/admin/contacts',
        icon: 'mail',
        allowed: can.viewContacts,
      },
    ],
  },
]

export default function AdminSidebar({ role }: { role: Role }) {
  const { belowReorder } = useInventory()
  const { pendingCount, reportedCount } = useReviews()

  const dotCount = (source: MenuItem['dot']) =>
    source === 'reorder'
      ? belowReorder.length
      : source === 'reviews'
      ? pendingCount
      : source === 'reportedReviews'
      ? reportedCount
      : 0

  return (
    <aside className="admin-nav">
      {MENU.map((group) => (
        <div key={group.heading} className="admin-nav__group">
          <p className="admin-nav__heading">{group.heading}</p>
          <ul>
            {group.items.map((item) => {
              const allowed = item.allowed(role)

              return (
                <li key={item.label}>
                  {allowed ? (
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        'admin-nav__link' + (isActive ? ' admin-nav__link--active' : '')
                      }
                    >
                      <Icon name={item.icon} size={19} />
                      <span>{item.label}</span>
                      {dotCount(item.dot) > 0 && <span className="admin-nav__dot" />}
                    </NavLink>
                  ) : (
                    <span
                      className="admin-nav__link admin-nav__link--off"
                      title="บทบาทของคุณไม่มีสิทธิ์เข้าถึงเมนูนี้"
                    >
                      <Icon name={item.icon} size={19} />
                      <span>{item.label}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}
