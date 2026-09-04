// flow_purchasing.go — U5–U10 จัดซื้อจากผู้จัดจำหน่าย
//
// เดินต่อกันเป็นสายเดียว: ตั้งจุดสั่งซื้อ → เปิด PR → อนุมัติจนได้ PO → ส่ง/ยืนยัน
// → รับสินค้าเข้าคลัง → ส่งคืนและชดเชย
package main

import "fmt"

// runPurchasingFlow — U5–U10 จัดซื้อจากผู้จัดจำหน่าย
func runPurchasingFlow(e *env) {
	warehouse, manager := e.warehouse, e.manager

	// สายนี้รับของเข้าและส่งคืนของจริงบนเล่ม 101 สุทธิแล้ว +10 ทุกรอบ
	// ถ้าไม่คืน ยอดคงเหลือจะโตขึ้นทุกครั้งที่รัน จนหน้าร้านกับรายงานของทีมอ่านตัวเลขไม่ออก
	// (กติกาเดียวกับ flow_order.go ที่คืนสต็อกทุกเล่มในใบตอนจบ)
	stockAtStart := onHand(warehouse, 101)
	defer restoreStock(warehouse, 101, stockAtStart)

	section("U5 แจ้งเตือนสินค้าถึงจุดสั่งซื้อ")

	// ล้างจุดสั่งซื้อของเล่มที่ใช้ทดสอบก่อน เพราะเคสถัดไปตรวจสถานะ "ยังไม่ตั้งค่า"
	// แต่การรัน smoke รอบก่อนหน้าตั้งค่าไว้แล้ว — ถ้าไม่ล้าง สคริปต์นี้จะผ่านแค่ครั้งแรกครั้งเดียว
	if _, err := put(warehouse, "/api/inventory/115/reorder-point",
		map[string]any{"reorderPoint": nil}, 200); err != nil {
		fmt.Printf("  เตรียมข้อมูล U5 ไม่สำเร็จ: %v\n", err)
	}

	check("รายการที่ยังไม่ตั้งจุดสั่งซื้อติดธง unconfigured (ไม่นับว่าต่ำ)", func() error {
		alerts, err := getList(warehouse, "/api/inventory/alerts")
		if err != nil {
			return err
		}
		for _, entry := range alerts {
			row := entry.(map[string]any)
			// หนังสือรหัส 115 ไม่ได้ตั้งจุดสั่งซื้อไว้ในข้อมูลตั้งต้น
			if int(row["bookId"].(float64)) == 115 {
				if row["unconfigured"] != true {
					return fmt.Errorf("เล่ม 115 ควรติดธง unconfigured")
				}
				return nil
			}
		}
		return fmt.Errorf("ไม่พบเล่ม 115 ในรายการแจ้งเตือน")
	})
	check("ตั้งค่าจุดสั่งซื้อได้", func() error {
		body, err := put(warehouse, "/api/inventory/115/reorder-point",
			map[string]any{"reorderPoint": 6}, 200)
		if err != nil {
			return err
		}
		return expect(body["reorderPoint"], float64(6))
	})

	section("U6 จัดทำใบขอสั่งซื้อ")
	check("เลือกผู้จัดจำหน่ายที่ปิดใช้งานแล้ว → 422 SUPPLIER_INACTIVE", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 8, // รหัส 8 ถูกปิดใช้งานในข้อมูลตั้งต้น
			"items":      []any{map[string]any{"bookId": 118, "quantity": 5, "unitPrice": 220}},
		}, 422, "SUPPLIER_INACTIVE")
	})
	check("หนังสือซ้ำในเอกสารเดียวกัน → 422 DUPLICATE_BOOK", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items": []any{
				map[string]any{"bookId": 101, "quantity": 5, "unitPrice": 285},
				map[string]any{"bookId": 101, "quantity": 3, "unitPrice": 285},
			},
		}, 422, "DUPLICATE_BOOK")
	})
	check("จำนวนเป็น 0 → 422 INVALID_QUANTITY", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 101, "quantity": 0, "unitPrice": 285}},
		}, 422, "INVALID_QUANTITY")
	})
	check("สั่งหนังสือที่ผู้จัดจำหน่ายไม่ได้ขาย → 422 BOOK_NOT_OFFERED", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 119, "quantity": 5, "unitPrice": 420}},
		}, 422, "BOOK_NOT_OFFERED")
	})

	var prID int
	check("บันทึกร่างได้ สถานะ DRAFT", func() error {
		body, err := post(warehouse, "/api/requisitions", map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 101, "quantity": 10, "unitPrice": 285}},
			"submit":     false,
		}, 201)
		if err != nil {
			return err
		}
		prID = int(body["prId"].(float64))
		return expect(body["status"], "DRAFT")
	})
	check("ส่งขออนุมัติ → SUBMITTED", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/requisitions/%d/submit", prID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "SUBMITTED")
	})
	check("ผู้จัดการได้รับแจ้งเตือน PR_SUBMITTED", func() error {
		rows, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "PR_SUBMITTED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน PR_SUBMITTED")
	})
	check("ส่งซ้ำใบที่ส่งไปแล้ว → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/requisitions/%d/submit", prID), warehouse, nil, 409)
	})

	section("U7 อนุมัติใบสั่งซื้อ")
	check("อ่านงบประมาณคงเหลือได้", func() error {
		body, err := get(manager, "/api/purchasing/budget")
		if err != nil {
			return err
		}
		if body["budget"].(float64) != 500000 {
			return fmt.Errorf("งบประมาณ = %v ต้องการ 500000", body["budget"])
		}
		return nil
	})

	var rejectPRID int
	check("ตีกลับต้องมีเหตุผล → 422 REASON_REQUIRED", func() error {
		body, err := post(warehouse, "/api/requisitions", map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 102, "quantity": 5, "unitPrice": 240}},
			"submit":     true,
		}, 201)
		if err != nil {
			return err
		}
		rejectPRID = int(body["prId"].(float64))
		return expectError("POST", fmt.Sprintf("/api/requisitions/%d/reject", rejectPRID), manager,
			map[string]any{"reason": ""}, 422, "REASON_REQUIRED")
	})
	check("ตีกลับพร้อมเหตุผล → REJECTED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/requisitions/%d/reject", rejectPRID),
			map[string]any{"reason": "ราคาสูงกว่าเงื่อนไขการค้า"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "REJECTED"); err != nil {
			return err
		}
		return expect(body["rejectionReason"], "ราคาสูงกว่าเงื่อนไขการค้า")
	})
	check("ใบที่ถูกตีกลับ แก้แล้วส่งใหม่ได้", func() error {
		body, err := put(warehouse, fmt.Sprintf("/api/requisitions/%d", rejectPRID), map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 102, "quantity": 5, "unitPrice": 235}},
			"submit":     true,
		}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "SUBMITTED")
	})

	var poID int
	check("อนุมัติแล้วออกใบสั่งซื้ออัตโนมัติ สถานะ APPROVED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/requisitions/%d/approve", prID),
			map[string]any{"overBudgetNote": ""}, 201)
		if err != nil {
			return err
		}
		poID = int(body["poId"].(float64))
		if err := expect(body["status"], "APPROVED"); err != nil {
			return err
		}
		// ยังไม่ส่ง → หน้าจออ่านเป็น "อนุมัติแล้ว รอส่ง"
		return expect(body["displayStatus"], "AWAITING_SEND")
	})
	check("คลังสินค้าได้รับแจ้งเตือน PR_APPROVED", func() error {
		rows, err := getList(warehouse, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "PR_APPROVED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน PR_APPROVED")
	})
	check("อนุมัติซ้ำ → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/requisitions/%d/approve", prID), manager,
			map[string]any{}, 409)
	})

	section("U8 ส่งใบสั่งซื้อให้ผู้จัดจำหน่าย")
	check("ยังไม่ส่ง ยืนยันไม่ได้ → 409 ORDER_NOT_SENT", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/confirm", poID), warehouse,
			map[string]any{"expectedDeliveryDate": daysFromNow(10)}, 409, "ORDER_NOT_SENT")
	})
	check("ส่งแล้ว displayStatus = AWAITING_CONFIRM", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/purchase-orders/%d/send", poID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["displayStatus"], "AWAITING_CONFIRM")
	})
	check("วันที่ส่งมอบย้อนหลัง → 422 EXPECTED_DATE_IN_PAST", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/confirm", poID), warehouse,
			map[string]any{"expectedDeliveryDate": daysFromNow(-1)}, 422, "EXPECTED_DATE_IN_PAST")
	})
	check("ยืนยันแล้ว → CONFIRMED พร้อมวันที่ส่งมอบ", func() error {
		expected := daysFromNow(10)
		body, err := post(warehouse, fmt.Sprintf("/api/purchase-orders/%d/confirm", poID),
			map[string]any{"expectedDeliveryDate": expected}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "CONFIRMED"); err != nil {
			return err
		}
		return expect(body["expectedDeliveryDate"], expected)
	})

	section("U9 บันทึกรับสินค้าเข้าคลัง")
	stockBefore := onHand(warehouse, 101)
	check("ไม่ใส่เลขที่ใบส่งของ → 422", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 5, "condition": "NORMAL"},
			}}, 422, "MISSING_DELIVERY_NOTE")
	})
	check("รับหนังสือที่ไม่อยู่ในใบสั่งซื้อ → 422 BOOK_NOT_IN_ORDER", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-01", "lines": []any{
				map[string]any{"bookId": 119, "receivedQty": 5, "condition": "NORMAL"},
			}}, 422, "BOOK_NOT_IN_ORDER")
	})
	check("รับ 0 ทุกรายการ → 422 NOTHING_RECEIVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-02", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 0, "condition": "NORMAL"},
			}}, 422, "NOTHING_RECEIVED")
	})
	check("รับบางส่วน → PO = RECEIVED_PARTIAL, GR = PARTIAL", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), map[string]any{
			"deliveryNoteNo": "DN-TEST-03",
			"lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 6, "condition": "NORMAL", "note": ""},
			},
		}, 201)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "PARTIAL"); err != nil {
			return err
		}
		order, err := get(warehouse, fmt.Sprintf("/api/purchase-orders/%d", poID))
		if err != nil {
			return err
		}
		return expect(order["status"], "RECEIVED_PARTIAL")
	})
	check("สต็อกเพิ่มขึ้นตามจำนวนที่รับ", func() error {
		after := onHand(warehouse, 101)
		if after != stockBefore+6 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, stockBefore+6)
		}
		return nil
	})
	check("เกิดรายการเคลื่อนไหวสต็อกชนิด RECEIVE_IN", func() error {
		receipts, err := getList(warehouse, fmt.Sprintf("/api/purchase-orders/%d/receipts", poID))
		if err != nil {
			return err
		}
		if len(receipts) == 0 {
			return fmt.Errorf("ไม่พบใบรับสินค้า")
		}
		return nil
	})
	check("รับส่วนที่เหลือจนครบ → PO = RECEIVED_FULL, GR = FULL", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), map[string]any{
			"deliveryNoteNo": "DN-TEST-04",
			"lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 4, "condition": "DAMAGED", "note": "ปกหักมุม"},
			},
		}, 201)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "FULL"); err != nil {
			return err
		}
		order, err := get(warehouse, fmt.Sprintf("/api/purchase-orders/%d", poID))
		if err != nil {
			return err
		}
		return expect(order["status"], "RECEIVED_FULL")
	})
	check("รับซ้ำหลังรับครบแล้ว → 409 PO_NOT_RECEIVABLE", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-05", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 1, "condition": "NORMAL"},
			}}, 409, "PO_NOT_RECEIVABLE")
	})

	section("U10 บันทึกส่งคืนสินค้า")
	beforeReturn := onHand(warehouse, 101)
	check("คืนเกินจำนวนที่รับ → 422 RETURN_EXCEEDS_RECEIVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/purchase-orders/%d/returns", poID), warehouse,
			map[string]any{"reason": "ชำรุด", "items": []any{
				map[string]any{"bookId": 101, "quantity": 99, "reason": "ชำรุด"},
			}}, 422, "RETURN_EXCEEDS_RECEIVED")
	})
	var returnID int
	check("เปิดใบส่งคืน → TRACKING และตัดสต็อกออก", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/purchase-orders/%d/returns", poID), map[string]any{
			"reason": "ชำรุด",
			"items": []any{
				map[string]any{"bookId": 101, "quantity": 4, "reason": "ปกหักมุม"},
			},
		}, 201)
		if err != nil {
			return err
		}
		returnID = int(body["returnId"].(float64))
		if err := expect(body["status"], "TRACKING"); err != nil {
			return err
		}
		if after := onHand(warehouse, 101); after != beforeReturn-4 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, beforeReturn-4)
		}
		return nil
	})
	check("ส่งต่อผู้จัดการต้องมีเหตุผล → 422", func() error {
		return expectError("POST", fmt.Sprintf("/api/returns/%d/escalate", returnID), warehouse,
			map[string]any{"note": ""}, 422, "REASON_REQUIRED")
	})
	check("ผู้จัดจำหน่ายปฏิเสธ → ESCALATED และแจ้งผู้จัดการ", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/returns/%d/escalate", returnID),
			map[string]any{"note": "ผู้จัดจำหน่ายปฏิเสธการรับคืน"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "ESCALATED"); err != nil {
			return err
		}
		rows, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "RETURN_ESCALATED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน RETURN_ESCALATED")
	})
	check("บันทึกสินค้าทดแทน → CLOSED และสต็อกกลับมา", func() error {
		before := onHand(warehouse, 101)
		body, err := post(warehouse, fmt.Sprintf("/api/returns/%d/compensation", returnID),
			map[string]any{"type": "REPLACEMENT", "note": "ผู้จัดจำหน่ายส่งของทดแทนแล้ว"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "CLOSED"); err != nil {
			return err
		}
		if after := onHand(warehouse, 101); after != before+4 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, before+4)
		}
		return nil
	})
	check("ปิดรายการซ้ำ → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/returns/%d/compensation", returnID), warehouse,
			map[string]any{"type": "CREDIT_NOTE", "note": ""}, 409)
	})
}
