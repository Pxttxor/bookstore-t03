// seed.go — ใส่ข้อมูลตั้งต้นลงฐานข้อมูล
//
// ข้อมูลอยู่ใน seed_data.go ซึ่งสร้างจาก SEED_* ของ frontend (ดู tools/gen_seed.py)
// ทำงานเมื่อฐานข้อมูลยังว่างเท่านั้น รันซ้ำแล้วจะข้ามไปเฉย ๆ ไม่ทับข้อมูลที่ผู้ใช้ทดสอบไว้
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
var sequences = []struct{ table, column string }{
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

// Seed — ใส่ข้อมูลตั้งต้นถ้าฐานข้อมูลยังว่าง
func Seed(db *gorm.DB) error {
	var suppliers int64
	if err := db.Model(&model.Supplier{}).Count(&suppliers).Error; err != nil {
		return fmt.Errorf("นับข้อมูลผู้จัดจำหน่ายไม่สำเร็จ: %w", err)
	}
	if suppliers > 0 {
		fmt.Println("[seed] มีข้อมูลอยู่แล้ว ข้ามการใส่ข้อมูลตั้งต้น")
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(seedPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("เข้ารหัสรหัสผ่านไม่สำเร็จ: %w", err)
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		employees := make([]model.Employee, len(seedEmployees))
		copy(employees, seedEmployees)
		for i := range employees {
			employees[i].PasswordHash = string(hash)
		}
		if err := tx.Create(&employees).Error; err != nil {
			return fmt.Errorf("ใส่ข้อมูลพนักงานไม่สำเร็จ: %w", err)
		}

		if err := tx.Create(&seedBooks).Error; err != nil {
			return fmt.Errorf("ใส่ข้อมูลหนังสือไม่สำเร็จ: %w", err)
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
				return fmt.Errorf("ใส่ข้อมูลผู้จัดจำหน่าย %d ไม่สำเร็จ: %w", supplier.SupplierID, err)
			}
		}

		inventory := make([]model.InventoryItem, len(seedInventory))
		lastUpdated := mustTime("2026-08-01T02:00:00.000Z")
		for i, row := range seedInventory {
			inventory[i] = model.InventoryItem{
				InventoryID:    row.InventoryID,
				BookID:         row.BookID,
				QuantityOnHand: row.QuantityOnHand,
				ReorderPoint:   row.ReorderPoint,
				LastUpdated:    lastUpdated,
			}
		}
		if err := tx.Create(&inventory).Error; err != nil {
			return fmt.Errorf("ใส่ข้อมูลสินค้าคงคลังไม่สำเร็จ: %w", err)
		}
		if err := tx.Create(&seedStockTransactions).Error; err != nil {
			return fmt.Errorf("ใส่ประวัติการเคลื่อนไหวสต็อกไม่สำเร็จ: %w", err)
		}

		if err := tx.Create(&seedRequisitions).Error; err != nil {
			return fmt.Errorf("ใส่ใบขอสั่งซื้อไม่สำเร็จ: %w", err)
		}

		// ยอดรวมของใบสั่งซื้อไม่ได้เก็บไว้ใน seed — คำนวณจากรายการเหมือนตอนใช้งานจริง
		orders := make([]model.PurchaseOrder, len(seedOrders))
		copy(orders, seedOrders)
		for i := range orders {
			orders[i].RecalculateTotal()
		}
		if err := tx.Create(&orders).Error; err != nil {
			return fmt.Errorf("ใส่ใบสั่งซื้อไม่สำเร็จ: %w", err)
		}

		if len(seedReceipts) > 0 {
			if err := tx.Create(&seedReceipts).Error; err != nil {
				return fmt.Errorf("ใส่ใบรับสินค้าไม่สำเร็จ: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	if err := resetSequences(db); err != nil {
		return err
	}
	fmt.Printf("[seed] ใส่ข้อมูลตั้งต้นแล้ว: พนักงาน %d · หนังสือ %d · ผู้จัดจำหน่าย %d · PR %d · PO %d · GR %d\n",
		len(seedEmployees), len(seedBooks), len(seedSuppliers),
		len(seedRequisitions), len(seedOrders), len(seedReceipts))
	return nil
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
