// labels.go — ป้ายภาษาไทยของ enum ทุกตัว (คู่กับค่า SCREAMING_SNAKE) + String()
package model

// OrderChannelLabels — ป้ายไทยของช่องทางการสั่งซื้อ
var OrderChannelLabels = map[OrderChannel]string{
	OrderChannelWebsite: "เว็บไซต์",
	OrderChannelMessage: "ข้อความ/แชท",
	OrderChannelPhone:   "โทรศัพท์",
}

func (c OrderChannel) String() string {
	if label, ok := OrderChannelLabels[c]; ok {
		return label
	}
	return string(c)
}

// OrderStatusLabels — ป้ายไทยของสถานะคำสั่งซื้อ
var OrderStatusLabels = map[OrderStatus]string{
	OrderStatusPendingConfirm:   "รอยืนยัน",
	OrderStatusStockConfirmed:   "ยืนยันสต็อกแล้ว",
	OrderStatusWaitingPayment:   "รอชำระเงิน",
	OrderStatusVerifyingPayment: "กำลังตรวจสอบการชำระ",
	OrderStatusPaid:             "ชำระแล้ว",
	OrderStatusPacking:          "กำลังแพ็ก",
	OrderStatusReadyToShip:      "พร้อมจัดส่ง",
	OrderStatusShipped:          "จัดส่งแล้ว",
	OrderStatusDelivered:        "ส่งถึงแล้ว",
	OrderStatusCancelled:        "ยกเลิก",
	OrderStatusRejected:         "ปฏิเสธ",
}

func (s OrderStatus) String() string {
	if label, ok := OrderStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// PromotionTypeLabels — ป้ายไทยของประเภทโปรโมชั่น
var PromotionTypeLabels = map[PromotionType]string{
	PromotionTypeFestivalDiscount: "ลดตามเทศกาล",
	PromotionTypeCoupon:           "คูปองส่วนลด",
	PromotionTypeBuyXQty:          "ซื้อครบจำนวน",
}

func (t PromotionType) String() string {
	if label, ok := PromotionTypeLabels[t]; ok {
		return label
	}
	return string(t)
}

// PromotionStatusLabels — ป้ายไทยของสถานะโปรโมชั่น
var PromotionStatusLabels = map[PromotionStatus]string{
	PromotionStatusActive:   "ใช้งาน",
	PromotionStatusInactive: "ปิดใช้งาน",
	PromotionStatusExpired:  "หมดอายุ",
}

func (s PromotionStatus) String() string {
	if label, ok := PromotionStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// BookStatusLabels — ป้ายไทยของสถานะหนังสือ
var BookStatusLabels = map[BookStatus]string{
	BookStatusActive:   "เปิดขาย/ใช้งาน",
	BookStatusInactive: "ปิดขาย/ไม่ใช้งาน",
}

func (s BookStatus) String() string {
	if label, ok := BookStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

