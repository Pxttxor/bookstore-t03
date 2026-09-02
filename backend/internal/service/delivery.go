// delivery.go — จัดการการจัดส่ง (คลาสของดวงกมล กองพันธ์)
//
// การ "บันทึกการจัดส่ง" กับ "ยืนยันรับสินค้า" ไม่ได้อยู่ที่นี่ แต่อยู่ใน OrderService
// เพราะเป็นเหตุการณ์เดียวกับการเปลี่ยนสถานะคำสั่งซื้อ — เหตุผลเดียวกับการตรวจสลิปใน P5
// ที่นี่รับผิดชอบการอ่าน การอัปเดตสถานะระหว่างทางของขนส่ง และสรุปบัญชีพัสดุ
package service

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type DeliveryService struct {
	db            *gorm.DB
	deliveries    *repository.DeliveryRepository
	orders        *repository.OrderRepository
	notifications *repository.NotificationRepository
}

func NewDeliveryService(
	db *gorm.DB,
	deliveries *repository.DeliveryRepository,
	orders *repository.OrderRepository,
	notifications *repository.NotificationRepository,
) *DeliveryService {
	return &DeliveryService{db: db, deliveries: deliveries, orders: orders, notifications: notifications}
}

// ShipmentInput — ฟอร์มบันทึกการจัดส่งของฝ่ายจัดส่ง (`DeliveryStaff.recordShipment()`)
//
// RecipientName ไม่บังคับ — เว้นไว้แปลว่าผู้รับคือลูกค้าที่สั่งเอง
type ShipmentInput struct {
	CarrierID      int    `json:"carrierId"`
	TrackingNumber string `json:"trackingNumber"`
	RecipientName  string `json:"recipientName,omitempty"`
}

// TrackingInput — ขนส่งอัปเดตความคืบหน้าระหว่างทาง
type TrackingInput struct {
	Status   model.ShipmentStatus `json:"status"`
	Location string               `json:"location,omitempty"`
	Note     string               `json:"note,omitempty"`
}

// SummaryInput — วันที่ที่ฝ่ายจัดส่งสั่งออกสรุปบัญชีพัสดุ (เว้นว่าง = วันนี้)
type SummaryInput struct {
	SummaryDate model.Date `json:"summaryDate"`
}

// ShipmentView — พัสดุพร้อมชื่อบริษัทขนส่งและลิงก์ติดตามที่หน้าจอต้องแสดง
type ShipmentView struct {
	Shipment    model.Shipment
	CarrierName string
	TrackingURL string
}

func (s *DeliveryService) Carriers() ([]model.ShippingCompany, error) {
	return s.deliveries.ListCarriers()
}

// List — รายการพัสดุ · ลูกค้าเห็นเฉพาะพัสดุของใบตัวเองเสมอ ไม่ว่าจะส่งตัวกรองอะไรมา
func (s *DeliveryService) List(current Identity, status model.ShipmentStatus) ([]ShipmentView, error) {
	if status != "" && !status.IsValid() {
		return nil, model.ErrInvalidShipmentStatus
	}

	filter := repository.ShipmentFilter{Status: status}
	if current.IsCustomer() {
		filter.CustomerID = current.CustomerID
	}

	shipments, err := s.deliveries.List(filter)
	if err != nil {
		return nil, err
	}
	return s.views(shipments)
}

func (s *DeliveryService) Get(current Identity, shipmentID int) (*ShipmentView, error) {
	shipment, err := s.deliveries.Find(s.db, shipmentID)
	if err != nil {
		return nil, err
	}
	if err := s.assertOwner(current, shipment.OrderID); err != nil {
		return nil, err
	}
	return s.single(*shipment)
}

// ForOrder — พัสดุของคำสั่งซื้อใบหนึ่ง (หน้าติดตามพัสดุของลูกค้า)
func (s *DeliveryService) ForOrder(current Identity, orderID int) (*ShipmentView, error) {
	if err := s.assertOwner(current, orderID); err != nil {
		return nil, err
	}
	shipment, err := s.deliveries.FindByOrder(s.db, orderID)
	if err != nil {
		return nil, err
	}
	return s.single(*shipment)
}

// assertOwner — ลูกค้าเปิดพัสดุของใบคนอื่นไม่ได้ (เช็คแบบเดียวกับ OrderService.Get)
func (s *DeliveryService) assertOwner(current Identity, orderID int) error {
	if !current.IsCustomer() {
		return nil
	}
	order, err := s.orders.Find(s.db, orderID)
	if err != nil {
		return err
	}
	if order.CustomerID != current.CustomerID {
		return model.ErrForbidden
	}
	return nil
}

