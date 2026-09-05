// inventory.go — ระบบย่อยสินค้าคงคลัง
// อ้างอิง class diagram: Sub2-Inventory.md
package model

import (
	"fmt"
	"time"
)

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
// BookID ไม่มีใน class diagram (ข้อ D4 ใน ClassDiagram-Review.md ยังไม่ได้แก้ในเอกสาร)
// แต่ถ้าไม่มี รายการเคลื่อนไหวจะไม่บอกว่าเป็นหนังสือเล่มไหนและใช้งานจริงไม่ได้ จึงเพิ่มไว้
// เป็น deviation
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

// StockLevelOf — ระดับยอดคงเหลือของรายงาน "หนังสือใกล้หมด" (U8 ของระบบย่อยสินค้าคงคลัง)
//
// ใช้เกณฑ์คงที่ LowStockThreshold ต่างจาก IsBelowReorder() ที่ใช้จุดสั่งซื้อรายเล่มของ U5
// สองอันนี้ตอบคนละคำถามและต้องแยกกันเด็ดขาด
func StockLevelOf(item InventoryItem) StockLevel {
	switch {
	case item.QuantityOnHand == 0:
		return StockLevelOut
	case item.QuantityOnHand < LowStockThreshold:
		return StockLevelLow
	default:
		return StockLevelOK
	}
}

// ── การตรวจนับสต็อก ─────────────────────────────────────────────────────

// StockCount — รอบการตรวจนับหนึ่งครั้ง
//
// composition: StockCount "1" *-- "*" StockCountItem : items
// CountedBy เก็บ "ชื่อ" พนักงานคลัง แบบเดียวกับ supplier_edit_log.by
// (diagram วาดเส้น WarehouseStaff --> StockCount ไว้แต่ไม่ระบุ attribute)
type StockCount struct {
	CountID   int              `gorm:"column:count_id;primaryKey;autoIncrement" json:"countId"`
	CountDate Date             `gorm:"column:count_date;type:date;not null" json:"countDate"`
	Status    StockCountStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
	CountedBy string           `gorm:"column:counted_by;type:varchar(200);not null" json:"countedBy"`
	Items     []StockCountItem `gorm:"foreignKey:CountID;references:CountID;constraint:OnDelete:CASCADE" json:"items"`
}

func (StockCount) TableName() string { return "stock_count" }

// StockCountItem — หนังสือหนึ่งเล่มในรอบตรวจนับ · PK ผสม (count_id, book_id)
//
// ReportID เป็น pointer เพราะแถวที่นับได้ตรงกับระบบไม่มีรายงานผลต่าง
// (StockCountItem "1" --> "0..1" StockDiscrepancyReport : flags)
type StockCountItem struct {
	CountID    int  `gorm:"column:count_id;primaryKey" json:"-"`
	BookID     int  `gorm:"column:book_id;primaryKey" json:"bookId"`
	SystemQty  int  `gorm:"column:system_qty;not null" json:"systemQty"`
	CountedQty int  `gorm:"column:counted_qty;not null" json:"countedQty"`
	Variance   int  `gorm:"column:variance;not null" json:"variance"`
	ReportID   *int `gorm:"column:report_id" json:"reportId,omitempty"`
}

func (StockCountItem) TableName() string { return "stock_count_item" }

// ComputeVariance — ผลต่างระหว่างที่นับได้กับที่ระบบบันทึกไว้ (`+computeVariance()` ใน diagram)
// บวก = นับได้มากกว่าระบบ · ลบ = ของหาย
func (i *StockCountItem) ComputeVariance() int {
	i.Variance = i.CountedQty - i.SystemQty
	return i.Variance
}

// StockDiscrepancyReport — รายงานผลต่างที่ต้องให้ผู้จัดการร้านตัดสิน
//
// CountID กับ BookID เป็น FK ที่เพิ่มเข้ามา — diagram เข้าถึงรายงานผ่าน StockCountItem.reportId
// ทางเดียว การถือรหัสรอบและรหัสหนังสือไว้ทำให้หน้าจอไม่ต้องไล่ย้อนทุกรอบตรวจนับ
type StockDiscrepancyReport struct {
	ReportID       int            `gorm:"column:report_id;primaryKey;autoIncrement" json:"reportId"`
	CountID        int            `gorm:"column:count_id;not null;index" json:"countId"`
	BookID         int            `gorm:"column:book_id;not null;index" json:"bookId"`
	Variance       int            `gorm:"column:variance;not null" json:"variance"`
	ApprovalStatus ApprovalStatus `gorm:"column:approval_status;type:varchar(20);not null;index" json:"approvalStatus"`
	Note           string         `gorm:"column:note;type:text" json:"note"`
	ReportedBy     string         `gorm:"column:reported_by;type:varchar(200);not null" json:"reportedBy"`
	ReportedAt     time.Time      `gorm:"column:reported_at;type:timestamptz;not null" json:"reportedAt"`
	ResolvedBy     string         `gorm:"column:resolved_by;type:varchar(200)" json:"resolvedBy,omitempty"`
	ResolvedAt     *time.Time     `gorm:"column:resolved_at;type:timestamptz" json:"resolvedAt,omitempty"`
}

func (StockDiscrepancyReport) TableName() string { return "stock_discrepancy_report" }

// Decide — ผู้จัดการตัดสินรายงาน (อนุมัติให้ปรับยอด หรือปฏิเสธ)
// ตัดสินได้ครั้งเดียว รายงานที่ตัดสินไปแล้วกดซ้ำไม่ได้
func (r *StockDiscrepancyReport) Decide(status ApprovalStatus, note, by string, at time.Time) error {
	if r.ApprovalStatus != ApprovalStatusPending {
		return ErrReportAlreadyDecided
	}
	if status != ApprovalStatusApproved && status != ApprovalStatusRejected {
		return ErrInvalidApprovalStatus
	}
	stamp := at.UTC()
	r.ApprovalStatus = status
	r.Note = note
	r.ResolvedBy = by
	r.ResolvedAt = &stamp
	return nil
}

// FormatCountCode / FormatReportCode — รหัสที่หน้าจอแสดง (SC001 · DR001)
func FormatCountCode(countID int) string   { return fmt.Sprintf("SC%03d", countID) }
func FormatReportCode(reportID int) string { return fmt.Sprintf("DR%03d", reportID) }
