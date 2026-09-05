// flow_order.go — คำสั่งซื้อลูกค้าและโปรโมชั่น
//
// ใช้หนังสือเล่ม 113 กับ 116 ซึ่งไม่ได้อยู่ในเอกสารจัดซื้อ ไม่ได้ถูกตรวจนับใน flow อื่น
// และมียอดคงเหลือมากพอให้รันซ้ำได้หลายรอบ
//
// การแพ็กสินค้าตัดสต็อกจริง flow นี้จึงคืนยอดของ **ทุกเล่มในใบ** กลับให้ตอนจบ
// (เคยพลาดมาแล้วตอนคืนแค่เล่มเดียว ยอดของอีกเล่มจึงลดลงทีละหนึ่งทุกรอบจนหมด)
package main

import (
	"fmt"
	"time"
)

const (
	orderBookID    = 113 // เล่มหลักที่ใช้เดินสถานะจนจบ
	orderBookOther = 116 // เล่มที่สองไว้ทดสอบใบที่มีหลายรายการ
)

// promotionBody — ฟอร์มโปรโมชั่นตัวอย่าง
func promotionBody(name string, percent float64, minAmount float64, from, to string) map[string]any {
	return map[string]any{
		"name":            name,
		"type":            "FESTIVAL_DISCOUNT",
		"conditionDetail": "โปรโมชั่นสำหรับทดสอบระบบ",
		"discountValue":   percent,
		"isPercent":       true,
		"minQty":          0,
		"minAmount":       minAmount,
		"startDate":       from,
		"endDate":         to,
		"status":          "ACTIVE",
	}
}

// orderBody — ฟอร์มสั่งซื้อของลูกค้า
func orderBody(lines []any, promotionID int) map[string]any {
	body := map[string]any{
		"shippingAddress": "1 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ 10000",
		"slipFileName":    "slip-smoke.jpg",
		"items":           lines,
	}
	if promotionID > 0 {
		body["promotionId"] = promotionID
	}
	return body
}

func orderLine(bookID, quantity int) any {
	return map[string]any{"bookId": bookID, "quantity": quantity}
}

// placeOrder — ลูกค้าสั่งซื้อหนึ่งใบ คืนรหัสคำสั่งซื้อ
func placeOrder(token string, lines []any) (int, error) {
	body, err := post(token, "/api/orders", orderBody(lines, 0), 201)
	if err != nil {
		return 0, err
	}
	return int(body["orderId"].(float64)), nil
}

