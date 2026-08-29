// shared.go — คลาสอ้างอิงข้ามระบบย่อย ใส่แบบย่อพอให้ใช้งาน/คอมไพล์ได้
//
//	Book, BookStatus, StockTransaction, StockTxnType — ระบบหนังสือ + สินค้าคงคลัง
//	WarehouseStaff, StoreManager                     — คลาสพนักงาน (ตาม class diagram รวม)
//
// ใช้ชื่อฟิลด์เดิมตาม class diagram ห้ามตั้งชื่อใหม่ซ้ำซ้อน
package model

import "time"

// BookStatus — สถานะหนังสือ
type BookStatus string

const (
	BookStatusActive   BookStatus = "ACTIVE"   // ใช้งาน
	BookStatusInactive BookStatus = "INACTIVE" // ปิดการขาย
)

// Book — หนังสือ ใส่แบบย่อสำหรับให้ระบบจัดซื้ออ้างอิง
type Book struct {
	BookID      int
	ISBN        string
	Title       string
	Author      string
	Publisher   string
	Price       float64
	Description string
	Status      BookStatus
}

// StockTxnType — ประเภทการเคลื่อนไหวสต็อก
type StockTxnType string

const (
	StockTxnTypeReceiveIn  StockTxnType = "RECEIVE_IN" // รับเข้า
	StockTxnTypeSaleOut    StockTxnType = "SALE_OUT"   // ขายออก
	StockTxnTypeReturn     StockTxnType = "RETURN"     // ส่งคืน
	StockTxnTypeAdjustment StockTxnType = "ADJUSTMENT" // ปรับปรุงยอด
)

// StockTransaction — รายการเคลื่อนไหวสต็อก
// ระบบจัดซื้อสร้างรายการชนิด RECEIVE_IN ให้เมื่อรับสินค้าเข้าคลัง (ดู GoodsReceipt.ToStockTransactions)
type StockTransaction struct {
	TxnID          int
	Type           StockTxnType
	QuantityChange int
	Reason         string
	ReferenceDoc   string
	TxnDate        time.Time
}

// WarehouseStaff — พนักงานคลังสินค้า
type WarehouseStaff struct {
	StaffID int
	Name    string
}

// CountStock — ตรวจนับสต็อก (รายละเอียดอยู่ในระบบย่อยสินค้าคงคลัง)
func (w *WarehouseStaff) CountStock() {}

// ReceiveGoods — บันทึกรับสินค้าเข้าคลังตามใบสั่งซื้อ แล้วคืนรายการเคลื่อนไหวสต็อกที่เกิดขึ้น
func (w *WarehouseStaff) ReceiveGoods(po *PurchaseOrder, gr *GoodsReceipt) []StockTransaction {
	po.ApplyReceipt(gr)
	return gr.ToStockTransactions()
}

// StoreManager — ผู้จัดการร้าน
type StoreManager struct {
	StaffID int
	Name    string
}

// ApprovePO — อนุมัติใบสั่งซื้อ (บันทึกผู้อนุมัติแล้วเปลี่ยนสถานะ PO)
func (m *StoreManager) ApprovePO(po *PurchaseOrder) error {
	po.ApprovedByManagerID = m.StaffID
	return po.Approve()
}

// ManagePromotion / ManageMemberTier — เป็นเมธอดของระบบย่อยอื่น (โปรโมชั่น/สมาชิก)
// ไม่ implement ในขอบเขตนี้
func (m *StoreManager) ManagePromotion()  {}
func (m *StoreManager) ManageMemberTier() {}
