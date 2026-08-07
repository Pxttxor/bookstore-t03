import { Routes, Route, Navigate } from 'react-router-dom'
import StorefrontLayout from './layouts/StorefrontLayout'
import AuthLayout from './layouts/AuthLayout'
import HomePage from './pages/HomePage'
import BookDetailPage from './pages/BookDetailPage'
import CheckoutShippingPage from './pages/CheckoutShippingPage'
import CheckoutPaymentPage from './pages/CheckoutPaymentPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ProfilePage from './pages/ProfilePage'
import AdminLayout from './admin/AdminLayout'
import DashboardPage from './admin/pages/DashboardPage'
import BookListPage from './admin/pages/BookListPage'
import BookFormPage from './admin/pages/BookFormPage'
// The storefront has a BookDetailPage too; this one is the back-office view.
import AdminBookDetailPage from './admin/pages/BookDetailPage'
import StockListPage from './admin/pages/StockListPage'
import StockAdjustPage from './admin/pages/StockAdjustPage'
import StockCountListPage from './admin/pages/StockCountListPage'
import StockCountFormPage from './admin/pages/StockCountFormPage'
import StockCountDetailPage from './admin/pages/StockCountDetailPage'
import StockDiscrepancyPage from './admin/pages/StockDiscrepancyPage'
import OrdersListPage from './admin/pages/OrdersListPage'
import CustomerOrderDetailPage from './admin/pages/CustomerOrderDetailPage'
import SupplierListPage from './admin/pages/SupplierListPage'
import SupplierDetailPage from './admin/pages/SupplierDetailPage'
import SupplierFormPage from './admin/pages/SupplierFormPage'
import ReorderAlertsPage from './admin/pages/ReorderAlertsPage'
import PurchasingListPage from './admin/pages/PurchasingListPage'
import RequisitionFormPage from './admin/pages/RequisitionFormPage'
import ApproveRequisitionPage from './admin/pages/ApproveRequisitionPage'
import OrderDetailPage from './admin/pages/OrderDetailPage'
import ReceiptsListPage from './admin/pages/ReceiptsListPage'
import ReceiveGoodsPage from './admin/pages/ReceiveGoodsPage'
import PurchaseReturnPage from './admin/pages/PurchaseReturnPage'
import ContactCentrePage from './admin/pages/ContactCentrePage'
import PromotionListPage from './admin/pages/PromotionListPage'
import PromotionFormPage from './admin/pages/PromotionFormPage'
import ReviewModerationPage from './admin/pages/ReviewModerationPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignUpPage />} />
      </Route>

      {/* The Figma spec defines no URLs; these mirror its sitemap (§5). */}
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />

        <Route path="orders" element={<OrdersListPage />} />
        <Route path="orders/:id" element={<CustomerOrderDetailPage />} />

        <Route path="books" element={<BookListPage />} />
        <Route path="books/new" element={<BookFormPage />} />
        <Route path="books/:id" element={<AdminBookDetailPage />} />
        <Route path="books/:id/edit" element={<BookFormPage />} />

        <Route path="suppliers" element={<SupplierListPage />} />
        <Route path="suppliers/new" element={<SupplierFormPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />

        <Route path="stock" element={<StockListPage />} />
        <Route path="stock/low" element={<StockListPage />} />
        <Route path="stock/adjust" element={<StockAdjustPage />} />
        <Route path="stock/counts" element={<StockCountListPage />} />
        <Route path="stock/counts/new" element={<StockCountFormPage />} />
        <Route path="stock/counts/:id" element={<StockCountDetailPage />} />
        <Route path="stock/discrepancies" element={<StockDiscrepancyPage />} />

        <Route path="alerts" element={<ReorderAlertsPage />} />

        <Route path="purchasing" element={<PurchasingListPage />} />
        <Route path="purchasing/pr/new" element={<RequisitionFormPage />} />
        <Route path="purchasing/pr/:id" element={<RequisitionFormPage />} />
        <Route path="purchasing/pr/:id/approve" element={<ApproveRequisitionPage />} />
        <Route path="purchasing/po/:id" element={<OrderDetailPage />} />
        <Route path="purchasing/po/:id/receive" element={<ReceiveGoodsPage />} />
        <Route path="purchasing/receipts" element={<ReceiptsListPage />} />
        <Route path="purchasing/returns/new" element={<PurchaseReturnPage />} />
        <Route path="purchasing/returns/:id" element={<PurchaseReturnPage />} />

        <Route path="promotions" element={<PromotionListPage />} />
        <Route path="promotions/new" element={<PromotionFormPage />} />
        <Route path="promotions/:id/edit" element={<PromotionFormPage />} />

        <Route path="reviews" element={<ReviewModerationPage />} />

        <Route path="contacts" element={<ContactCentrePage />} />

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route element={<StorefrontLayout />}>
        <Route index element={<HomePage />} />
        <Route path="book/:id" element={<BookDetailPage />} />
        <Route path="checkout/shipping" element={<CheckoutShippingPage />} />
        <Route path="checkout/payment" element={<CheckoutPaymentPage />} />
        <Route path="order/:id" element={<OrderTrackingPage />} />
        <Route path="orders" element={<OrderHistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
