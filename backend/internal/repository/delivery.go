// delivery.go — พัสดุ ประวัติการติดตาม บริษัทขนส่ง และสรุปบัญชีพัสดุ
// (ระบบย่อยของดวงกมล กองพันธ์)
package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type DeliveryRepository struct{ db *gorm.DB }

func NewDeliveryRepository(db *gorm.DB) *DeliveryRepository {
	return &DeliveryRepository{db: db}
}

// ── บริษัทขนส่ง ─────────────────────────────────────────────────────────

func (r *DeliveryRepository) ListCarriers() ([]model.ShippingCompany, error) {
	var carriers []model.ShippingCompany
	err := r.db.Order("carrier_id").Find(&carriers).Error
	return carriers, err
}

func (r *DeliveryRepository) CarrierExists(db *gorm.DB, carrierID int) (bool, error) {
	var count int64
	err := db.Model(&model.ShippingCompany{}).Where("carrier_id = ?", carrierID).Count(&count).Error
	return count > 0, err
}

// CarrierNames — แผนที่ carrierId → ชื่อ ใช้เติมชื่อขนส่งลงหน้าจอและลงสรุปพัสดุ
func (r *DeliveryRepository) CarrierNames() (map[int]string, error) {
	carriers, err := r.ListCarriers()
	if err != nil {
		return nil, err
	}
	names := make(map[int]string, len(carriers))
	for _, carrier := range carriers {
		names[carrier.CarrierID] = carrier.Name
	}
	return names, nil
}

// ── พัสดุ ───────────────────────────────────────────────────────────────

// ShipmentFilter — ตัวกรองของหน้ารายการพัสดุ
// CustomerID > 0 = เฉพาะพัสดุของคำสั่งซื้อที่ลูกค้ารายนั้นเป็นเจ้าของ
type ShipmentFilter struct {
	Status     model.ShipmentStatus
	CustomerID int
}

func (r *DeliveryRepository) List(filter ShipmentFilter) ([]model.Shipment, error) {
	query := r.db.
		Preload("Tracking", func(db *gorm.DB) *gorm.DB { return db.Order("update_date, tracking_id") }).
		Order("shipment_id DESC")

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.CustomerID > 0 {
		query = query.Where(
			"order_id IN (SELECT order_id FROM customer_order WHERE customer_id = ?)", filter.CustomerID)
	}

	var shipments []model.Shipment
	err := query.Find(&shipments).Error
	return shipments, err
}

func (r *DeliveryRepository) Find(db *gorm.DB, shipmentID int) (*model.Shipment, error) {
	var shipment model.Shipment
	err := db.
		Preload("Tracking", func(db *gorm.DB) *gorm.DB { return db.Order("update_date, tracking_id") }).
		First(&shipment, "shipment_id = ?", shipmentID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrShipmentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &shipment, nil
}

func (r *DeliveryRepository) FindByOrder(db *gorm.DB, orderID int) (*model.Shipment, error) {
	var shipment model.Shipment
	err := db.
		Preload("Tracking", func(db *gorm.DB) *gorm.DB { return db.Order("update_date, tracking_id") }).
		First(&shipment, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrShipmentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &shipment, nil
}

// FindForUpdate — อ่านพร้อมล็อกแถวหัวเอกสาร กันอัปเดตสถานะพัสดุซ้อนกัน
//
// Preload กับ FOR UPDATE ใช้พร้อมกันไม่ได้ จึงล็อกหัวเอกสารก่อนแล้วค่อยอ่านประวัติตามทีหลัง
// (เหตุผลเดียวกับ OrderRepository.FindForUpdate)
func (r *DeliveryRepository) FindForUpdate(tx *gorm.DB, shipmentID int) (*model.Shipment, error) {
	var shipment model.Shipment
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&shipment, "shipment_id = ?", shipmentID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrShipmentNotFound
	}
	if err != nil {
		return nil, err
	}
	err = tx.Order("update_date, tracking_id").
		Find(&shipment.Tracking, "shipment_id = ?", shipmentID).Error
	if err != nil {
		return nil, err
	}
	return &shipment, nil
}

func (r *DeliveryRepository) ExistsForOrder(db *gorm.DB, orderID int) (bool, error) {
	var count int64
	err := db.Model(&model.Shipment{}).Where("order_id = ?", orderID).Count(&count).Error
	return count > 0, err
}

// Create — สร้างพัสดุพร้อมประวัติแถวแรกในครั้งเดียว
func (r *DeliveryRepository) Create(tx *gorm.DB, shipment *model.Shipment) error {
	return tx.Create(shipment).Error
}

// Save — เขียนสถานะและข้อมูลพัสดุกลับลงหัวเอกสาร (ประวัติเพิ่มด้วย AddTracking)
func (r *DeliveryRepository) Save(tx *gorm.DB, shipment *model.Shipment) error {
	return tx.Model(&model.Shipment{}).
		Where("shipment_id = ?", shipment.ShipmentID).
		Updates(map[string]any{
			"carrier_id":      shipment.CarrierID,
			"tracking_number": shipment.TrackingNumber,
			"recipient_name":  shipment.RecipientName,
			"shipped_date":    shipment.ShippedDate,
			"status":          shipment.Status,
		}).Error
}

// AddTracking — บันทึกประวัติการติดตามที่เพิ่งเกิดขึ้น
func (r *DeliveryRepository) AddTracking(tx *gorm.DB, rows []model.ShipmentTracking) error {
	if len(rows) == 0 {
		return nil
	}
	return tx.Create(&rows).Error
}

// ShippedOn — พัสดุทั้งหมดที่ออกจากร้านในวันที่กำหนด (ใช้ออกสรุปบัญชีพัสดุ)
func (r *DeliveryRepository) ShippedOn(date model.Date) ([]model.Shipment, error) {
	var shipments []model.Shipment
	err := r.db.Where("shipped_date = ?", date).Order("shipment_id").Find(&shipments).Error
	return shipments, err
}

// ── สรุปบัญชีพัสดุ ──────────────────────────────────────────────────────

func (r *DeliveryRepository) ListSummaries() ([]model.DeliverySummary, error) {
	var summaries []model.DeliverySummary
	err := r.db.Order("summary_id DESC").Find(&summaries).Error
	return summaries, err
}

func (r *DeliveryRepository) CreateSummary(summary *model.DeliverySummary) error {
	return r.db.Create(summary).Error
}

// FindByOrderForUpdate — อ่านพัสดุของคำสั่งซื้อพร้อมล็อกแถว
// ใช้ตอนปิดพัสดุคู่กับการยืนยันรับสินค้าในทรานแซกชันเดียวกัน
func (r *DeliveryRepository) FindByOrderForUpdate(tx *gorm.DB, orderID int) (*model.Shipment, error) {
	var shipment model.Shipment
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&shipment, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrShipmentNotFound
	}
	if err != nil {
		return nil, err
	}
	err = tx.Order("update_date, tracking_id").
		Find(&shipment.Tracking, "shipment_id = ?", shipment.ShipmentID).Error
	if err != nil {
		return nil, err
	}
	return &shipment, nil
}
