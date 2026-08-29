// inventory.go — เข้าถึงข้อมูลหนังสือ สินค้าคงคลัง และการแจ้งเตือน
//
// Book / InventoryItem / StockTransaction เป็นคลาสของระบบย่อยอื่น ระบบจัดซื้ออ่านเป็นหลัก
// และเขียนเฉพาะตอนรับสินค้าเข้าคลัง (U9) กับส่งคืน (U10)
package repository

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

type InventoryRepository struct{ db *gorm.DB }

func NewInventoryRepository(db *gorm.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
}

// ── หนังสือ ─────────────────────────────────────────────────────────────

func (r *InventoryRepository) ListBooks(term string) ([]model.Book, error) {
	query := r.db.Model(&model.Book{}).Order("book_id")
	if trimmed := strings.TrimSpace(term); trimmed != "" {
		like := "%" + strings.ToLower(trimmed) + "%"
		query = query.Where("lower(title) LIKE ? OR lower(author) LIKE ? OR lower(isbn) LIKE ?",
			like, like, like)
	}

	var books []model.Book
	if err := query.Find(&books).Error; err != nil {
		return nil, err
	}
	return books, nil
}

// BooksByID — แผนที่ bookId → Book ใช้เติมชื่อเรื่องลงในรายการเอกสาร
func (r *InventoryRepository) BooksByID() (map[int]model.Book, error) {
	books, err := r.ListBooks("")
	if err != nil {
		return nil, err
	}
	index := make(map[int]model.Book, len(books))
	for _, book := range books {
		index[book.BookID] = book
	}
	return index, nil
}

func (r *InventoryRepository) BookExists(bookID int) (bool, error) {
	var count int64
	err := r.db.Model(&model.Book{}).Where("book_id = ?", bookID).Count(&count).Error
	return count > 0, err
}

// ── สินค้าคงคลัง ────────────────────────────────────────────────────────

func (r *InventoryRepository) ListInventory() ([]model.InventoryItem, error) {
	var items []model.InventoryItem
	if err := r.db.Order("book_id").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *InventoryRepository) FindByBookID(db *gorm.DB, bookID int) (*model.InventoryItem, error) {
	var item model.InventoryItem
	err := db.First(&item, "book_id = ?", bookID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrInventoryNotFound
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// SetReorderPoint — ตั้งหรือล้างจุดสั่งซื้อของหนังสือเล่มหนึ่ง (U5 / SCR-20)
func (r *InventoryRepository) SetReorderPoint(bookID int, reorderPoint *int) (*model.InventoryItem, error) {
	result := r.db.Model(&model.InventoryItem{}).
		Where("book_id = ?", bookID).
		Updates(map[string]any{"reorder_point": reorderPoint, "last_updated": time.Now().UTC()})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, model.ErrInventoryNotFound
	}
	return r.FindByBookID(r.db, bookID)
}

// ApplyStockChanges — บันทึกรายการเคลื่อนไหวสต็อกแล้วปรับยอดคงเหลือให้ตรงกัน
//
// ยอดคงเหลือไม่ให้ติดลบ — ตัดออกมากกว่าที่มีจะเหลือ 0 (พฤติกรรมเดียวกับ applyStockChanges
// ฝั่ง frontend) เพราะรายการรับ/คืนของระบบจัดซื้อไม่ควรทำให้ทั้งทรานแซกชันล้ม
// ส่วนการปรับยอดด้วยมือของระบบสินค้าคงคลังมีกฎเข้มกว่านี้และไม่ได้อยู่ในขอบเขตนี้
func (r *InventoryRepository) ApplyStockChanges(tx *gorm.DB, txns []model.StockTransaction) error {
	if len(txns) == 0 {
		return nil
	}
	if err := tx.Create(&txns).Error; err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, txn := range txns {
		err := tx.Model(&model.InventoryItem{}).
			Where("book_id = ?", txn.BookID).
			Updates(map[string]any{
				"quantity_on_hand": gorm.Expr("GREATEST(quantity_on_hand + ?, 0)", txn.QuantityChange),
				"last_updated":     now,
			}).Error
		if err != nil {
			return err
		}
	}
	return nil
}

// TransactionsForBook — ประวัติการเคลื่อนไหวของหนังสือเล่มหนึ่ง ล่าสุดขึ้นก่อน
func (r *InventoryRepository) TransactionsForBook(bookID int) ([]model.StockTransaction, error) {
	var txns []model.StockTransaction
	err := r.db.Where("book_id = ?", bookID).Order("txn_date DESC, txn_id DESC").Find(&txns).Error
	return txns, err
}

// ── การแจ้งเตือน ────────────────────────────────────────────────────────

type NotificationRepository struct{ db *gorm.DB }

func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Push — บันทึกการแจ้งเตือนหลายช่องทางเป็นการเขียนครั้งเดียว
func (r *NotificationRepository) Push(tx *gorm.DB, notifications []model.Notification) error {
	if len(notifications) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for i := range notifications {
		notifications[i].CreatedAt = now
	}
	return tx.Create(&notifications).Error
}

// ListFor — การแจ้งเตือนของบทบาทหนึ่ง ใหม่สุดขึ้นก่อน
func (r *NotificationRepository) ListFor(role model.Role) ([]model.Notification, error) {
	var notifications []model.Notification
	err := r.db.Where("to_role = ?", role).
		Order("created_at DESC, id DESC").
		Find(&notifications).Error
	return notifications, err
}

func (r *NotificationRepository) MarkRead(id int) error {
	result := r.db.Model(&model.Notification{}).Where("id = ?", id).Update("read", true)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return model.NotFound("NOTIFICATION_NOT_FOUND", "ไม่พบการแจ้งเตือนนี้")
	}
	return nil
}

func (r *NotificationRepository) MarkAllRead(role model.Role) error {
	return r.db.Model(&model.Notification{}).
		Where("to_role = ? AND read = false", role).
		Update("read", true).Error
}
