// Package model — Entity/Model ของ 2 ระบบย่อย: จัดการข้อมูลผู้จัดจำหน่าย (U1–U4) และจัดซื้อ (U5–U10)
// แปลงตรงจาก class diagram ระดับ Analysis (Sub1-Supplier-Management.md, Sub2-Purchasing.md)
//
// enums.go — ค่าคงที่สถานะทั้งหมด เก็บใน PostgreSQL เป็น varchar + CHECK constraint
// ค่าทุกตัวเป็น SCREAMING_SNAKE ตรงกับ class diagram และ union type ฝั่ง frontend
package model

// SupplierStatus — สถานะผู้จัดจำหน่าย
type SupplierStatus string

const (
	SupplierStatusActive    SupplierStatus = "ACTIVE"
	SupplierStatusCancelled SupplierStatus = "CANCELLED"
)

func (s SupplierStatus) IsValid() bool {
	switch s {
	case SupplierStatusActive, SupplierStatusCancelled:
		return true
	}
	return false
}

// PRStatus — สถานะใบขอสั่งซื้อ (PR)
type PRStatus string

const (
	PRStatusDraft     PRStatus = "DRAFT"
	PRStatusSubmitted PRStatus = "SUBMITTED"
	PRStatusApproved  PRStatus = "APPROVED"
	PRStatusRejected  PRStatus = "REJECTED"
)

func (s PRStatus) IsValid() bool {
	switch s {
	case PRStatusDraft, PRStatusSubmitted, PRStatusApproved, PRStatusRejected:
		return true
	}
	return false
}

// POStatus — สถานะใบสั่งซื้อ (PO)
type POStatus string

const (
	POStatusPendingApproval POStatus = "PENDING_APPROVAL"
	POStatusApproved        POStatus = "APPROVED"
	POStatusConfirmed       POStatus = "CONFIRMED"
	POStatusReceivedPartial POStatus = "RECEIVED_PARTIAL"
	POStatusReceivedFull    POStatus = "RECEIVED_FULL"
	POStatusReturned        POStatus = "RETURNED"
	POStatusCancelled       POStatus = "CANCELLED"
)

func (s POStatus) IsValid() bool {
	switch s {
	case POStatusPendingApproval, POStatusApproved, POStatusConfirmed,
		POStatusReceivedPartial, POStatusReceivedFull, POStatusReturned, POStatusCancelled:
		return true
	}
	return false
}

// IsClosed — ใบสั่งซื้อที่ปิดรายการแล้ว ไม่นับเป็น "คงค้าง" ตอนปิดใช้งานผู้จัดจำหน่าย (U3)
// ตรงกับ CLOSED_PO ใน frontend/src/admin/purchasing/purchasing.ts
func (s POStatus) IsClosed() bool {
	switch s {
	case POStatusReceivedFull, POStatusReturned, POStatusCancelled:
		return true
	}
	return false
}

// GRStatus — สถานะใบรับสินค้า
//
// class diagram พิมพ์ GoodsReceipt.status เป็น string เฉย ๆ (ข้อ D3 ใน ClassDiagram-Review.md)
// ยกระดับเป็น enum ให้ตรงกับ union GoodsReceiptStatus ฝั่ง frontend
type GRStatus string

const (
	GRStatusPartial GRStatus = "PARTIAL"
	GRStatusFull    GRStatus = "FULL"
)

func (s GRStatus) IsValid() bool {
	switch s {
	case GRStatusPartial, GRStatusFull:
		return true
	}
	return false
}

// ReturnStatus — สถานะใบส่งคืนสินค้า (ข้อ D3 เช่นเดียวกับ GRStatus)
type ReturnStatus string

const (
	ReturnStatusTracking  ReturnStatus = "TRACKING"
	ReturnStatusEscalated ReturnStatus = "ESCALATED"
	ReturnStatusClosed    ReturnStatus = "CLOSED"
)

func (s ReturnStatus) IsValid() bool {
	switch s {
	case ReturnStatusTracking, ReturnStatusEscalated, ReturnStatusClosed:
		return true
	}
	return false
}

// ItemCondition — สภาพสินค้าที่รับเข้าคลัง (GoodsReceiptItem.condition ใน diagram เป็น string)
type ItemCondition string

const (
	ItemConditionNormal  ItemCondition = "NORMAL"
	ItemConditionDamaged ItemCondition = "DAMAGED"
)

func (c ItemCondition) IsValid() bool {
	switch c {
	case ItemConditionNormal, ItemConditionDamaged:
		return true
	}
	return false
}

