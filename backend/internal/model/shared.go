// shared.go — คลาสอ้างอิงข้ามระบบย่อย
//
// Book / InventoryItem / StockTransaction เป็นคลาสของระบบย่อย "ข้อมูลหนังสือ" และ "สินค้าคงคลัง"
// ใส่ไว้เท่าที่ U5 (แจ้งเตือนจุดสั่งซื้อ), U9 (รับเข้าคลัง) และ U10 (ส่งคืน) ต้องใช้
// ใช้ชื่อฟิลด์เดิมตาม class diagram ไม่ตั้งชื่อใหม่ซ้ำซ้อน
//
// Employee เป็นการ map generalization Person <|- Employee <|- {WarehouseStaff, StoreManager,
// SalesStaff, DeliveryStaff} แบบ single-table inheritance (คอลัมน์ role เป็น discriminator)
// migrate.go สร้าง view warehouse_staff / store_manager ทับให้ชื่อตรงกับตาราง schema ในเอกสาร
package model

import "time"

// ── หนังสือ ─────────────────────────────────────────────────────────────

type Book struct {
	BookID      int        `gorm:"column:book_id;primaryKey" json:"bookId"`
	ISBN        string     `gorm:"column:isbn;type:varchar(20);not null;uniqueIndex" json:"isbn"`
	Title       string     `gorm:"column:title;type:varchar(300);not null" json:"title"`
	Author      string     `gorm:"column:author;type:varchar(200);not null" json:"author"`
	Publisher   string     `gorm:"column:publisher;type:varchar(200);not null" json:"publisher"`
	Price       float64    `gorm:"column:price;type:numeric(12,2);not null" json:"price"`
	Description string     `gorm:"column:description;type:text" json:"description"`
	Status      BookStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
}

func (Book) TableName() string { return "book" }

// ── สินค้าคงคลัง ────────────────────────────────────────────────────────

// InventoryItem — ยอดคงเหลือต่อหนังสือหนึ่งเล่ม
//
// ReorderPoint เป็น pointer เพราะ "ยังไม่ตั้งค่าจุดสั่งซื้อ" ต่างจาก "ตั้งไว้ที่ 0"
// SCR-20 Abnormal (U5): รายการที่ยังไม่ตั้งจุดสั่งซื้อ ระบบข้ามการตรวจ
type InventoryItem struct {
	InventoryID    int       `gorm:"column:inventory_id;primaryKey" json:"inventoryId"`
	BookID         int       `gorm:"column:book_id;not null;uniqueIndex" json:"bookId"`
	QuantityOnHand int       `gorm:"column:quantity_on_hand;not null;default:0" json:"quantityOnHand"`
	ReorderPoint   *int      `gorm:"column:reorder_point" json:"reorderPoint,omitempty"`
	LastUpdated    time.Time `gorm:"column:last_updated;type:timestamptz;not null" json:"lastUpdated"`
}

func (InventoryItem) TableName() string { return "inventory_item" }

// IsBelowReorder — ถึงจุดสั่งซื้อแล้วหรือยัง (U5)
// ยังไม่ตั้งจุดสั่งซื้อ = ไม่ถือว่าต่ำ ระบบข้ามการตรวจตาม SCR-20
func (i InventoryItem) IsBelowReorder() bool {
	return i.ReorderPoint != nil && i.QuantityOnHand <= *i.ReorderPoint
}

// StockTransaction — รายการเคลื่อนไหวสต็อก
// ระบบจัดซื้อสร้างชนิด RECEIVE_IN ตอนรับสินค้า (U9) และ RETURN ตอนส่งคืน (U10)
//
// BookID ไม่มีใน class diagram (ข้อ D4 ใน ClassDiagram-Review.md — คลาสนี้เป็นของระบบย่อย
// สินค้าคงคลัง จึงยังไม่ได้แก้ในเอกสาร) แต่ถ้าไม่มี รายการเคลื่อนไหวจะไม่บอกว่าเป็นหนังสือเล่มไหน
// และใช้งานจริงไม่ได้ จึงเพิ่มไว้ — เป็น deviation ที่ต้องตกลงกับเจ้าของคลาส
type StockTransaction struct {
	TxnID          int          `gorm:"column:txn_id;primaryKey;autoIncrement" json:"txnId"`
	BookID         int          `gorm:"column:book_id;not null;index" json:"bookId"`
	Type           StockTxnType `gorm:"column:type;type:varchar(20);not null" json:"type"`
	QuantityChange int          `gorm:"column:quantity_change;not null" json:"quantityChange"`
	Reason         string       `gorm:"column:reason;type:varchar(200);not null" json:"reason"`
	ReferenceDoc   string       `gorm:"column:reference_doc;type:varchar(100);not null;index" json:"referenceDoc"`
	TxnDate        time.Time    `gorm:"column:txn_date;type:timestamptz;not null" json:"txnDate"`
}

func (StockTransaction) TableName() string { return "stock_transaction" }

// ── พนักงาน ─────────────────────────────────────────────────────────────

// Employee — พนักงานทุกบทบาท (flatten Person + Employee ของ class diagram รวม)
//
// PasswordHash เป็นส่วนขยายสำหรับ JWT — คลาส UserAccount เต็มรูปแบบเป็นของระบบย่อยสมาชิก
// จึงดึงมาแค่ที่ backend นี้ต้องใช้จริง
type Employee struct {
	EmployeeID   string `gorm:"column:employee_id;type:varchar(20);primaryKey" json:"employeeId"`
	FirstName    string `gorm:"column:first_name;type:varchar(100);not null" json:"firstName"`
	LastName     string `gorm:"column:last_name;type:varchar(100);not null" json:"lastName"`
	Phone        string `gorm:"column:phone;type:varchar(50)" json:"phone"`
	Email        string `gorm:"column:email;type:varchar(200);not null;uniqueIndex" json:"email"`
	Role         Role   `gorm:"column:role;type:varchar(20);not null;index" json:"role"`
	PasswordHash string `gorm:"column:password_hash;type:varchar(100);not null" json:"-"`
}

func (Employee) TableName() string { return "employee" }

// Name — ชื่อเต็มที่หน้าจอแสดง (frontend เก็บผู้ทำรายการเป็นชื่อ ไม่ใช่รหัส)
func (e Employee) Name() string { return e.FirstName + " " + e.LastName }

// ── การแจ้งเตือน ────────────────────────────────────────────────────────

// Notification — แจ้งเตือนในระบบ (U6/U7/U9/U10)
// ช่อง "email" เป็นการจำลอง บันทึกไว้ให้ SCR-27 แสดงเส้นทางเอกสาร แต่ไม่ได้ส่งจริง
type Notification struct {
	ID        int                 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	To        Role                `gorm:"column:to_role;type:varchar(20);not null;index" json:"to"`
	Kind      NotificationKind    `gorm:"column:kind;type:varchar(40);not null" json:"kind"`
	Title     string              `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Body      string              `gorm:"column:body;type:text;not null" json:"body"`
	Link      string              `gorm:"column:link;type:varchar(300);not null" json:"link"`
	Channel   NotificationChannel `gorm:"column:channel;type:varchar(20);not null" json:"channel"`
	Read      bool                `gorm:"column:read;not null;default:false" json:"read"`
	CreatedAt time.Time           `gorm:"column:created_at;type:timestamptz;not null" json:"createdAt"`
}

func (Notification) TableName() string { return "notification" }
