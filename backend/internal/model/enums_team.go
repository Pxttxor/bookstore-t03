// enums_team.go — enum ของระบบย่อยที่เพื่อนร่วมทีมเป็นเจ้าของคลาส
//
// แยกไฟล์จาก enums.go เพื่อให้เห็นชัดว่าตัวไหนมาจาก class diagram ของใคร
// กติกาเดียวกันทุกตัว: ค่าเป็น SCREAMING_SNAKE ตรงกับ diagram · มี IsValid() · ไม่มี fmt.Stringer
package model

// AccountStatus — สถานะบัญชีผู้ใช้ (UserAccount.status)
//
// UNVERIFIED = สมัครแล้วแต่ยังไม่ยืนยัน OTP · SUSPENDED = ถูกผู้จัดการระงับ
type AccountStatus string

const (
	AccountStatusUnverified AccountStatus = "UNVERIFIED"
	AccountStatusActive     AccountStatus = "ACTIVE"
	AccountStatusSuspended  AccountStatus = "SUSPENDED"
)

func (s AccountStatus) IsValid() bool {
	switch s {
	case AccountStatusUnverified, AccountStatusActive, AccountStatusSuspended:
		return true
	}
	return false
}

// StockCountStatus — สถานะรอบการตรวจนับสต็อก
//
// class diagram พิมพ์เป็น string เฉย ๆ · ทำเป็น enum ให้ตรงกับ union ฝั่งหน้าจอ
// ซึ่งมีแค่สองค่านี้จริง ๆ (deviation ข้อเดียวกับ GRStatus/ReturnStatus)
type StockCountStatus string

const (
	StockCountStatusDraft StockCountStatus = "DRAFT"
	StockCountStatusDone  StockCountStatus = "DONE"
)

func (s StockCountStatus) IsValid() bool {
	switch s {
	case StockCountStatusDraft, StockCountStatusDone:
		return true
	}
	return false
}

// ApprovalStatus — ผลการตัดสินรายงานผลต่างสต็อกโดยผู้จัดการร้าน
type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "PENDING"
	ApprovalStatusApproved ApprovalStatus = "APPROVED"
	ApprovalStatusRejected ApprovalStatus = "REJECTED"
)

func (s ApprovalStatus) IsValid() bool {
	switch s {
	case ApprovalStatusPending, ApprovalStatusApproved, ApprovalStatusRejected:
		return true
	}
	return false
}

// StockLevel — ระดับยอดคงเหลือของรายงาน "หนังสือใกล้หมด"
//
// **คนละเรื่องกับ IsBelowReorder()** — อันนั้นใช้จุดสั่งซื้อรายเล่มของ U5 เพื่อเปิดใบขอสั่งซื้อ
// อันนี้ใช้เกณฑ์คงที่ LowStockThreshold ของรายงานอ่านอย่างเดียว · ห้ามยุบรวมกัน
type StockLevel string

const (
	StockLevelOut StockLevel = "OUT"
	StockLevelLow StockLevel = "LOW"
	StockLevelOK  StockLevel = "OK"
)

// LowStockThreshold — เกณฑ์ "เหลือน้อย" ของรายงาน (ตรงกับ LOW_STOCK_THRESHOLD ฝั่งหน้าจอ)
const LowStockThreshold = 10

// ── คำสั่งซื้อลูกค้า (เจ้าของคลาส: จิรพนธ์ อยู่หลาย) ─────────────────────

// OrderChannel — ช่องทางที่ลูกค้าสั่งซื้อ
type OrderChannel string

const (
	OrderChannelWebsite OrderChannel = "WEBSITE"
	OrderChannelMessage OrderChannel = "MESSAGE"
	OrderChannelPhone   OrderChannel = "PHONE"
)

func (c OrderChannel) IsValid() bool {
	switch c {
	case OrderChannelWebsite, OrderChannelMessage, OrderChannelPhone:
		return true
	}
	return false
}

// OrderStatus — สถานะคำสั่งซื้อ 11 ค่าตาม class diagram
type OrderStatus string

const (
	OrderStatusPendingConfirm   OrderStatus = "PENDING_CONFIRM"
	OrderStatusStockConfirmed   OrderStatus = "STOCK_CONFIRMED"
	OrderStatusWaitingPayment   OrderStatus = "WAITING_PAYMENT"
	OrderStatusVerifyingPayment OrderStatus = "VERIFYING_PAYMENT"
	OrderStatusPaid             OrderStatus = "PAID"
	OrderStatusPacking          OrderStatus = "PACKING"
	OrderStatusReadyToShip      OrderStatus = "READY_TO_SHIP"
	OrderStatusShipped          OrderStatus = "SHIPPED"
	OrderStatusDelivered        OrderStatus = "DELIVERED"
	OrderStatusCancelled        OrderStatus = "CANCELLED"
	OrderStatusRejected         OrderStatus = "REJECTED"
)

// OrderStatuses — ทุกค่าเรียงตามลำดับใน class diagram (ใช้ตอนสร้าง CHECK constraint)
func OrderStatuses() []OrderStatus {
	return []OrderStatus{
		OrderStatusPendingConfirm, OrderStatusStockConfirmed, OrderStatusWaitingPayment,
		OrderStatusVerifyingPayment, OrderStatusPaid, OrderStatusPacking,
		OrderStatusReadyToShip, OrderStatusShipped, OrderStatusDelivered,
		OrderStatusCancelled, OrderStatusRejected,
	}
}

func (s OrderStatus) IsValid() bool {
	_, ok := orderTransitions[s]
	return ok
}

// ── โปรโมชั่น (เจ้าของคลาส: จิรพนธ์ อยู่หลาย) ───────────────────────────

// PromotionType — ชนิดของโปรโมชั่น
type PromotionType string

