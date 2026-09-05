// book.go — คำสั่ง GORM ของหมวดหมู่ หนังสือ และประวัติการแก้ไข
//
// ย้ายคำสั่งอ่านหนังสือออกมาจาก InventoryRepository ตอนทำระบบย่อยข้อมูลหนังสือ
// เพื่อให้ "หนังสือ" กับ "ยอดคงเหลือ" อยู่คนละ repository ตาม class diagram
package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type BookRepository struct{ db *gorm.DB }

func NewBookRepository(db *gorm.DB) *BookRepository {
	return &BookRepository{db: db}
}

// BookFilter — ตัวกรองของหน้ารายการหนังสือ
//
// CategoryID = 0 คือไม่กรองหมวดหมู่ · Status ว่างคือไม่กรองสถานะ
type BookFilter struct {
	Query      string
	CategoryID int
	Status     model.BookStatus
}

// List — ค้นหาหนังสือตาม Book.search() (ชื่อเรื่อง / ผู้แต่ง / ISBN แบบไม่สนตัวพิมพ์) + ตัวกรอง
func (r *BookRepository) List(filter BookFilter) ([]model.Book, error) {
	query := r.db.Model(&model.Book{}).Order("book_id")

	if term := strings.TrimSpace(filter.Query); term != "" {
		like := "%" + strings.ToLower(term) + "%"
		query = query.Where("lower(title) LIKE ? OR lower(author) LIKE ? OR lower(isbn) LIKE ?",
			like, like, like)
	}
	if filter.CategoryID > 0 {
		query = query.Where("category_id = ?", filter.CategoryID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var books []model.Book
	if err := query.Find(&books).Error; err != nil {
		return nil, err
	}
	return books, nil
}

// BooksByID — แผนที่ bookId → Book ใช้เติมชื่อเรื่องลงในรายการเอกสารจัดซื้อ
func (r *BookRepository) BooksByID() (map[int]model.Book, error) {
	books, err := r.List(BookFilter{})
	if err != nil {
		return nil, err
	}
	index := make(map[int]model.Book, len(books))
	for _, book := range books {
		index[book.BookID] = book
	}
	return index, nil
}

func (r *BookRepository) Exists(bookID int) (bool, error) {
	var count int64
	err := r.db.Model(&model.Book{}).Where("book_id = ?", bookID).Count(&count).Error
	return count > 0, err
}

// ExistingIDs — ตรวจว่า id ไหนมีอยู่จริงบ้างจากรายการที่ให้มา ครั้งเดียวแทนการ Exists ทีละเล่ม
// ใช้ตอนตรวจฟอร์มที่มีหนังสือหลายเล่มพร้อมกัน (เช่น SCR-12/13 รายการหนังสือของผู้จัดจำหน่าย)
func (r *BookRepository) ExistingIDs(bookIDs []int) (map[int]bool, error) {
	found := make(map[int]bool, len(bookIDs))
	if len(bookIDs) == 0 {
		return found, nil
	}
	var ids []int
	if err := r.db.Model(&model.Book{}).
		Where("book_id IN ?", bookIDs).
		Pluck("book_id", &ids).Error; err != nil {
		return nil, err
	}
	for _, id := range ids {
		found[id] = true
	}
	return found, nil
}

// Find — หนังสือหนึ่งเล่ม · รับ *gorm.DB เข้ามาเพื่อให้เรียกจากในทรานแซกชันได้
func (r *BookRepository) Find(db *gorm.DB, bookID int) (*model.Book, error) {
	return firstBook(db.Where("book_id = ?", bookID))
}

// FindForUpdate — อ่านพร้อมล็อกแถว ใช้ตอนแก้ไขเพื่อไม่ให้สองคนกดบันทึกพร้อมกัน
// แล้วได้ประวัติการแก้ไขที่อ่านค่าเดิมคนละรอบ
func (r *BookRepository) FindForUpdate(tx *gorm.DB, bookID int) (*model.Book, error) {
	return firstBook(tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("book_id = ?", bookID))
}

func firstBook(query *gorm.DB) (*model.Book, error) {
	var book model.Book
	err := query.First(&book).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrBookNotFound
	}
	if err != nil {
		return nil, err
	}
	return &book, nil
}

// FindByISBN — หนังสือที่ใช้ ISBN นี้อยู่ (คืน nil ถ้ายังว่าง)
//
// ignoreBookID ให้เล่มที่กำลังแก้ไขคง ISBN เดิมของตัวเองได้ (แบบเดียวกับ findByIsbn ฝั่งหน้าจอ)
// รับ tx เข้ามาเพราะต้องตรวจในทรานแซกชันเดียวกับที่เขียน ไม่งั้น unique index จะเป็นด่านเดียว
func (r *BookRepository) FindByISBN(tx *gorm.DB, isbn string, ignoreBookID int) (*model.Book, error) {
	query := tx.Where("lower(btrim(isbn)) = ?", strings.ToLower(strings.TrimSpace(isbn)))
	if ignoreBookID > 0 {
		query = query.Where("book_id <> ?", ignoreBookID)
	}

	var book model.Book
	err := query.First(&book).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &book, nil
}

func (r *BookRepository) Create(tx *gorm.DB, book *model.Book) error {
	return tx.Create(book).Error
}

// Save — เขียนทุกฟิลด์ที่แก้ได้กลับลงแถวเดิม
func (r *BookRepository) Save(tx *gorm.DB, book *model.Book) error {
	return tx.Model(&model.Book{}).
		Where("book_id = ?", book.BookID).
		Updates(map[string]any{
			"isbn":        book.ISBN,
			"title":       book.Title,
			"author":      book.Author,
			"publisher":   book.Publisher,
			"price":       book.Price,
			"description": book.Description,
			"category_id": book.CategoryID,
			"status":      book.Status,
		}).Error
}

// ── ประวัติการแก้ไข ─────────────────────────────────────────────────────

func (r *BookRepository) AddChangeLogs(tx *gorm.DB, logs []model.BookChangeLog) error {
	if len(logs) == 0 {
		return nil
	}
	return tx.Create(&logs).Error
}

// ChangeLogs — ประวัติการแก้ไขของหนังสือเล่มหนึ่ง ล่าสุดขึ้นก่อน
func (r *BookRepository) ChangeLogs(bookID int) ([]model.BookChangeLog, error) {
	var logs []model.BookChangeLog
	err := r.db.Where("book_id = ?", bookID).
		Order("changed_date DESC, log_id DESC").
		Find(&logs).Error
	return logs, err
}

// ── หมวดหมู่ ────────────────────────────────────────────────────────────

func (r *BookRepository) ListCategories() ([]model.Category, error) {
	var categories []model.Category
	err := r.db.Order("category_id").Find(&categories).Error
	return categories, err
}

// CategoriesByID — แผนที่ categoryId → ชื่อ ใช้ทั้งตอนแบน DTO และตอนเขียนประวัติการแก้ไข
func (r *BookRepository) CategoriesByID() (map[int]string, error) {
	categories, err := r.ListCategories()
	if err != nil {
		return nil, err
	}
	index := make(map[int]string, len(categories))
	for _, category := range categories {
		index[category.CategoryID] = category.Name
	}
	return index, nil
}
