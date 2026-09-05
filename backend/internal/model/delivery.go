// delivery.go — จัดการการจัดส่ง
// อ้างอิง class diagram: Sub1-Delivery.md
//
//	Order "1" --> "1" Shipment : shipped via
//	Shipment "*" --> "1" ShippingCompany : carrier
//	Shipment "1" *-- "*" ShipmentTracking : tracking
//	DeliveryStaff "1" --> "*" Shipment : delivers
//	DeliveryStaff "1" --> "*" DeliverySummary : summarizes
package model

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// ShippingCompany — บริษัทขนส่งที่ร้านใช้ (ข้อมูลอ้างอิง อ่านอย่างเดียว)
//
// TrackingURLTemplate เก็บ URL ที่มี {tracking} ให้หน้าจอแทนค่าเลขพัสดุ
// แล้วเปิดหน้าติดตามของบริษัทขนส่งได้เลย
type ShippingCompany struct {
	CarrierID           int    `gorm:"column:carrier_id;primaryKey;autoIncrement" json:"carrierId"`
	Name                string `gorm:"column:name;type:varchar(200);not null" json:"name"`
	TrackingURLTemplate string `gorm:"column:tracking_url_template;type:varchar(300)" json:"trackingUrlTemplate,omitempty"`
}

func (ShippingCompany) TableName() string { return "shipping_company" }

