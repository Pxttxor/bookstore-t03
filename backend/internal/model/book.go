// book.go — ระบบย่อยข้อมูลหนังสือ (เจ้าของ: วุฒิภัทร โกฎแสง)
// อ้างอิง class diagram: Sub1-Book-Management.md
//
//	Category "1" o-- "*" Book : contains
//	Book "1" *-- "*" BookChangeLog : history
//	Book "1" *-- "1" InventoryItem : stock   (อยู่ใน inventory.go)
package model

import (
	"strconv"
	"time"
)

// ── หมวดหมู่ ────────────────────────────────────────────────────────────

// Category — หมวดหมู่ที่หนังสือสังกัด
//
// เป็นข้อมูลอ้างอิงอ่านอย่างเดียวในระบบนี้ — class diagram ไม่ได้ให้เมธอดจัดการหมวดหมู่ไว้
// และหน้าจอ (BookContext) ก็อ่านอย่างเดียวเช่นกัน
type Category struct {
	CategoryID  int    `gorm:"column:category_id;primaryKey;autoIncrement" json:"categoryId"`
	Name        string `gorm:"column:name;type:varchar(200);not null" json:"name"`
	Description string `gorm:"column:description;type:text" json:"description"`
}

func (Category) TableName() string { return "category" }

// ── หนังสือ ─────────────────────────────────────────────────────────────

// Book — หนังสือหนึ่งเล่มในแคตตาล็อก
//
// CategoryID ไม่ใส่ not null เพราะ AutoMigrate เพิ่มคอลัมน์ NOT NULL บนตารางที่มีข้อมูลอยู่แล้วไม่ได้
// backfillBookCategories() ใน migrate.go เติมค่าแล้วค่อยบังคับ NOT NULL ทีหลัง (แบบเดียวกับ person)
type Book struct {
	BookID      int        `gorm:"column:book_id;primaryKey" json:"bookId"`
	ISBN        string     `gorm:"column:isbn;type:varchar(20);not null;uniqueIndex" json:"isbn"`
	Title       string     `gorm:"column:title;type:varchar(300);not null" json:"title"`
	Author      string     `gorm:"column:author;type:varchar(200);not null" json:"author"`
	Publisher   string     `gorm:"column:publisher;type:varchar(200);not null" json:"publisher"`
	Price       float64    `gorm:"column:price;type:numeric(12,2);not null" json:"price"`
	Description string     `gorm:"column:description;type:text" json:"description"`
	CategoryID  int        `gorm:"column:category_id;index" json:"categoryId"`
	Status      BookStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
}

func (Book) TableName() string { return "book" }

// BookDraft — ค่าที่ฟอร์มเพิ่ม/แก้ไขหนังสือส่งเข้ามา (ทุกฟิลด์ที่แก้ได้ ไม่รวมรหัสและประวัติ)
type BookDraft struct {
	ISBN        string     `json:"isbn"`
	Title       string     `json:"title"`
	Author      string     `json:"author"`
	Publisher   string     `json:"publisher"`
	Price       float64    `json:"price"`
	Description string     `json:"description"`
	CategoryID  int        `json:"categoryId"`
	Status      BookStatus `json:"status"`
}

// Draft — ค่าปัจจุบันของหนังสือในรูปแบบ draft (ใช้เป็นฐานตอนแก้ทีละฟิลด์)
func (b Book) Draft() BookDraft {
	return BookDraft{
		ISBN:        b.ISBN,
		Title:       b.Title,
		Author:      b.Author,
		Publisher:   b.Publisher,
		Price:       b.Price,
		Description: b.Description,
		CategoryID:  b.CategoryID,
		Status:      b.Status,
	}
}

// BookField — ฟิลด์ของหนังสือที่บันทึกประวัติการแก้ไข
type BookField string

const (
	BookFieldISBN        BookField = "isbn"
	BookFieldTitle       BookField = "title"
	BookFieldAuthor      BookField = "author"
	BookFieldPublisher   BookField = "publisher"
	BookFieldPrice       BookField = "price"
	BookFieldDescription BookField = "description"
	BookFieldCategoryID  BookField = "categoryId"
	BookFieldStatus      BookField = "status"
)

// BookFields — ลำดับฟิลด์ที่ตรวจการเปลี่ยนแปลง ตรงกับ CHANGE_FIELDS ฝั่งหน้าจอ
var BookFields = []BookField{
	BookFieldISBN, BookFieldTitle, BookFieldAuthor, BookFieldPublisher,
	BookFieldPrice, BookFieldDescription, BookFieldCategoryID, BookFieldStatus,
}

