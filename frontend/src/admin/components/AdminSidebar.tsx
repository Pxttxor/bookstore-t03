import { Link, useLocation } from 'react-router-dom'
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
  dot?: 'reorder' | 'reviews' | 'reportedReviews' | 'discrepancy'
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
    heading: 'การคืนเงิน (Refund)',
    items: [
      {
        label: 'รายการคืนเงินลูกค้า',
        to: '/admin/refunds',
        icon: 'dollar-sign',
        allowed: can.viewRefunds,
      },
    ],
  },
  {
    heading: 'การชำระเงิน',
    items: [
      {
        label: 'รายงานสรุปรับชำระเงิน',
        to: '/admin/payments/report',
        icon: 'bar-chart',
        allowed: can.managePaymentReports,
      },
    ],
  },
  {
    heading: 'สมาชิกและแต้มสะสม',
    items: [
      {
        label: 'ระดับสมาชิกและแต้ม',
        to: '/admin/members',
        icon: 'award',
        allowed: can.viewMembers,
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
    heading: 'จัดการข้อมูลหนังสือ',
    items: [
      {
        label: 'รายการหนังสือ',
        to: '/admin/books',
        icon: 'book',
        allowed: can.viewBooks,
      },
      {
        label: 'ประวัติการแก้ไขหนังสือ',
        to: '/admin/books/change-logs',
        icon: 'clock',
        allowed: can.viewAllBookHistory,
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
    heading: 'คลังสินค้า',
    items: [
      {
        label: 'ยอดคงเหลือ',
        to: '/admin/stock',
        icon: 'package',
        allowed: can.viewStock,
        end: true,
      },
      {
        // The low-stock report is the same read as ยอดคงเหลือ, so it shares can.viewStock;
        // the backend has no separate endpoint for it to mirror.
        label: 'หนังสือที่ใกล้หมด',
        to: '/admin/stock/low',
        icon: 'trending-down',
        allowed: can.viewStock,
      },
      {
        label: 'ปรับปรุงจำนวน',
        to: '/admin/stock/adjust',
        icon: 'edit',
        allowed: can.adjustStock,
      },
      {
        label: 'ประวัติการปรับยอด',
        to: '/admin/stock/adjustments',
        icon: 'clipboard',
        allowed: can.viewAdjustmentHistory,
      },
      {
        label: 'ตรวจนับสต็อก',
        to: '/admin/stock/counts',
        icon: 'clipboard',
        allowed: can.viewStockCounts,
      },
      {
        label: 'ยอดหนังสือไม่ตรง',
        to: '/admin/stock/discrepancies',
        icon: 'alert-triangle',
        allowed: can.viewDiscrepancies,
        dot: 'discrepancy',
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

// เมนู active เมื่อ path ตรงหรือเป็น prefix (เคารพ `end`) — ยกเว้นมีเมนูอื่นที่ path ยาวกว่า
// แล้วแมตช์ pathname เดียวกันอยู่ด้วย เมนูนั้นจะชนะแทน (เช่น /admin/purchasing เป็น prefix ของ
// /admin/purchasing/receipts — ต้องให้ตัวหลังสว่างคนเดียว ไม่ใช่สว่างพร้อมกันทั้งคู่)
function matchesPath(pathname: string, item: MenuItem): boolean {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function isActiveItem(pathname: string, item: MenuItem, allItems: MenuItem[]): boolean {
  if (!matchesPath(pathname, item)) return false
  return !allItems.some(
    (other) => other !== item && other.to.length > item.to.length && matchesPath(pathname, other),
  )
}

export default function AdminSidebar({ role }: { role: Role }) {
  const { pathname } = useLocation()
  const { belowReorder, pendingReports, loading: stockLoading } = useInventory()
  const { unrepliedCount, pendingCount, loading: reviewLoading } = useReviews()

  // แถบเมนูอยู่บนโครงหน้าตลอด จะขึ้นจอโหลดเต็มไม่ได้ — ระหว่างยังไม่รู้ตัวเลขจริง
  // ให้ถือว่าไม่มีงานค้าง จุดแดงจึงไม่กระพริบขึ้นแล้วหายทุกครั้งที่เปิดหลังร้าน
  //
  // เมนู "ตรวจสอบรีวิว" เป็นของฝ่ายขาย → จุดแดงต้องนับรีวิวที่รอตอบกลับ (unrepliedCount)
  // เมนู "จัดการรีวิวที่มีปัญหา" เป็นของผู้จัดการ → จุดแดงต้องนับรายงานที่ยังค้าง (pendingCount)
  // (เดิมสองตัวนี้สลับกันอยู่)
  const dotCount = (source: MenuItem['dot']) =>
    stockLoading || reviewLoading
      ? 0
      : source === 'reorder'
      ? belowReorder.length
      : source === 'reviews'
      ? unrepliedCount
      : source === 'reportedReviews'
      ? pendingCount
      : source === 'discrepancy'
      ? pendingReports.length
      : 0

  // แต่ละบทบาทเห็นเฉพาะเมนูของหน้าที่ตัวเอง — กรองก่อนเรนเดอร์ ไม่ใช่แค่ทำจาง
  // แล้วตัดหัวข้อกลุ่มที่ไม่เหลือเมนูใดให้แสดงทิ้งไปด้วย
  const visibleGroups = MENU.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.allowed(role)),
  })).filter((group) => group.items.length > 0)

  // isActiveItem เทียบกับเมนูที่บทบาทนี้เห็นจริงเท่านั้น — เมนูที่ถูกกรองออกไปแล้ว
  // (บทบาทอื่นเห็น) จะไม่มามีผลต่อว่าใครชนะ
  const allVisibleItems = visibleGroups.flatMap((group) => group.items)

  return (
    <aside className="admin-nav">
      {visibleGroups.map((group) => (
        <div key={group.heading} className="admin-nav__group">
          <p className="admin-nav__heading">{group.heading}</p>
          <ul>
            {group.items.map((item) => {
              const active = isActiveItem(pathname, item, allVisibleItems)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className={'admin-nav__link' + (active ? ' admin-nav__link--active' : '')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                    {dotCount(item.dot) > 0 && <span className="admin-nav__dot" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </aside>
  )
}
