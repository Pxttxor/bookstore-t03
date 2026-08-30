// labels_team.go — ป้ายภาษาไทยของ enum ในระบบย่อยที่เพื่อนร่วมทีมเป็นเจ้าของคลาส
//
// คู่กับ enums_team.go แบบหนึ่งต่อหนึ่ง · ข้อความยึดตามที่ frontend แสดงจริง
// (กติกาโปรเจกต์: ป้ายไทยที่ frontend กับ backend ไม่ตรงกัน ให้ยึดฝั่ง frontend)
package model

var AccountStatusLabels = map[AccountStatus]string{
	AccountStatusUnverified: "รอยืนยันตัวตน",
	AccountStatusActive:     "ใช้งาน",
	AccountStatusSuspended:  "ระงับการใช้งาน",
}

func (s AccountStatus) Label() string { return lookup(AccountStatusLabels, s) }

// BookFieldLabels — ป้ายไทยของฟิลด์หนังสือที่บันทึกประวัติการแก้ไข
// ตรงกับ BOOK_FIELD_LABELS ใน frontend/src/admin/books/books.ts ทีละตัว
var BookFieldLabels = map[BookField]string{
	BookFieldISBN:        "ISBN",
	BookFieldTitle:       "ชื่อหนังสือ",
	BookFieldAuthor:      "ผู้แต่ง",
	BookFieldPublisher:   "สำนักพิมพ์",
	BookFieldPrice:       "ราคาปก",
	BookFieldDescription: "รายละเอียด",
	BookFieldCategoryID:  "หมวดหมู่",
	BookFieldStatus:      "สถานะ",
}

var StockCountStatusLabels = map[StockCountStatus]string{
	StockCountStatusDraft: "ร่าง",
	StockCountStatusDone:  "ตรวจนับแล้ว",
}

var ApprovalStatusLabels = map[ApprovalStatus]string{
	ApprovalStatusPending:  "รออนุมัติ",
	ApprovalStatusApproved: "อนุมัติแล้ว",
	ApprovalStatusRejected: "ปฏิเสธ",
}

var StockLevelLabels = map[StockLevel]string{
	StockLevelOut: "หมด",
	StockLevelLow: "เหลือน้อย",
	StockLevelOK:  "ปกติ",
}

func (s StockCountStatus) Label() string { return lookup(StockCountStatusLabels, s) }
func (s ApprovalStatus) Label() string   { return lookup(ApprovalStatusLabels, s) }
func (l StockLevel) Label() string       { return lookup(StockLevelLabels, l) }

var OrderStatusLabels = map[OrderStatus]string{
	OrderStatusPendingConfirm:   "รอยืนยันคำสั่งซื้อ",
	OrderStatusStockConfirmed:   "ยืนยันสต็อกแล้ว",
	OrderStatusWaitingPayment:   "รอชำระเงิน",
	OrderStatusVerifyingPayment: "กำลังตรวจสอบการชำระเงิน",
	OrderStatusPaid:             "ชำระเงินแล้ว",
	OrderStatusPacking:          "กำลังแพ็กสินค้า",
	OrderStatusReadyToShip:      "พร้อมจัดส่ง",
	OrderStatusShipped:          "จัดส่งแล้ว",
	OrderStatusDelivered:        "ส่งถึงแล้ว",
	OrderStatusCancelled:        "ยกเลิก",
	OrderStatusRejected:         "ปฏิเสธ",
}

var OrderChannelLabels = map[OrderChannel]string{
	OrderChannelWebsite: "เว็บไซต์",
	OrderChannelMessage: "ข้อความ",
	OrderChannelPhone:   "โทรศัพท์",
}

var PromotionTypeLabels = map[PromotionType]string{
	PromotionTypeFestival: "ส่วนลดเทศกาล",
	PromotionTypeCoupon:   "คูปองส่วนลด",
	PromotionTypeBuyXQty:  "ซื้อครบจำนวน",
}

var PromotionStatusLabels = map[PromotionStatus]string{
	PromotionStatusActive:   "ใช้งาน",
	PromotionStatusInactive: "ปิดใช้งาน",
	PromotionStatusExpired:  "หมดอายุ",
}

