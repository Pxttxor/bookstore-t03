// Package model — Entity/Model ของ 2 ระบบย่อย: จัดการข้อมูลผู้จัดจำหน่าย (U1–U4) และจัดซื้อ (U5–U10)
// แปลงตรงจาก class diagram ระดับ Analysis
//
// ไฟล์นี้ = ระบบย่อยที่ 1: จัดการข้อมูลผู้จัดจำหน่าย (Supplier Management, U1–U4)
// อ้างอิง: Sub1-Supplier-Management.md
package model

import "errors"

// SupplierStatus — สถานะผู้จัดจำหน่าย (enum จาก class diagram)
type SupplierStatus string

const (
	SupplierStatusActive    SupplierStatus = "ACTIVE"    // ใช้งาน
	SupplierStatusCancelled SupplierStatus = "CANCELLED" // ยกเลิก
)

// IsValid ตรวจว่าค่าสถานะอยู่ในชุดที่กำหนดไว้หรือไม่
func (s SupplierStatus) IsValid() bool {
	switch s {
	case SupplierStatusActive, SupplierStatusCancelled:
		return true
	}
	return false
}

// Supplier — ผู้จัดจำหน่าย (คลาสหลักของระบบย่อยที่ 1)
type Supplier struct {
	SupplierID  int
	CompanyName string
	ContactName string
	Phone       string
	Email       string
	Address     string
	TradeTerms  string // เงื่อนไขการค้า
	CreditTerms string // เงื่อนไขเครดิตการชำระเงิน
	Status      SupplierStatus
	Books       []SupplierBook // composition: Supplier "1" *-- "*" SupplierBook (offers)
}

// Register — ขึ้นทะเบียนผู้จัดจำหน่ายรายใหม่ (ตั้งสถานะเป็น ACTIVE)
func (s *Supplier) Register() {
	s.Status = SupplierStatusActive
}

// UpdateInfo — แก้ไขข้อมูลติดต่อและเงื่อนไขการค้า
func (s *Supplier) UpdateInfo(contactName, phone, email, address, tradeTerms, creditTerms string) {
	s.ContactName = contactName
	s.Phone = phone
	s.Email = email
	s.Address = address
	s.TradeTerms = tradeTerms
	s.CreditTerms = creditTerms
}

// Deactivate — ยกเลิกการค้ากับผู้จัดจำหน่าย (คงประวัติไว้ ไม่ลบทิ้ง)
func (s *Supplier) Deactivate() error {
	if s.Status == SupplierStatusCancelled {
		return errors.New("ผู้จัดจำหน่ายรายนี้ถูกยกเลิกไปแล้ว")
	}
	s.Status = SupplierStatusCancelled
	return nil
}

// SupplierBook — รายการหนังสือที่ผู้จัดจำหน่ายรายนี้ขาย (เชื่อม Supplier กับ Book)
// association: SupplierBook "*" --> "1" Book (for)
type SupplierBook struct {
	BookID       int     // FK ไปยัง Book
	SupplyPrice  float64 // ราคาส่ง — diagram เป็น decimal; production ควรใช้ decimal type ไม่ใช่ float64
	LeadTimeDays int     // ระยะเวลาส่งมอบ (วัน)
}