// UpdateTracking — ขนส่งอัปเดตความคืบหน้าระหว่างทาง (IN_TRANSIT หรือ FAILED)
//
// DELIVERED ไม่รับที่นี่โดยตั้งใจ — การยืนยันรับสินค้าต้องเขียนทั้ง customer_order และ shipment
// ในทรานแซกชันเดียว จึงอยู่ที่ POST /api/orders/{id}/deliver ที่เดียว (ดู OrderService.Deliver)
func (s *DeliveryService) UpdateTracking(shipmentID int, input TrackingInput, by string) (*ShipmentView, error) {
	if input.Status == model.ShipmentStatusDelivered {
		return nil, model.ErrDeliverViaOrder
	}

	var updated model.Shipment
	err := s.db.Transaction(func(tx *gorm.DB) error {
		shipment, err := s.deliveries.FindForUpdate(tx, shipmentID)
		if err != nil {
			return err
		}

		before := len(shipment.Tracking)
		if err := shipment.UpdateStatus(input.Status, input.Location, input.Note, time.Now()); err != nil {
			return err
		}
		if err := s.deliveries.Save(tx, shipment); err != nil {
			return err
		}

		fresh := shipment.Tracking[before:]
		for i := range fresh {
			fresh[i].ShipmentID = shipment.ShipmentID
		}
		if err := s.deliveries.AddTracking(tx, fresh); err != nil {
			return err
		}

		// พัสดุที่ส่งไม่สำเร็จต้องมีคนตามเรื่องต่อ ฝ่ายขายเป็นคนคุยกับลูกค้า
		if input.Status == model.ShipmentStatusFailed {
			body := fmt.Sprintf("%s · %s · %s",
				model.FormatShipmentCode(shipment.ShipmentID),
				model.FormatOrderCode(shipment.OrderID),
				strings.TrimSpace(input.Note))
			if err := pushBothChannels(tx, s.notifications, model.RoleSales,
				model.NotifyShipmentFailed, "จัดส่งไม่สำเร็จ", body,
				fmt.Sprintf("/admin/orders/%d", shipment.OrderID)); err != nil {
				return err
			}
		}

		updated = *shipment
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.single(updated)
}

// ── สรุปบัญชีพัสดุ ──────────────────────────────────────────────────────

func (s *DeliveryService) Summaries() ([]model.DeliverySummary, error) {
	return s.deliveries.ListSummaries()
}

// GenerateSummary — สรุปจำนวนพัสดุที่ออกจากร้านในวันหนึ่ง (`DeliverySummary.generate()`)
//
// เก็บตัวเลขที่คำนวณได้ลงเป็นแถวเหมือน PaymentReport ไม่ได้คำนวณสดตอนเปิดดู
func (s *DeliveryService) GenerateSummary(input SummaryInput, by string) (*model.DeliverySummary, error) {
	date := input.SummaryDate
	if date.IsZero() {
		date = model.Today()
	}

	shipments, err := s.deliveries.ShippedOn(date)
	if err != nil {
		return nil, err
	}
	names, err := s.deliveries.CarrierNames()
	if err != nil {
		return nil, err
	}

	summary := model.DeliverySummary{SummaryDate: date, GeneratedBy: strings.TrimSpace(by)}
	summary.Generate(shipments, names)
	if err := s.deliveries.CreateSummary(&summary); err != nil {
		return nil, err
	}
	return &summary, nil
}

// ── ตัวช่วย ─────────────────────────────────────────────────────────────

func (s *DeliveryService) single(shipment model.Shipment) (*ShipmentView, error) {
	views, err := s.views([]model.Shipment{shipment})
	if err != nil {
		return nil, err
	}
	return &views[0], nil
}

func (s *DeliveryService) views(shipments []model.Shipment) ([]ShipmentView, error) {
	views := make([]ShipmentView, len(shipments))
	if len(shipments) == 0 {
		return views, nil
	}

	carriers, err := s.deliveries.ListCarriers()
	if err != nil {
		return nil, err
	}
	index := make(map[int]model.ShippingCompany, len(carriers))
	for _, carrier := range carriers {
		index[carrier.CarrierID] = carrier
	}

	for i, shipment := range shipments {
		carrier := index[shipment.CarrierID]
		views[i] = ShipmentView{Shipment: shipment, CarrierName: carrier.Name}
		if carrier.TrackingURLTemplate != "" {
			views[i].TrackingURL = strings.ReplaceAll(
				carrier.TrackingURLTemplate, "{tracking}", shipment.TrackingNumber)
		}
	}
	return views, nil
}