// CompensationType — รูปแบบการชดเชยจากผู้จัดจำหน่ายเมื่อส่งคืนสินค้า (U10)
type CompensationType string

const (
	CompensationReplacement CompensationType = "REPLACEMENT"
	CompensationCreditNote  CompensationType = "CREDIT_NOTE"
)

func (c CompensationType) IsValid() bool {
	switch c {
	case CompensationReplacement, CompensationCreditNote:
		return true
	}
	return false
}

// BookStatus — สถานะหนังสือ
type BookStatus string

const (
	BookStatusActive   BookStatus = "ACTIVE"
	BookStatusInactive BookStatus = "INACTIVE"
)

func (s BookStatus) IsValid() bool {
	switch s {
	case BookStatusActive, BookStatusInactive:
		return true
	}
	return false
}

// StockTxnType — ประเภทการเคลื่อนไหวสต็อก
type StockTxnType string

const (
	StockTxnTypeReceiveIn  StockTxnType = "RECEIVE_IN"
	StockTxnTypeSaleOut    StockTxnType = "SALE_OUT"
	StockTxnTypeReturn     StockTxnType = "RETURN"
	StockTxnTypeAdjustment StockTxnType = "ADJUSTMENT"
)

func (t StockTxnType) IsValid() bool {
	switch t {
	case StockTxnTypeReceiveIn, StockTxnTypeSaleOut, StockTxnTypeReturn, StockTxnTypeAdjustment:
		return true
	}
	return false
}

// Role — บทบาทพนักงาน = subclass ของ Employee ใน class diagram รวม
// (Employee <|-- WarehouseStaff / StoreManager / SalesStaff / DeliveryStaff)
type Role string

const (
	RoleWarehouse Role = "warehouse"
	RoleManager   Role = "manager"
	RoleSales     Role = "sales"
	RoleDelivery  Role = "delivery"

	// RoleCustomer ไม่ใช่พนักงาน — เป็น Customer ที่สืบทอดจาก Person คนละสายกับ Employee
	// **ห้ามใส่ในลิสต์ของ chk_employee_role** และห้ามใส่ในชุดบทบาทของหลังร้าน (roleStaff/roleOffice)
	// มีไว้ให้ token ของลูกค้าผ่าน Verify และให้ RequireRole กันเส้นทางฝั่งลูกค้าได้
	RoleCustomer Role = "customer"
)

// EmployeeRoles — บทบาทที่เป็นพนักงานจริง ใช้กับ CHECK constraint ของตาราง employee
func EmployeeRoles() []Role {
	return []Role{RoleWarehouse, RoleManager, RoleSales, RoleDelivery}
}

func (r Role) IsValid() bool {
	switch r {
	case RoleWarehouse, RoleManager, RoleSales, RoleDelivery, RoleCustomer:
		return true
	}
	return false
}

// IsEmployee — บทบาทนี้เป็นพนักงานหลังร้านหรือไม่ (ตรงกับ isEmployee() ของ frontend)
func (r Role) IsEmployee() bool { return r.IsValid() && r != RoleCustomer }

// NotificationKind / NotificationChannel — การแจ้งเตือนที่ระบบจัดซื้อสร้าง (U6–U10)
type NotificationKind string

const (
	NotifyReorderAlert     NotificationKind = "REORDER_ALERT"
	NotifyPRSubmitted      NotificationKind = "PR_SUBMITTED"
	NotifyPRApproved       NotificationKind = "PR_APPROVED"
	NotifyPRRejected       NotificationKind = "PR_REJECTED"
	NotifyGRRecorded       NotificationKind = "GR_RECORDED"
	NotifyOrderCancelled   NotificationKind = "ORDER_CANCELLED"
	NotifyReturnEscalated  NotificationKind = "RETURN_ESCALATED"
	NotifyStockDiscrepancy NotificationKind = "STOCK_DISCREPANCY"
	NotifyStockAdjusted    NotificationKind = "STOCK_ADJUSTED"
	NotifyOrderPlaced      NotificationKind = "ORDER_PLACED"
	NotifyOrderPaid        NotificationKind = "ORDER_PAID"
	NotifyOrderReadyToShip NotificationKind = "ORDER_READY_TO_SHIP"
	NotifyShipmentFailed   NotificationKind = "SHIPMENT_FAILED"
	NotifyReviewReported   NotificationKind = "REVIEW_REPORTED"
)

type NotificationChannel string

const (
	ChannelInApp NotificationChannel = "in-app"
	ChannelEmail NotificationChannel = "email"
)
