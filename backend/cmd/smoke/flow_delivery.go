// flow_delivery.go — จัดการการจัดส่ง
//
// flow นี้เดินคำสั่งซื้อจนถึงขั้น "แพ็ก" ซึ่ง **ตัดสต็อกจริง** จึงคืนยอดกลับให้ตอนจบ
// เหมือนที่ flow คำสั่งซื้อทำ · ใช้เล่ม 116 ที่มีของเยอะและไม่ถูกใช้ในเอกสารจัดซื้อ
package main

import (
	"fmt"
	"strings"
)

const deliveryBookID = 116

// shipmentOf — พัสดุของคำสั่งซื้อใบหนึ่ง
func shipmentOf(token string, orderID int) (map[string]any, error) {
	return get(token, fmt.Sprintf("/api/orders/%d/shipment", orderID))
}

// readyOrder — สั่งซื้อหนึ่งใบแล้วเดินจนถึงสถานะ "พร้อมจัดส่ง" คืนรหัสใบ
func readyOrder(customer, sales, warehouse string) (int, error) {
	orderID, err := placeOrder(customer, []any{orderLine(deliveryBookID, 1)})
	if err != nil {
		return 0, err
	}
	// ต้องแนบสลิปให้ใบเข้าสถานะรอตรวจก่อน ฝ่ายขายถึงจะกดตรวจผ่านได้
	if _, err := post(sales, fmt.Sprintf("/api/orders/%d/confirm-stock", orderID), nil, 200); err != nil {
		return 0, fmt.Errorf("ยืนยันสต็อกไม่ได้: %w", err)
	}
	if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
		map[string]any{"slipFileName": "slip-delivery-smoke.jpg", "bankId": 1}, 200); err != nil {
		return 0, fmt.Errorf("แนบสลิปไม่ได้: %w", err)
	}
	steps := []struct {
		token string
		path  string
	}{
		{sales, "verify-payment"},
		{warehouse, "pack"},
		{warehouse, "ready"},
	}
	for _, step := range steps {
		if _, err := post(step.token, fmt.Sprintf("/api/orders/%d/%s", orderID, step.path), nil, 200); err != nil {
			return 0, fmt.Errorf("เดินถึงขั้น %s ไม่ได้: %w", step.path, err)
		}
	}
	return orderID, nil
}

// shipBody — ฟอร์มบันทึกการจัดส่งของฝ่ายจัดส่ง
func shipBody(carrierID int, tracking string) map[string]any {
	return map[string]any{"carrierId": carrierID, "trackingNumber": tracking}
}

