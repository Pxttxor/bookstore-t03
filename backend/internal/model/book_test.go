package model

import (
	"testing"
	"time"
)

// sampleBook — หนังสือตั้งต้นของทุกเคส (ตรงกับเล่ม 101 ในข้อมูลตั้งต้น)
func sampleBook() Book {
	return Book{
		BookID: 101, ISBN: "978-616-0001-01", Title: "Atomic Habits",
		Author: "James Clear", Publisher: "สำนักพิมพ์ก้าวหน้า", Price: 438,
		Description: "คู่มือสร้างนิสัย", CategoryID: 2, Status: BookStatusActive,
	}
}

func categoryNames() CategoryNamer {
	names := map[int]string{1: "วรรณกรรมและนวนิยาย", 2: "พัฒนาตนเอง"}
	return func(categoryID int) string { return names[categoryID] }
}

func TestBookUpdateWritesOneLogPerChangedField(t *testing.T) {
	book := sampleBook()
	at := time.Date(2026, 8, 30, 3, 0, 0, 0, time.UTC)

	draft := book.Draft()
	draft.Price = 399
	draft.Title = "Atomic Habits (ฉบับปรับปรุง)"

	logs := book.Update(draft, categoryNames(), "ณัฐวุฒิ แสงจันทร์", at)
	if len(logs) != 2 {
		t.Fatalf("แก้ 2 ฟิลด์ต้องได้ประวัติ 2 แถว ได้ %d", len(logs))
	}
	if book.Price != 399 || book.Title != draft.Title {
		t.Fatalf("ค่าใหม่ไม่ถูกเขียนลงหนังสือ: %+v", book)
	}

	byField := map[string]BookChangeLog{}
	for _, log := range logs {
		byField[log.ChangedField] = log
		if log.BookID != 101 {
			t.Fatalf("ประวัติต้องผูกกับหนังสือเล่มเดิม ได้ %d", log.BookID)
		}
		if log.ChangedBy != "ณัฐวุฒิ แสงจันทร์" || !log.ChangedDate.Equal(at) {
			t.Fatalf("ผู้แก้/เวลาไม่ถูกบันทึก: %+v", log)
		}
	}

	// ราคาเก็บเป็นตัวเลขสั้นที่สุด ไม่ใช่ 438.00 — ให้ตรงกับ String(price) ฝั่ง TypeScript
	price := byField["price"]
	if price.OldValue != "438" || price.NewValue != "399" {
		t.Fatalf("ค่าเดิม/ค่าใหม่ของราคาผิด: %q → %q", price.OldValue, price.NewValue)
	}
}

func TestBookUpdateWithoutChangesWritesNothing(t *testing.T) {
	book := sampleBook()
	logs := book.Update(book.Draft(), categoryNames(), "ณัฐวุฒิ แสงจันทร์", time.Now())
	if len(logs) != 0 {
		t.Fatalf("ไม่ได้เปลี่ยนค่าอะไรเลย ต้องไม่มีประวัติ ได้ %d แถว", len(logs))
	}
}

// หมวดหมู่กับสถานะเก็บเป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ไม่ใช่ FK หรือ SCREAMING_SNAKE
// (กติกาเดียวกับ fieldValue() ใน BookContext ฝั่งหน้าจอ)
func TestBookUpdateLogsReadableValues(t *testing.T) {
	book := sampleBook()
	draft := book.Draft()
	draft.CategoryID = 1
	draft.Status = BookStatusInactive

	logs := book.Update(draft, categoryNames(), "ณัฐวุฒิ แสงจันทร์", time.Now())
	if len(logs) != 2 {
		t.Fatalf("ต้องได้ประวัติ 2 แถว ได้ %d", len(logs))
	}

	for _, log := range logs {
		switch log.ChangedField {
		case "categoryId":
			if log.OldValue != "พัฒนาตนเอง" || log.NewValue != "วรรณกรรมและนวนิยาย" {
				t.Fatalf("หมวดหมู่ต้องเก็บเป็นชื่อ: %q → %q", log.OldValue, log.NewValue)
			}
			if log.FieldLabel() != "หมวดหมู่" {
				t.Fatalf("ป้ายฟิลด์ผิด: %q", log.FieldLabel())
			}
		case "status":
			if log.OldValue != "ใช้งาน" || log.NewValue != "ปิดการขาย" {
				t.Fatalf("สถานะต้องเก็บเป็นป้ายไทย: %q → %q", log.OldValue, log.NewValue)
			}
		default:
			t.Fatalf("ฟิลด์ที่ไม่ควรเปลี่ยน: %s", log.ChangedField)
		}
	}
}

// ถ้าไม่มีตัวแปลงหมวดหมู่ ต้องไม่ panic — SetStatus เรียก Update โดยส่ง nil เข้าไป
func TestBookSetStatus(t *testing.T) {
	book := sampleBook()

	logs, err := book.SetStatus(BookStatusInactive, "ปิยะพร วงศ์ทอง", time.Now())
	if err != nil {
		t.Fatalf("ปิดการขายไม่สำเร็จ: %v", err)
	}
	if len(logs) != 1 || logs[0].ChangedField != "status" {
		t.Fatalf("ต้องได้ประวัติเฉพาะฟิลด์สถานะ ได้ %+v", logs)
	}
	if book.Status != BookStatusInactive {
		t.Fatalf("สถานะไม่เปลี่ยน ได้ %s", book.Status)
	}

	// ตั้งสถานะเดิมซ้ำไม่ควรเกิดประวัติเพิ่ม
	logs, err = book.SetStatus(BookStatusInactive, "ปิยะพร วงศ์ทอง", time.Now())
	if err != nil || len(logs) != 0 {
		t.Fatalf("ตั้งสถานะเดิมซ้ำต้องไม่มีประวัติ ได้ %+v (err=%v)", logs, err)
	}

	if _, err := book.SetStatus(BookStatus("SOLD_OUT"), "ปิยะพร วงศ์ทอง", time.Now()); err != ErrInvalidBookStatus {
		t.Fatalf("สถานะนอก enum ต้องถูกปฏิเสธ ได้ %v", err)
	}
}

// ป้ายไทยต้องตรงกับ BOOK_FIELD_LABELS ใน frontend/src/admin/books/books.ts ทีละตัว
func TestBookFieldLabelsMatchFrontend(t *testing.T) {
	want := map[BookField]string{
		BookFieldISBN:        "ISBN",
		BookFieldTitle:       "ชื่อหนังสือ",
		BookFieldAuthor:      "ผู้แต่ง",
		BookFieldPublisher:   "สำนักพิมพ์",
		BookFieldPrice:       "ราคาปก",
		BookFieldDescription: "รายละเอียด",
		BookFieldCategoryID:  "หมวดหมู่",
		BookFieldStatus:      "สถานะ",
	}
	if len(BookFields) != len(want) {
		t.Fatalf("จำนวนฟิลด์ที่ตรวจการเปลี่ยนแปลง = %d ต้องการ %d", len(BookFields), len(want))
	}
	for _, field := range BookFields {
		if got := BookFieldLabels[field]; got != want[field] {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", field, got, want[field])
		}
	}
}
