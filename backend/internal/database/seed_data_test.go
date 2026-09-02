// seed_data_test.go — ตรวจข้อมูลตั้งต้นที่ tools/gen_seed.py สร้าง
//
// สคริปต์อ่าน TypeScript ด้วย regex การเปลี่ยนฟอร์แมตฝั่ง frontend จึงทำให้ข้อมูลหายเงียบ ๆ ได้
// (เคยเกิดมาแล้ว: สคริปต์ไม่ได้อ่าน argument `status` เลย หนังสือทุกเล่มจึงถูกเขียนเป็น ACTIVE
// ทั้งที่เล่ม 118 ปิดการขายอยู่) เทสต์ชุดนี้จับกรณีแบบนั้นตั้งแต่ go test โดยไม่ต้องมีฐานข้อมูล
package database

import (
	"testing"

	"bookstore-t03/internal/model"
)

func TestSeedCategories(t *testing.T) {
	if len(seedCategories) != 6 {
		t.Fatalf("หมวดหมู่ตั้งต้น = %d ต้องการ 6", len(seedCategories))
	}
	seen := map[int]bool{}
	for _, category := range seedCategories {
		if category.CategoryID == 0 || category.Name == "" {
			t.Errorf("หมวดหมู่ไม่สมบูรณ์: %+v", category)
		}
		if seen[category.CategoryID] {
			t.Errorf("รหัสหมวดหมู่ %d ซ้ำ", category.CategoryID)
		}
		seen[category.CategoryID] = true
	}
}

func TestSeedBooks(t *testing.T) {
	if len(seedBooks) != 23 {
		t.Fatalf("หนังสือตั้งต้น = %d ต้องการ 23", len(seedBooks))
	}

	categories := map[int]bool{}
	for _, category := range seedCategories {
		categories[category.CategoryID] = true
	}

	seen := map[int]bool{}
	var inactive []int
	for _, book := range seedBooks {
		if seen[book.BookID] {
			t.Errorf("รหัสหนังสือ %d ซ้ำ", book.BookID)
		}
		seen[book.BookID] = true

		if book.ISBN == "" || book.Title == "" || book.Price <= 0 {
			t.Errorf("หนังสือ %d ข้อมูลไม่ครบ: %+v", book.BookID, book)
		}
		// FK ต้องชี้ไปยังหมวดหมู่ที่มีจริง ไม่งั้น applyForeignKeys จะล้มตอน migrate
		if !categories[book.CategoryID] {
			t.Errorf("หนังสือ %d อยู่ในหมวดหมู่ %d ที่ไม่มีในข้อมูลตั้งต้น", book.BookID, book.CategoryID)
		}
		if !book.Status.IsValid() {
			t.Errorf("หนังสือ %d สถานะไม่ถูกต้อง: %s", book.BookID, book.Status)
		}
		if book.Status == model.BookStatusInactive {
			inactive = append(inactive, book.BookID)
		}
	}

	// เล่ม 118 (ดาวเคราะห์สีคราม) ผู้จัดจำหน่ายเลิกกิจการ จึงปิดการขายอยู่ฝั่งหน้าจอ
	if len(inactive) != 1 || inactive[0] != 118 {
		t.Errorf("หนังสือที่ปิดการขาย = %v ต้องการ [118]", inactive)
	}
}

func TestSeedBookChangeLogs(t *testing.T) {
	books := map[int]bool{}
	for _, book := range seedBooks {
		books[book.BookID] = true
	}

	if len(seedBookChangeLogs) == 0 {
		t.Fatal("ต้องมีประวัติการแก้ไขตั้งต้นอย่างน้อยหนึ่งแถว ให้แท็บประวัติมีข้อมูลให้ดู")
	}
	for _, log := range seedBookChangeLogs {
		if !books[log.BookID] {
			t.Errorf("ประวัติ %d ผูกกับหนังสือ %d ที่ไม่มีในข้อมูลตั้งต้น", log.LogID, log.BookID)
		}
		if _, ok := model.BookFieldLabels[model.BookField(log.ChangedField)]; !ok {
			t.Errorf("ประวัติ %d อ้างฟิลด์ %q ที่ไม่มีป้ายกำกับ", log.LogID, log.ChangedField)
		}
		if log.ChangedBy == "" || log.ChangedDate.IsZero() {
			t.Errorf("ประวัติ %d ไม่มีผู้แก้หรือเวลา: %+v", log.LogID, log)
		}
	}
}

// สินค้าคงคลังต้องมีครบทุกเล่ม — Book "1" *-- "1" InventoryItem เป็น composition
func TestSeedInventoryCoversEveryBook(t *testing.T) {
	covered := map[int]bool{}
	for _, item := range seedInventory {
		covered[item.BookID] = true
	}
	for _, book := range seedBooks {
		if !covered[book.BookID] {
			t.Errorf("หนังสือ %d ไม่มีแถวสินค้าคงคลัง", book.BookID)
		}
	}
}
