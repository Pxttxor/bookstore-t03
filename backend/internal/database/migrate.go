// migrate.go — สร้างตารางและข้อจำกัดของ schema
//
// AutoMigrate สร้างตาราง/คอลัมน์/FK จาก struct tag ได้ แต่ทำ 3 อย่างนี้ไม่ได้ จึงเขียน SQL เพิ่ม:
//  1. CHECK constraint ของคอลัมน์ enum (เก็บเป็น varchar ไม่ใช่ native type เพื่อให้แก้ค่าภายหลังง่าย)
//  2. unique index แบบ case-insensitive บนชื่อบริษัท (กฎตรวจซ้ำของ U1)
//  3. view warehouse_staff / store_manager ให้ชื่อครบตามตาราง schema 15 แถวในเอกสาร
package database

import (
	"fmt"
	"log"
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// entities — เรียงตามลำดับตาราง schema ในเอกสารที่ส่งอาจารย์
// ตารางแม่ต้องมาก่อนตารางลูกเสมอ เพราะ FK อ้างถึงกัน
var entities = []any{
	&model.Person{},
	&model.Category{},
	&model.Book{},
	&model.BookChangeLog{},
	&model.Employee{},
	&model.Customer{},
	&model.UserAccount{},
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
	&model.StockCount{},
	&model.StockDiscrepancyReport{},
	&model.StockCountItem{},
	&model.Promotion{},
	&model.Order{},
	&model.OrderItem{},
	&model.OrderStatusHistory{},
	&model.Bank{},
	&model.Payment{},
	&model.PaymentReport{},
	&model.ShippingCompany{},
	&model.Shipment{},
	&model.ShipmentTracking{},
	&model.DeliverySummary{},
	&model.MembershipTier{},
	&model.Member{},
	&model.PointTransaction{},
	&model.Reward{},
	&model.Redemption{},
	&model.Review{},
	&model.ReviewReply{},
	&model.ReviewReport{},
	&model.Notification{},
}

// Migrate — สร้าง schema ทั้งหมดให้พร้อมใช้งาน (รันซ้ำได้ ไม่ทำลายข้อมูลเดิม)
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(entities...); err != nil {
		return fmt.Errorf("สร้างตารางไม่สำเร็จ: %w", err)
	}
	if err := backfillPersons(db); err != nil {
		return err
	}
	if err := backfillBookCategories(db); err != nil {
		return err
	}
	if err := backfillCarriers(db); err != nil {
		return err
	}
	if err := backfillTiers(db); err != nil {
		return err
	}
	if err := backfillMembers(db); err != nil {
		return err
	}
	if err := applyChecks(db); err != nil {
		return err
	}
	if err := dedupeShipmentTracking(db); err != nil {
		return err
	}
	if err := applyIndexes(db); err != nil {
		return err
	}
	if err := applyForeignKeys(db); err != nil {
		return err
	}
	if err := db.Exec(`ALTER TABLE shipment_tracking ALTER COLUMN update_date TYPE timestamptz(0)`).Error; err != nil {
		return fmt.Errorf("ปรับความละเอียด update_date ไม่สำเร็จ: %w", err)
	}
	backfillTrackingLocations := `
		UPDATE shipment_tracking SET location = 'คลังสินค้า BookHaven' WHERE status = 'PREPARING' AND (location IS NULL OR trim(location) = '');
		UPDATE shipment_tracking SET location = 'ศูนย์คัดแยกพัสดุ' WHERE status = 'SHIPPED' AND (location IS NULL OR trim(location) = '');
		UPDATE shipment_tracking st SET location = CASE WHEN trim(co.shipping_address) <> '' THEN substring(trim(co.shipping_address) from 1 for 200) ELSE 'ปลายทางผู้รับ' END
		FROM shipment s JOIN customer_order co ON co.order_id = s.order_id
		WHERE st.shipment_id = s.shipment_id AND st.status = 'DELIVERED' AND (st.location IS NULL OR trim(st.location) = '');
	`
	if err := db.Exec(backfillTrackingLocations).Error; err != nil {
		return fmt.Errorf("เติมค่า location พัสดุไม่สำเร็จ: %w", err)
	}
	if err := db.Exec(`ALTER TABLE review DROP COLUMN IF EXISTS headline`).Error; err != nil {
		return fmt.Errorf("ลบคอลัมน์ headline ออกจาก review ไม่สำเร็จ: %w", err)
	}
	if err := db.Exec(`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS customer_phone varchar(50)`).Error; err != nil {
		return fmt.Errorf("เพิ่มคอลัมน์ customer_phone ใน customer_order ไม่สำเร็จ: %w", err)
	}
	backfillCustomerPhone := `
		UPDATE customer_order co
		SET customer_phone = p.phone
		FROM customer c
		JOIN person p ON c.person_id = p.person_id
		WHERE co.customer_id = c.customer_id
		  AND (co.customer_phone IS NULL OR co.customer_phone = '')
		  AND p.phone IS NOT NULL AND p.phone != '';
	`
	if err := db.Exec(backfillCustomerPhone).Error; err != nil {
		return fmt.Errorf("เติมค่า customer_phone ใน customer_order ไม่สำเร็จ: %w", err)
	}
	orderColumns := []string{
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS out_of_stock_note text`,
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS restock_estimate varchar(100)`,
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS restock_date date`,
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS customer_choice varchar(50)`,
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS replacement_book_id integer`,
		`ALTER TABLE customer_order ADD COLUMN IF NOT EXISTS replacement_note text`,
	}
	for _, stmt := range orderColumns {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("เพิ่มคอลัมน์ใน customer_order ไม่สำเร็จ (%s): %w", stmt, err)
		}
	}
	return applyViews(db)
}

// backfillPersons — เติมแถวใน person ให้พนักงานที่ยังไม่มี แล้วผูก employee.person_id
//
// จำเป็นเพราะ person ถูกเพิ่มทีหลัง ตอนที่ตาราง employee มีข้อมูลอยู่แล้ว
// AutoMigrate เพิ่มคอลัมน์ NOT NULL บนตารางที่มีข้อมูลไม่ได้ (ADD COLUMN ... NOT NULL
// without default → ERROR: column contains null values) จึงต้อง
// ประกาศฟิลด์แบบ nullable → เติมค่า → ค่อยบังคับ NOT NULL ที่นี่
//
// รันซ้ำได้: แถวที่ผูกแล้วจะไม่ถูกแตะ และการบังคับ NOT NULL ทำเฉพาะเมื่อไม่เหลือค่าว่าง
func backfillPersons(db *gorm.DB) error {
	// อีเมลของ employee เป็น unique index อยู่แล้ว จึงใช้เป็นกุญแจจับคู่ได้ปลอดภัย
	insert := `INSERT INTO person (first_name, last_name, phone, email)
	           SELECT e.first_name, e.last_name, e.phone, e.email
	           FROM employee e
	           WHERE (e.person_id IS NULL OR e.person_id = 0)
	             AND NOT EXISTS (SELECT 1 FROM person p WHERE lower(p.email) = lower(e.email))`
	if err := db.Exec(insert).Error; err != nil {
		return fmt.Errorf("สร้างแถว person ให้พนักงานไม่สำเร็จ: %w", err)
	}

	link := `UPDATE employee e SET person_id = p.person_id
	         FROM person p
	         WHERE (e.person_id IS NULL OR e.person_id = 0)
	           AND lower(p.email) = lower(e.email)`
	if err := db.Exec(link).Error; err != nil {
		return fmt.Errorf("ผูก employee เข้ากับ person ไม่สำเร็จ: %w", err)
	}

	// บังคับ NOT NULL เฉพาะเมื่อเติมครบแล้ว ไม่งั้น migrate จะล้มทั้งชุดเพราะข้อมูลเก่าแถวเดียว
	var orphans int64
	if err := db.Model(&model.Employee{}).
		Where("person_id IS NULL OR person_id = 0").Count(&orphans).Error; err != nil {
		return fmt.Errorf("นับพนักงานที่ยังไม่มี person ไม่สำเร็จ: %w", err)
	}
	if orphans > 0 {
		return fmt.Errorf("ยังมีพนักงาน %d รายที่ผูกกับ person ไม่ได้ (อีเมลซ้ำหรือว่าง)", orphans)
	}

	statements := []string{
		`ALTER TABLE employee ALTER COLUMN person_id SET NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_person ON employee (person_id)`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("บังคับความสัมพันธ์ employee → person ไม่สำเร็จ: %w", err)
		}
	}
	return nil
}

// backfillBookCategories — เติม book.category_id ให้ข้อมูลเดิม แล้วบังคับ NOT NULL
//
// เหตุผลเดียวกับ backfillPersons: คอลัมน์ถูกเพิ่มทีหลังตอนที่ตาราง book มีหนังสือ 23 เล่มอยู่แล้ว
// จึงประกาศฟิลด์แบบ nullable แล้วมาเติมค่าที่นี่
//
// ต่างกันตรงที่คราวนี้ FK ต้องมีปลายทางอยู่ก่อน — applyForeignKeys จะสร้าง
// book.category_id → category ไม่ผ่านถ้าตาราง category ยังว่าง จึงใส่หมวดหมู่ตั้งต้นให้ด้วย
// (Seed จะข้ามไปเองเพราะตรวจความว่างเป็นรายตาราง)
//
// รันซ้ำได้: แถวที่มีค่าแล้วไม่ถูกแตะ และบังคับ NOT NULL เฉพาะเมื่อไม่เหลือค่าว่าง
func backfillBookCategories(db *gorm.DB) error {
	var books int64
	if err := db.Model(&model.Book{}).Count(&books).Error; err != nil {
		return fmt.Errorf("นับหนังสือไม่สำเร็จ: %w", err)
	}

	if books > 0 {
		var categories int64
		if err := db.Model(&model.Category{}).Count(&categories).Error; err != nil {
			return fmt.Errorf("นับหมวดหมู่ไม่สำเร็จ: %w", err)
		}
		if categories == 0 {
			rows := make([]model.Category, len(seedCategories))
			copy(rows, seedCategories)
			if err := db.Create(&rows).Error; err != nil {
				return fmt.Errorf("ใส่หมวดหมู่ตั้งต้นไม่สำเร็จ: %w", err)
			}
		}

		// ค่าที่ถูกต้องอยู่ในข้อมูลตั้งต้นอยู่แล้ว (คัดมาจาก SEED_BOOKS ของ frontend)
		for _, book := range seedBooks {
			err := db.Model(&model.Book{}).
				Where("book_id = ? AND (category_id IS NULL OR category_id = 0)", book.BookID).
				Update("category_id", book.CategoryID).Error
			if err != nil {
				return fmt.Errorf("เติมหมวดหมู่ให้หนังสือ %d ไม่สำเร็จ: %w", book.BookID, err)
			}
		}
	}

	var orphans int64
	if err := db.Model(&model.Book{}).
		Where("category_id IS NULL OR category_id = 0").Count(&orphans).Error; err != nil {
		return fmt.Errorf("นับหนังสือที่ยังไม่มีหมวดหมู่ไม่สำเร็จ: %w", err)
	}
	if orphans > 0 {
		return fmt.Errorf("ยังมีหนังสือ %d เล่มที่ไม่มีหมวดหมู่ (ไม่อยู่ในข้อมูลตั้งต้น)", orphans)
	}
	if err := db.Exec(`ALTER TABLE book ALTER COLUMN category_id SET NOT NULL`).Error; err != nil {
		return fmt.Errorf("บังคับความสัมพันธ์ book → category ไม่สำเร็จ: %w", err)
	}
	return nil
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
	{"book", "category_id", "category", "category_id"},
	{"book_change_log", "book_id", "book", "book_id"},
	{"stock_count_item", "book_id", "book", "book_id"},
	{"stock_count_item", "report_id", "stock_discrepancy_report", "report_id"},
	{"stock_discrepancy_report", "count_id", "stock_count", "count_id"},
	{"stock_discrepancy_report", "book_id", "book", "book_id"},
	{"customer_order", "customer_id", "customer", "customer_id"},
	{"customer_order", "promotion_id", "promotion", "promotion_id"},
	{"customer_order", "replacement_book_id", "book", "book_id"},
	{"customer_order_item", "book_id", "book", "book_id"},
	{"payment", "order_id", "customer_order", "order_id"},
	{"payment", "bank_id", "bank", "bank_id"},
	{"shipment", "order_id", "customer_order", "order_id"},
	{"shipment", "carrier_id", "shipping_company", "carrier_id"},
	{"shipment_tracking", "shipment_id", "shipment", "shipment_id"},
	{"member", "customer_id", "customer", "customer_id"},
	{"member", "tier_id", "membership_tier", "tier_id"},
	{"point_transaction", "member_id", "member", "member_id"},
	{"point_transaction", "order_id", "customer_order", "order_id"},
	{"redemption", "member_id", "member", "member_id"},
	{"redemption", "reward_id", "reward", "reward_id"},
	{"redemption", "order_id", "customer_order", "order_id"},
	{"employee", "person_id", "person", "person_id"},
	{"customer", "person_id", "person", "person_id"},
	{"user_account", "person_id", "person", "person_id"},
	{"review", "customer_id", "customer", "customer_id"},
	{"review", "book_id", "book", "book_id"},
	{"review", "order_id", "customer_order", "order_id"},
	{"review_reply", "review_id", "review", "review_id"},
	{"review_report", "review_id", "review", "review_id"},
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
		// ห้ามใส่ RoleCustomer — ลูกค้าไม่ใช่พนักงาน อยู่คนละตาราง
		{"employee", "role", values(model.EmployeeRoles()...)},
		{"user_account", "status", values(
			model.AccountStatusUnverified, model.AccountStatusActive, model.AccountStatusSuspended)},
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
		{"stock_count", "status", values(
			model.StockCountStatusDraft, model.StockCountStatusDone)},
		{"stock_discrepancy_report", "approval_status", values(
			model.ApprovalStatusPending, model.ApprovalStatusApproved, model.ApprovalStatusRejected)},
		{"customer_order", "channel", values(
			model.OrderChannelWebsite, model.OrderChannelMessage, model.OrderChannelPhone)},
		{"customer_order", "status", values(model.OrderStatuses()...)},
		{"customer_order_status_history", "status", values(model.OrderStatuses()...)},
		{"promotion", "type", values(
			model.PromotionTypeFestival, model.PromotionTypeCoupon, model.PromotionTypeBuyXQty)},
		{"promotion", "status", values(
			model.PromotionStatusActive, model.PromotionStatusInactive, model.PromotionStatusExpired)},
		{"payment", "status", values(
			model.PaymentStatusWaiting, model.PaymentStatusVerifying,
			model.PaymentStatusSuccess, model.PaymentStatusRejected)},
		{"shipment", "status", values(model.ShipmentStatuses()...)},
		{"shipment_tracking", "status", values(model.ShipmentStatuses()...)},
		{"point_transaction", "type", values(model.PointTxnTypes()...)},
		{"reward", "type", values(model.RewardTypes()...)},
		{"review", "status", values(model.ReviewStatuses()...)},
		{"review_report", "status", values(
			model.ApprovalStatusPending, model.ApprovalStatusApproved, model.ApprovalStatusRejected)},
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
		// คะแนนรีวิวเป็น 1–5 ดาว — เป็นช่วงตัวเลข ไม่ใช่ enum จึงตรวจแยกจาก checks()
		`ALTER TABLE review DROP CONSTRAINT IF EXISTS chk_review_rating`,
		`ALTER TABLE review ADD CONSTRAINT chk_review_rating
		 CHECK (rating BETWEEN 1 AND 5)`,
	}
	for _, statement := range guards {
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("สร้าง constraint จำนวนไม่สำเร็จ: %w", err)
		}
	}
	return nil
}

// dedupeShipmentTracking — ปลดล็อก uq_shipment_tracking_number (applyIndexes ข้างล่าง)
// บนฐานที่มีอยู่ก่อน commit 3f87b9e (PR #44) ซึ่งเป็นจุดแรกที่ service เริ่มกันเลขพัสดุซ้ำ
// (TrackingExists) — แถวที่พิมพ์เลขซ้ำผ่านหน้าจอก่อนหน้านั้นยังค้างอยู่ในฐานเก่า ทำให้สร้าง
// unique index ไม่ผ่าน (23505) ฟังก์ชันนี้เก็บแถว shipment_id น้อยที่สุดของแต่ละเลขไว้ตามเดิม
// ส่วนแถวที่เหลือต่อท้ายด้วย -DUP<shipment_id> ให้ไม่ชนกันเอง (ID ไม่ซ้ำ) แล้วรออัปเดตเป็นเลขจริง
// จากหน้าจัดส่ง — รันซ้ำได้ รอบสองกระทบ 0 แถว
func dedupeShipmentTracking(db *gorm.DB) error {
	type renamedShipment struct {
		ShipmentID     int
		TrackingNumber string
	}
	const statement = `
		WITH dup AS (
			SELECT shipment_id,
			       row_number() OVER (PARTITION BY btrim(tracking_number) ORDER BY shipment_id) AS seq
			FROM shipment
		)
		UPDATE shipment s
		SET tracking_number = left(btrim(s.tracking_number), 88) || '-DUP' || s.shipment_id
		FROM dup
		WHERE dup.shipment_id = s.shipment_id AND dup.seq > 1
		RETURNING s.shipment_id, s.tracking_number`

	var renamed []renamedShipment
	if err := db.Raw(statement).Scan(&renamed).Error; err != nil {
		return fmt.Errorf("แก้เลขพัสดุซ้ำไม่สำเร็จ: %w", err)
	}
	for _, row := range renamed {
		log.Printf("[migrate] เลขพัสดุซ้ำ — เปลี่ยนพัสดุ %d เป็น %q แล้ว กรุณาแก้เป็นเลขจริงในหน้าจัดส่ง",
			row.ShipmentID, row.TrackingNumber)
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
		// อีเมลกับชื่อผู้ใช้ต้องไม่ซ้ำแบบไม่สนตัวพิมพ์ — เป็นกุญแจที่ใช้ค้นตอนล็อกอิน
		// ชื่อหมวดหมู่ต้องไม่ซ้ำ กติกาเดียวกับชื่อบริษัทของผู้จัดจำหน่าย
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name ON category (lower(btrim(name)))`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_person_email ON person (lower(email))`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_username ON user_account (lower(username))`,
		// ชื่อระดับสมาชิกห้ามซ้ำ (กติกาเดียวกับชื่อหมวดหมู่) · รหัสคูปองต้องไม่ชนกันเด็ดขาด
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_tier_name
		 ON membership_tier (lower(btrim(name)))`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_coupon_code ON redemption (coupon_code)`,
		// ลูกค้าหนึ่งคนรีวิวหนังสือเล่มหนึ่งได้ครั้งเดียวต่อคำสั่งซื้อหนึ่งใบ
		// Postgres นับ NULL เป็นค่าไม่ซ้ำกัน แถวเก่าที่ไม่มีใบสั่งซื้อ (0..1 ใน diagram)
		// จึงไม่ติด constraint นี้ — ตรงกับที่ต้องการพอดี
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_review_customer_book_order
		 ON review (customer_id, book_id, order_id)`,
		// เลขพัสดุห้ามซ้ำข้ามคำสั่งซื้อ — service ตรวจให้ก่อนแล้ว index นี้กันการยิงพร้อมกันเล็ดลอด
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_tracking_number ON shipment (btrim(tracking_number))`,
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
	// ต้อง DROP ก่อนเสมอ — CREATE OR REPLACE VIEW เปลี่ยนชุดคอลัมน์ไม่ได้
	// (เพิ่ม person_id เข้าไปจะได้ ERROR: cannot change name of view column)
	roles := []struct{ view, role string }{
		{"warehouse_staff", string(model.RoleWarehouse)},
		{"store_manager", string(model.RoleManager)},
		{"sales_staff", string(model.RoleSales)},
		{"delivery_staff", string(model.RoleDelivery)},
	}
	for _, r := range roles {
		if err := db.Exec("DROP VIEW IF EXISTS " + r.view).Error; err != nil {
			return fmt.Errorf("ลบ view %s ไม่สำเร็จ: %w", r.view, err)
		}
		create := fmt.Sprintf(
			`CREATE VIEW %s AS
			 SELECT employee_id, person_id, first_name, last_name, phone, email
			 FROM employee WHERE role = '%s'`, r.view, r.role)
		if err := db.Exec(create).Error; err != nil {
			return fmt.Errorf("สร้าง view %s ไม่สำเร็จ: %w", r.view, err)
		}
	}
	return nil
}

// backfillCarriers — ใส่บริษัทขนส่งตั้งต้นให้ก่อนถ้าตารางยังว่าง
//
// เหตุผลเดียวกับ backfillBookCategories: Migrate รันก่อน Seed เสมอ ถ้าฐานเดิมมีแถว shipment
// อยู่แล้วแต่ shipping_company ยังว่าง constraint `shipment.carrier_id → shipping_company`
// จะสร้างไม่ผ่าน · ข้อมูลชุดเต็มยังมาจาก seedCarriers เหมือนเดิม
func backfillCarriers(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.ShippingCompany{}).Count(&count).Error; err != nil {
		return fmt.Errorf("นับบริษัทขนส่งไม่สำเร็จ: %w", err)
	}
	if count > 0 {
		return nil
	}
	if err := db.Create(&seedCarriers).Error; err != nil {
		return fmt.Errorf("ใส่บริษัทขนส่งตั้งต้นไม่สำเร็จ: %w", err)
	}
	return nil
}

