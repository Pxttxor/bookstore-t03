// promotion.go — โปรโมชั่นและส่วนลด
// อ้างอิง class diagram: Sub2-Promotion.md · Order "*" --> "0..1" Promotion : applies
package model

import "fmt"

// Promotion — เงื่อนไขส่วนลดหนึ่งรายการ
//
// IsPercent แยกจาก DiscountValue เพราะ diagram เก็บสองฟิลด์นี้แยกกัน
// (15 กับ isPercent=true คือ 15% · 50 กับ isPercent=false คือ 50 บาท)
type Promotion struct {
	PromotionID     int             `gorm:"column:promotion_id;primaryKey;autoIncrement" json:"promotionId"`
	Name            string          `gorm:"column:name;type:varchar(200);not null" json:"name"`
	Type            PromotionType   `gorm:"column:type;type:varchar(30);not null" json:"type"`
	ConditionDetail string          `gorm:"column:condition_detail;type:text" json:"conditionDetail"`
	DiscountValue   float64         `gorm:"column:discount_value;type:numeric(12,2);not null" json:"discountValue"`
	IsPercent       bool            `gorm:"column:is_percent;not null" json:"isPercent"`
	MinQty          int             `gorm:"column:min_qty;not null;default:0" json:"minQty"`
	MinAmount       float64         `gorm:"column:min_amount;type:numeric(12,2);not null;default:0" json:"minAmount"`
	StartDate       Date            `gorm:"column:start_date;type:date;not null" json:"startDate"`
	EndDate         Date            `gorm:"column:end_date;type:date;not null" json:"endDate"`
	Status          PromotionStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
}

func (Promotion) TableName() string { return "promotion" }

// DisplayStatus — สถานะที่หน้าจอแสดงจริง
//
// โปรโมชั่นที่เลยวันสิ้นสุดอ่านเป็น EXPIRED โดยไม่ต้องมีใครไปกดปิด (ตรงกับ promoDisplayStatus
// ฝั่งหน้าจอ) · แต่ถ้าผู้จัดการปิดใช้งานเอง INACTIVE มาก่อนเสมอ
func (p Promotion) DisplayStatus(today Date) PromotionStatus {
	if p.Status == PromotionStatusInactive {
		return PromotionStatusInactive
	}
	if p.EndDate.Before(today) {
		return PromotionStatusExpired
	}
	return p.Status
}

// IsApplicable — คำสั่งซื้อใบนี้เข้าเงื่อนไขโปรโมชั่นหรือไม่ (`+isApplicable(order)` ใน diagram)
//
// ตรวจสามอย่าง: ยังใช้งานได้ในวันที่สั่ง · ยอดถึงขั้นต่ำ · จำนวนเล่มถึงขั้นต่ำ
func (p Promotion) IsApplicable(order Order, today Date) bool {
	if p.DisplayStatus(today) != PromotionStatusActive {
		return false
	}
	if today.Before(p.StartDate) {
		return false
	}
	if p.MinAmount > 0 && order.Subtotal < p.MinAmount {
		return false
	}
	if p.MinQty > 0 && order.ItemCount() < p.MinQty {
		return false
	}
	return true
}

// CalcDiscount — ส่วนลดเป็นบาทของคำสั่งซื้อใบนี้ (`+calcDiscount(order)` ใน diagram)
// ส่วนลดไม่เกินยอดก่อนลด ไม่งั้นยอดสุทธิจะติดลบ
func (p Promotion) CalcDiscount(order Order) float64 {
	discount := p.DiscountValue
	if p.IsPercent {
		discount = order.Subtotal * p.DiscountValue / 100
	}
	if discount > order.Subtotal {
		return order.Subtotal
	}
	if discount < 0 {
		return 0
	}
	return discount
}

// Overlaps — โปรโมชั่นชนิดเดียวกันที่ช่วงวันที่ทับกัน (`+overlaps(other)` ใน diagram)
// ฟอร์มใช้เตือนผู้จัดการก่อนบันทึก ไม่ได้ห้ามบันทึก
func (p Promotion) Overlaps(other Promotion) bool {
	if p.Type != other.Type {
		return false
	}
	if p.PromotionID != 0 && p.PromotionID == other.PromotionID {
		return false
	}
	return !p.StartDate.After(other.EndDate) && !other.StartDate.After(p.EndDate)
}

// FormatPromotionCode — รหัสที่หน้าจอแสดง (PROMO01)
func FormatPromotionCode(promotionID int) string { return fmt.Sprintf("PROMO%02d", promotionID) }
