// inventory.go — ระบบย่อยสินค้าคงคลัง (เจ้าของ: วุฒิภัทร โกฎแสง)
// อ้างอิง class diagram: Sub2-Inventory.md
package model

import "time"

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
