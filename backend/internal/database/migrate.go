// migrate.go — สร้างตารางและข้อจำกัดของ schema
//
// AutoMigrate สร้างตาราง/คอลัมน์/FK จาก struct tag ได้ แต่ทำ 3 อย่างนี้ไม่ได้ จึงเขียน SQL เพิ่ม:
//  1. CHECK constraint ของคอลัมน์ enum (เก็บเป็น varchar ไม่ใช่ native type เพื่อให้แก้ค่าภายหลังง่าย)
//  2. unique index แบบ case-insensitive บนชื่อบริษัท (กฎตรวจซ้ำของ U1)
//  3. view warehouse_staff / store_manager ให้ชื่อครบตามตาราง schema 15 แถวในเอกสาร
package database

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// entities — เรียงตามลำดับตาราง schema ในเอกสารที่ส่งอาจารย์
// ตารางแม่ต้องมาก่อนตารางลูกเสมอ เพราะ FK อ้างถึงกัน
var entities = []any{
	&model.Book{},
	&model.Employee{},
	&model.Supplier{},
	&model.SupplierBook{},
	&model.SupplierEditLog{},
	&model.SupplierDeactivation{},
	&model.PurchaseRequisition{},
	&model.PurchaseRequisitionItem{},
	&model.PurchaseOrder{},
	&model.PurchaseOrderItem{},
	&model.GoodsReceipt{},
	&model.GoodsReceiptItem{},
	&model.PurchaseReturn{},
	&model.PurchaseReturnItem{},
	&model.InventoryItem{},
	&model.StockTransaction{},
	&model.Notification{},
}

// Migrate — สร้าง schema ทั้งหมดให้พร้อมใช้งาน (รันซ้ำได้ ไม่ทำลายข้อมูลเดิม)
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(entities...); err != nil {
		return fmt.Errorf("สร้างตารางไม่สำเร็จ: %w", err)
	}
	if err := applyChecks(db); err != nil {
		return err
	}
	if err := applyIndexes(db); err != nil {
		return err
	}
	if err := applyForeignKeys(db); err != nil {
		return err
	}
	return applyViews(db)
}

// foreignKey — คอลัมน์หนึ่งที่ชี้ไปยังคีย์หลักของอีกตาราง
type foreignKey struct {
	table, column string
	refTable      string
	refColumn     string
}

// foreignKeys — FK ที่ AutoMigrate สร้างให้ไม่ได้ ต้องยิง SQL เอง
//
// สองกรณีที่ตกหล่น:
//  1. association (→) ของ class diagram ที่โค้ดเก็บเป็น FK id เปล่า ๆ ตามกติกาของโปรเจกต์
//     GORM ไม่รู้ว่าเป็นความสัมพันธ์ จึงไม่สร้าง constraint ให้
//  2. ความสัมพันธ์ที่ GORM เดาทิศทางผิดจนต้องปิดด้วย `-:migration`
//     (เช่น SupplierBook.Book — ทั้งสอง struct มีฟิลด์ชื่อ BookID เหมือนกัน)
var foreignKeys = []foreignKey{
	{"supplier_book", "book_id", "book", "book_id"},
}

