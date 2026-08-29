// shared.go — คลาสอ้างอิงข้ามระบบย่อย (เจ้าของคือเพื่อนร่วมทีม) ใส่แบบย่อพอให้ใช้งาน/คอมไพล์ได้
//
//	Book + BookStatus — ระบบย่อยของ วุฒิภัทร โกฎแสง (ข้อมูลหนังสือ)
//	Customer/SalesStaff/StoreManager — คลาสบุคคล (ตาม class diagram รวม)
//
// คลาสอื่นที่ diagram อ้างถึง (Payment/Shipment/PointTransaction/Review/StockTransaction)
// อ้างผ่าน FK id (int) ใน order.go จึงไม่ต้องประกาศ struct ที่นี่
package model

import "time"

// BookStatus — สถานะหนังสือ (เจ้าของ: วุฒิภัทร)
type BookStatus string

const (
	BookStatusActive   BookStatus = "ACTIVE"
	BookStatusInactive BookStatus = "INACTIVE"
)

// Book — หนังสือ (เจ้าของ: วุฒิภัทร) ใส่แบบย่อสำหรับให้คำสั่งซื้ออ้างอิงราคา/รหัส
type Book struct {
	BookID      int        `json:"book_id" gorm:"primaryKey;autoIncrement"`
	ISBN        string     `json:"isbn" gorm:"size:20"`
	Title       string     `json:"title" gorm:"size:255;not null"`
	Author      string     `json:"author" gorm:"size:255"`
	Publisher   string     `json:"publisher" gorm:"size:255"`
	Price       float64    `json:"price" gorm:"type:numeric(10,2);not null"`
	Description string     `json:"description" gorm:"type:text"`
	Status      BookStatus `json:"status" gorm:"size:20;default:'ACTIVE'"`
}

// Customer — ลูกค้า
type Customer struct {
	CustomerID     int       `json:"customer_id" gorm:"primaryKey;autoIncrement"`
	Name           string    `json:"name" gorm:"size:255"`
	Email          string    `json:"email" gorm:"size:255"`
	Address        string    `json:"address" gorm:"type:text"`
	RegisteredDate time.Time `json:"registered_date"`
}

// SalesStaff — พนักงานฝ่ายขาย (รับผิดชอบ/ดูแลคำสั่งซื้อ)
type SalesStaff struct {
	StaffID int    `json:"staff_id" gorm:"primaryKey;autoIncrement"`
	Name    string `json:"name" gorm:"size:255"`
}

// HandleOrder — พนักงานฝ่ายขายเปลี่ยนสถานะคำสั่งซื้อ
func (s *SalesStaff) HandleOrder(o *Order, status OrderStatus, note string) error {
	return o.UpdateStatus(status, note)
}

// StoreManager — ผู้จัดการร้าน (ดูแลโปรโมชั่น)
type StoreManager struct {
	StaffID int    `json:"staff_id" gorm:"primaryKey;autoIncrement"`
	Name    string `json:"name" gorm:"size:255"`
}

// ManagePromotion — เปิด/ปิดใช้งานโปรโมชั่น
func (m *StoreManager) ManagePromotion(p *Promotion, status PromotionStatus) {
	p.Status = status
}

