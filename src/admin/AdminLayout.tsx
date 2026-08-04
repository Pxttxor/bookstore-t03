import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isEmployee } from '../auth/roles'
import AdminTopBar from './components/AdminTopBar'
import AdminSidebar from './components/AdminSidebar'
import { ToastProvider } from './components/ToastContext'
import { InventoryProvider } from './inventory/InventoryContext'
import { PurchasingProvider } from './purchasing/PurchasingContext'
import { SupplierProvider } from './suppliers/SupplierContext'
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
  return (
    <SupplierProvider>
      <InventoryProvider>
        <PurchasingProvider>
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
        </PurchasingProvider>
      </InventoryProvider>
    </SupplierProvider>
  )
}
