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
	"gorm.io/gorm/clause"

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
	return r.applyStockChanges(tx, txns, true)
}

// ApplyStrictStockChanges — เหมือน ApplyStockChanges แต่ **ไม่ปัดยอดติดลบขึ้นเป็นศูนย์**
//
// ใช้กับการปรับยอดด้วยมือของระบบสินค้าคงคลัง ซึ่งมี abnormal flow ว่า
// "ยอดคงเหลือติดลบ → ไม่อนุญาตให้บันทึก" · ถ้าปัดให้เหมือนเส้นทางจัดซื้อ ข้อผิดพลาดจะถูกกลืน
// ผู้เรียกต้องตรวจยอดรวมทุกเล่มก่อนเสมอ (ดู InventoryService.AdjustStock)
func (r *InventoryRepository) ApplyStrictStockChanges(tx *gorm.DB, txns []model.StockTransaction) error {
	return r.applyStockChanges(tx, txns, false)
}

func (r *InventoryRepository) applyStockChanges(
	tx *gorm.DB, txns []model.StockTransaction, clamp bool,
) error {
	if len(txns) == 0 {
		return nil
	}
	if err := tx.Create(&txns).Error; err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, txn := range txns {
		quantity := gorm.Expr("quantity_on_hand + ?", txn.QuantityChange)
		if clamp {
			quantity = gorm.Expr("GREATEST(quantity_on_hand + ?, 0)", txn.QuantityChange)
		}
		err := tx.Model(&model.InventoryItem{}).
			Where("book_id = ?", txn.BookID).
			Updates(map[string]any{"quantity_on_hand": quantity, "last_updated": now}).Error
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

// AdjustmentTransactions — ประวัติการปรับยอดด้วยมือทั้งหมด ล่าสุดขึ้นก่อน
func (r *InventoryRepository) AdjustmentTransactions() ([]model.StockTransaction, error) {
	var txns []model.StockTransaction
	err := r.db.Where("type = ?", model.StockTxnTypeAdjustment).
		Order("txn_date DESC, txn_id DESC").Find(&txns).Error
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

// ListForCustomer — การแจ้งเตือนของลูกค้าคนหนึ่ง ใหม่สุดขึ้นก่อน
func (r *NotificationRepository) ListForCustomer(customerID int) ([]model.Notification, error) {
	var notifications []model.Notification
	err := r.db.Where("to_role = ? AND customer_id = ?", model.RoleCustomer, customerID).
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

func (r *NotificationRepository) MarkReadForCustomer(id, customerID int) error {
	result := r.db.Model(&model.Notification{}).
		Where("id = ? AND to_role = ? AND customer_id = ?", id, model.RoleCustomer, customerID).
		Update("read", true)
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

func (r *NotificationRepository) MarkAllReadForCustomer(customerID int) error {
	return r.db.Model(&model.Notification{}).
		Where("to_role = ? AND customer_id = ? AND read = false", model.RoleCustomer, customerID).
		Update("read", true).Error
}

// ── การตรวจนับสต็อก ─────────────────────────────────────────────────────

// LockItemsByBook — อ่านยอดคงเหลือของหนังสือชุดหนึ่งพร้อมล็อกแถว
// ใช้ก่อนปรับยอดด้วยมือ เพื่อให้การตรวจ "ติดลบไหม" กับการเขียนอยู่ในภาพเดียวกัน
func (r *InventoryRepository) LockItemsByBook(tx *gorm.DB, bookIDs []int) (map[int]model.InventoryItem, error) {
	items := map[int]model.InventoryItem{}
	if len(bookIDs) == 0 {
		return items, nil
	}

	var rows []model.InventoryItem
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("book_id IN ?", bookIDs).
		Order("book_id").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		items[row.BookID] = row
	}
	return items, nil
}

func (r *InventoryRepository) CreateStockCount(tx *gorm.DB, count *model.StockCount) error {
	return tx.Create(count).Error
}

func (r *InventoryRepository) CreateCountItems(tx *gorm.DB, items []model.StockCountItem) error {
	if len(items) == 0 {
		return nil
	}
	return tx.Create(&items).Error
}

func (r *InventoryRepository) CreateReport(tx *gorm.DB, report *model.StockDiscrepancyReport) error {
	return tx.Create(report).Error
}

// ListStockCounts — รอบตรวจนับทั้งหมด ใหม่สุดขึ้นก่อน พร้อมรายการที่นับ
func (r *InventoryRepository) ListStockCounts() ([]model.StockCount, error) {
	var counts []model.StockCount
	err := r.db.Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("book_id") }).
		Order("count_id DESC").
		Find(&counts).Error
	return counts, err
}

func (r *InventoryRepository) FindStockCount(countID int) (*model.StockCount, error) {
	var count model.StockCount
	err := r.db.Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("book_id") }).
		First(&count, "count_id = ?", countID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrStockCountNotFound
	}
	if err != nil {
		return nil, err
	}
	return &count, nil
}

// CountedQty — จำนวนที่นับได้จริงของหนังสือเล่มหนึ่งในรอบหนึ่ง
// ใช้ตอนอนุมัติผลต่าง เพราะต้องตั้งยอดเท่าที่นับได้ ไม่ใช่บวก variance ที่อาจเก่าไปแล้ว
func (r *InventoryRepository) CountedQty(db *gorm.DB, countID, bookID int) (int, error) {
	var item model.StockCountItem
	err := db.First(&item, "count_id = ? AND book_id = ?", countID, bookID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, model.ErrStockCountNotFound
	}
	if err != nil {
		return 0, err
	}
	return item.CountedQty, nil
}

// ListDiscrepancies — รายงานผลต่าง ใหม่สุดขึ้นก่อน · status ว่าง = ไม่กรอง
func (r *InventoryRepository) ListDiscrepancies(status model.ApprovalStatus) ([]model.StockDiscrepancyReport, error) {
	query := r.db.Model(&model.StockDiscrepancyReport{}).Order("report_id DESC")
	if status != "" {
		query = query.Where("approval_status = ?", status)
	}

	var reports []model.StockDiscrepancyReport
	err := query.Find(&reports).Error
	return reports, err
}

// FindReportForUpdate — อ่านรายงานพร้อมล็อกแถว กันผู้จัดการสองคนกดตัดสินพร้อมกัน
func (r *InventoryRepository) FindReportForUpdate(tx *gorm.DB, reportID int) (*model.StockDiscrepancyReport, error) {
	var report model.StockDiscrepancyReport
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&report, "report_id = ?", reportID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrDiscrepancyNotFound
	}
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *InventoryRepository) SaveReport(tx *gorm.DB, report *model.StockDiscrepancyReport) error {
	return tx.Model(&model.StockDiscrepancyReport{}).
		Where("report_id = ?", report.ReportID).
		Updates(map[string]any{
			"approval_status": report.ApprovalStatus,
			"note":            report.Note,
			"resolved_by":     report.ResolvedBy,
			"resolved_at":     report.ResolvedAt,
		}).Error
}