// CategoryNamer — แปลงรหัสหมวดหมู่เป็นชื่อที่ผู้ใช้อ่านรู้เรื่อง
//
// ประวัติการแก้ไขเก็บ oldValue/newValue เป็น string ตาม class diagram ประวัติจึงอ่านง่ายกว่า
// ถ้าเก็บชื่อหมวดหมู่แทนตัวเลข FK (แนวเดียวกับ fieldValue() ใน BookContext)
// ชั้น model ไม่รู้จักตาราง category จึงรับตัวแปลงเข้ามา · ส่ง nil ได้ถ้าไม่ได้แก้หมวดหมู่
type CategoryNamer func(categoryID int) string

// Update — เขียนค่าใหม่ลงหนังสือ แล้วคืนประวัติหนึ่งแถวต่อฟิลด์ที่เปลี่ยนจริง
// (`+update()` ใน class diagram · ฟิลด์ที่ค่าเท่าเดิมไม่สร้างแถว)
func (b *Book) Update(draft BookDraft, naming CategoryNamer, by string, at time.Time) []BookChangeLog {
	before := b.Draft()

	var logs []BookChangeLog
	for _, field := range BookFields {
		oldValue := bookFieldValue(before, field, naming)
		newValue := bookFieldValue(draft, field, naming)
		if oldValue == newValue {
			continue
		}
		logs = append(logs, BookChangeLog{
			BookID:       b.BookID,
			ChangedField: string(field),
			OldValue:     oldValue,
			NewValue:     newValue,
			ChangedDate:  at.UTC(),
			ChangedBy:    by,
		})
	}

	b.ISBN = draft.ISBN
	b.Title = draft.Title
	b.Author = draft.Author
	b.Publisher = draft.Publisher
	b.Price = draft.Price
	b.Description = draft.Description
	b.CategoryID = draft.CategoryID
	b.Status = draft.Status
	return logs
}

// SetStatus — เปิด/ปิดการขายหนังสือ บันทึกประวัติเฉพาะฟิลด์ status
func (b *Book) SetStatus(status BookStatus, by string, at time.Time) ([]BookChangeLog, error) {
	if !status.IsValid() {
		return nil, ErrInvalidBookStatus
	}
	draft := b.Draft()
	draft.Status = status
	return b.Update(draft, nil, by, at), nil
}

// bookFieldValue — ค่าของฟิลด์หนึ่งในรูปข้อความที่จะเก็บลงประวัติ
func bookFieldValue(draft BookDraft, field BookField, naming CategoryNamer) string {
	switch field {
	case BookFieldISBN:
		return draft.ISBN
	case BookFieldTitle:
		return draft.Title
	case BookFieldAuthor:
		return draft.Author
	case BookFieldPublisher:
		return draft.Publisher
	case BookFieldPrice:
		// -1 = ใช้ตัวเลขสั้นที่สุดที่อ่านกลับได้ค่าเดิม ให้ตรงกับ String(price) ของ TypeScript
		return strconv.FormatFloat(draft.Price, 'f', -1, 64)
	case BookFieldDescription:
		return draft.Description
	case BookFieldCategoryID:
		if naming != nil {
			if name := naming(draft.CategoryID); name != "" {
				return name
			}
		}
		return strconv.Itoa(draft.CategoryID)
	case BookFieldStatus:
		return draft.Status.Label()
	}
	return ""
}

// ── ประวัติการแก้ไข ─────────────────────────────────────────────────────

// BookChangeLog — ประวัติการแก้ไขข้อมูลหนังสือทีละฟิลด์
//
// ChangedBy เก็บ "ชื่อ" ไม่ใช่รหัสพนักงาน ตามแบบเดียวกับ SupplierEditLog.By
// class diagram วาดเส้น SalesStaff "1" --> "*" BookChangeLog : records ไว้แต่ไม่ระบุ attribute
// จึงเป็น deviation ที่ต้องตกลงกับเจ้าของคลาสก่อนรวมงาน (ดู README)
type BookChangeLog struct {
	LogID        int       `gorm:"column:log_id;primaryKey;autoIncrement" json:"logId"`
	BookID       int       `gorm:"column:book_id;not null;index" json:"bookId"`
	ChangedField string    `gorm:"column:changed_field;type:varchar(50);not null" json:"changedField"`
	OldValue     string    `gorm:"column:old_value;type:text" json:"oldValue"`
	NewValue     string    `gorm:"column:new_value;type:text" json:"newValue"`
	ChangedDate  time.Time `gorm:"column:changed_date;type:timestamptz;not null" json:"changedDate"`
	ChangedBy    string    `gorm:"column:changed_by;type:varchar(200);not null" json:"changedBy"`
}

func (BookChangeLog) TableName() string { return "book_change_log" }

// FieldLabel — ป้ายไทยของฟิลด์ที่ถูกแก้ (หน้าจอแสดงคอลัมน์นี้)
func (l BookChangeLog) FieldLabel() string {
	return lookup(BookFieldLabels, BookField(l.ChangedField))
}
