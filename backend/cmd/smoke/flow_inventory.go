// flow_inventory.go — ระบบย่อยสินค้าคงคลัง (ปรับยอด · ตรวจนับ · รายงานผลต่าง)
//
// ใช้หนังสือเล่ม 122 กับ 123 ซึ่งไม่ได้อยู่ในเอกสารจัดซื้อของ flow_purchasing
// เพื่อให้ยอดคงเหลือที่ flow นี้ขยับไม่ไปกวนการตรวจของ U9/U10
package main

import (
	"fmt"
)

const (
	adjustBookID  = 122 // ปรับยอดด้วยมือ
	approveBookID = 122 // รอบตรวจนับที่ผู้จัดการอนุมัติ
	rejectBookID  = 123 // รอบตรวจนับที่ผู้จัดการปฏิเสธ
)

// adjustBody — ฟอร์มปรับปรุงจำนวนสินค้าคงคลัง
func adjustBody(bookID, change int, reason string) map[string]any {
	return map[string]any{
		"lines": []any{
			map[string]any{
				"bookId":         bookID,
				"quantityChange": change,
				"reason":         reason,
				"referenceDoc":   "SMOKE",
			},
		},
	}
}

// countBody — ฟอร์มบันทึกผลการตรวจนับ
func countBody(bookID, countedQty int) map[string]any {
	return map[string]any{
		"items": []any{map[string]any{"bookId": bookID, "countedQty": countedQty}},
	}
}

// saveCount — บันทึกรอบตรวจนับหนึ่งเล่ม แล้วคืนรหัสรายงานผลต่างที่เกิดขึ้น (0 = ไม่เกิด)
func saveCount(token string, bookID, countedQty int) (int, error) {
	body, err := post(token, "/api/stock-counts", countBody(bookID, countedQty), 201)
	if err != nil {
		return 0, err
	}
	items, _ := body["items"].([]any)
	if len(items) != 1 {
		return 0, fmt.Errorf("รอบตรวจนับมี %d รายการ ต้องการ 1", len(items))
	}
	row := items[0].(map[string]any)
	if row["reportId"] == nil {
		return 0, nil
	}
	return int(row["reportId"].(float64)), nil
}

