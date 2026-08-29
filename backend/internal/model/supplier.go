// supplier.go — ระบบย่อยที่ 1: จัดการข้อมูลผู้จัดจำหน่าย (U1–U4)
// อ้างอิง class diagram: Sub1-Supplier-Management.md
package model

import "time"

// Supplier — ผู้จัดจำหน่าย (คลาสหลักของระบบย่อยที่ 1)
type Supplier struct {
	SupplierID  int            `gorm:"column:supplier_id;primaryKey" json:"supplierId"`
	CompanyName string         `gorm:"column:company_name;type:varchar(200);not null" json:"companyName"`
	ContactName string         `gorm:"column:contact_name;type:varchar(200);not null" json:"contactName"`
	Phone       string         `gorm:"column:phone;type:varchar(50);not null" json:"phone"`
	Email       string         `gorm:"column:email;type:varchar(200);not null" json:"email"`
	Address     string         `gorm:"column:address;type:text;not null" json:"address"`
	TradeTerms  string         `gorm:"column:trade_terms;type:text;not null" json:"tradeTerms"`
	CreditTerms string         `gorm:"column:credit_terms;type:varchar(200);not null" json:"creditTerms"`
	Status      SupplierStatus `gorm:"column:status;type:varchar(20);not null;index" json:"status"`

	// composition (◆): Supplier "1" *-- "*" SupplierBook : offers
	Books []SupplierBook `gorm:"foreignKey:SupplierID;references:SupplierID;constraint:OnDelete:CASCADE" json:"books"`

	// ส่วนขยายนอก class diagram — U2 ต้องเก็บประวัติแก้ไข, U3 ต้องเก็บเหตุผลยกเลิก
	EditHistory  []SupplierEditLog     `gorm:"foreignKey:SupplierID;references:SupplierID;constraint:OnDelete:CASCADE" json:"editHistory"`
	Deactivation *SupplierDeactivation `gorm:"foreignKey:SupplierID;references:SupplierID;constraint:OnDelete:CASCADE" json:"deactivation,omitempty"`
}

func (Supplier) TableName() string { return "supplier" }

// SupplierBook — รายการหนังสือที่ผู้จัดจำหน่ายรายนี้เสนอขาย
//
// association: SupplierBook "*" --> "1" Book : for
// PK ผสม (supplier_id, book_id) ตามตาราง schema ในเอกสาร → หนังสือเล่มเดียวซ้ำในผู้ขายรายเดียวไม่ได้
type SupplierBook struct {
	SupplierID   int     `gorm:"column:supplier_id;primaryKey" json:"-"`
	BookID       int     `gorm:"column:book_id;primaryKey" json:"bookId"`
	SupplyPrice  float64 `gorm:"column:supply_price;type:numeric(12,2);not null" json:"supplyPrice"`
	LeadTimeDays int     `gorm:"column:lead_time_days;not null" json:"leadTimeDays"`

	// อ่านอย่างเดียว เติมจากตาราง book ตอน preload
	// frontend คาดหวัง isbn/title/author/publisher ติดมากับ SupplierBook — handler แบนออกมาให้
	Book *Book `gorm:"foreignKey:BookID;references:BookID" json:"-"`
}

func (SupplierBook) TableName() string { return "supplier_book" }

// SupplierEditLog — ประวัติการแก้ไขข้อมูลผู้จัดจำหน่าย
// U2 postcondition "ระบบบันทึกประวัติการแก้ไข (ใคร/เมื่อไร)" · ส่วนขยายนอก class diagram
type SupplierEditLog struct {
	LogID      int       `gorm:"column:log_id;primaryKey;autoIncrement" json:"-"`
	SupplierID int       `gorm:"column:supplier_id;not null;index" json:"-"`
	At         time.Time `gorm:"column:at;type:timestamptz;not null" json:"at"`
	By         string    `gorm:"column:by;type:varchar(200);not null" json:"by"`
	Summary    string    `gorm:"column:summary;type:text;not null" json:"summary"`
}

func (SupplierEditLog) TableName() string { return "supplier_edit_log" }

// SupplierDeactivation — เหตุผลและผู้สั่งปิดใช้งานผู้จัดจำหน่าย (U3)
// ส่วนขยายนอก class diagram · 1 supplier มีได้ไม่เกิน 1 แถว
type SupplierDeactivation struct {
	SupplierID int       `gorm:"column:supplier_id;primaryKey" json:"-"`
	Reason     string    `gorm:"column:reason;type:varchar(200);not null" json:"reason"`
	Note       string    `gorm:"column:note;type:text;not null" json:"note"`
	At         time.Time `gorm:"column:at;type:timestamptz;not null" json:"at"`
	By         string    `gorm:"column:by;type:varchar(200);not null" json:"by"`
}

func (SupplierDeactivation) TableName() string { return "supplier_deactivation" }

// Register — ขึ้นทะเบียนผู้จัดจำหน่ายรายใหม่ (class diagram: +register())
// U1 postcondition: ผู้จัดจำหน่ายรายใหม่มีสถานะ ACTIVE ใช้ออกใบสั่งซื้อได้ทันที
func (s *Supplier) Register() {
	s.Status = SupplierStatusActive
}

// UpdateInfo — แก้ไขข้อมูลติดต่อและเงื่อนไขการค้า (class diagram: +updateInfo())
// จงใจไม่ให้แก้ CompanyName เพราะเป็นคีย์ที่ใช้ตรวจซ้ำตอน U1
func (s *Supplier) UpdateInfo(contactName, phone, email, address, tradeTerms, creditTerms string) {
	s.ContactName = contactName
	s.Phone = phone
	s.Email = email
	s.Address = address
	s.TradeTerms = tradeTerms
	s.CreditTerms = creditTerms
}

// Deactivate — ยกเลิกการค้ากับผู้จัดจำหน่าย (class diagram: +deactivate())
// คงประวัติไว้ ไม่ลบทิ้ง · การตรวจ "ใบสั่งซื้อคงค้าง" อยู่ที่ service เพราะต้อง query PO
func (s *Supplier) Deactivate() error {
	if s.Status == SupplierStatusCancelled {
		return ErrSupplierAlreadyCancelled
	}
	s.Status = SupplierStatusCancelled
	return nil
}

// IsActive — ใช้ตอน U6 ตรวจว่าเลือกผู้จัดจำหน่ายรายนี้ทำใบขอสั่งซื้อได้หรือไม่
func (s *Supplier) IsActive() bool { return s.Status == SupplierStatusActive }

// Offers — ผู้จัดจำหน่ายรายนี้เสนอขายหนังสือเล่มนี้หรือไม่ พร้อมราคาส่งที่ตกลงไว้
func (s *Supplier) Offers(bookID int) (SupplierBook, bool) {
	for _, book := range s.Books {
		if book.BookID == bookID {
			return book, true
		}
	}
	return SupplierBook{}, false
}
