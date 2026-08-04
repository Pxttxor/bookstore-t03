// Roles follow the Employee subclasses in the class diagram.
export type Role = 'customer' | 'warehouse' | 'manager' | 'sales' | 'delivery'

export const ROLE_LABELS: Record<Role, string> = {
  customer: 'ลูกค้า',
  warehouse: 'พนักงานคลังสินค้า',
  manager: 'ผู้จัดการร้าน',
  sales: 'พนักงานฝ่ายขาย',
  delivery: 'พนักงานจัดส่ง',
}

export function isEmployee(role: Role) {
  return role !== 'customer'
}