func runDeliveryFlow(e *env) {
	warehouse, manager, sales, delivery, customer := e.warehouse, e.manager, e.sales, e.delivery, e.customer
	var orderID, shipmentID int
	var firstTracking string
	onHandBefore := onHand(warehouse, deliveryBookID)

	section("บริษัทขนส่ง (Shipment --> ShippingCompany)")

	check("พนักงานอ่านรายชื่อบริษัทขนส่งได้ครบ 5 แห่ง", func() error {
		items, err := getList(delivery, "/api/carriers")
		if err != nil {
			return err
		}
		if len(items) != 5 {
			return fmt.Errorf("ได้ %d แห่ง ต้องการ 5", len(items))
		}
		return expect(items[0].(map[string]any)["name"], "ไปรษณีย์ไทย")
	})
	check("ลูกค้าเปิดรายชื่อบริษัทขนส่งไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/carriers", customer, nil, 403)
	})

	section("บันทึกการจัดส่ง (DeliveryStaff.recordShipment)")

	check("เดินคำสั่งซื้อจนถึงพร้อมจัดส่ง", func() error {
		id, err := readyOrder(customer, sales, warehouse)
		if err != nil {
			return err
		}
		orderID = id
		body, err := get(warehouse, fmt.Sprintf("/api/orders/%d", orderID))
		if err != nil {
			return err
		}
		return expect(body["status"], "READY_TO_SHIP")
	})
	check("ยังไม่บันทึกการจัดส่ง เปิดพัสดุไม่เจอ → 404 SHIPMENT_NOT_FOUND", func() error {
		return expectError("GET", fmt.Sprintf("/api/orders/%d/shipment", orderID), delivery,
			nil, 404, "SHIPMENT_NOT_FOUND")
	})
	check("ไม่กรอกเลขติดตามพัสดุ → 422 TRACKING_REQUIRED", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/ship", orderID), delivery,
			shipBody(1, "  "), 422, "TRACKING_REQUIRED")
	})
	check("บริษัทขนส่งที่ไม่มีอยู่ → 404 CARRIER_NOT_FOUND", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/ship", orderID), delivery,
			shipBody(999999, "TH-SMOKE-0001"), 404, "CARRIER_NOT_FOUND")
	})
	check("คลังสินค้าบันทึกการจัดส่งไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/orders/%d/ship", orderID), warehouse,
			shipBody(2, "TH-SMOKE-0002"), 403)
	})
	check("บันทึกการจัดส่งแล้วใบเป็น SHIPPED และเปิดพัสดุให้อัตโนมัติ", func() error {
		tracking := fmt.Sprintf("TH-SMOKE-%d", orderID)
		firstTracking = tracking
		body, err := post(delivery, fmt.Sprintf("/api/orders/%d/ship", orderID), shipBody(2, tracking), 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "SHIPPED"); err != nil {
			return err
		}

		parcel, err := shipmentOf(delivery, orderID)
		if err != nil {
			return err
		}
		shipmentID = int(parcel["shipmentId"].(float64))
		if err := expect(parcel["status"], "SHIPPED"); err != nil {
			return err
		}
		if err := expect(parcel["statusLabel"], "จัดส่งแล้ว"); err != nil {
			return err
		}
		if err := expect(parcel["carrierName"], "Kerry Express"); err != nil {
			return err
		}
		if err := expect(parcel["trackingNumber"], tracking); err != nil {
			return err
		}
		if err := expect(parcel["code"], fmt.Sprintf("SHP-%d", shipmentID)); err != nil {
			return err
		}
		// เปิดรายการ (PREPARING) แล้วส่งออก (SHIPPED) = ประวัติสองแถวตั้งแต่ต้น
		steps, _ := parcel["tracking"].([]any)
		if len(steps) != 2 {
			return fmt.Errorf("ประวัติ = %d แถว ต้องการ 2", len(steps))
		}
		return expect(steps[0].(map[string]any)["status"], "PREPARING")
	})
	check("ผู้รับคือชื่อลูกค้าถ้าไม่ได้ระบุมา", func() error {
		parcel, err := shipmentOf(delivery, orderID)
		if err != nil {
			return err
		}
		if parcel["recipientName"] == "" {
			return fmt.Errorf("ไม่ได้เติมชื่อผู้รับให้")
		}
		return nil
	})
	check("ลิงก์ติดตามพัสดุถูกแทนค่าเลขพัสดุแล้ว", func() error {
		parcel, err := shipmentOf(delivery, orderID)
		if err != nil {
			return err
		}
		url, _ := parcel["trackingUrl"].(string)
		if !strings.Contains(url, parcel["trackingNumber"].(string)) {
			return fmt.Errorf("ลิงก์ติดตาม %q ไม่มีเลขพัสดุอยู่ในนั้น", url)
		}
		return nil
	})
	check("เลขพัสดุซ้ำกับใบอื่น → 409 TRACKING_DUPLICATED", func() error {
		secondOrderID, err := readyOrder(customer, sales, warehouse)
		if err != nil {
			return err
		}
		return expectError("POST", fmt.Sprintf("/api/orders/%d/ship", secondOrderID), delivery,
			shipBody(2, firstTracking), 409, "TRACKING_DUPLICATED")
	})

	section("ติดตามสถานะพัสดุ (Shipment 1--* ShipmentTracking)")

	check("ขนส่งอัปเดตเป็น IN_TRANSIT พร้อมสถานที่", func() error {
		body, err := post(delivery, fmt.Sprintf("/api/shipments/%d/tracking", shipmentID),
			map[string]any{
				"status":   "IN_TRANSIT",
				"location": "ศูนย์กระจายสินค้าลาดกระบัง",
				"note":     "พัสดุถึงศูนย์กระจายสินค้า",
			}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "IN_TRANSIT"); err != nil {
			return err
		}
		steps, _ := body["tracking"].([]any)
		if len(steps) != 3 {
			return fmt.Errorf("ประวัติ = %d แถว ต้องการ 3", len(steps))
		}
		last := steps[len(steps)-1].(map[string]any)
		return expect(last["location"], "ศูนย์กระจายสินค้าลาดกระบัง")
	})
	check("ย้อนกลับไป PREPARING → 409 SHIPMENT_TRANSITION_REJECTED", func() error {
		return expectError("POST", fmt.Sprintf("/api/shipments/%d/tracking", shipmentID), delivery,
			map[string]any{"status": "PREPARING"}, 409, "SHIPMENT_TRANSITION_REJECTED")
	})
	check("สถานะที่ไม่มีอยู่ → 422 INVALID_SHIPMENT_STATUS", func() error {
		return expectError("POST", fmt.Sprintf("/api/shipments/%d/tracking", shipmentID), delivery,
			map[string]any{"status": "ON_THE_WAY"}, 422, "INVALID_SHIPMENT_STATUS")
	})
	check("ปิดพัสดุเป็น DELIVERED ที่นี่ไม่ได้ → 422 DELIVER_VIA_ORDER", func() error {
		return expectError("POST", fmt.Sprintf("/api/shipments/%d/tracking", shipmentID), delivery,
			map[string]any{"status": "DELIVERED"}, 422, "DELIVER_VIA_ORDER")
	})
	check("ฝ่ายขายอัปเดตสถานะพัสดุไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/shipments/%d/tracking", shipmentID), sales,
			map[string]any{"status": "IN_TRANSIT"}, 403)
	})
	check("พัสดุที่ไม่มีอยู่ → 404 SHIPMENT_NOT_FOUND", func() error {
		return expectError("POST", "/api/shipments/999999/tracking", delivery,
			map[string]any{"status": "IN_TRANSIT"}, 404, "SHIPMENT_NOT_FOUND")
	})

	section("สิทธิ์การเห็นพัสดุ")

	check("ลูกค้าเห็นพัสดุของใบตัวเองในรายการ", func() error {
		items, err := getList(customer, "/api/shipments")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["shipmentId"].(float64)) == shipmentID {
				return nil
			}
		}
		return fmt.Errorf("ไม่เห็นพัสดุ SHP-%d ของตัวเอง", shipmentID)
	})
	check("ลูกค้าเปิดพัสดุของใบคนอื่นไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/orders/1003/shipment", customer, nil, 403)
	})
	check("คำสั่งซื้อตั้งต้น SO-1003 มีพัสดุที่ส่งถึงแล้วครบประวัติ", func() error {
		parcel, err := shipmentOf(sales, 1003)
		if err != nil {
			return err
		}
		if err := expect(parcel["trackingNumber"], "TH-2026-073001"); err != nil {
			return err
		}
		if err := expect(parcel["carrierName"], "ไปรษณีย์ไทย"); err != nil {
			return err
		}
		if err := expect(parcel["status"], "DELIVERED"); err != nil {
			return err
		}
		steps, _ := parcel["tracking"].([]any)
		if len(steps) != 4 {
			return fmt.Errorf("ประวัติ = %d แถว ต้องการ 4", len(steps))
		}
		return expect(parcel["closed"], true)
	})

	section("ยืนยันรับสินค้า (ปิดใบและปิดพัสดุพร้อมกัน)")

	check("ยืนยันรับสินค้าแล้วทั้งใบและพัสดุเป็น DELIVERED", func() error {
		body, err := post(delivery, fmt.Sprintf("/api/orders/%d/deliver", orderID), nil, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "DELIVERED"); err != nil {
			return err
		}
		parcel, err := shipmentOf(delivery, orderID)
		if err != nil {
			return err
		}
		if err := expect(parcel["status"], "DELIVERED"); err != nil {
			return err
		}
		if err := expect(parcel["closed"], true); err != nil {
			return err
		}
		steps, _ := parcel["tracking"].([]any)
		if len(steps) != 4 {
			return fmt.Errorf("ประวัติ = %d แถว ต้องการ 4", len(steps))
		}
		return nil
	})
	check("กรองรายการพัสดุด้วยสถานะ DELIVERED ได้", func() error {
		items, err := getList(manager, "/api/shipments?status=DELIVERED")
		if err != nil {
			return err
		}
		found := false
		for _, entry := range items {
			row := entry.(map[string]any)
			if err := expect(row["status"], "DELIVERED"); err != nil {
				return err
			}
			if int(row["shipmentId"].(float64)) == shipmentID {
				found = true
			}
		}
		if !found {
			return fmt.Errorf("ไม่เห็นพัสดุ SHP-%d ในรายการที่ส่งถึงแล้ว", shipmentID)
		}
		return nil
	})
	check("สถานะที่ไม่มีอยู่ในตัวกรอง → 422 INVALID_SHIPMENT_STATUS", func() error {
		return expectError("GET", "/api/shipments?status=LOST", delivery, nil, 422, "INVALID_SHIPMENT_STATUS")
	})

	section("สรุปบัญชีพัสดุ (DeliverySummary.generate)")

	var summaryID int
	check("ฝ่ายจัดส่งออกสรุปพัสดุประจำวันได้", func() error {
		body, err := post(delivery, "/api/delivery-summaries",
			map[string]any{"summaryDate": daysFromNow(0)}, 201)
		if err != nil {
			return err
		}
		summaryID = int(body["summaryId"].(float64))
		if int(body["totalParcels"].(float64)) < 1 {
			return fmt.Errorf("จำนวนพัสดุ = %v ต้องมีอย่างน้อย 1 ใบที่ส่งวันนี้", body["totalParcels"])
		}
		if !strings.Contains(body["totalByCarrier"].(string), "Kerry Express") {
			return fmt.Errorf("สรุปรายขนส่ง %q ไม่มีเจ้าที่เพิ่งใช้", body["totalByCarrier"])
		}
		return expect(body["code"], fmt.Sprintf("DSM%03d", summaryID))
	})
	check("สรุปที่ออกไปแล้วอ่านย้อนหลังได้", func() error {
		items, err := getList(manager, "/api/delivery-summaries")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["summaryId"].(float64)) == summaryID {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบสรุป DSM%03d ในรายการ", summaryID)
	})
	check("ฝ่ายขายออกสรุปบัญชีพัสดุไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/delivery-summaries", sales,
			map[string]any{"summaryDate": daysFromNow(0)}, 403)
	})

	section("คืนยอดสต็อกที่ flow จัดส่งตัดไป")
	check("คืนยอดเล่มที่ใช้ทดสอบกลับเป็นค่าเดิม", func() error {
		// 2 หน่วย: ใบหลักที่จัดส่งจริง + ใบที่สองของเช็คเลขพัสดุซ้ำ (แพ็กจนตัดสต็อกไปแล้ว
		// แต่ถูกปฏิเสธตอน ship จึงค้างที่ READY_TO_SHIP ไม่มีเส้นทางคืนสต็อกอัตโนมัติ)
		_, err := post(warehouse, "/api/inventory/adjust", map[string]any{
			"lines": []any{map[string]any{
				"bookId":         deliveryBookID,
				"quantityChange": 2,
				"reason":         "คืนยอดหลังทดสอบการจัดส่ง",
				"referenceDoc":   "SMOKE",
			}},
		}, 201)
		if err != nil {
			return err
		}
		return expect(onHand(warehouse, deliveryBookID), onHandBefore)
	})
}