// applyForeignKeys — เพิ่ม FK แบบรันซ้ำได้
//
// PostgreSQL ไม่มี ADD CONSTRAINT IF NOT EXISTS จึงต้องห่อด้วยบล็อก DO
// แล้วกลืน duplicate_object ทิ้ง · ต้องรันหลังข้อมูลพร้อมแล้วเสมอ
// ไม่งั้นแถวที่ค่าอ้างอิงยังว่างจะทำให้สร้าง constraint ไม่ผ่าน
func applyForeignKeys(db *gorm.DB) error {
	for _, fk := range foreignKeys {
		name := fmt.Sprintf("fk_%s_%s", fk.table, fk.column)
		statement := fmt.Sprintf(`DO $$ BEGIN
			ALTER TABLE %s ADD CONSTRAINT %s
			FOREIGN KEY (%s) REFERENCES %s(%s);
		EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			fk.table, name, fk.column, fk.refTable, fk.refColumn)
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("สร้าง foreign key %s ไม่สำเร็จ: %w", name, err)
		}
	}
	return nil
}

// enumCheck — คอลัมน์หนึ่งกับชุดค่าที่ยอมรับ
type enumCheck struct {
	table  string
	column string
	values []string
}

func checks() []enumCheck {
	return []enumCheck{
		{"supplier", "status", values(model.SupplierStatusActive, model.SupplierStatusCancelled)},
		{"book", "status", values(model.BookStatusActive, model.BookStatusInactive)},
		{"employee", "role", values(model.RoleWarehouse, model.RoleManager, model.RoleSales, model.RoleDelivery)},
		{"purchase_requisition", "status", values(
			model.PRStatusDraft, model.PRStatusSubmitted, model.PRStatusApproved, model.PRStatusRejected)},
		{"purchase_order", "status", values(
			model.POStatusPendingApproval, model.POStatusApproved, model.POStatusConfirmed,
			model.POStatusReceivedPartial, model.POStatusReceivedFull, model.POStatusReturned,
			model.POStatusCancelled)},
		{"goods_receipt", "status", values(model.GRStatusPartial, model.GRStatusFull)},
		{"goods_receipt_item", "condition", values(model.ItemConditionNormal, model.ItemConditionDamaged)},
		{"purchase_return", "status", values(
			model.ReturnStatusTracking, model.ReturnStatusEscalated, model.ReturnStatusClosed)},
		{"stock_transaction", "type", values(
			model.StockTxnTypeReceiveIn, model.StockTxnTypeSaleOut,
			model.StockTxnTypeReturn, model.StockTxnTypeAdjustment)},
		{"notification", "channel", values(model.ChannelInApp, model.ChannelEmail)},
	}
}

// values — แปลง enum เป็น string ลิสต์สำหรับใส่ใน SQL
func values[T ~string](items ...T) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = string(item)
	}
	return out
}

func applyChecks(db *gorm.DB) error {
	for _, check := range checks() {
		name := fmt.Sprintf("chk_%s_%s", check.table, check.column)

		quoted := make([]string, len(check.values))
		for i, v := range check.values {
			quoted[i] = "'" + v + "'"
		}

		// DROP ก่อนเสมอ เพื่อให้รัน migrate ซ้ำได้หลังเพิ่มค่า enum ใหม่
		drop := fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s", check.table, name)
		if err := db.Exec(drop).Error; err != nil {
			return fmt.Errorf("ลบ constraint %s ไม่สำเร็จ: %w", name, err)
		}

		add := fmt.Sprintf("ALTER TABLE %s ADD CONSTRAINT %s CHECK (%s IN (%s))",
			check.table, name, check.column, strings.Join(quoted, ", "))
		if err := db.Exec(add).Error; err != nil {
			return fmt.Errorf("สร้าง constraint %s ไม่สำเร็จ: %w", name, err)
		}
	}

	// compensation_type ว่างได้ (ใบส่งคืนที่ยังไม่ปิดรายการ) จึงตรวจแยกโดยยอม NULL
	compensation := `ALTER TABLE purchase_return DROP CONSTRAINT IF EXISTS chk_purchase_return_compensation_type`
	if err := db.Exec(compensation).Error; err != nil {
		return err
	}
	add := `ALTER TABLE purchase_return ADD CONSTRAINT chk_purchase_return_compensation_type
	        CHECK (compensation_type IS NULL OR compensation_type = ''
	               OR compensation_type IN ('REPLACEMENT', 'CREDIT_NOTE'))`
	if err := db.Exec(add).Error; err != nil {
		return fmt.Errorf("สร้าง constraint ของ compensation_type ไม่สำเร็จ: %w", err)
	}

	// จำนวนต้องไม่ติดลบ — กันข้อมูลเพี้ยนระดับฐานข้อมูล ไม่ได้พึ่ง service อย่างเดียว
	guards := []string{
		`ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS chk_inventory_item_qty_non_negative`,
		`ALTER TABLE inventory_item ADD CONSTRAINT chk_inventory_item_qty_non_negative
		 CHECK (quantity_on_hand >= 0)`,
		`ALTER TABLE purchase_order_item DROP CONSTRAINT IF EXISTS chk_purchase_order_item_qty`,
		`ALTER TABLE purchase_order_item ADD CONSTRAINT chk_purchase_order_item_qty
		 CHECK (quantity > 0 AND received_qty >= 0)`,
		`ALTER TABLE purchase_requisition_item DROP CONSTRAINT IF EXISTS chk_purchase_requisition_item_qty`,
		`ALTER TABLE purchase_requisition_item ADD CONSTRAINT chk_purchase_requisition_item_qty
		 CHECK (quantity > 0)`,
	}
	for _, statement := range guards {
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("สร้าง constraint จำนวนไม่สำเร็จ: %w", err)
		}
	}
	return nil
}

func applyIndexes(db *gorm.DB) error {
	// U1: ตรวจชื่อบริษัทซ้ำแบบไม่สนตัวพิมพ์และช่องว่างหัวท้าย
	// เป็น unique index จริงในฐานข้อมูล เพื่อกันการยิงพร้อมกันสองครั้งเล็ดลอดผ่าน service
	statements := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_company_name
		 ON supplier (lower(btrim(company_name)))`,
		// SCR-22 กรองเอกสารตามผู้จัดจำหน่ายและสถานะพร้อมกันบ่อย
		`CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier_status
		 ON purchase_order (supplier_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_purchase_requisition_supplier_status
		 ON purchase_requisition (supplier_id, status)`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("สร้าง index ไม่สำเร็จ: %w", err)
		}
	}
	return nil
}

// applyViews — ตาราง schema ในเอกสารแยก WarehouseStaff กับ StoreManager เป็นคนละตาราง
// โค้ดใช้ตาราง employee ตารางเดียว (single-table inheritance) แล้วเปิด view สองตัวทับ
// เพื่อให้ชื่อที่เห็นในฐานข้อมูลตรงกับเอกสาร และ query ตามบทบาทได้ตรง ๆ
func applyViews(db *gorm.DB) error {
	statements := []string{
		`CREATE OR REPLACE VIEW warehouse_staff AS
		 SELECT employee_id, first_name, last_name, phone, email
		 FROM employee WHERE role = 'warehouse'`,
		`CREATE OR REPLACE VIEW store_manager AS
		 SELECT employee_id, first_name, last_name, phone, email
		 FROM employee WHERE role = 'manager'`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("สร้าง view ไม่สำเร็จ: %w", err)
		}
	}
	return nil
}