// backfillTiers — ใส่ระดับสมาชิกตั้งต้นให้ก่อนถ้าตารางยังว่าง
//
// เหตุผลเดียวกับ backfillCarriers/backfillBookCategories: Migrate รันก่อน Seed เสมอ
// ถ้ามีแถว member อยู่แล้วแต่ membership_tier ยังว่าง constraint `member.tier_id`
// จะสร้างไม่ผ่าน · และ backfillMembers ข้างล่างก็ต้องมีระดับให้เลือกก่อนด้วย
func backfillTiers(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.MembershipTier{}).Count(&count).Error; err != nil {
		return fmt.Errorf("นับระดับสมาชิกไม่สำเร็จ: %w", err)
	}
	if count > 0 {
		return nil
	}
	rows := make([]model.MembershipTier, len(seedTiers))
	copy(rows, seedTiers)
	if err := db.Create(&rows).Error; err != nil {
		return fmt.Errorf("ใส่ระดับสมาชิกตั้งต้นไม่สำเร็จ: %w", err)
	}
	return nil
}

// backfillMembers — เปิดแถวสมาชิกให้ลูกค้าที่ยังไม่มี (ระดับต่ำสุด แต้ม 0)
//
// ลูกค้าทุกคนเป็นสมาชิกตั้งแต่ P7 เป็นต้นไป (ดู PersonService.enroll) แต่ลูกค้าที่สมัคร
// ไว้ก่อนหน้านั้นยังไม่มีแถว · ตัวนี้ตามเก็บให้บนฐานเดิม ส่วนฐานเปล่าจะได้ข้อมูลตัวอย่าง
// จาก seedMemberRows แทน — คู่เดียวกับ backfillPersons() กับ seedEmployeeRows()
//
// รันซ้ำได้: ลูกค้าที่มีแถวแล้วไม่ถูกแตะ
func backfillMembers(db *gorm.DB) error {
	var customerIDs []int
	err := db.Model(&model.Customer{}).
		Where("customer_id NOT IN (SELECT customer_id FROM member)").
		Pluck("customer_id", &customerIDs).Error
	if err != nil {
		return fmt.Errorf("หาลูกค้าที่ยังไม่เป็นสมาชิกไม่สำเร็จ: %w", err)
	}
	if len(customerIDs) == 0 {
		return nil
	}

	var tiers []model.MembershipTier
	if err := db.Find(&tiers).Error; err != nil {
		return fmt.Errorf("อ่านระดับสมาชิกไม่สำเร็จ: %w", err)
	}
	tier := model.PickTier(tiers, 0)
	if tier == nil {
		return fmt.Errorf("ไม่มีระดับสมาชิกให้ผูกกับลูกค้า %d ราย", len(customerIDs))
	}

	// วันที่สมัครใช้วันที่ลงทะเบียนของลูกค้า เพื่อไม่ให้ประวัติย้อนหลังดูเหมือนเพิ่งสมัครวันนี้
	rows := make([]model.Member, len(customerIDs))
	for i, customerID := range customerIDs {
		var customer model.Customer
		if err := db.First(&customer, "customer_id = ?", customerID).Error; err != nil {
			return fmt.Errorf("อ่านข้อมูลลูกค้า %d ไม่สำเร็จ: %w", customerID, err)
		}
		joinDate := customer.RegisteredDate
		if joinDate.IsZero() {
			joinDate = model.Today()
		}
		rows[i] = model.Member{CustomerID: customerID, JoinDate: joinDate, TierID: tier.TierID}
	}
	if err := db.Create(&rows).Error; err != nil {
		return fmt.Errorf("เปิดแถวสมาชิกให้ลูกค้าเดิมไม่สำเร็จ: %w", err)
	}
	return nil
}
