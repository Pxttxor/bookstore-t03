// inventory.go — เข้าถึงข้อมูลสินค้าคงคลังและการแจ้งเตือน
//
// InventoryItem / StockTransaction เป็นคลาสของระบบย่อยสินค้าคงคลัง ระบบจัดซื้ออ่านเป็นหลัก
// และเขียนเฉพาะตอนรับสินค้าเข้าคลัง (U9) กับส่งคืน (U10)
//
// คำสั่งของตาราง book ย้ายไป book.go แล้ว
package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

type InventoryRepository struct{ db *gorm.DB }

func NewInventoryRepository(db *gorm.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
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

// CreateForBook — เปิดแถวสินค้าคงคลังยอด 0 ให้หนังสือเล่มใหม่
//
// class diagram ผูก Book "1" *-- "1" InventoryItem เป็น composition หนังสือจึงต้องมีแถวคู่เสมอ
// ถ้าไม่สร้างให้ตั้งแต่ตอนเพิ่มหนังสือ เล่มใหม่จะไม่โผล่ในหน้ายอดคงเหลือและใน U5 เลย
// ยังไม่ตั้งจุดสั่งซื้อ (nil) — ให้คลังมาตั้งเองที่ SCR-20
func (r *InventoryRepository) CreateForBook(tx *gorm.DB, bookID int) error {
	return tx.Create(&model.InventoryItem{
		BookID:         bookID,
		QuantityOnHand: 0,
		LastUpdated:    time.Now().UTC(),
	}).Error
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
