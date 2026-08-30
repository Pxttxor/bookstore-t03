// order.go — คำสั่งซื้อของลูกค้าและโปรโมชั่น (ระบบย่อยของจิรพนธ์ อยู่หลาย)
package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type OrderRepository struct{ db *gorm.DB }

func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

// OrderFilter — ตัวกรองของหน้ารายการคำสั่งซื้อ
// CustomerID > 0 = ดูเฉพาะของลูกค้ารายนั้น (ใช้ตอนลูกค้าดูประวัติของตัวเอง)
type OrderFilter struct {
	Status     model.OrderStatus
	CustomerID int
}

// List — คำสั่งซื้อทั้งหมดที่ผ่านตัวกรอง ใหม่สุดขึ้นก่อน
func (r *OrderRepository) List(filter OrderFilter) ([]model.Order, error) {
	query := r.db.
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("book_id") }).
		Preload("Timeline", func(db *gorm.DB) *gorm.DB { return db.Order("changed_date, history_id") }).
		Order("order_id DESC")

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.CustomerID > 0 {
		query = query.Where("customer_id = ?", filter.CustomerID)
	}

	var orders []model.Order
	err := query.Find(&orders).Error
	return orders, err
}

// Find — คำสั่งซื้อหนึ่งใบพร้อมรายการและ timeline
func (r *OrderRepository) Find(db *gorm.DB, orderID int) (*model.Order, error) {
	var order model.Order
	err := db.
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("book_id") }).
		Preload("Timeline", func(db *gorm.DB) *gorm.DB { return db.Order("changed_date, history_id") }).
		First(&order, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrCustomerOrderNotFound
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// FindForUpdate — อ่านพร้อมล็อกแถวหัวเอกสาร กันกดปุ่มเปลี่ยนสถานะซ้อนกัน
//
// Preload กับ FOR UPDATE ใช้พร้อมกันไม่ได้ (GORM ยิงคนละคำสั่ง จึงล็อกได้แค่แถวแม่)
// จึงล็อกหัวเอกสารก่อนแล้วค่อย Find รายการลูกตามทีหลัง — แบบเดียวกับ findOrder ของระบบจัดซื้อ
func (r *OrderRepository) FindForUpdate(tx *gorm.DB, orderID int) (*model.Order, error) {
	var order model.Order
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&order, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrCustomerOrderNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := tx.Order("book_id").Find(&order.Items, "order_id = ?", orderID).Error; err != nil {
		return nil, err
	}
	err = tx.Order("changed_date, history_id").Find(&order.Timeline, "order_id = ?", orderID).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// Create — สร้างคำสั่งซื้อพร้อมรายการและ timeline แถวแรกในครั้งเดียว
func (r *OrderRepository) Create(tx *gorm.DB, order *model.Order) error {
	return tx.Create(order).Error
}

// Save — เขียนสถานะและยอดเงินกลับลงหัวเอกสาร (รายการสินค้าไม่แก้หลังสั่งแล้ว)
func (r *OrderRepository) Save(tx *gorm.DB, order *model.Order) error {
	return tx.Model(&model.Order{}).
		Where("order_id = ?", order.OrderID).
		Updates(map[string]any{
			"status":          order.Status,
			"subtotal":        order.Subtotal,
			"discount_amount": order.DiscountAmount,
			"net_amount":      order.NetAmount,
			"promotion_id":    order.PromotionID,
			"slip_file_name":  order.SlipFileName,
		}).Error
}

// AddHistory — บันทึกแถว timeline ที่เพิ่งเกิดขึ้น
func (r *OrderRepository) AddHistory(tx *gorm.DB, rows []model.OrderStatusHistory) error {
	if len(rows) == 0 {
		return nil
	}
	return tx.Create(&rows).Error
}

// ── โปรโมชั่น ───────────────────────────────────────────────────────────

type PromotionRepository struct{ db *gorm.DB }

func NewPromotionRepository(db *gorm.DB) *PromotionRepository {
	return &PromotionRepository{db: db}
}

func (r *PromotionRepository) List() ([]model.Promotion, error) {
	var promotions []model.Promotion
	err := r.db.Order("promotion_id").Find(&promotions).Error
	return promotions, err
}

// Active — โปรโมชั่นที่ยังเปิดใช้งานอยู่ ใช้ตอนหาส่วนลดให้คำสั่งซื้อ
func (r *PromotionRepository) Active() ([]model.Promotion, error) {
	var promotions []model.Promotion
	err := r.db.Where("status = ?", model.PromotionStatusActive).
		Order("promotion_id").Find(&promotions).Error
	return promotions, err
}

func (r *PromotionRepository) Find(db *gorm.DB, promotionID int) (*model.Promotion, error) {
	var promotion model.Promotion
	err := db.First(&promotion, "promotion_id = ?", promotionID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrPromotionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &promotion, nil
}

func (r *PromotionRepository) Create(promotion *model.Promotion) error {
	return r.db.Create(promotion).Error
}

func (r *PromotionRepository) Save(promotion *model.Promotion) error {
	return r.db.Model(&model.Promotion{}).
		Where("promotion_id = ?", promotion.PromotionID).
		Updates(map[string]any{
			"name":             promotion.Name,
			"type":             promotion.Type,
			"condition_detail": promotion.ConditionDetail,
			"discount_value":   promotion.DiscountValue,
			"is_percent":       promotion.IsPercent,
			"min_qty":          promotion.MinQty,
			"min_amount":       promotion.MinAmount,
			"start_date":       promotion.StartDate,
			"end_date":         promotion.EndDate,
			"status":           promotion.Status,
		}).Error
}

// Delete — ลบโปรโมชั่นที่ยังไม่เคยถูกใช้
// คำสั่งซื้อที่อ้างโปรโมชั่นอยู่จะถูก FK กันไว้ ผู้จัดการต้องปิดใช้งานแทนการลบ
func (r *PromotionRepository) Delete(promotionID int) error {
	result := r.db.Delete(&model.Promotion{}, "promotion_id = ?", promotionID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return model.ErrPromotionNotFound
	}
	return nil
}

// UsedByOrders — มีคำสั่งซื้อใบไหนอ้างโปรโมชั่นนี้อยู่ไหม
func (r *PromotionRepository) UsedByOrders(promotionID int) (bool, error) {
	var count int64
	err := r.db.Model(&model.Order{}).Where("promotion_id = ?", promotionID).Count(&count).Error
	return count > 0, err
}
