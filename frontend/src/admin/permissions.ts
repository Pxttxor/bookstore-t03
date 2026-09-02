import type { Role } from '../auth/roles'

// Permission rules for the back office, following the role table in §2 of the UI
// specification. The role sets mirror `internal/handler/routes.go` in the backend
// one for one — the server checks again because a user can call the API directly. Where a role owns an action but may not perform it right now, the
// screen renders the control disabled with a title; where the action is outside the
// role's scope entirely, the control is hidden.
export const can = {
  // Supplier management (U1-U4)
  viewSuppliers: (role: Role) => role === 'warehouse' || role === 'manager' || role === 'sales',
  editSuppliers: (role: Role) => role === 'warehouse',
  deactivateSupplier: (role: Role) => role === 'manager',

  // Purchasing (U5-U10)
  viewAlerts: (role: Role) => role === 'warehouse',
  setReorderPoint: (role: Role) => role === 'warehouse',
  viewPurchasing: (role: Role) => role === 'warehouse' || role === 'manager',
  createRequisition: (role: Role) => role === 'warehouse',
  approveRequisition: (role: Role) => role === 'manager',
  sendOrder: (role: Role) => role === 'warehouse',
  receiveGoods: (role: Role) => role === 'warehouse',
  createReturn: (role: Role) => role === 'warehouse',

  // Contact centre (SCR-27). Sales sees the directory tab only, read-only.
  viewContacts: (role: Role) =>
    role === 'warehouse' || role === 'manager' || role === 'sales',
  viewDocumentRouting: (role: Role) => role === 'warehouse' || role === 'manager',

  // Promotion (Promotion subsystem). StoreManager.managePromotion — the store manager
  // owns creating, editing, toggling and removing promotions.
  viewPromotions: (role: Role) => role === 'manager',
  managePromotion: (role: Role) => role === 'manager',

  // Review moderation (Review subsystem). SalesStaff.moderateReview; the store manager
  // may moderate reviews and handle escalations too.
  moderateReview: (role: Role) => role === 'sales' || role === 'manager',
  manageReportedReviews: (role: Role) => role === 'manager',

  // Customer orders (Order + Delivery subsystems). Responsibility is split by role:
  // sales handle intake and payment, warehouse packs, delivery ships and confirms.
  viewOrders: (role: Role) =>
    role === 'sales' || role === 'warehouse' || role === 'manager' || role === 'delivery',
  confirmStock: (role: Role) => role === 'sales',
  verifyPayment: (role: Role) => role === 'sales',
  packOrder: (role: Role) => role === 'warehouse',
  shipOrder: (role: Role) => role === 'delivery',
  confirmDelivery: (role: Role) => role === 'delivery',
  cancelOrder: (role: Role) => role === 'sales' || role === 'manager',

  // Book catalogue (Book subsystem). Sales owns the catalogue; everyone in the
  // back office reads it because purchasing and stock screens show book details.
  viewBooks: (role: Role) => role === 'warehouse' || role === 'manager' || role === 'sales',
  editBooks: (role: Role) => role === 'sales' || role === 'manager',
  viewBookHistory: (role: Role) => role === 'sales' || role === 'manager',

  // Inventory (Inventory subsystem). Warehouse owns the counting work; only the
  // store manager decides a discrepancy report. `viewStock` is the read-only
  // report, separate from `viewAlerts` which drives the reorder flow of U5.
  viewStock: (role: Role) => role === 'warehouse' || role === 'manager' || role === 'sales',
  adjustStock: (role: Role) => role === 'warehouse',
  viewStockCounts: (role: Role) => role === 'warehouse' || role === 'manager',
  countStock: (role: Role) => role === 'warehouse',
  viewDiscrepancies: (role: Role) => role === 'warehouse' || role === 'manager',
  resolveDiscrepancy: (role: Role) => role === 'manager',

  // Customer accounts (People subsystem). Sales answers customer enquiries;
  // suspending an account is the manager's call.
  viewCustomers: (role: Role) => role === 'sales' || role === 'manager',
  suspendAccount: (role: Role) => role === 'manager',

  // Payment verification (Payment subsystem). The decision itself rides on
  // `verifyPayment` above — these two cover the records and the period report.
  viewPayments: (role: Role) => role === 'sales' || role === 'manager',
  managePaymentReports: (role: Role) => role === 'manager',

  // Delivery (Delivery subsystem). Everyone in the back office can look up a
  // parcel; only delivery staff update tracking, and they own the daily summary.
  viewShipments: (role: Role) =>
    role === 'sales' || role === 'warehouse' || role === 'manager' || role === 'delivery',
  updateTracking: (role: Role) => role === 'delivery',
  manageDeliverySummary: (role: Role) => role === 'delivery' || role === 'manager',
  // The daily summary report (DeliverySummary.generate) is read-only, so it opens to
  // everyone who already sees a parcel; producing/closing a summary stays with
  // `manageDeliverySummary` above.
  viewDeliveryReport: (role: Role) =>
    role === 'sales' || role === 'warehouse' || role === 'manager' || role === 'delivery',

  // Membership and loyalty points (Membership subsystem).
  // StoreManager.manageMemberTier in the class diagram.
  viewMembers: (role: Role) => role === 'sales' || role === 'manager',
  manageMemberTier: (role: Role) => role === 'manager',
  manageRewards: (role: Role) => role === 'manager',
  adjustPoints: (role: Role) => role === 'manager',
}