func (s OrderStatus) Label() string     { return lookup(OrderStatusLabels, s) }
func (c OrderChannel) Label() string    { return lookup(OrderChannelLabels, c) }
func (t PromotionType) Label() string   { return lookup(PromotionTypeLabels, t) }
func (s PromotionStatus) Label() string { return lookup(PromotionStatusLabels, s) }

// PaymentStatusLabels — ระบบย่อยนี้ไม่มีหน้าจอฝั่ง frontend ให้ยึด
// ข้อความจึงเลือกให้อ่านเข้าคู่กับป้ายของ OrderStatus ที่ผู้ใช้เห็นอยู่แล้ว
var PaymentStatusLabels = map[PaymentStatus]string{
	PaymentStatusWaiting:   "รอชำระเงิน",
	PaymentStatusVerifying: "รอตรวจสอบ",
	PaymentStatusSuccess:   "ชำระเงินสำเร็จ",
	PaymentStatusRejected:  "ปฏิเสธการชำระเงิน",
}

func (s PaymentStatus) Label() string { return lookup(PaymentStatusLabels, s) }

// ShipmentStatusLabels — ตรงกับ SHIPMENT_STATUS_LABELS ใน frontend/src/admin/orders/orders.ts
// (ป้ายที่ผู้ใช้เห็นจริงอยู่ฝั่งหน้าจอ จึงยึดข้อความชุดนั้น ไม่ใช่ชุดใน SourceCode/)
var ShipmentStatusLabels = map[ShipmentStatus]string{
	ShipmentStatusPreparing: "กำลังเตรียม",
	ShipmentStatusShipped:   "จัดส่งแล้ว",
	ShipmentStatusInTransit: "ระหว่างขนส่ง",
	ShipmentStatusDelivered: "ส่งถึงแล้ว",
	ShipmentStatusFailed:    "จัดส่งไม่สำเร็จ",
}

func (s ShipmentStatus) Label() string { return lookup(ShipmentStatusLabels, s) }

// PointTxnTypeLabels / RewardTypeLabels — ระบบย่อยนี้ไม่มีหน้าจอฝั่ง frontend ให้ยึด
// จึงคัดข้อความจากไฟล์ของเจ้าของคลาส (SourceCode/B6730741-banchakan/model/labels.go)
// ต่างจาก ShipmentStatusLabels ที่มีป้ายฝั่งหน้าจออยู่แล้วจึงต้องยึดฝั่งนั้น
var PointTxnTypeLabels = map[PointTxnType]string{
	PointTxnTypeEarn:     "ได้รับแต้ม",
	PointTxnTypeRedeem:   "ใช้แต้มแลก",
	PointTxnTypeExpire:   "แต้มหมดอายุ",
	PointTxnTypeReversal: "ยกเลิก/คืนรายการ",
}

var RewardTypeLabels = map[RewardType]string{
	RewardTypeDiscount: "ส่วนลด",
	RewardTypeGift:     "ของแถม",
}

func (t PointTxnType) Label() string { return lookup(PointTxnTypeLabels, t) }
func (t RewardType) Label() string   { return lookup(RewardTypeLabels, t) }

// ReviewStatusLabels — ตรงกับ REVIEW_STATUS_LABELS ใน frontend/src/admin/reviews/reviews.ts
// ระบบย่อยนี้มีหน้าจอจริง (SCR ไม่มี แต่มีหน้า /admin/reviews) จึงยึดฝั่งหน้าจอ
// แบบเดียวกับ ShipmentStatus ไม่ใช่แบบ PointTxnType ที่ไม่มีหน้าจอให้ยึด
var ReviewStatusLabels = map[ReviewStatus]string{
	ReviewStatusPending:   "รอตรวจสอบ",
	ReviewStatusPublished: "ตรวจสอบสำเร็จ",
	ReviewStatusHidden:    "ซ่อนไว้",
	ReviewStatusRemoved:   "รีวิวที่ถูกลบ",
}

// ModerateActionLabels — ตรงกับ MODERATE_ACTION_LABELS ของ TS (ข้อความบนปุ่ม)
var ModerateActionLabels = map[ModerateAction]string{
	ModerateActionPublish: "อนุมัติ",
	ModerateActionHide:    "ซ่อนถาวร",
	ModerateActionRemove:  "ลบรีวิว",
}

func (s ReviewStatus) Label() string   { return lookup(ReviewStatusLabels, s) }
func (a ModerateAction) Label() string { return lookup(ModerateActionLabels, a) }
