package model

import (
	"testing"
	"time"
)

func TestComputeVariance(t *testing.T) {
	cases := []struct {
		name       string
		systemQty  int
		countedQty int
		want       int
	}{
		{"นับได้ตรงกับระบบ", 12, 12, 0},
		{"ของหาย", 12, 9, -3},
		{"นับได้มากกว่าระบบ", 12, 15, 3},
	}
	for _, c := range cases {
		item := StockCountItem{SystemQty: c.systemQty, CountedQty: c.countedQty}
		if got := item.ComputeVariance(); got != c.want {
			t.Errorf("%s: ได้ %d ต้องการ %d", c.name, got, c.want)
		}
		if item.Variance != c.want {
			t.Errorf("%s: ไม่ได้เขียนค่ากลับลง Variance (ได้ %d)", c.name, item.Variance)
		}
	}
}

func TestDiscrepancyDecideOnlyOnce(t *testing.T) {
	at := time.Date(2026, 8, 30, 4, 0, 0, 0, time.UTC)
	report := StockDiscrepancyReport{ApprovalStatus: ApprovalStatusPending}

	if err := report.Decide(ApprovalStatusApproved, "ตรวจซ้ำแล้วยอดหาย", "ปิยะพร วงศ์ทอง", at); err != nil {
		t.Fatalf("อนุมัติไม่สำเร็จ: %v", err)
	}
	if report.ApprovalStatus != ApprovalStatusApproved || report.ResolvedBy != "ปิยะพร วงศ์ทอง" {
		t.Fatalf("ผลการตัดสินไม่ถูกบันทึก: %+v", report)
	}
	if report.ResolvedAt == nil || !report.ResolvedAt.Equal(at) {
		t.Fatalf("เวลาที่ตัดสินไม่ถูกบันทึก: %+v", report.ResolvedAt)
	}

	// ตัดสินซ้ำไม่ได้ — กันผู้จัดการสองคนกดคนละปุ่ม
	if err := report.Decide(ApprovalStatusRejected, "เปลี่ยนใจ", "ปิยะพร วงศ์ทอง", at); err != ErrReportAlreadyDecided {
		t.Fatalf("ตัดสินซ้ำต้องได้ ErrReportAlreadyDecided ได้ %v", err)
	}
	if report.ApprovalStatus != ApprovalStatusApproved {
		t.Fatalf("ตัดสินซ้ำแล้วสถานะต้องไม่เปลี่ยน ได้ %s", report.ApprovalStatus)
	}
}

func TestDiscrepancyRejectsInvalidStatus(t *testing.T) {
	report := StockDiscrepancyReport{ApprovalStatus: ApprovalStatusPending}
	if err := report.Decide(ApprovalStatusPending, "", "ปิยะพร วงศ์ทอง", time.Now()); err == nil {
		t.Fatal("ตัดสินเป็น PENDING ไม่ควรผ่าน")
	}
	if report.ApprovalStatus != ApprovalStatusPending {
		t.Fatalf("สถานะต้องไม่เปลี่ยนเมื่อตัดสินไม่ผ่าน ได้ %s", report.ApprovalStatus)
	}
}

// StockLevelOf ใช้เกณฑ์คงที่ · IsBelowReorder ใช้จุดสั่งซื้อรายเล่มของ U5
// สองอันนี้ต้องไม่ถูกยุบรวมกัน — เคสนี้เอาไว้จับถ้ามีใครเผลอทำ
func TestStockLevelIsSeparateFromReorderPoint(t *testing.T) {
	// เหลือ 20 เล่ม แต่จุดสั่งซื้ออยู่ที่ 25 → ปกติสำหรับรายงาน แต่ถึงจุดสั่งซื้อแล้วสำหรับ U5
	reorder := 25
	item := InventoryItem{QuantityOnHand: 20, ReorderPoint: &reorder}
	if got := StockLevelOf(item); got != StockLevelOK {
		t.Errorf("เหลือ 20 เล่ม (เกณฑ์รายงาน %d) ต้องเป็น OK ได้ %s", LowStockThreshold, got)
	}
	if !item.IsBelowReorder() {
		t.Error("เหลือ 20 เล่ม จุดสั่งซื้อ 25 ต้องถือว่าถึงจุดสั่งซื้อแล้ว")
	}

	// เหลือ 5 เล่ม ไม่ตั้งจุดสั่งซื้อ → เหลือน้อยสำหรับรายงาน แต่ U5 ข้ามไป
	item = InventoryItem{QuantityOnHand: 5}
	if got := StockLevelOf(item); got != StockLevelLow {
		t.Errorf("เหลือ 5 เล่มต้องเป็น LOW ได้ %s", got)
	}
	if item.IsBelowReorder() {
		t.Error("ยังไม่ตั้งจุดสั่งซื้อ ต้องไม่นับว่าถึงจุดสั่งซื้อ")
	}

	if got := StockLevelOf(InventoryItem{QuantityOnHand: 0}); got != StockLevelOut {
		t.Errorf("ยอด 0 ต้องเป็น OUT ได้ %s", got)
	}
}

// ป้ายไทยต้องตรงกับที่หน้าจอแสดงจริง (inventory.ts ฝั่ง frontend)
func TestStockLabelsMatchFrontend(t *testing.T) {
	want := map[string]string{
		string(StockCountStatusDraft):  "ร่าง",
		string(StockCountStatusDone):   "ตรวจนับแล้ว",
		string(ApprovalStatusPending):  "รออนุมัติ",
		string(ApprovalStatusApproved): "อนุมัติแล้ว",
		string(ApprovalStatusRejected): "ปฏิเสธ",
		string(StockLevelOut):          "หมด",
		string(StockLevelLow):          "เหลือน้อย",
		string(StockLevelOK):           "ปกติ",
	}
	got := map[string]string{
		string(StockCountStatusDraft):  StockCountStatusDraft.Label(),
		string(StockCountStatusDone):   StockCountStatusDone.Label(),
		string(ApprovalStatusPending):  ApprovalStatusPending.Label(),
		string(ApprovalStatusApproved): ApprovalStatusApproved.Label(),
		string(ApprovalStatusRejected): ApprovalStatusRejected.Label(),
		string(StockLevelOut):          StockLevelOut.Label(),
		string(StockLevelLow):          StockLevelLow.Label(),
		string(StockLevelOK):           StockLevelOK.Label(),
	}
	for key, expected := range want {
		if got[key] != expected {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", key, got[key], expected)
		}
	}
}

func TestFormatStockCodes(t *testing.T) {
	if got := FormatCountCode(7); got != "SC007" {
		t.Errorf("รหัสรอบตรวจนับ = %q ต้องการ SC007", got)
	}
	if got := FormatReportCode(12); got != "DR012" {
		t.Errorf("รหัสรายงานผลต่าง = %q ต้องการ DR012", got)
	}
}
