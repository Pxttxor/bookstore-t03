import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import StorefrontLayout from './layouts/StorefrontLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './admin/AdminLayout'
import RequireCan from './admin/components/RequireCan'
import { can } from './admin/permissions'
import HomePage from './pages/HomePage'
import BookDetailPage from './pages/BookDetailPage'

// The three layouts plus the two storefront entry screens stay eager: they are what a
// first-time visitor lands on, so splitting them would only cost a round trip. Every
// other screen is a separate chunk, which keeps the whole back office out of the
// storefront's initial download. Each layout wraps its <Outlet /> in <Suspense>.
const CheckoutShippingPage = lazy(() => import('./pages/CheckoutShippingPage'))
const CheckoutPaymentPage = lazy(() => import('./pages/CheckoutPaymentPage'))
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'))
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))

const DashboardPage = lazy(() => import('./admin/pages/DashboardPage'))
const BookListPage = lazy(() => import('./admin/pages/BookListPage'))
const BookFormPage = lazy(() => import('./admin/pages/BookFormPage'))
const BookChangeHistoryPage = lazy(() => import('./admin/pages/BookChangeHistoryPage'))
// The storefront has a BookDetailPage too; this one is the back-office view.
const AdminBookDetailPage = lazy(() => import('./admin/pages/BookDetailPage'))
const StockListPage = lazy(() => import('./admin/pages/StockListPage'))
const StockAdjustPage = lazy(() => import('./admin/pages/StockAdjustPage'))
const StockAdjustmentHistoryPage = lazy(() => import('./admin/pages/StockAdjustmentHistoryPage'))
const StockCountListPage = lazy(() => import('./admin/pages/StockCountListPage'))
const StockCountFormPage = lazy(() => import('./admin/pages/StockCountFormPage'))
const StockCountDetailPage = lazy(() => import('./admin/pages/StockCountDetailPage'))
const StockDiscrepancyPage = lazy(() => import('./admin/pages/StockDiscrepancyPage'))
const OrdersListPage = lazy(() => import('./admin/pages/OrdersListPage'))
const CustomerOrderDetailPage = lazy(() => import('./admin/pages/CustomerOrderDetailPage'))
const DeliverySummaryReportPage = lazy(() => import('./admin/pages/DeliverySummaryReportPage'))
const SupplierListPage = lazy(() => import('./admin/pages/SupplierListPage'))
const SupplierDetailPage = lazy(() => import('./admin/pages/SupplierDetailPage'))
const SupplierFormPage = lazy(() => import('./admin/pages/SupplierFormPage'))
const ReorderAlertsPage = lazy(() => import('./admin/pages/ReorderAlertsPage'))
const PurchasingListPage = lazy(() => import('./admin/pages/PurchasingListPage'))
const RequisitionFormPage = lazy(() => import('./admin/pages/RequisitionFormPage'))
const ApproveRequisitionPage = lazy(() => import('./admin/pages/ApproveRequisitionPage'))
const OrderDetailPage = lazy(() => import('./admin/pages/OrderDetailPage'))
const ReceiptsListPage = lazy(() => import('./admin/pages/ReceiptsListPage'))
const ReceiveGoodsPage = lazy(() => import('./admin/pages/ReceiveGoodsPage'))
const PurchaseReturnPage = lazy(() => import('./admin/pages/PurchaseReturnPage'))
const ContactCentrePage = lazy(() => import('./admin/pages/ContactCentrePage'))
const PromotionListPage = lazy(() => import('./admin/pages/PromotionListPage'))
const PromotionFormPage = lazy(() => import('./admin/pages/PromotionFormPage'))
const ReviewModerationPage = lazy(() => import('./admin/pages/ReviewModerationPage'))
const ReviewManagerPage = lazy(() => import('./admin/pages/ReviewManagerPage'))
const PaymentReportPage = lazy(() => import('./admin/pages/PaymentReportPage'))
const MemberTierListPage = lazy(() => import('./admin/pages/MemberTierListPage'))
const MemberPointsPage = lazy(() => import('./pages/MemberPointsPage'))
const MemberRewardsPage = lazy(() => import('./pages/MemberRewardsPage'))

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

        <Route path="payments" element={<Navigate to="/admin/orders" replace />} />
        <Route element={<RequireCan allowed={can.managePaymentReports} />}>
          <Route path="payments/report" element={<PaymentReportPage />} />
        </Route>
        <Route path="payments/:id" element={<Navigate to="/admin/orders" replace />} />
        <Route element={<RequireCan allowed={can.viewMembers} />}>
          <Route path="members" element={<MemberTierListPage />} />
        </Route>

        <Route path="delivery-report" element={<DeliverySummaryReportPage />} />

        <Route element={<RequireCan allowed={can.viewBooks} />}>
          <Route path="books" element={<BookListPage />} />
          <Route path="books/:id" element={<AdminBookDetailPage />} />
        </Route>
        <Route element={<RequireCan allowed={can.viewAllBookHistory} />}>
          <Route path="books/change-logs" element={<BookChangeHistoryPage />} />
        </Route>
        <Route element={<RequireCan allowed={can.editBooks} />}>
          <Route path="books/new" element={<BookFormPage />} />
          <Route path="books/:id/edit" element={<BookFormPage />} />
        </Route>

        <Route element={<RequireCan allowed={can.viewSuppliers} />}>
          <Route path="suppliers" element={<SupplierListPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        </Route>
        <Route element={<RequireCan allowed={can.editSuppliers} />}>
          <Route path="suppliers/new" element={<SupplierFormPage />} />
          <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />
        </Route>

        {/* stock and stock/low are the same screen; it reads the pathname itself. Both
            paths already gate on can.viewStock inside StockListPage. */}
        <Route path="stock" element={<StockListPage />} />
        <Route path="stock/low" element={<StockListPage />} />
        <Route path="stock/adjust" element={<StockAdjustPage />} />
        <Route element={<RequireCan allowed={can.viewAdjustmentHistory} />}>
          <Route path="stock/adjustments" element={<StockAdjustmentHistoryPage />} />
        </Route>
        <Route path="stock/counts" element={<StockCountListPage />} />
        <Route path="stock/counts/new" element={<StockCountFormPage />} />
        <Route path="stock/counts/:id" element={<StockCountDetailPage />} />
        <Route path="stock/discrepancies" element={<StockDiscrepancyPage />} />

        <Route path="alerts" element={<ReorderAlertsPage />} />

        <Route element={<RequireCan allowed={can.viewPurchasing} />}>
          <Route path="purchasing" element={<PurchasingListPage />} />
          <Route path="purchasing/po/:id" element={<OrderDetailPage />} />
        </Route>
        <Route path="purchasing/pr/new" element={<RequisitionFormPage />} />
        <Route path="purchasing/pr/:id" element={<RequisitionFormPage />} />
        <Route path="purchasing/pr/:id/approve" element={<ApproveRequisitionPage />} />
        <Route path="purchasing/po/:id/receive" element={<ReceiveGoodsPage />} />
        <Route element={<RequireCan allowed={can.receiveGoods} />}>
          <Route path="purchasing/receipts" element={<ReceiptsListPage />} />
        </Route>
        <Route path="purchasing/returns/new" element={<PurchaseReturnPage />} />
        <Route path="purchasing/returns/:id" element={<PurchaseReturnPage />} />

        <Route element={<RequireCan allowed={can.viewPromotions} />}>
          <Route path="promotions" element={<PromotionListPage />} />
          <Route path="promotions/new" element={<PromotionFormPage />} />
          <Route path="promotions/:id/edit" element={<PromotionFormPage />} />
        </Route>

        <Route element={<RequireCan allowed={can.moderateReview} />}>
          <Route path="reviews" element={<ReviewModerationPage />} />
        </Route>
        <Route element={<RequireCan allowed={can.manageReportedReviews} />}>
          <Route path="reviews/manage" element={<ReviewManagerPage />} />
        </Route>

        <Route element={<RequireCan allowed={can.viewContacts} />}>
          <Route path="contacts" element={<ContactCentrePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route element={<StorefrontLayout />}>
        <Route index element={<HomePage />} />
        <Route path="book/:bookId" element={<BookDetailPage />} />
        <Route path="checkout/shipping" element={<CheckoutShippingPage />} />
        <Route path="checkout/payment" element={<CheckoutPaymentPage />} />
        <Route path="order/:id" element={<OrderTrackingPage />} />
        <Route path="orders" element={<OrderHistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="deals" element={<PromotionsPage />} />
        <Route path="member/points" element={<MemberPointsPage />} />
        <Route path="member/rewards" element={<MemberRewardsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
