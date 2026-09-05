// book.go — ระบบย่อยข้อมูลหนังสือ
//
// class diagram: Category "1" o-- "*" Book · Book "1" *-- "*" BookChangeLog · Book "1" *-- "1" InventoryItem
//
// กฎที่ตัดสินได้จากหนังสือเล่มเดียวอยู่บนเมธอดของ model (Book.Update / Book.SetStatus)
// ที่นี่เหลือเฉพาะกฎที่ต้องอ่านหลายตาราง — ISBN ซ้ำ และหมวดหมู่ที่อ้างถึงต้องมีจริง
package service

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type BookService struct {
	db        *gorm.DB
	books     *repository.BookRepository
	inventory *repository.InventoryRepository
}

func NewBookService(
	db *gorm.DB, books *repository.BookRepository, inventory *repository.InventoryRepository,
) *BookService {
	return &BookService{db: db, books: books, inventory: inventory}
}

// BookView — หนังสือพร้อมชื่อหมวดหมู่ที่หน้าจอต้องแสดงคู่กันเสมอ
type BookView struct {
	Book         model.Book
	CategoryName string
}

// StatusInput — ฟอร์มเปิด/ปิดการขาย
type StatusInput struct {
	Status model.BookStatus `json:"status"`
}

// ── อ่าน ────────────────────────────────────────────────────────────────

func (s *BookService) Categories() ([]model.Category, error) {
	return s.books.ListCategories()
}

// List — ค้นหาหนังสือตาม Book.search() พร้อมตัวกรองหมวดหมู่และสถานะ
func (s *BookService) List(filter repository.BookFilter) ([]BookView, error) {
	books, err := s.books.List(filter)
	if err != nil {
		return nil, err
	}
	names, err := s.books.CategoriesByID()
	if err != nil {
		return nil, err
	}

	views := make([]BookView, len(books))
	for i, book := range books {
		views[i] = BookView{Book: book, CategoryName: names[book.CategoryID]}
	}
	return views, nil
}

func (s *BookService) Get(bookID int) (*BookView, error) {
	book, err := s.books.Find(s.db, bookID)
	if err != nil {
		return nil, err
	}
	return s.view(*book)
}

// ChangeLogs — ประวัติการแก้ไขของหนังสือเล่มหนึ่ง (แท็บประวัติในหน้ารายละเอียด)
func (s *BookService) ChangeLogs(bookID int) ([]model.BookChangeLog, error) {
	if _, err := s.books.Find(s.db, bookID); err != nil {
		return nil, err
	}
	return s.books.ChangeLogs(bookID)
}

// ── เขียน ───────────────────────────────────────────────────────────────

// Create — เพิ่มหนังสือเล่มใหม่ (`Book.add()` ใน class diagram)
//
// เปิดแถวสินค้าคงคลังยอด 0 ให้ในทรานแซกชันเดียวกัน เพราะ class diagram ผูก
// Book "1" *-- "1" InventoryItem เป็น composition — หนังสือที่ไม่มียอดคงเหลือคู่กัน
// จะหายไปจากหน้าสต็อกและจากการตรวจจุดสั่งซื้อของ U5
//
// ไม่บันทึกประวัติการแก้ไขตอนเพิ่ม — BookChangeLog เก็บเฉพาะ "ค่าเดิม → ค่าใหม่"
// การเพิ่มเล่มใหม่ไม่มีค่าเดิม (หน้าจอก็เขียนประวัติเฉพาะตอนแก้ไขเช่นกัน)
func (s *BookService) Create(draft model.BookDraft) (*BookView, error) {
	draft, err := s.clean(draft)
	if err != nil {
		return nil, err
	}

	book := model.Book{
		ISBN: draft.ISBN, Title: draft.Title, Author: draft.Author,
		Publisher: draft.Publisher, Price: draft.Price, Description: draft.Description,
		CategoryID: draft.CategoryID, Status: draft.Status,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.assertIsbnFree(tx, draft.ISBN, 0); err != nil {
			return err
		}
		if err := s.books.Create(tx, &book); err != nil {
			return err
		}
		return s.inventory.CreateForBook(tx, book.BookID)
	})
	if err != nil {
		return nil, err
	}
	return s.view(book)
}

// Update — แก้ไขข้อมูลหนังสือ (`Book.update()`) พร้อมบันทึกประวัติทีละฟิลด์ที่เปลี่ยนจริง
func (s *BookService) Update(bookID int, draft model.BookDraft, by string) (*BookView, error) {
	draft, err := s.clean(draft)
	if err != nil {
		return nil, err
	}
	return s.write(bookID, by, func(book *model.Book, naming model.CategoryNamer, at time.Time) ([]model.BookChangeLog, error) {
		return book.Update(draft, naming, by, at), nil
	}, draft.ISBN)
}

