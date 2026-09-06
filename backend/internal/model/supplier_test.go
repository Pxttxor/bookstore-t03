// supplier_test.go — ทดสอบกฎของผู้จัดจำหน่ายและชนิด Date
package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestSupplierRegisterAndDeactivate(t *testing.T) {
	supplier := &Supplier{}
	supplier.Register()
	if supplier.Status != SupplierStatusActive {
		t.Fatalf("สถานะหลังขึ้นทะเบียน = %s, ต้องการ ACTIVE", supplier.Status)
	}
	if !supplier.IsActive() {
		t.Error("ผู้จัดจำหน่ายที่เพิ่งขึ้นทะเบียนต้องใช้งานได้")
	}

	if err := supplier.Deactivate(); err != nil {
		t.Fatalf("ปิดใช้งานควรผ่าน: %v", err)
	}
	if supplier.Status != SupplierStatusCancelled {
		t.Errorf("สถานะ = %s, ต้องการ CANCELLED", supplier.Status)
	}

	// ปิดซ้ำต้องไม่ผ่าน — หน้าจอปิดปุ่มไว้แล้ว แต่ API ต้องกันเองด้วย
	if err := supplier.Deactivate(); err == nil {
		t.Error("ปิดใช้งานซ้ำต้องไม่ผ่าน")
	}
}

// U2: ชื่อบริษัทแก้ได้ (SupplierService.Update ตรวจชื่อซ้ำกับรายอื่นก่อนเรียก)
func TestUpdateInfoChangesCompanyName(t *testing.T) {
	supplier := &Supplier{CompanyName: "สำนักพิมพ์ก้าวหน้า", ContactName: "สมศักดิ์ ทองดี"}
	supplier.UpdateInfo("สำนักพิมพ์รุ่งเรือง", "วราภรณ์ ศรีสุข", "081-000-0000", "new@example.com",
		"ที่อยู่ใหม่", "ส่วนลด 40%", "เครดิต 60 วัน")

	if supplier.CompanyName != "สำนักพิมพ์รุ่งเรือง" {
		t.Errorf("ชื่อบริษัท = %q, ต้องการ สำนักพิมพ์รุ่งเรือง", supplier.CompanyName)
	}
	if supplier.ContactName != "วราภรณ์ ศรีสุข" {
		t.Errorf("ผู้ติดต่อ = %q, ต้องการ วราภรณ์ ศรีสุข", supplier.ContactName)
	}
}

// U6 ต้องรู้ว่าผู้จัดจำหน่ายเสนอขายเล่มนี้ไหม และราคาส่งเท่าไร
func TestSupplierOffers(t *testing.T) {
	supplier := &Supplier{Books: []SupplierBook{
		{BookID: 101, SupplyPrice: 285, LeadTimeDays: 7},
	}}

	offer, ok := supplier.Offers(101)
	if !ok {
		t.Fatal("ควรพบหนังสือเล่ม 101")
	}
	if offer.SupplyPrice != 285 {
		t.Errorf("ราคาส่ง = %.2f, ต้องการ 285", offer.SupplyPrice)
	}
	if _, ok := supplier.Offers(999); ok {
		t.Error("ไม่ควรพบหนังสือที่ไม่ได้เสนอขาย")
	}
}

// Date ต้องออกทาง JSON เป็น "YYYY-MM-DD" ให้ตรงกับที่ TypeScript ประกาศไว้เป็น string
func TestDateJSONRoundTrip(t *testing.T) {
	type payload struct {
		CreatedDate Date `json:"createdDate"`
	}

	encoded, err := json.Marshal(payload{CreatedDate: NewDate(time.Date(2026, 7, 28, 15, 4, 5, 0, time.UTC))})
	if err != nil {
		t.Fatalf("แปลงเป็น JSON ไม่สำเร็จ: %v", err)
	}
	if string(encoded) != `{"createdDate":"2026-07-28"}` {
		t.Errorf("JSON = %s, ต้องการ {\"createdDate\":\"2026-07-28\"}", encoded)
	}

	var decoded payload
	if err := json.Unmarshal([]byte(`{"createdDate":"2026-08-15"}`), &decoded); err != nil {
		t.Fatalf("อ่าน JSON ไม่สำเร็จ: %v", err)
	}
	if decoded.CreatedDate.String() != "2026-08-15" {
		t.Errorf("วันที่ = %s, ต้องการ 2026-08-15", decoded.CreatedDate)
	}

	// frontend บางจุดส่ง ISO เต็มมา (new Date().toISOString()) ต้องอ่านได้เหมือนกัน
	if err := json.Unmarshal([]byte(`{"createdDate":"2026-08-15T07:00:00.000Z"}`), &decoded); err != nil {
		t.Fatalf("อ่าน ISO เต็มไม่สำเร็จ: %v", err)
	}
	if decoded.CreatedDate.String() != "2026-08-15" {
		t.Errorf("วันที่จาก ISO เต็ม = %s, ต้องการ 2026-08-15", decoded.CreatedDate)
	}
}

