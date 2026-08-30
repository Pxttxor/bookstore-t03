// seed.go — ใส่ข้อมูลตั้งต้นลงฐานข้อมูล
//
// ข้อมูลมาจากสองแหล่ง:
//   - seed_data.go       สร้างด้วยสคริปต์จาก SEED_* ของ frontend (ดู tools/gen_seed.py) ห้ามแก้ด้วยมือ
//   - seed_*.go ที่เหลือ เขียนด้วยมือ สำหรับระบบย่อยที่ frontend ยังไม่มีข้อมูลตั้งต้นให้
//
// ตรวจความว่างเป็น "รายตาราง" ไม่ใช่ทั้งก้อน — เพราะระบบถูกสร้างทีละเฟส
// ถ้าเช็คทั้งก้อน พอเฟสแรก seed ไปแล้ว เฟสถัดไปสั่ง -seed จะไม่ได้ข้อมูลของตัวเองเลย
// ตารางที่มีข้อมูลอยู่แล้วจะถูกข้าม ไม่ทับของที่ผู้ใช้ทดสอบไว้
package database

import (
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// รหัสผ่านของบัญชีพนักงานทั้งสี่ ตรงกับที่หน้าจอ dev ใช้ทดสอบ
// ต่างจากฝั่ง frontend ตรงที่ backend เก็บเป็น bcrypt hash ไม่ใช่ plaintext
const seedPassword = "staff1234"

// ผู้ทำรายการของเอกสารตั้งต้นทั้งหมด — พนักงานคลังสินค้า
const (
	seedWarehouseID   = "EMP-WH-01"
	seedWarehouseName = "สมชาย ใจดี"
)

// seedEmployees — บัญชีพนักงาน 4 บทบาท (ชื่อ/อีเมลตรงกับ AuthContext ของ frontend)
var seedEmployees = []model.Employee{
	{EmployeeID: seedWarehouseID, FirstName: "สมชาย", LastName: "ใจดี",
		Email: "warehouse@bookhaven.co.th", Phone: "081-100-1001", Role: model.RoleWarehouse},
	{EmployeeID: "EMP-MG-01", FirstName: "ปิยะพร", LastName: "วงศ์ทอง",
		Email: "manager@bookhaven.co.th", Phone: "081-100-1002", Role: model.RoleManager},
	{EmployeeID: "EMP-SL-01", FirstName: "ณัฐวุฒิ", LastName: "แสงจันทร์",
		Email: "sales@bookhaven.co.th", Phone: "081-100-1003", Role: model.RoleSales},
	{EmployeeID: "EMP-DL-01", FirstName: "อรทัย", LastName: "พรมมา",
		Email: "delivery@bookhaven.co.th", Phone: "081-100-1004", Role: model.RoleDelivery},
}

// sequences — คอลัมน์ identity ทุกตัวที่ต้องเลื่อนเลขต่อจากข้อมูลตั้งต้น
// ถ้าไม่ทำ แถวใหม่แถวแรกจะได้ id = 1 แล้วชนกับ id ที่ seed ใส่ไว้ทันที
//
// เพิ่มตารางใหม่ที่มี id อัตโนมัติเมื่อไร ต้องเพิ่มเข้าลิสต์นี้ด้วย
var sequences = []struct{ table, column string }{
	{"person", "person_id"},
	{"customer", "customer_id"},
	{"user_account", "account_id"},
	{"book", "book_id"},
	{"supplier", "supplier_id"},
	{"supplier_edit_log", "log_id"},
	{"purchase_requisition", "pr_id"},
	{"purchase_order", "po_id"},
	{"goods_receipt", "gr_id"},
	{"purchase_return", "return_id"},
	{"inventory_item", "inventory_id"},
	{"stock_transaction", "txn_id"},
	{"notification", "id"},
}

// tableEmpty — ตารางของชนิด T ยังไม่มีข้อมูลเลยหรือไม่
func tableEmpty[T any](tx *gorm.DB, label string) (bool, error) {
	var count int64
	if err := tx.Model(new(T)).Count(&count).Error; err != nil {
		return false, fmt.Errorf("นับข้อมูล%sไม่สำเร็จ: %w", label, err)
	}
	return count == 0, nil
}

// seedIfEmpty — ใส่ข้อมูลตั้งต้นของตารางหนึ่ง ถ้าตารางนั้นยังว่าง
// คืนจำนวนแถวที่ใส่จริง (0 = ข้ามเพราะมีข้อมูลอยู่แล้ว หรือไม่มีข้อมูลตั้งต้นให้ใส่)
func seedIfEmpty[T any](tx *gorm.DB, rows []T, label string) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	empty, err := tableEmpty[T](tx, label)
	if err != nil || !empty {
		return 0, err
	}
	if err := tx.Create(&rows).Error; err != nil {
		return 0, fmt.Errorf("ใส่ข้อมูล%sไม่สำเร็จ: %w", label, err)
	}
	return len(rows), nil
}