// SetStatus — เปิด/ปิดการขาย บันทึกประวัติเฉพาะฟิลด์สถานะ
func (s *BookService) SetStatus(bookID int, status model.BookStatus, by string) (*BookView, error) {
	if !status.IsValid() {
		return nil, model.ErrInvalidBookStatus
	}
	return s.write(bookID, by, func(book *model.Book, _ model.CategoryNamer, at time.Time) ([]model.BookChangeLog, error) {
		return book.SetStatus(status, by, at)
	}, "")
}

// write — โครงร่วมของทุกการแก้ไข: ล็อกแถว → ตรวจ ISBN ซ้ำ → ให้ model ตัดสิน → บันทึกพร้อมประวัติ
//
// isbn ว่าง = การแก้ครั้งนี้ไม่แตะ ISBN จึงไม่ต้องตรวจซ้ำ
func (s *BookService) write(
	bookID int, by string,
	apply func(*model.Book, model.CategoryNamer, time.Time) ([]model.BookChangeLog, error),
	isbn string,
) (*BookView, error) {
	names, err := s.books.CategoriesByID()
	if err != nil {
		return nil, err
	}
	naming := model.CategoryNamer(func(categoryID int) string { return names[categoryID] })

	var book *model.Book
	err = s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.books.FindForUpdate(tx, bookID)
		if err != nil {
			return err
		}
		book = found
		if isbn != "" {
			if err := s.assertIsbnFree(tx, isbn, bookID); err != nil {
				return err
			}
		}

		logs, err := apply(book, naming, time.Now())
		if err != nil {
			return err
		}
		if err := s.books.Save(tx, book); err != nil {
			return err
		}
		return s.books.AddChangeLogs(tx, logs)
	})
	if err != nil {
		return nil, err
	}
	return s.view(*book)
}

// ── ตัวช่วย ─────────────────────────────────────────────────────────────

// clean — ตัดช่องว่างหัวท้ายแล้วตรวจว่ากรอกครบและอ้างถึงหมวดหมู่ที่มีจริง
func (s *BookService) clean(draft model.BookDraft) (model.BookDraft, error) {
	draft.ISBN = strings.TrimSpace(draft.ISBN)
	draft.Title = strings.TrimSpace(draft.Title)
	draft.Author = strings.TrimSpace(draft.Author)
	draft.Publisher = strings.TrimSpace(draft.Publisher)
	draft.Description = strings.TrimSpace(draft.Description)
	if draft.Status == "" {
		draft.Status = model.BookStatusActive
	}

	// ลำดับเดียวกับ REQUIRED_BOOK_FIELDS ของฟอร์ม เพื่อให้ข้อความบอกช่องเดียวกับที่หน้าจอไฮไลต์
	var missing []string
	for _, field := range []struct {
		name  model.BookField
		blank bool
	}{
		{model.BookFieldISBN, draft.ISBN == ""},
		{model.BookFieldTitle, draft.Title == ""},
		{model.BookFieldAuthor, draft.Author == ""},
		{model.BookFieldPublisher, draft.Publisher == ""},
		{model.BookFieldPrice, draft.Price == 0},
		{model.BookFieldCategoryID, draft.CategoryID == 0},
	} {
		if field.blank {
			missing = append(missing, model.BookFieldLabels[field.name])
		}
	}
	if len(missing) > 0 {
		return draft, model.Validation("MISSING_FIELDS",
			"กรุณากรอกข้อมูลให้ครบ: "+strings.Join(missing, ", "))
	}

	if draft.Price < 0 {
		return draft, model.ErrInvalidBookPrice
	}
	if !draft.Status.IsValid() {
		return draft, model.ErrInvalidBookStatus
	}

	names, err := s.books.CategoriesByID()
	if err != nil {
		return draft, err
	}
	if _, ok := names[draft.CategoryID]; !ok {
		return draft, model.ErrCategoryNotFound
	}
	return draft, nil
}

// assertIsbnFree — ISBN ต้องไม่ซ้ำกับเล่มอื่น (ตรวจในทรานแซกชันเดียวกับที่เขียน)
func (s *BookService) assertIsbnFree(tx *gorm.DB, isbn string, ignoreBookID int) error {
	existing, err := s.books.FindByISBN(tx, isbn, ignoreBookID)
	if err != nil {
		return err
	}
	if existing != nil {
		return model.IsbnTaken(existing.ISBN, existing.Title)
	}
	return nil
}

func (s *BookService) view(book model.Book) (*BookView, error) {
	names, err := s.books.CategoriesByID()
	if err != nil {
		return nil, err
	}
	return &BookView{Book: book, CategoryName: names[book.CategoryID]}, nil
}
