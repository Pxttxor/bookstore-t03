package model

import (
	"testing"
	"time"
)

var shipAt = time.Date(2026, 8, 30, 7, 0, 0, 0, time.UTC)

func sampleShipment() Shipment {
	shipment := Shipment{
		ShipmentID: 1, OrderID: 1001, CarrierID: 1,
		TrackingNumber: "TH-2026-083001", RecipientName: "ณภัทร วงศ์สว่าง",
		ShippedDate: NewDate(shipAt),
	}
	shipment.Record(shipAt)
	return shipment
}

func TestShipmentRecord(t *testing.T) {
	shipment := sampleShipment()

	if shipment.Status != ShipmentStatusPreparing {
		t.Errorf("สถานะเริ่มต้น = %s ต้องการ PREPARING", shipment.Status)
	}
	if len(shipment.Tracking) != 1 {
		t.Fatalf("ประวัติ = %d แถว ต้องการ 1 แถวตั้งแต่เปิดรายการ", len(shipment.Tracking))
	}
	if shipment.Track() != ShipmentStatusPreparing {
		t.Errorf("track() = %s ต้องการ PREPARING", shipment.Track())
	}
	if shipment.IsClosed() {
		t.Error("พัสดุที่เพิ่งเปิดต้องยังไม่ปิด")
	}
}

func TestShipmentHappyPath(t *testing.T) {
	shipment := sampleShipment()

	steps := []struct {
		status   ShipmentStatus
		location string
	}{
		{ShipmentStatusShipped, "ศูนย์คัดแยกกรุงเทพฯ"},
		{ShipmentStatusInTransit, "ศูนย์กระจายสินค้าเชียงใหม่"},
		{ShipmentStatusDelivered, "อำเภอเมือง เชียงใหม่"},
	}
	for _, step := range steps {
		if err := shipment.UpdateStatus(step.status, step.location, "", shipAt); err != nil {
			t.Fatalf("เปลี่ยนเป็น %s ไม่ผ่าน: %v", step.status, err)
		}
	}

	if len(shipment.Tracking) != 4 {
		t.Errorf("ประวัติ = %d แถว ต้องการ 4 (เปิดรายการ + สามครั้งที่อัปเดต)", len(shipment.Tracking))
	}
	last := shipment.Tracking[len(shipment.Tracking)-1]
	if last.Location != "อำเภอเมือง เชียงใหม่" {
		t.Errorf("สถานที่ล่าสุด = %q", last.Location)
	}
	if !shipment.IsClosed() {
		t.Error("พัสดุที่ส่งถึงแล้วต้องปิด")
	}
}

// ข้ามขั้นตอนไม่ได้ — ยังไม่ส่งออกจากร้านก็ยังส่งถึงมือลูกค้าไม่ได้
func TestShipmentSkipStepRejected(t *testing.T) {
	shipment := sampleShipment()

	err := shipment.UpdateStatus(ShipmentStatusDelivered, "", "", shipAt)
	if err == nil {
		t.Fatal("ข้ามจาก PREPARING ไป DELIVERED ต้องถูกปฏิเสธ")
	}
	domain, ok := err.(*DomainError)
	if !ok || domain.Code != "SHIPMENT_TRANSITION_REJECTED" {
		t.Errorf("รหัสข้อผิดพลาด = %v ต้องการ SHIPMENT_TRANSITION_REJECTED", err)
	}
	if shipment.Status != ShipmentStatusPreparing || len(shipment.Tracking) != 1 {
		t.Error("การเปลี่ยนที่ถูกปฏิเสธต้องไม่แตะสถานะหรือประวัติ")
	}
}

func TestShipmentClosedIsFinal(t *testing.T) {
	shipment := sampleShipment()
	_ = shipment.UpdateStatus(ShipmentStatusShipped, "", "", shipAt)
	if err := shipment.UpdateStatus(ShipmentStatusFailed, "", "ผู้รับไม่อยู่", shipAt); err != nil {
		t.Fatalf("ส่งไม่สำเร็จต้องบันทึกได้: %v", err)
	}
	if !shipment.IsClosed() {
		t.Error("พัสดุที่ส่งไม่สำเร็จต้องปิด")
	}
	if err := shipment.UpdateStatus(ShipmentStatusInTransit, "", "", shipAt); err == nil {
		t.Error("พัสดุที่ปิดแล้วต้องแก้ต่อไม่ได้")
	}
}

func TestShipmentInvalidStatus(t *testing.T) {
	shipment := sampleShipment()
	if err := shipment.UpdateStatus("ON_THE_WAY", "", "", shipAt); err != ErrInvalidShipmentStatus {
		t.Errorf("สถานะนอกชุดต้องถูกปฏิเสธ ได้ %v", err)
	}
}

func TestDeliverySummaryGenerate(t *testing.T) {
	names := map[int]string{1: "ไปรษณีย์ไทย", 2: "Kerry Express"}
	shipments := []Shipment{
		{ShipmentID: 1, CarrierID: 1}, {ShipmentID: 2, CarrierID: 2},
		{ShipmentID: 3, CarrierID: 1}, {ShipmentID: 4, CarrierID: 9},
	}

	summary := DeliverySummary{SummaryDate: NewDate(shipAt)}
	summary.Generate(shipments, names)

	if summary.TotalParcels != 4 {
		t.Errorf("จำนวนพัสดุ = %d ต้องการ 4", summary.TotalParcels)
	}
	// เรียงตามชื่อขนส่ง ผลจึงเหมือนเดิมทุกครั้งที่ข้อมูลชุดเดียวกัน
	want := "Kerry Express 1 ชิ้น · ขนส่ง #9 1 ชิ้น · ไปรษณีย์ไทย 2 ชิ้น"
	if summary.TotalByCarrier != want {
		t.Errorf("สรุปรายขนส่ง = %q\nต้องการ %q", summary.TotalByCarrier, want)
	}
}

// ป้ายไทยต้องตรงกับ SHIPMENT_STATUS_LABELS ฝั่ง frontend เป๊ะ — เป็นข้อความที่ผู้ใช้เห็นจริง
func TestShipmentStatusLabels(t *testing.T) {
	want := map[ShipmentStatus]string{
		ShipmentStatusPreparing: "กำลังเตรียม",
		ShipmentStatusShipped:   "จัดส่งแล้ว",
		ShipmentStatusInTransit: "ระหว่างขนส่ง",
		ShipmentStatusDelivered: "ส่งถึงแล้ว",
		ShipmentStatusFailed:    "จัดส่งไม่สำเร็จ",
	}
	for status, label := range want {
		if !status.IsValid() {
			t.Errorf("%s ต้องเป็นค่าที่ถูกต้อง", status)
		}
		if got := status.Label(); got != label {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", status, got, label)
		}
	}
	if ShipmentStatus("RETURNED").IsValid() {
		t.Error("ค่านอกชุดต้องไม่ผ่าน IsValid")
	}
	if len(ShipmentStatuses()) != len(want) {
		t.Errorf("ShipmentStatuses() มี %d ค่า ต้องการ %d", len(ShipmentStatuses()), len(want))
	}
}

func TestFormatDeliveryCodes(t *testing.T) {
	if got := FormatShipmentCode(7); got != "SHP-7" {
		t.Errorf("รหัสพัสดุ = %q ต้องการ SHP-7", got)
	}
	if got := FormatSummaryCode(7); got != "DSM007" {
		t.Errorf("รหัสสรุปพัสดุ = %q ต้องการ DSM007", got)
	}
}