// Shipment — พัสดุของคำสั่งซื้อหนึ่งใบ (1 ต่อ 1 ตาม diagram)
//
// RecipientName แยกจากชื่อลูกค้า เพราะผู้รับปลายทางอาจเป็นคนละคนกับคนสั่ง
type Shipment struct {
	ShipmentID     int                `gorm:"column:shipment_id;primaryKey;autoIncrement" json:"shipmentId"`
	OrderID        int                `gorm:"column:order_id;not null;uniqueIndex" json:"orderId"`
	CarrierID      int                `gorm:"column:carrier_id;not null;index" json:"carrierId"`
	TrackingNumber string             `gorm:"column:tracking_number;type:varchar(100);not null" json:"trackingNumber"`
	RecipientName  string             `gorm:"column:recipient_name;type:varchar(200);not null" json:"recipientName"`
	ShippedDate    Date               `gorm:"column:shipped_date;type:date;not null" json:"shippedDate"`
	Status         ShipmentStatus     `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	Tracking       []ShipmentTracking `gorm:"foreignKey:ShipmentID;references:ShipmentID;constraint:OnDelete:CASCADE" json:"tracking"`
}

func (Shipment) TableName() string { return "shipment" }

// ShipmentTracking — ประวัติสถานะของพัสดุแต่ละครั้งที่ขนส่งอัปเดต
type ShipmentTracking struct {
	TrackingID int            `gorm:"column:tracking_id;primaryKey;autoIncrement" json:"trackingId"`
	ShipmentID int            `gorm:"column:shipment_id;not null;index" json:"-"`
	Status     ShipmentStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
	Location   string         `gorm:"column:location;type:varchar(200)" json:"location,omitempty"`
	UpdateDate time.Time      `gorm:"column:update_date;type:timestamptz(0);not null" json:"updateDate"`
	Note       string         `gorm:"column:note;type:text" json:"note,omitempty"`
}

func (ShipmentTracking) TableName() string { return "shipment_tracking" }

// shipmentTransitions — สถานะที่ไปต่อได้จากแต่ละสถานะ
//
// พัสดุที่ส่งถึงแล้วหรือส่งไม่สำเร็จเป็นปลายทาง — จะแก้ต้องเปิดใบใหม่
// FAILED แตกออกได้เฉพาะตอนที่พัสดุออกจากร้านไปแล้ว (ยังไม่ออกก็ยังไม่มีอะไรล้มเหลว)
var shipmentTransitions = map[ShipmentStatus][]ShipmentStatus{
	ShipmentStatusPreparing: {ShipmentStatusShipped},
	ShipmentStatusShipped:   {ShipmentStatusInTransit, ShipmentStatusDelivered, ShipmentStatusFailed},
	ShipmentStatusInTransit: {ShipmentStatusDelivered, ShipmentStatusFailed},
	ShipmentStatusDelivered: {},
	ShipmentStatusFailed:    {},
}

// CanTransitionTo — เปลี่ยนจากสถานะปัจจุบันไปสถานะนี้ได้ไหม
func (s Shipment) CanTransitionTo(next ShipmentStatus) bool {
	for _, allowed := range shipmentTransitions[s.Status] {
		if allowed == next {
			return true
		}
	}
	return false
}

// Record — เปิดรายการจัดส่งใหม่ (`+record()` ใน class diagram)
//
// เริ่มที่ PREPARING เสมอ แล้วบันทึกประวัติแถวแรกไว้ให้ ไม่ต้องให้ผู้เรียกจำเอง
func (s *Shipment) Record(at time.Time) {
	s.Status = ShipmentStatusPreparing
	s.Tracking = append(s.Tracking, ShipmentTracking{
		Status:     ShipmentStatusPreparing,
		Location:   "คลังสินค้า BookHaven",
		UpdateDate: at.UTC().Truncate(time.Second),
		Note:       "เปิดรายการจัดส่ง",
	})
}

// UpdateStatus — ขนส่งอัปเดตสถานะพัสดุ (`+updateStatus(s)` ใน class diagram)
//
// เขียนประวัติหนึ่งแถวทุกครั้งที่เปลี่ยน จึงย้อนดูได้ว่าพัสดุผ่านที่ไหนมาบ้าง
func (s *Shipment) UpdateStatus(next ShipmentStatus, location, note string, at time.Time) error {
	if !next.IsValid() {
		return ErrInvalidShipmentStatus
	}
	if !s.CanTransitionTo(next) {
		return ShipmentTransitionRejected(s.Status, next)
	}
	s.Status = next
	s.Tracking = append(s.Tracking, ShipmentTracking{
		ShipmentID: s.ShipmentID,
		Status:     next,
		Location:   strings.TrimSpace(location),
		UpdateDate: at.UTC().Truncate(time.Second),
		Note:       strings.TrimSpace(note),
	})
	return nil
}

// Track — สถานะล่าสุดของพัสดุ (`+track() ShipmentStatus` ใน class diagram)
func (s Shipment) Track() ShipmentStatus { return s.Status }

// IsClosed — พัสดุที่ถึงปลายทางแล้ว (ส่งถึงหรือส่งไม่สำเร็จ) แตะต่อไม่ได้
func (s Shipment) IsClosed() bool {
	return s.Status == ShipmentStatusDelivered || s.Status == ShipmentStatusFailed
}

// DeliverySummary — สรุปบัญชีพัสดุประจำวันที่ฝ่ายจัดส่งสั่งออก
//
// เก็บผลลัพธ์ไว้เป็นแถวเหมือน PaymentReport เพราะเป็น "สรุปที่ออก ณ วันหนึ่ง"
// ตัวเลขต้องคงที่แม้ข้อมูลหลังจากนั้นจะเปลี่ยน
type DeliverySummary struct {
	SummaryID      int    `gorm:"column:summary_id;primaryKey;autoIncrement" json:"summaryId"`
	SummaryDate    Date   `gorm:"column:summary_date;type:date;not null" json:"summaryDate"`
	TotalParcels   int    `gorm:"column:total_parcels;not null" json:"totalParcels"`
	TotalByCarrier string `gorm:"column:total_by_carrier;type:text" json:"totalByCarrier"`
	GeneratedBy    string `gorm:"column:generated_by;type:varchar(200);not null" json:"generatedBy"`
}

func (DeliverySummary) TableName() string { return "delivery_summary" }

// Generate — สรุปจำนวนพัสดุของวันนั้น (`+generate()` ใน class diagram)
//
// totalByCarrier ใน diagram เป็น string จึงสรุปเป็นข้อความ "ชื่อขนส่ง n ชิ้น" คั่นด้วย ·
// เรียงตามชื่อขนส่ง เพื่อให้ข้อมูลชุดเดียวกันได้ผลเหมือนเดิมทุกครั้ง
func (d *DeliverySummary) Generate(shipments []Shipment, carrierNames map[int]string) {
	d.TotalParcels = len(shipments)

	counts := map[string]int{}
	for _, shipment := range shipments {
		name := carrierNames[shipment.CarrierID]
		if name == "" {
			name = fmt.Sprintf("ขนส่ง #%d", shipment.CarrierID)
		}
		counts[name]++
	}

	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	sort.Strings(names)

	parts := make([]string, len(names))
	for i, name := range names {
		parts[i] = fmt.Sprintf("%s %d ชิ้น", name, counts[name])
	}
	d.TotalByCarrier = strings.Join(parts, " · ")
}

// FormatShipmentCode / FormatSummaryCode — รหัสที่หน้าจอแสดง (SHP-1 · DSM001)
func FormatShipmentCode(shipmentID int) string { return fmt.Sprintf("SHP-%d", shipmentID) }
func FormatSummaryCode(summaryID int) string   { return fmt.Sprintf("DSM%03d", summaryID) }