const (
	PromotionTypeFestival PromotionType = "FESTIVAL_DISCOUNT"
	PromotionTypeCoupon   PromotionType = "COUPON"
	PromotionTypeBuyXQty  PromotionType = "BUY_X_QTY"
)

func (t PromotionType) IsValid() bool {
	switch t {
	case PromotionTypeFestival, PromotionTypeCoupon, PromotionTypeBuyXQty:
		return true
	}
	return false
}

// PromotionStatus — EXPIRED คำนวณจากวันหมดอายุ ไม่ได้ตั้งเอง (ดู Promotion.DisplayStatus)
type PromotionStatus string

const (
	PromotionStatusActive   PromotionStatus = "ACTIVE"
	PromotionStatusInactive PromotionStatus = "INACTIVE"
	PromotionStatusExpired  PromotionStatus = "EXPIRED"
)

func (s PromotionStatus) IsValid() bool {
	switch s {
	case PromotionStatusActive, PromotionStatusInactive, PromotionStatusExpired:
		return true
	}
	return false
}

// ── ตรวจสอบการชำระเงิน (เจ้าของคลาส: บัญชาการ อภัยสอน) ──────────────────

// PaymentStatus — สถานะการชำระเงินของคำสั่งซื้อ
//
// WAITING = ยังไม่แนบสลิป · VERIFYING = แนบแล้วรอฝ่ายขายตรวจ
// เป็นคนละชุดกับ OrderStatus โดยตั้งใจ — ใบสั่งซื้อเดินเรื่องหลายขั้นกว่าการชำระเงิน
type PaymentStatus string

const (
	PaymentStatusWaiting   PaymentStatus = "WAITING"
	PaymentStatusVerifying PaymentStatus = "VERIFYING"
	PaymentStatusSuccess   PaymentStatus = "SUCCESS"
	PaymentStatusRejected  PaymentStatus = "REJECTED"
)

func (s PaymentStatus) IsValid() bool {
	switch s {
	case PaymentStatusWaiting, PaymentStatusVerifying, PaymentStatusSuccess, PaymentStatusRejected:
		return true
	}
	return false
}

// ── จัดการการจัดส่ง (เจ้าของคลาส: ดวงกมล กองพันธ์) ─────────────────────

// ShipmentStatus — สถานะของพัสดุหนึ่งชิ้น
//
// เป็นคนละชุดกับ OrderStatus โดยตั้งใจ — ใบสั่งซื้อเดินเรื่องตั้งแต่รับออร์เดอร์
// ส่วนพัสดุเริ่มนับตั้งแต่ฝ่ายจัดส่งเตรียมของ และมีปลายทาง FAILED ที่ใบสั่งซื้อไม่มี
type ShipmentStatus string

const (
	ShipmentStatusPreparing ShipmentStatus = "PREPARING"
	ShipmentStatusShipped   ShipmentStatus = "SHIPPED"
	ShipmentStatusInTransit ShipmentStatus = "IN_TRANSIT"
	ShipmentStatusDelivered ShipmentStatus = "DELIVERED"
	ShipmentStatusFailed    ShipmentStatus = "FAILED"
)

func (s ShipmentStatus) IsValid() bool {
	switch s {
	case ShipmentStatusPreparing, ShipmentStatusShipped, ShipmentStatusInTransit,
		ShipmentStatusDelivered, ShipmentStatusFailed:
		return true
	}
	return false
}

// ShipmentStatuses — ค่าทั้งหมดของสถานะพัสดุ (ใช้สร้าง CHECK ใน migrate)
func ShipmentStatuses() []ShipmentStatus {
	return []ShipmentStatus{
		ShipmentStatusPreparing, ShipmentStatusShipped, ShipmentStatusInTransit,
		ShipmentStatusDelivered, ShipmentStatusFailed,
	}
}

// ── ระบบสมาชิกและแต้มสะสม (เจ้าของคลาส: บัญชาการ อภัยสอน) ───────────────

// PointTxnType — ประเภทรายการแต้มสะสม
//
// EARN มาจากคำสั่งซื้อที่ส่งถึงลูกค้าแล้ว · REDEEM มาจากการแลกของรางวัล
// EXPIRE กับ REVERSAL เป็นการปรับด้วยมือของผู้จัดการ (ดู Member.Adjust)
type PointTxnType string

const (
	PointTxnTypeEarn     PointTxnType = "EARN"
	PointTxnTypeRedeem   PointTxnType = "REDEEM"
	PointTxnTypeExpire   PointTxnType = "EXPIRE"
	PointTxnTypeReversal PointTxnType = "REVERSAL"
)

func (t PointTxnType) IsValid() bool {
	switch t {
	case PointTxnTypeEarn, PointTxnTypeRedeem, PointTxnTypeExpire, PointTxnTypeReversal:
		return true
	}
	return false
}

// PointTxnTypes — ค่าทั้งหมดเรียงตาม class diagram (ใช้สร้าง CHECK ใน migrate)
func PointTxnTypes() []PointTxnType {
	return []PointTxnType{
		PointTxnTypeEarn, PointTxnTypeRedeem, PointTxnTypeExpire, PointTxnTypeReversal,
	}
}

// RewardType — ประเภทของรางวัลที่แลกด้วยแต้ม
type RewardType string

const (
	RewardTypeDiscount RewardType = "DISCOUNT"
	RewardTypeGift     RewardType = "GIFT"
)

func (t RewardType) IsValid() bool {
	return t == RewardTypeDiscount || t == RewardTypeGift
}

// RewardTypes — ค่าทั้งหมด (ใช้สร้าง CHECK ใน migrate)
func RewardTypes() []RewardType {
	return []RewardType{RewardTypeDiscount, RewardTypeGift}
}
