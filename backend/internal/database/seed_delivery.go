// seed_delivery.go — บริษัทขนส่งตั้งต้น และพัสดุของคำสั่งซื้อที่ส่งถึงแล้ว
// (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// รายชื่อบริษัทขนส่งคัดจาก CARRIERS ใน frontend/src/admin/orders/orders.ts ตรงตัว
// เพราะเป็นตัวเลือกที่หน้าจอบันทึกการจัดส่งให้ฝ่ายจัดส่งเลือกอยู่แล้ว
package database

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// seedCarriers — บริษัทขนส่งที่ร้านใช้
//
// trackingUrlTemplate เป็นที่อยู่หน้าติดตามพัสดุที่มี {tracking} ให้หน้าจอแทนค่า
// (ที่อยู่จริงของแต่ละเจ้าอาจเปลี่ยนได้ ถือเป็นข้อมูลตัวอย่างสำหรับงานวิชา)
var seedCarriers = []model.ShippingCompany{
	{CarrierID: 1, Name: "ไปรษณีย์ไทย", TrackingURLTemplate: "https://track.thailandpost.co.th/?trackNumber={tracking}"},
	{CarrierID: 2, Name: "Kerry Express", TrackingURLTemplate: "https://th.kerryexpress.com/th/track/?track={tracking}"},
	{CarrierID: 3, Name: "Flash Express", TrackingURLTemplate: "https://www.flashexpress.com/fle/tracking?se={tracking}"},
	{CarrierID: 4, Name: "J&T Express", TrackingURLTemplate: "https://www.jtexpress.co.th/service/track?billcode={tracking}"},
	{CarrierID: 5, Name: "DHL Express", TrackingURLTemplate: "https://www.dhl.com/th-en/home/tracking.html?tracking-id={tracking}"},
}

// seedShipment — พัสดุของคำสั่งซื้อตั้งต้นหนึ่งใบ (ไม่ใช่ทุกใบที่ถูกส่งแล้ว)
type seedShipment struct {
	CarrierID      int
	TrackingNumber string
	RecipientName  string
	ShippedDate    string // YYYY-MM-DD
	Status         model.ShipmentStatus
	Tracking       []seedTrackingStep
}

type seedTrackingStep struct {
	Status   model.ShipmentStatus
	Location string
	At       string // ISO-8601
	Note     string
}

// seedShipmentFor — เปิดแถวพัสดุคู่กับคำสั่งซื้อตั้งต้นที่ถูกจัดส่งแล้ว
func seedShipmentFor(tx *gorm.DB, row seedOrderRow) error {
	if row.Shipment == nil {
		return nil
	}
	parcel := *row.Shipment

	shipment := model.Shipment{
		OrderID:        row.OrderID,
		CarrierID:      parcel.CarrierID,
		TrackingNumber: parcel.TrackingNumber,
		RecipientName:  parcel.RecipientName,
		ShippedDate:    mustDate(parcel.ShippedDate),
		Status:         parcel.Status,
	}
	for _, step := range parcel.Tracking {
		shipment.Tracking = append(shipment.Tracking, model.ShipmentTracking{
			Status:     step.Status,
			Location:   step.Location,
			UpdateDate: mustTime(step.At),
			Note:       step.Note,
		})
	}
	if err := tx.Create(&shipment).Error; err != nil {
		return fmt.Errorf("ใส่รายการจัดส่งของคำสั่งซื้อ %d ไม่สำเร็จ: %w", row.OrderID, err)
	}
	return nil
}
