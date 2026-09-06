import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isEmployee } from '../auth/roles'
import AdminTopBar from './components/AdminTopBar'
import AdminSidebar from './components/AdminSidebar'
import LoadingState from './components/LoadingState'
import { BookProvider } from './books/BookContext'
import { InventoryProvider } from './inventory/InventoryContext'
import { PurchasingProvider } from './purchasing/PurchasingContext'
import { SupplierProvider } from './suppliers/SupplierContext'
import { PromotionProvider } from './promotions/PromotionContext'
import { ReviewProvider } from './reviews/ReviewContext'
import './AdminLayout.css'

export default function AdminLayout() {
  const { user, initialising } = useAuth()
  const location = useLocation()

  // มี token ค้างอยู่แต่ยังไม่รู้ผลจาก GET /api/auth/me — ถ้าเด้งออกตอนนี้
  // ผู้ใช้ที่ยังล็อกอินอยู่จะโดนส่งไปหน้าเข้าสู่ระบบทุกครั้งที่รีเฟรชหน้าหลังร้าน
  if (initialising) {
    return (
      <div className="admin admin--booting">
        <LoadingState label="กำลังตรวจสอบสิทธิ์การใช้งาน…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isEmployee(user.role)) {
    return <Navigate to="/" replace />
  }

  // PurchasingProvider reads suppliers, adjusts stock and raises notifications, so it has
  // to sit inside SupplierProvider and InventoryProvider. NotificationProvider now lives
  // above AdminLayout (see main.tsx), so it is still an ancestor here.
  // PromotionProvider and ReviewProvider are back-office-only, so they live here rather
  // than in main.tsx. AdminSidebar reads useReviews() for its pending-review dots and
  // useInventory() for the reorder and discrepancy dots, so both have to wrap the shell.
  // BookProvider carries the catalogue the stock screens join against; nothing inside it
  // reads books, so it can sit anywhere above them.
  // Every /admin screen is a lazy chunk (see App.tsx). The fallback is deliberately null:
  // the spec's loading skeletons are a documented deviation, and a placeholder here would
  // flash on every navigation because these chunks are local and land within a frame.
  return (
    <SupplierProvider>
      <BookProvider>
        <InventoryProvider>
          <PurchasingProvider>
            <PromotionProvider>
              <ReviewProvider>
                <div className="admin">
                  <AdminTopBar user={user} />
                  <div className="admin__body">
                    <AdminSidebar role={user.role} />
                    <main className="admin__main">
                      <Suspense fallback={null}>
                        <Outlet />
                      </Suspense>
                    </main>
                  </div>
                </div>
              </ReviewProvider>
            </PromotionProvider>
          </PurchasingProvider>
        </InventoryProvider>
      </BookProvider>
    </SupplierProvider>
  )
}