// runInventoryFlow — สินค้าคงคลังส่วนที่นอกเหนือจาก U5/U9/U10
func runInventoryFlow(e *env) {
	warehouse, manager := e.warehouse, e.manager

	section("ปรับปรุงจำนวนสินค้าคงคลังด้วยมือ")
	before := onHand(warehouse, adjustBookID)
	check("คลังสินค้าปรับยอดเพิ่มได้ ยอดคงเหลือขยับตาม", func() error {
		if _, err := post(warehouse, "/api/inventory/adjust",
			adjustBody(adjustBookID, 5, "รับของคืนจากหน้าร้าน"), 201); err != nil {
			return err
		}
		return expect(onHand(warehouse, adjustBookID), before+5)
	})
	check("ปรับจนยอดติดลบ → 422 NEGATIVE_STOCK", func() error {
		current := onHand(warehouse, adjustBookID)
		return expectError("POST", "/api/inventory/adjust", warehouse,
			adjustBody(adjustBookID, -(current+1), "ตัดออกเกินจำนวนที่มี"), 422, "NEGATIVE_STOCK")
	})
	check("ยอดคงเหลือไม่ถูกแตะเลยหลังเคสที่ล้ม", func() error {
		return expect(onHand(warehouse, adjustBookID), before+5)
	})
	check("ไม่ระบุเหตุผล → 422 REASON_REQUIRED", func() error {
		return expectError("POST", "/api/inventory/adjust", warehouse,
			adjustBody(adjustBookID, 1, ""), 422, "REASON_REQUIRED")
	})
	check("จำนวนที่ปรับเป็นศูนย์ → 422 INVALID_QUANTITY_CHANGE", func() error {
		return expectError("POST", "/api/inventory/adjust", warehouse,
			adjustBody(adjustBookID, 0, "ไม่ได้ปรับอะไร"), 422, "INVALID_QUANTITY_CHANGE")
	})
	check("ไม่เลือกหนังสือเลย → 422 NO_STOCK_LINES", func() error {
		return expectError("POST", "/api/inventory/adjust", warehouse,
			map[string]any{"lines": []any{}}, 422, "NO_STOCK_LINES")
	})
	check("ผู้จัดการปรับยอดเองไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/inventory/adjust", manager,
			adjustBody(adjustBookID, 1, "ผู้จัดการปรับเอง"), 403)
	})
	check("ปรับยอดกลับที่เดิม", func() error {
		if _, err := post(warehouse, "/api/inventory/adjust",
			adjustBody(adjustBookID, -5, "คืนค่าหลังทดสอบ"), 201); err != nil {
			return err
		}
		return expect(onHand(warehouse, adjustBookID), before)
	})

	section("รายงานหนังสือใกล้หมด")
	check("รายงานคืนเฉพาะเล่มที่หมดหรือเหลือน้อย พร้อมชื่อเรื่อง", func() error {
		items, err := getList(warehouse, "/api/inventory/low-stock")
		if err != nil {
			return err
		}
		for _, entry := range items {
			row := entry.(map[string]any)
			if row["level"] == "OK" {
				return fmt.Errorf("เล่มที่ยอดปกติหลุดเข้ามาในรายงาน: %v", row["bookId"])
			}
			if row["title"] == "" || row["title"] == nil {
				return fmt.Errorf("รายงานไม่มีชื่อเรื่อง: %v", row)
			}
		}
		return nil
	})

	section("ตรวจนับสต็อก")
	check("หนังสือซ้ำในรอบเดียว → 422 DUPLICATE_BOOK", func() error {
		body := map[string]any{"items": []any{
			map[string]any{"bookId": adjustBookID, "countedQty": 1},
			map[string]any{"bookId": adjustBookID, "countedQty": 2},
		}}
		return expectError("POST", "/api/stock-counts", warehouse, body, 422, "DUPLICATE_BOOK")
	})
	check("จำนวนที่นับได้ติดลบ → 422 INVALID_COUNTED_QTY", func() error {
		return expectError("POST", "/api/stock-counts", warehouse,
			countBody(adjustBookID, -1), 422, "INVALID_COUNTED_QTY")
	})
	check("ไม่เลือกหนังสือเลย → 422 NO_STOCK_LINES", func() error {
		return expectError("POST", "/api/stock-counts", warehouse,
			map[string]any{"items": []any{}}, 422, "NO_STOCK_LINES")
	})
	check("ผู้จัดการบันทึกการตรวจนับเองไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/stock-counts", manager, countBody(adjustBookID, 1), 403)
	})
	check("นับได้ตรงกับระบบ ไม่เปิดรายงานผลต่าง", func() error {
		reportID, err := saveCount(warehouse, adjustBookID, onHand(warehouse, adjustBookID))
		if err != nil {
			return err
		}
		if reportID != 0 {
			return fmt.Errorf("นับได้ตรงกันแต่เปิดรายงาน DR%03d", reportID)
		}
		return nil
	})

	var countID, approveReportID, rejectReportID int
	check("นับได้ไม่ตรง เปิดรายงานผลต่างสถานะ PENDING", func() error {
		system := onHand(warehouse, approveBookID)
		body, err := post(warehouse, "/api/stock-counts", countBody(approveBookID, system-2), 201)
		if err != nil {
			return err
		}
		countID = int(body["countId"].(float64))
		if err := expect(body["status"], "DONE"); err != nil {
			return err
		}
		row := body["items"].([]any)[0].(map[string]any)
		if err := expect(row["variance"], float64(-2)); err != nil {
			return err
		}
		if row["reportId"] == nil {
			return fmt.Errorf("นับได้ไม่ตรงแต่ไม่เปิดรายงาน: %v", row)
		}
		approveReportID = int(row["reportId"].(float64))
		return nil
	})
	check("ผู้จัดการได้รับแจ้งเตือน STOCK_DISCREPANCY", func() error {
		items, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if entry.(map[string]any)["kind"] == "STOCK_DISCREPANCY" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือนผลต่างสต็อกในกล่องของผู้จัดการ")
	})
	check("รายงานอยู่ในรายการที่รออนุมัติ พร้อมชื่อเรื่องและรหัสเอกสาร", func() error {
		items, err := getList(manager, "/api/discrepancies?status=PENDING")
		if err != nil {
			return err
		}
		for _, entry := range items {
			row := entry.(map[string]any)
			if int(row["reportId"].(float64)) != approveReportID {
				continue
			}
			if err := expect(row["code"], fmt.Sprintf("DR%03d", approveReportID)); err != nil {
				return err
			}
			if err := expect(row["countCode"], fmt.Sprintf("SC%03d", countID)); err != nil {
				return err
			}
			return expect(row["approvalLabel"], "รออนุมัติ")
		}
		return fmt.Errorf("ไม่พบรายงาน DR%03d ในรายการที่รออนุมัติ", approveReportID)
	})
	check("ดูรอบตรวจนับย้อนหลังได้ พร้อมชื่อเรื่อง", func() error {
		body, err := get(warehouse, fmt.Sprintf("/api/stock-counts/%d", countID))
		if err != nil {
			return err
		}
		if err := expect(body["statusLabel"], "ตรวจนับแล้ว"); err != nil {
			return err
		}
		row := body["items"].([]any)[0].(map[string]any)
		if row["title"] == "" || row["title"] == nil {
			return fmt.Errorf("รายการตรวจนับไม่มีชื่อเรื่อง: %v", row)
		}
		return nil
	})
	check("รอบตรวจนับที่ไม่มีอยู่ → 404 STOCK_COUNT_NOT_FOUND", func() error {
		return expectError("GET", "/api/stock-counts/999999", warehouse, nil, 404, "STOCK_COUNT_NOT_FOUND")
	})

	section("ผู้จัดการตัดสินผลต่างสต็อก")
	check("คลังสินค้าอนุมัติผลต่างเองไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/discrepancies/%d/approve", approveReportID),
			warehouse, map[string]any{"note": ""}, 403)
	})
	check("อนุมัติแล้วยอดคงเหลือเท่ากับจำนวนที่นับได้", func() error {
		counted := onHand(warehouse, approveBookID) - 2
		body, err := post(manager, fmt.Sprintf("/api/discrepancies/%d/approve", approveReportID),
			map[string]any{"note": "ตรวจซ้ำแล้วของหายจริง"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["approvalStatus"], "APPROVED"); err != nil {
			return err
		}
		if err := expect(body["approvalLabel"], "อนุมัติแล้ว"); err != nil {
			return err
		}
		return expect(onHand(warehouse, approveBookID), counted)
	})
	check("อนุมัติซ้ำ → 409 REPORT_ALREADY_DECIDED", func() error {
		return expectError("POST", fmt.Sprintf("/api/discrepancies/%d/approve", approveReportID),
			manager, map[string]any{"note": "กดซ้ำ"}, 409, "REPORT_ALREADY_DECIDED")
	})

	check("เปิดรายงานอีกใบไว้ทดสอบการปฏิเสธ", func() error {
		reportID, err := saveCount(warehouse, rejectBookID, onHand(warehouse, rejectBookID)+3)
		if err != nil {
			return err
		}
		if reportID == 0 {
			return fmt.Errorf("นับได้ไม่ตรงแต่ไม่เปิดรายงาน")
		}
		rejectReportID = reportID
		return nil
	})
	check("ปฏิเสธโดยไม่ระบุเหตุผล → 422 REASON_REQUIRED", func() error {
		return expectError("POST", fmt.Sprintf("/api/discrepancies/%d/reject", rejectReportID),
			manager, map[string]any{"note": ""}, 422, "REASON_REQUIRED")
	})
	check("ปฏิเสธแล้วยอดคงเหลือไม่ขยับ", func() error {
		unchanged := onHand(warehouse, rejectBookID)
		body, err := post(manager, fmt.Sprintf("/api/discrepancies/%d/reject", rejectReportID),
			map[string]any{"note": "ให้ไปนับใหม่อีกรอบ"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["approvalStatus"], "REJECTED"); err != nil {
			return err
		}
		return expect(onHand(warehouse, rejectBookID), unchanged)
	})
	check("รายงานที่ไม่มีอยู่ → 404 DISCREPANCY_NOT_FOUND", func() error {
		return expectError("POST", "/api/discrepancies/999999/approve", manager,
			map[string]any{"note": "ไม่มีใบนี้"}, 404, "DISCREPANCY_NOT_FOUND")
	})
}