// Seed — ใส่ข้อมูลตั้งต้นของตารางที่ยังว่าง
func Seed(db *gorm.DB) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(seedPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("เข้ารหัสรหัสผ่านไม่สำเร็จ: %w", err)
	}

	inserted := map[string]int{}

	err = db.Transaction(func(tx *gorm.DB) error {
		// พนักงาน — ต้องใส่ hash ก่อน จึงคัดลอกออกมาแก้แทนการแก้ตัวแปรระดับแพ็กเกจ
		employees := make([]model.Employee, len(seedEmployees))
		copy(employees, seedEmployees)
		for i := range employees {
			employees[i].PasswordHash = string(hash)
		}
		n, err := seedIfEmpty(tx, employees, "พนักงาน")
		if err != nil {
			return err
		}
		inserted["พนักงาน"] = n

		// ลูกค้าใช้รหัสผ่านคนละตัวกับพนักงาน จึงเข้ารหัสแยกอีกครั้ง
		customerHash, err := bcrypt.GenerateFromPassword([]byte(seedCustomerPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("เข้ารหัสรหัสผ่านลูกค้าไม่สำเร็จ: %w", err)
		}
		if n, err = seedCustomerRows(tx, string(customerHash)); err != nil {
			return err
		}
		inserted["ลูกค้า"] = n

		if n, err = seedIfEmpty(tx, seedBooks, "หนังสือ"); err != nil {
			return err
		}
		inserted["หนังสือ"] = n

		if n, err = seedSupplierRows(tx); err != nil {
			return err
		}
		inserted["ผู้จัดจำหน่าย"] = n

		if n, err = seedInventoryRows(tx); err != nil {
			return err
		}
		inserted["สินค้าคงคลัง"] = n

		if n, err = seedIfEmpty(tx, seedStockTransactions, "ประวัติการเคลื่อนไหวสต็อก"); err != nil {
			return err
		}
		inserted["เคลื่อนไหวสต็อก"] = n

		if n, err = seedIfEmpty(tx, seedRequisitions, "ใบขอสั่งซื้อ"); err != nil {
			return err
		}
		inserted["PR"] = n

		if n, err = seedOrderRows(tx); err != nil {
			return err
		}
		inserted["PO"] = n

		if n, err = seedIfEmpty(tx, seedReceipts, "ใบรับสินค้า"); err != nil {
			return err
		}
		inserted["GR"] = n
		return nil
	})
	if err != nil {
		return err
	}

	if err := resetSequences(db); err != nil {
		return err
	}

	fmt.Printf("[seed] พนักงาน %d · ลูกค้า %d · หนังสือ %d · ผู้จัดจำหน่าย %d · สินค้าคงคลัง %d · เคลื่อนไหวสต็อก %d · PR %d · PO %d · GR %d\n",
		inserted["พนักงาน"], inserted["ลูกค้า"], inserted["หนังสือ"], inserted["ผู้จัดจำหน่าย"],
		inserted["สินค้าคงคลัง"], inserted["เคลื่อนไหวสต็อก"], inserted["PR"], inserted["PO"], inserted["GR"])
	return nil
}