// runOrderFlow — คำสั่งซื้อลูกค้าตั้งแต่สั่งจนส่งถึง และงานโปรโมชั่นของผู้จัดการ
func runOrderFlow(e *env) {
	warehouse, manager, sales, delivery, customer := e.warehouse, e.manager, e.sales, e.delivery, e.customer

	section("โปรโมชั่น (StoreManager.managePromotion)")
	name := fmt.Sprintf("โปรทดสอบ %d", time.Now().UnixNano()%100000)
	var promotionID, pickyPromotionID int

	check("ผู้จัดการเห็นโปรโมชั่นตั้งต้น", func() error {
		items, err := getList(manager, "/api/promotions")
		if err != nil {
			return err
		}
		if len(items) < 6 {
			return fmt.Errorf("ได้ %d ใบ ต้องอย่างน้อย 6", len(items))
		}
		return nil
	})
	check("ฝ่ายขายเข้าหน้าโปรโมชั่นไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/promotions", sales, nil, 403)
	})
	check("สร้างโปรโมชั่นที่ใช้ได้ตอนนี้", func() error {
		body, err := post(manager, "/api/promotions",
			promotionBody(name, 10, 0, daysFromNow(-1), daysFromNow(30)), 201)
		if err != nil {
			return err
		}
		promotionID = int(body["promotionId"].(float64))
		if err := expect(body["displayStatus"], "ACTIVE"); err != nil {
			return err
		}
		return expect(body["code"], fmt.Sprintf("PROMO%02d", promotionID))
	})
	check("สร้างโปรโมชั่นที่ตั้งยอดขั้นต่ำสูงมาก", func() error {
		body, err := post(manager, "/api/promotions",
			promotionBody(name+" ขั้นต่ำสูง", 20, 999999, daysFromNow(-1), daysFromNow(30)), 201)
		if err != nil {
			return err
		}
		pickyPromotionID = int(body["promotionId"].(float64))
		return nil
	})
	check("โปรโมชั่นชนิดเดียวกันช่วงทับกัน ถูกทำเครื่องหมายเตือน", func() error {
		body, err := get(manager, fmt.Sprintf("/api/promotions/%d", promotionID))
		if err != nil {
			return err
		}
		overlapping, _ := body["overlapping"].([]any)
		for _, entry := range overlapping {
			if int(entry.(float64)) == pickyPromotionID {
				return nil
			}
		}
		return fmt.Errorf("ไม่ได้เตือนว่าทับกับ PROMO%02d", pickyPromotionID)
	})
	check("ชื่อว่าง → 422 MISSING_FIELDS", func() error {
		return expectError("POST", "/api/promotions", manager,
			promotionBody("", 10, 0, daysFromNow(0), daysFromNow(7)), 422, "MISSING_FIELDS")
	})
	check("ส่วนลดเปอร์เซ็นต์เกิน 100 → 422 INVALID_DISCOUNT_VALUE", func() error {
		return expectError("POST", "/api/promotions", manager,
			promotionBody(name+" เกิน", 150, 0, daysFromNow(0), daysFromNow(7)),
			422, "INVALID_DISCOUNT_VALUE")
	})
	check("วันเริ่มหลังวันสิ้นสุด → 422 PROMOTION_DATE_RANGE", func() error {
		return expectError("POST", "/api/promotions", manager,
			promotionBody(name+" วันผิด", 10, 0, daysFromNow(30), daysFromNow(1)),
			422, "PROMOTION_DATE_RANGE")
	})
	check("ตั้งสถานะเป็น EXPIRED เองไม่ได้ → 422", func() error {
		return expectError("POST", fmt.Sprintf("/api/promotions/%d/status", promotionID), manager,
			map[string]any{"status": "EXPIRED"}, 422, "INVALID_PROMOTION_STATUS")
	})
	check("แก้ไขโปรโมชั่นได้", func() error {
		body, err := put(manager, fmt.Sprintf("/api/promotions/%d", promotionID),
			promotionBody(name+" (แก้ไขแล้ว)", 12, 0, daysFromNow(-1), daysFromNow(30)), 200)
		if err != nil {
			return err
		}
		return expect(body["discountValue"], float64(12))
	})

	section("สั่งซื้อ (Customer.placeOrder)")
	var orderID int
	check("ลูกค้าสั่งซื้อได้ สถานะ PENDING_CONFIRM", func() error {
		body, err := post(customer, "/api/orders",
			orderBody([]any{orderLine(orderBookID, 1), orderLine(orderBookOther, 1)}, 0), 201)
		if err != nil {
			return err
		}
		orderID = int(body["orderId"].(float64))
		if err := expect(body["status"], "PENDING_CONFIRM"); err != nil {
			return err
		}
		if err := expect(body["channelLabel"], "เว็บไซต์"); err != nil {
			return err
		}
		if err := expect(body["itemCount"], float64(2)); err != nil {
			return err
		}
		return expect(body["code"], fmt.Sprintf("SO-%d", orderID))
	})
	check("ฝ่ายขายได้รับแจ้งเตือน ORDER_PLACED", func() error {
		items, err := getList(sales, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if entry.(map[string]any)["kind"] == "ORDER_PLACED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือนคำสั่งซื้อใหม่ในกล่องของฝ่ายขาย")
	})
	check("ไม่มีรายการสินค้า → 422 NO_ORDER_ITEMS", func() error {
		return expectError("POST", "/api/orders", customer, orderBody([]any{}, 0), 422, "NO_ORDER_ITEMS")
	})
	check("สั่งหนังสือที่ปิดการขาย → 422 BOOK_NOT_FOR_SALE", func() error {
		// สร้างเล่มของตัวเองแล้วปิดการขาย แทนที่จะพึ่งเล่ม 118 ของข้อมูลตั้งต้น
		// เพราะฐานข้อมูลที่ seed ไปก่อนแก้ gen_seed.py ยังมีเล่มนั้นเป็น ACTIVE อยู่
		created, err := post(sales, "/api/books",
			bookBody(fmt.Sprintf("978-616-9%05d", time.Now().UnixNano()%100000),
				"เล่มที่ปิดการขาย", 199, 1), 201)
		if err != nil {
			return err
		}
		closedBookID := int(created["bookId"].(float64))
		if _, err := post(sales, fmt.Sprintf("/api/books/%d/status", closedBookID),
			map[string]any{"status": "INACTIVE"}, 200); err != nil {
			return err
		}
		return expectError("POST", "/api/orders", customer,
			orderBody([]any{orderLine(closedBookID, 1)}, 0), 422, "BOOK_NOT_FOR_SALE")
	})
	check("หนังสือซ้ำในใบเดียว → 422 DUPLICATE_BOOK", func() error {
		return expectError("POST", "/api/orders", customer,
			orderBody([]any{orderLine(orderBookID, 1), orderLine(orderBookID, 2)}, 0),
			422, "DUPLICATE_BOOK")
	})
	check("ใช้โปรโมชั่นที่ยอดไม่ถึงขั้นต่ำ → 422 PROMOTION_NOT_APPLICABLE", func() error {
		return expectError("POST", "/api/orders", customer,
			orderBody([]any{orderLine(orderBookID, 1)}, pickyPromotionID),
			422, "PROMOTION_NOT_APPLICABLE")
	})
	check("ใช้โปรโมชั่นที่เข้าเงื่อนไข ส่วนลดถูกคำนวณให้", func() error {
		body, err := post(customer, "/api/orders",
			orderBody([]any{orderLine(orderBookID, 1)}, promotionID), 201)
		if err != nil {
			return err
		}
		subtotal := body["subtotal"].(float64)
		discount := body["discountAmount"].(float64)
		if discount <= 0 {
			return fmt.Errorf("ไม่ได้ลดราคาให้เลย (ยอด %.2f)", subtotal)
		}
		if net := body["netAmount"].(float64); net != subtotal-discount {
			return fmt.Errorf("ยอดสุทธิ %.2f ไม่เท่ากับ %.2f - %.2f", net, subtotal, discount)
		}
		// ยกเลิกใบนี้ทิ้ง จะได้ไม่ค้างอยู่ในคิวของฝ่ายขาย
		_, err = post(sales, fmt.Sprintf("/api/orders/%d/cancel", int(body["orderId"].(float64))),
			map[string]any{"note": "ใบทดสอบโปรโมชั่น"}, 200)
		return err
	})
	check("คลังสินค้าสั่งซื้อแทนลูกค้าไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/orders", warehouse,
			orderBody([]any{orderLine(orderBookID, 1)}, 0), 403)
	})
	check("ลูกค้าเห็นเฉพาะคำสั่งซื้อของตัวเอง", func() error {
		items, err := getList(customer, "/api/orders")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ลูกค้าควรเห็นใบของตัวเองอย่างน้อยหนึ่งใบ")
		}
		mine, err := get(customer, fmt.Sprintf("/api/orders/%d", orderID))
		if err != nil {
			return err
		}
		customerID := mine["customerId"]
		for _, entry := range items {
			if got := entry.(map[string]any)["customerId"]; got != customerID {
				return fmt.Errorf("มีใบของลูกค้าคนอื่นหลุดมา (customerId %v)", got)
			}
		}
		return nil
	})
	check("ลูกค้าเปิดใบของคนอื่นไม่ได้ → 403", func() error {
		// ใบ 1001 เป็นของลูกค้าตั้งต้น ไม่ใช่บัญชีที่ smoke สมัครใหม่
		return expectStatus("GET", "/api/orders/1001", customer, nil, 403)
	})
	check("ฝ่ายขายเห็นคำสั่งซื้อทุกใบ", func() error {
		items, err := getList(sales, "/api/orders")
		if err != nil {
			return err
		}
		if len(items) < 4 {
			return fmt.Errorf("ได้ %d ใบ ต้องอย่างน้อย 4 (ตั้งต้น 3 + ที่เพิ่งสั่ง)", len(items))
		}
		return nil
	})

	section("เดินสถานะคำสั่งซื้อจนส่งถึง")
	onHandBefore := onHand(warehouse, orderBookID)
	otherBefore := onHand(warehouse, orderBookOther)
	check("แพ็กก่อนชำระเงินไม่ได้ → 409 ORDER_TRANSITION_REJECTED", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/pack", orderID), warehouse,
			nil, 409, "ORDER_TRANSITION_REJECTED")
	})
	check("คลังสินค้ายืนยันสต็อกแทนฝ่ายขายไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/orders/%d/confirm-stock", orderID),
			warehouse, nil, 403)
	})
	check("ฝ่ายขายยืนยันสต็อก → STOCK_CONFIRMED", func() error {
		body, err := post(sales, fmt.Sprintf("/api/orders/%d/confirm-stock", orderID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "STOCK_CONFIRMED")
	})
	check("แนบสลิปโดยไม่ระบุชื่อไฟล์ → 422 SLIP_REQUIRED", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/payment", orderID), customer,
			map[string]any{"slipFileName": ""}, 422, "SLIP_REQUIRED")
	})
	check("ลูกค้าแนบหลักฐานการชำระเงิน → VERIFYING_PAYMENT", func() error {
		body, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
			map[string]any{"slipFileName": "slip-smoke-paid.jpg"}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "VERIFYING_PAYMENT")
	})
	check("ฝ่ายขายตรวจการชำระเงินผ่าน → PAID", func() error {
		body, err := post(sales, fmt.Sprintf("/api/orders/%d/verify-payment", orderID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "PAID")
	})
	check("คลังสินค้าได้รับแจ้งเตือน ORDER_PAID", func() error {
		items, err := getList(warehouse, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if entry.(map[string]any)["kind"] == "ORDER_PAID" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือนคำสั่งซื้อที่ชำระแล้วในกล่องของคลัง")
	})
	check("คลังแพ็กสินค้า → PACKING และตัดสต็อกจริง", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/pack", orderID), nil, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "PACKING"); err != nil {
			return err
		}
		return expect(onHand(warehouse, orderBookID), onHandBefore-1)
	})
	check("คลังกดพร้อมจัดส่ง → READY_TO_SHIP", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/ready", orderID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "READY_TO_SHIP")
	})
	check("ฝ่ายจัดส่งได้รับแจ้งเตือน ORDER_READY_TO_SHIP", func() error {
		items, err := getList(delivery, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if entry.(map[string]any)["kind"] == "ORDER_READY_TO_SHIP" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือนพัสดุรอจัดส่งในกล่องของฝ่ายจัดส่ง")
	})
	check("ฝ่ายขายบันทึกการจัดส่งแทนไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/orders/%d/ship", orderID), sales, nil, 403)
	})
	// การบันทึกจัดส่งพกเลขติดตามพัสดุมาด้วยตั้งแต่ P6 (เปิดแถว shipment ในทรานแซกชันเดียวกัน)
	check("ฝ่ายจัดส่งบันทึกส่งมอบให้ขนส่ง → SHIPPED", func() error {
		body, err := post(delivery, fmt.Sprintf("/api/orders/%d/ship", orderID),
			map[string]any{"carrierId": 1, "trackingNumber": fmt.Sprintf("TH-ORDER-%d", orderID)}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "SHIPPED")
	})
	check("ฝ่ายจัดส่งยืนยันส่งถึง → DELIVERED และใบปิด", func() error {
		body, err := post(delivery, fmt.Sprintf("/api/orders/%d/deliver", orderID), nil, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "DELIVERED"); err != nil {
			return err
		}
		if err := expect(body["closed"], true); err != nil {
			return err
		}
		timeline, _ := body["timeline"].([]any)
		if len(timeline) < 7 {
			return fmt.Errorf("timeline มี %d แถว ต้องครบทุกขั้นตอน", len(timeline))
		}
		return nil
	})
	check("ใบที่ส่งถึงแล้วยกเลิกไม่ได้ → 409", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/cancel", orderID), sales,
			map[string]any{"note": "ขอยกเลิกย้อนหลัง"}, 409, "ORDER_TRANSITION_REJECTED")
	})
	check("คืนยอดสต็อกของทุกเล่มที่ตัดไประหว่างทดสอบ", func() error {
		restore := func(bookID int) any {
			return map[string]any{
				"bookId":         bookID,
				"quantityChange": 1,
				"reason":         "คืนยอดหลังทดสอบคำสั่งซื้อ",
				"referenceDoc":   "SMOKE",
			}
		}
		_, err := post(warehouse, "/api/inventory/adjust",
			map[string]any{"lines": []any{restore(orderBookID), restore(orderBookOther)}}, 201)
		if err != nil {
			return err
		}
		if err := expect(onHand(warehouse, orderBookID), onHandBefore); err != nil {
			return err
		}
		return expect(onHand(warehouse, orderBookOther), otherBefore)
	})

	section("ยกเลิกและปฏิเสธคำสั่งซื้อ")
	check("ยกเลิกโดยไม่ระบุเหตุผล → 422 REASON_REQUIRED", func() error {
		id, err := placeOrder(customer, []any{orderLine(orderBookOther, 1)})
		if err != nil {
			return err
		}
		if err := expectError("POST", fmt.Sprintf("/api/orders/%d/cancel", id), sales,
			map[string]any{"note": ""}, 422, "REASON_REQUIRED"); err != nil {
			return err
		}
		body, err := post(sales, fmt.Sprintf("/api/orders/%d/cancel", id),
			map[string]any{"note": "ลูกค้าขอยกเลิก"}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "CANCELLED")
	})
	check("ปฏิเสธการชำระเงินต้องมีเหตุผล แล้วใบเป็น REJECTED", func() error {
		id, err := placeOrder(customer, []any{orderLine(orderBookOther, 1)})
		if err != nil {
			return err
		}
		if _, err := post(sales, fmt.Sprintf("/api/orders/%d/confirm-stock", id), nil, 200); err != nil {
			return err
		}
		if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", id),
			map[string]any{"slipFileName": "slip-wrong.jpg"}, 200); err != nil {
			return err
		}
		if err := expectError("POST", fmt.Sprintf("/api/orders/%d/reject-payment", id), sales,
			map[string]any{"note": ""}, 422, "REASON_REQUIRED"); err != nil {
			return err
		}
		body, err := post(sales, fmt.Sprintf("/api/orders/%d/reject-payment", id),
			map[string]any{"note": "ยอดเงินในสลิปไม่ตรง"}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "REJECTED")
	})
	check("สั่งเกินจำนวนที่มีในคลัง → 409 INSUFFICIENT_STOCK ตอนยืนยันสต็อก", func() error {
		id, err := placeOrder(customer, []any{orderLine(orderBookID, onHand(warehouse, orderBookID)+50)})
		if err != nil {
			return err
		}
		if err := expectError("POST", fmt.Sprintf("/api/orders/%d/confirm-stock", id), sales,
			nil, 409, "INSUFFICIENT_STOCK"); err != nil {
			return err
		}
		_, err = post(sales, fmt.Sprintf("/api/orders/%d/cancel", id),
			map[string]any{"note": "ของไม่พอ"}, 200)
		return err
	})

	section("เก็บกวาดโปรโมชั่นที่ใช้ทดสอบ")
	check("ลบโปรโมชั่นที่ยังไม่เคยถูกใช้", func() error {
		return expectStatus("DELETE", fmt.Sprintf("/api/promotions/%d", pickyPromotionID),
			manager, nil, 204)
	})
	check("ลบโปรโมชั่นที่ไม่มีอยู่ → 404 PROMOTION_NOT_FOUND", func() error {
		return expectError("DELETE", "/api/promotions/999999", manager, nil, 404, "PROMOTION_NOT_FOUND")
	})
	check("ปิดใช้งานโปรโมชั่นที่ถูกใช้ไปแล้วแทนการลบ", func() error {
		if err := expectError("DELETE", fmt.Sprintf("/api/promotions/%d", promotionID), manager,
			nil, 409, "PROMOTION_IN_USE"); err != nil {
			return err
		}
		body, err := post(manager, fmt.Sprintf("/api/promotions/%d/status", promotionID),
			map[string]any{"status": "INACTIVE"}, 200)
		if err != nil {
			return err
		}
		return expect(body["displayStatus"], "INACTIVE")
	})
}
