// Package model — Entity/Model ของ 2 ระบบย่อยที่ นายจิรพนธ์ อยู่หลาย (B6708429, ทีม T03) รับผิดชอบ
// แปลงตรงจาก class diagram ระดับ Analysis (รวมงาน/ClassDiagram/PerPerson/4-จิรพนธ์ อยู่หลาย/)
//
// ไฟล์นี้ = ระบบย่อยที่ 1: จัดการคำสั่งซื้อลูกค้า (Order) — อ้างอิง Sub1-Order.md
package model

import (
	"fmt"
	"time"
)

// OrderChannel — ช่องทางการสั่งซื้อ (enum จาก class diagram)
type OrderChannel string

const (
	OrderChannelWebsite OrderChannel = "WEBSITE" // เว็บไซต์
	OrderChannelMessage OrderChannel = "MESSAGE" // ข้อความ/แชท
	OrderChannelPhone   OrderChannel = "PHONE"   // โทรศัพท์
)

// IsValid ตรวจว่าค่าช่องทางการสั่งซื้ออยู่ในชุดที่กำหนดไว้หรือไม่
func (c OrderChannel) IsValid() bool {
	switch c {
	case OrderChannelWebsite, OrderChannelMessage, OrderChannelPhone:
		return true
	}
	return false
}

// OrderStatus — สถานะคำสั่งซื้อ (enum จาก class diagram)
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

// IsValid ตรวจว่าค่าสถานะคำสั่งซื้ออยู่ในชุดที่กำหนดไว้หรือไม่
func (s OrderStatus) IsValid() bool {
	switch s {
	case OrderStatusPendingConfirm, OrderStatusStockConfirmed, OrderStatusWaitingPayment,
		OrderStatusVerifyingPayment, OrderStatusPaid, OrderStatusPacking, OrderStatusReadyToShip,
		OrderStatusShipped, OrderStatusDelivered, OrderStatusCancelled, OrderStatusRejected:
		return true
	}
	return false
}

// Order — คำสั่งซื้อ (คลาสหลัก)
type Order struct {
	OrderID         int          `json:"order_id" gorm:"primaryKey;autoIncrement"`
	Channel         OrderChannel `json:"channel" gorm:"size:20;not null"`
	OrderDate       time.Time    `json:"order_date" gorm:"not null"`
	ShippingAddress string       `json:"shipping_address" gorm:"type:text"`
	Status          OrderStatus  `json:"status" gorm:"size:30;not null;default:'PENDING_CONFIRM'"`
	Subtotal        float64      `json:"subtotal" gorm:"type:numeric(10,2);default:0"`
	DiscountAmount  float64      `json:"discount_amount" gorm:"type:numeric(10,2);default:0"`
	NetAmount       float64      `json:"net_amount" gorm:"type:numeric(10,2);default:0"`

	// ความสัมพันธ์แบบ Belongs-To กับ Customer (ลูกค้า)
	CustomerID int       `json:"customer_id" gorm:"index"`
	Customer   *Customer `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`

	// ความสัมพันธ์แบบ Belongs-To กับ Promotion (โปรโมชั่นที่ใช้ — เป็น nil/null ได้หากไม่ได้ใช้โปรโมชั่น)
	PromotionID *int       `json:"promotion_id,omitempty" gorm:"index"`
	Promotion   *Promotion `json:"promotion,omitempty" gorm:"foreignKey:PromotionID"`

	PaymentID  *int `json:"payment_id,omitempty"`
	ShipmentID *int `json:"shipment_id,omitempty"`

	// ความสัมพันธ์แบบ 1-to-Many (Order 1 อัน มี Items หลายอัน และมี History หลายอัน)
	Items   []OrderItem          `json:"items" gorm:"foreignKey:OrderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	History []OrderStatusHistory `json:"history" gorm:"foreignKey:OrderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// AddItem — เพิ่มรายการหนังสือเข้าคำสั่งซื้อ (คิด lineTotal จากราคาขายของหนังสือ)
func (o *Order) AddItem(book Book, qty int) {
	o.Items = append(o.Items, OrderItem{
		OrderID:   o.OrderID,
		BookID:    book.BookID,
		Book:      &book,
		Quantity:  qty,
		UnitPrice: book.Price,
		LineTotal: book.Price * float64(qty),
	})
}

// CalcTotal — คำนวณยอดรวมย่อย/สุทธิใหม่ (netAmount = subtotal - discountAmount)
func (o *Order) CalcTotal() float64 {
	var subtotal float64
	for _, it := range o.Items {
		subtotal += it.LineTotal
	}
	o.Subtotal = subtotal
	o.NetAmount = subtotal - o.DiscountAmount
	return o.NetAmount
}

// ApplyPromotion — นำโปรโมชั่นมาใช้กับคำสั่งซื้อ คำนวณส่วนลด และบันทึก PromotionID ให้อัตโนมัติ
func (o *Order) ApplyPromotion(p *Promotion) bool {
	if p == nil || !p.IsApplicable(o) {
		return false
	}
	discount := p.CalcDiscount(o)
	o.DiscountAmount = discount
	o.PromotionID = &p.PromotionID
	o.Promotion = p
	o.CalcTotal()
	return true
}

// UpdateStatus — เปลี่ยนสถานะคำสั่งซื้อ พร้อมบันทึกไทม์ไลน์
func (o *Order) UpdateStatus(s OrderStatus, note string) error {
	if !s.IsValid() {
		return fmt.Errorf("สถานะคำสั่งซื้อไม่ถูกต้อง: %q", string(s))
	}
	o.Status = s
	o.History = append(o.History, OrderStatusHistory{
		OrderID:     o.OrderID,
		Status:      s,
		ChangedDate: time.Now(),
		Note:        note,
	})
	return nil
}

// OrderItem — รายการสินค้าในคำสั่งซื้อ (เชื่อมต่อกับ Order และ Book)
type OrderItem struct {
	OrderItemID int      `json:"order_item_id" gorm:"primaryKey;autoIncrement"`
	OrderID     int      `json:"order_id" gorm:"not null;index"`
	BookID      int      `json:"book_id" gorm:"not null;index"`
	Book        *Book    `json:"book,omitempty" gorm:"foreignKey:BookID"`
	Quantity    int      `json:"quantity" gorm:"not null;default:1"`
	UnitPrice   float64  `json:"unit_price" gorm:"type:numeric(10,2);not null"`
	LineTotal   float64  `json:"line_total" gorm:"type:numeric(10,2);not null"`
}

// OrderStatusHistory — ไทม์ไลน์สถานะคำสั่งซื้อ (เชื่อมต่อกับ Order)
type OrderStatusHistory struct {
	HistoryID   int         `json:"history_id" gorm:"primaryKey;autoIncrement"`
	OrderID     int         `json:"order_id" gorm:"not null;index"`
	Status      OrderStatus `json:"status" gorm:"size:30;not null"`
	ChangedDate time.Time   `json:"changed_date" gorm:"not null"`
	Note        string      `json:"note" gorm:"type:text"`
}
