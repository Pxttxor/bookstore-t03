import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isEmployee } from '../auth/roles'
import AdminTopBar from './components/AdminTopBar'
import AdminSidebar from './components/AdminSidebar'
import { ToastProvider } from './components/ToastContext'
import { BookProvider } from './books/BookContext'
import { InventoryProvider } from './inventory/InventoryContext'
import { PurchasingProvider } from './purchasing/PurchasingContext'
import { SupplierProvider } from './suppliers/SupplierContext'
import { PromotionProvider } from './promotions/PromotionContext'
import { ReviewProvider } from './reviews/ReviewContext'
import './AdminLayout.css'

export default function AdminLayout() {
  const { user } = useAuth()
  const location = useLocation()

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
  // than in main.tsx. AdminSidebar reads useReviews() for its pending-review dot and
  // useInventory() for the reorder and discrepancy dots, so both have to wrap the shell.
  // BookProvider carries the catalogue the stock screens join against; nothing inside it
  // reads books, so it can sit anywhere above them.
  return (
    <SupplierProvider>
      <BookProvider>
        <InventoryProvider>
          <PurchasingProvider>
            <PromotionProvider>
              <ReviewProvider>
                <ToastProvider>
                  <div className="admin">
                    <AdminTopBar user={user} />
                    <div className="admin__body">
                      <AdminSidebar role={user.role} />
                      <main className="admin__main">
                        <Outlet />
                      </main>
                    </div>
                  </div>
                </ToastProvider>
              </ReviewProvider>
            </PromotionProvider>
          </PurchasingProvider>
        </InventoryProvider>
      </BookProvider>
    </SupplierProvider>
  )
}