func TestDateAddDaysAndBefore(t *testing.T) {
	base := NewDate(time.Date(2026, 8, 29, 0, 0, 0, 0, time.UTC))
	if got := base.AddDays(14).String(); got != "2026-09-12" {
		t.Errorf("บวก 14 วัน = %s, ต้องการ 2026-09-12", got)
	}
	if !base.Before(base.AddDays(1)) {
		t.Error("วันนี้ต้องมาก่อนพรุ่งนี้")
	}
	if base.Before(base) {
		t.Error("วันเดียวกันไม่ควรถือว่ามาก่อน")
	}
}

// ป้ายไทยต้องตรงกับ *_STATUS_LABELS ฝั่ง frontend เพราะกรรมการเทียบข้อความบนหน้าจอ
func TestLabelsMatchFrontend(t *testing.T) {
	tests := []struct {
		got  string
		want string
	}{
		{SupplierStatusActive.Label(), "ใช้งาน"},
		{SupplierStatusCancelled.Label(), "ยกเลิก"},
		{PRStatusDraft.Label(), "ร่าง"},
		{PRStatusSubmitted.Label(), "รออนุมัติ"},
		{PRStatusApproved.Label(), "อนุมัติแล้ว"},
		{PRStatusRejected.Label(), "ตีกลับ"},
		{POStatusReceivedPartial.Label(), "รับบางส่วน"},
		{POStatusReceivedFull.Label(), "รับครบ"},
		{POStatusReturned.Label(), "ส่งคืน"},
		{ReturnStatusTracking.Label(), "กำลังติดตาม"},
		{ReturnStatusEscalated.Label(), "ส่งต่อผู้จัดการ"},
		{ReturnStatusClosed.Label(), "ปิดรายการ"},
		{ItemConditionDamaged.Label(), "ขาด/ชำรุด"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("ป้าย = %q, ต้องการ %q", tt.got, tt.want)
		}
	}
}

// รูปแบบรหัสเอกสารต้องตรงกับ formatXxxCode ฝั่ง frontend
func TestDocumentCodes(t *testing.T) {
	tests := []struct{ got, want string }{
		{FormatSupplierCode(1), "SUP01"},
		{FormatSupplierCode(12), "SUP12"},
		{FormatPRCode(101), "PR-101"},
		{FormatPOCode(2429), "PO-2429"},
		{FormatGRCode(5001), "GR-5001"},
		{FormatReturnCode(7001), "RT-7001"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("รหัส = %q, ต้องการ %q", tt.got, tt.want)
		}
	}
}

// U5: ยังไม่ตั้งจุดสั่งซื้อ = ไม่ถือว่าต่ำ ระบบข้ามการตรวจ (SCR-20 Abnormal)
func TestIsBelowReorder(t *testing.T) {
	point := func(v int) *int { return &v }

	tests := []struct {
		name string
		item InventoryItem
		want bool
	}{
		{"เหลือน้อยกว่าจุดสั่งซื้อ", InventoryItem{QuantityOnHand: 3, ReorderPoint: point(10)}, true},
		{"เท่ากับจุดสั่งซื้อพอดี", InventoryItem{QuantityOnHand: 10, ReorderPoint: point(10)}, true},
		{"มากกว่าจุดสั่งซื้อ", InventoryItem{QuantityOnHand: 24, ReorderPoint: point(10)}, false},
		{"ยังไม่ตั้งจุดสั่งซื้อ", InventoryItem{QuantityOnHand: 0, ReorderPoint: nil}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.item.IsBelowReorder(); got != tt.want {
				t.Errorf("IsBelowReorder() = %v, ต้องการ %v", got, tt.want)
			}
		})
	}
}

// ค่า enum ทุกตัวต้องผ่าน IsValid และค่าที่ไม่รู้จักต้องไม่ผ่าน
func TestEnumValidity(t *testing.T) {
	valid := []interface{ IsValid() bool }{
		SupplierStatusActive, PRStatusDraft, POStatusConfirmed,
		GRStatusFull, ReturnStatusTracking, ItemConditionNormal,
		CompensationReplacement, BookStatusActive, StockTxnTypeReceiveIn, RoleWarehouse,
	}
	for _, value := range valid {
		if !value.IsValid() {
			t.Errorf("%v ควรเป็นค่าที่ถูกต้อง", value)
		}
	}

	invalid := []interface{ IsValid() bool }{
		SupplierStatus("PENDING"), PRStatus("CANCELLED"), POStatus("REJECTED"),
		GRStatus("NONE"), ReturnStatus("OPEN"), ItemCondition("BROKEN"),
		CompensationType("REFUND"), BookStatus("DRAFT"), StockTxnType("TRANSFER"), Role("admin"),
	}
	for _, value := range invalid {
		if value.IsValid() {
			t.Errorf("%v ไม่ควรเป็นค่าที่ถูกต้อง", value)
		}
	}
}
