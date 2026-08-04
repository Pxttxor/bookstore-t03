import type { Role } from '../auth/roles'

// Permission rules for the back office, following the role table in §2 of the UI
// specification. Where a role owns an action but may not perform it right now, the
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
}
