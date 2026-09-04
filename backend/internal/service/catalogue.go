// catalogue.go — แคตตาล็อกที่หน้าร้านอ่าน (read-model ไม่มีการเขียน)
//
// หน้าร้านต้องเห็นข้อมูลชุดเดียวกับหลังร้าน แต่คนเดินดูยังไม่ล็อกอิน จึงเข้า
// /api/books ที่เป็น roleOffice ไม่ได้ · ที่นี่จึงประกอบสิ่งที่หน้าร้านต้องใช้ไว้ให้ครบ
// ในคำขอเดียว: หนังสือ + ชื่อหมวดหมู่ + ยอดคงเหลือ + คะแนนเฉลี่ย
//
// **เห็นเฉพาะเล่มที่ขายอยู่** — เล่ม INACTIVE ถูกตัดออกทั้งจากลิสต์และการเปิดดูรายเล่ม
// (`Order.buildOrder` ก็ปฏิเสธด้วย ErrBookNotForSale อยู่แล้ว สองชั้นตรงกัน)
package service

import (
	"errors"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type CatalogueService struct {
	db        *gorm.DB
	books     *repository.BookRepository
	inventory *repository.InventoryRepository
	reviews   *repository.ReviewRepository
}

func NewCatalogueService(
	db *gorm.DB,
	books *repository.BookRepository,
	inventory *repository.InventoryRepository,
	reviews *repository.ReviewRepository,
) *CatalogueService {
	return &CatalogueService{db: db, books: books, inventory: inventory, reviews: reviews}
}

// CatalogueRow — หนังสือหนึ่งเล่มพร้อมทุกอย่างที่การ์ดหน้าร้านต้องใช้
//
// QuantityOnHand เป็น int ธรรมดา ไม่ใช่ตัวชี้ — เล่มที่ยังไม่มีแถว inventory_item
// อ่านเป็น 0 (ขายไม่ได้) ซึ่งเป็นคำตอบที่ปลอดภัยกว่าการซ่อนเล่มนั้นไปเฉย ๆ
type CatalogueRow struct {
	Book           model.Book
	CategoryName   string
	QuantityOnHand int
	Level          model.StockLevel
	Rating         repository.RatingSummary
}

// CatalogueDetail — หน้ารายละเอียดหนังสือ = แถวเดียวกัน + รีวิวที่เผยแพร่แล้ว
type CatalogueDetail struct {
	CatalogueRow
	Reviews []repository.ReviewRow
}

// List — หนังสือทุกเล่มที่ขายอยู่ เรียงตามรหัส
func (s *CatalogueService) List() ([]CatalogueRow, error) {
	books, err := s.books.List(repository.BookFilter{Status: model.BookStatusActive})
	if err != nil {
		return nil, err
	}
	categories, err := s.books.CategoriesByID()
	if err != nil {
		return nil, err
	}
	items, err := s.inventory.ListInventory()
	if err != nil {
		return nil, err
	}
	ratings, err := s.reviews.RatingsByBook()
	if err != nil {
		return nil, err
	}

	stock := make(map[int]model.InventoryItem, len(items))
	for _, item := range items {
		stock[item.BookID] = item
	}

	rows := make([]CatalogueRow, len(books))
	for i, book := range books {
		rows[i] = CatalogueRow{
			Book:           book,
			CategoryName:   categories[book.CategoryID],
			QuantityOnHand: stock[book.BookID].QuantityOnHand,
			Level:          model.StockLevelOf(stock[book.BookID]),
			Rating:         ratings[book.BookID],
		}
	}
	return rows, nil
}

// Get — หนังสือหนึ่งเล่มพร้อมรีวิวที่ผ่านการตรวจสอบแล้ว
//
// เล่มที่ปิดการขายตอบ 404 เหมือนเล่มที่ไม่มีอยู่จริง เพื่อไม่ให้เดารหัสแล้วเปิดดูได้
func (s *CatalogueService) Get(bookID int) (*CatalogueDetail, error) {
	book, err := s.books.Find(s.db, bookID)
	if err != nil {
		return nil, err
	}
	if book.Status != model.BookStatusActive {
		return nil, model.ErrBookNotFound
	}
	categories, err := s.books.CategoriesByID()
	if err != nil {
		return nil, err
	}
	ratings, err := s.reviews.RatingsByBook()
	if err != nil {
		return nil, err
	}
	reviews, err := s.reviews.List(repository.ReviewFilter{
		BookID: bookID,
		Status: model.ReviewStatusPublished,
	})
	if err != nil {
		return nil, err
	}

	// เล่มที่ยังไม่มีแถวคลัง (สร้างใหม่แล้วทรานแซกชันไม่ครบ) อ่านเป็นศูนย์ ไม่ใช่ 404
	var item model.InventoryItem
	if found, err := s.inventory.FindByBookID(s.db, bookID); err == nil {
		item = *found
	} else if !errors.Is(err, model.ErrInventoryNotFound) {
		return nil, err
	}

	return &CatalogueDetail{
		CatalogueRow: CatalogueRow{
			Book:           *book,
			CategoryName:   categories[book.CategoryID],
			QuantityOnHand: item.QuantityOnHand,
			Level:          model.StockLevelOf(item),
			Rating:         ratings[bookID],
		},
		Reviews: reviews,
	}, nil
}

// Categories — หมวดหมู่ทั้งหมดสำหรับชิปกรองบนหน้าแรก
func (s *CatalogueService) Categories() ([]model.Category, error) {
	return s.books.ListCategories()
}
