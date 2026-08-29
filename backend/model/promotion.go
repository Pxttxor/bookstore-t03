// promotion.go — ระบบย่อยที่ 2: จัดการโปรโมชั่นและส่วนลด (Promotion) — อ้างอิง Sub2-Promotion.md
package model

import "time"

// PromotionType — ประเภทโปรโมชั่น (enum จาก class diagram)
type PromotionType string

const (
	PromotionTypeFestivalDiscount PromotionType = "FESTIVAL_DISCOUNT" // ลดตามเทศกาล
	PromotionTypeCoupon           PromotionType = "COUPON"            // คูปองส่วนลด
	PromotionTypeBuyXQty          PromotionType = "BUY_X_QTY"         // ซื้อครบจำนวน
)

// IsValid ตรวจว่าค่าประเภทโปรโมชั่นอยู่ในชุดที่กำหนดไว้หรือไม่
func (t PromotionType) IsValid() bool {
	switch t {
	case PromotionTypeFestivalDiscount, PromotionTypeCoupon, PromotionTypeBuyXQty:
		return true
	}
	return false
}

// PromotionStatus — สถานะโปรโมชั่น (enum จาก class diagram)
type PromotionStatus string

const (
	PromotionStatusActive   PromotionStatus = "ACTIVE"   // ใช้งาน
	PromotionStatusInactive PromotionStatus = "INACTIVE" // ปิดใช้งาน
	PromotionStatusExpired  PromotionStatus = "EXPIRED"  // หมดอายุ
)

// IsValid ตรวจว่าค่าสถานะโปรโมชั่นอยู่ในชุดที่กำหนดไว้หรือไม่
func (s PromotionStatus) IsValid() bool {
	switch s {
	case PromotionStatusActive, PromotionStatusInactive, PromotionStatusExpired:
		return true
	}
	return false
}

// Promotion — โปรโมชั่น/ส่วนลด (คลาสหลัก)
type Promotion struct {
	PromotionID     int             `json:"promotion_id" gorm:"primaryKey;autoIncrement"`
	Name            string          `json:"name" gorm:"size:255;not null"`
	Type            PromotionType   `json:"type" gorm:"size:30;not null"`
	ConditionDetail string          `json:"condition_detail" gorm:"type:text"`
	DiscountValue   float64         `json:"discount_value" gorm:"type:numeric(10,2);not null"` // มูลค่าส่วนลด (บาท หรือ % ตาม IsPercent)
	IsPercent       bool            `json:"is_percent" gorm:"default:false"`
	MinQty          int             `json:"min_qty" gorm:"default:0"`
	MinAmount       float64         `json:"min_amount" gorm:"type:numeric(10,2);default:0"`
	StartDate       time.Time       `json:"start_date"`
	EndDate         time.Time       `json:"end_date"`
	Status          PromotionStatus `json:"status" gorm:"size:20;default:'ACTIVE'"`

	// ความสัมพันธ์: 1 Promotion สามารถมีคำสั่งซื้อหลายรายการที่นำโปรโมชั่นนี้ไปใช้
	Orders []Order `json:"orders,omitempty" gorm:"foreignKey:PromotionID"`
}

// IsApplicable — ตรวจว่าโปรโมชั่นนี้ใช้กับคำสั่งซื้อได้หรือไม่
// (ต้อง ACTIVE, อยู่ในช่วงวันที่, ยอด/จำนวนถึงเกณฑ์ขั้นต่ำ)
func (p *Promotion) IsApplicable(o *Order) bool {
	now := time.Now()
	if p.Status != PromotionStatusActive {
		return false
	}
	if now.Before(p.StartDate) || now.After(p.EndDate) {
		return false
	}
	if o.Subtotal < p.MinAmount {
		return false
	}
	totalQty := 0
	for _, it := range o.Items {
		totalQty += it.Quantity
	}
	return totalQty >= p.MinQty
}

// CalcDiscount — คำนวณส่วนลดที่ได้จากคำสั่งซื้อ (คืน 0 ถ้าใช้ไม่ได้)
func (p *Promotion) CalcDiscount(o *Order) float64 {
	if !p.IsApplicable(o) {
		return 0
	}
	if p.IsPercent {
		return o.Subtotal * p.DiscountValue / 100
	}
	return p.DiscountValue
}

// Overlaps — ตรวจว่าช่วงเวลาของโปรโมชั่นสองรายการทับซ้อนกันหรือไม่
func (p *Promotion) Overlaps(other *Promotion) bool {
	return !p.StartDate.After(other.EndDate) && !other.StartDate.After(p.EndDate)
}