// seedSupplierRows — ผู้จัดจำหน่ายพร้อมรายการหนังสือที่เสนอขายและเหตุผลการปิดใช้งาน
// สร้างทีละรายเพราะแต่ละรายมีตารางลูกไม่เท่ากัน
func seedSupplierRows(tx *gorm.DB) (int, error) {
	empty, err := tableEmpty[model.Supplier](tx, "ผู้จัดจำหน่าย")
	if err != nil || !empty {
		return 0, err
	}
	for _, row := range seedSuppliers {
		supplier := row.Supplier
		supplier.Books = make([]model.SupplierBook, len(row.Offers))
		for i, offer := range row.Offers {
			supplier.Books[i] = model.SupplierBook{
				SupplierID:   supplier.SupplierID,
				BookID:       offer.BookID,
				SupplyPrice:  offer.SupplyPrice,
				LeadTimeDays: offer.LeadTimeDays,
			}
		}
		if row.Deactivation != nil {
			supplier.Deactivation = row.Deactivation
		}
		if err := tx.Create(&supplier).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลผู้จัดจำหน่าย %d ไม่สำเร็จ: %w", supplier.SupplierID, err)
		}
	}
	return len(seedSuppliers), nil
}

// seedInventoryRows — ยอดคงเหลือตั้งต้น (เวลาอัปเดตล่าสุดใช้ค่าเดียวกันทั้งชุด)
func seedInventoryRows(tx *gorm.DB) (int, error) {
	lastUpdated := mustTime("2026-08-01T02:00:00.000Z")
	rows := make([]model.InventoryItem, len(seedInventory))
	for i, row := range seedInventory {
		rows[i] = model.InventoryItem{
			InventoryID:    row.InventoryID,
			BookID:         row.BookID,
			QuantityOnHand: row.QuantityOnHand,
			ReorderPoint:   row.ReorderPoint,
			LastUpdated:    lastUpdated,
		}
	}
	return seedIfEmpty(tx, rows, "สินค้าคงคลัง")
}

// seedOrderRows — ใบสั่งซื้อ ยอดรวมไม่ได้เก็บใน seed จึงคำนวณจากรายการเหมือนตอนใช้งานจริง
func seedOrderRows(tx *gorm.DB) (int, error) {
	rows := make([]model.PurchaseOrder, len(seedOrders))
	copy(rows, seedOrders)
	for i := range rows {
		rows[i].RecalculateTotal()
	}
	return seedIfEmpty(tx, rows, "ใบสั่งซื้อ")
}

// resetSequences — เลื่อน sequence ของทุกคอลัมน์ identity ให้เริ่มต่อจาก id สูงสุดที่มีอยู่
// ตารางที่ยังว่าง setval(..., 1, false) จะทำให้แถวแรกได้ id = 1 ตามปกติ
func resetSequences(db *gorm.DB) error {
	for _, seq := range sequences {
		statement := fmt.Sprintf(
			`SELECT setval(pg_get_serial_sequence('%s', '%s'),
			                COALESCE((SELECT MAX(%s) FROM %s), 1),
			                (SELECT COUNT(*) FROM %s) > 0)`,
			seq.table, seq.column, seq.column, seq.table, seq.table)
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("ตั้งค่า sequence ของ %s.%s ไม่สำเร็จ: %w", seq.table, seq.column, err)
		}
	}
	return nil
}

// ── ตัวช่วยที่ seed_data.go เรียกใช้ ─────────────────────────────────────

func intPtr(v int) *int              { return &v }
func timePtr(t time.Time) *time.Time { return &t }

// mustTime — แปลง ISO-8601 ของ frontend เป็น time.Time (ข้อมูลตั้งต้นคงที่ ผิดคือบั๊กของโค้ด)
func mustTime(value string) time.Time {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(fmt.Sprintf("seed: เวลา %q ไม่ถูกรูปแบบ: %v", value, err))
	}
	return t.UTC()
}

// mustDate — แปลง "YYYY-MM-DD" ของ frontend เป็น model.Date
func mustDate(value string) model.Date {
	d, err := model.ParseDate(value)
	if err != nil {
		panic(fmt.Sprintf("seed: วันที่ %q ไม่ถูกรูปแบบ: %v", value, err))
	}
	return d
}
