// flow_payment.go — ตรวจสอบการชำระเงิน บัญชีธนาคาร และรายงานการรับชำระ
//
// ใช้หนังสือเล่มเดียวกับ flow คำสั่งซื้อได้อย่างปลอดภัย เพราะ flow นี้ไม่เดินไปถึงขั้น "แพ็ก"
// จึงไม่ตัดสต็อกจริง ไม่ต้องคืนยอดตอนจบ
package main

import (
	"fmt"
	"math"
)

// paymentOrderBody — ฟอร์มสั่งซื้อที่ยังไม่แนบสลิป (ช่องทางโทรศัพท์/ข้อความ)
// ใบที่แนบสลิปมาตั้งแต่ตอนสั่งจะเข้าสถานะรอตรวจทันที ที่นี่อยากเห็น WAITING ก่อน
func paymentOrderBody(lines []any) map[string]any {
	return map[string]any{
		"shippingAddress": "9 ถนนทดสอบการชำระเงิน กรุงเทพฯ 10000",
		"items":           lines,
	}
}

// paymentOf — การชำระเงินของคำสั่งซื้อใบหนึ่ง
func paymentOf(token string, orderID int) (map[string]any, error) {
	return get(token, fmt.Sprintf("/api/orders/%d/payment", orderID))
}

// openUnpaidOrder — สั่งซื้อหนึ่งใบแล้วยืนยันสต็อก คืนรหัสใบกับยอดสุทธิ
func openUnpaidOrder(customer, sales string) (int, float64, error) {
	profile, err := get(customer, "/api/customers/me")
	if err != nil {
		return 0, 0, err
	}
	input := paymentOrderBody([]any{orderLine(orderBookID, 1)})
	input["customerId"] = profile["customerId"]
	input["channel"] = "PHONE"
	body, err := post(sales, "/api/orders", input, 201)
	if err != nil {
		return 0, 0, err
	}
	orderID := int(body["orderId"].(float64))
	netAmount := body["netAmount"].(float64)
	if _, err := post(sales, fmt.Sprintf("/api/orders/%d/confirm-stock", orderID), nil, 200); err != nil {
		return 0, 0, err
	}
	return orderID, netAmount, nil
}

// generateReport — ออกรายงานหนึ่งใบครอบเมื่อวานถึงพรุ่งนี้
// (กว้างกว่าหนึ่งวันเพื่อไม่ให้ผลเปลี่ยนตามเวลาที่รัน — verified_date เก็บเป็น UTC)
func generateReport(manager string) (map[string]any, error) {
	return post(manager, "/api/payment-reports", map[string]any{
		"periodStart": daysFromNow(-1),
		"periodEnd":   daysFromNow(1),
	}, 201)
}

func runPaymentFlow(e *env) {
	warehouse, manager, sales, customer := e.warehouse, e.manager, e.sales, e.customer
	var successPaymentID int

	section("บัญชีธนาคารที่ร้านรับโอน (Payment --> Bank)")

	check("พนักงานอ่านบัญชีธนาคารได้ครบ 3 แห่ง", func() error {
		items, err := getList(sales, "/api/banks")
		if err != nil {
			return err
		}
		if len(items) != 3 {
			return fmt.Errorf("ได้ %d แห่ง ต้องการ 3", len(items))
		}
		return expect(items[0].(map[string]any)["name"], "ธนาคารกสิกรไทย")
	})
	check("ลูกค้าเห็นบัญชีธนาคารด้วย (ต้องรู้ว่าจะโอนเข้าบัญชีไหน)", func() error {
		items, err := getList(customer, "/api/banks")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ลูกค้าไม่เห็นบัญชีธนาคารเลย")
		}
		return nil
	})

	section("การชำระเงินของคำสั่งซื้อ (Order 1--1 Payment)")

	check("สั่งซื้อแล้วเปิดแถวการชำระเงินสถานะ WAITING ยอดเท่ายอดสุทธิ", func() error {
		orderID, netAmount, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		body, err := paymentOf(customer, orderID)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "WAITING"); err != nil {
			return err
		}
		if err := expect(body["statusLabel"], "รอชำระเงิน"); err != nil {
			return err
		}
		if err := expect(body["orderCode"], fmt.Sprintf("SO-%d", orderID)); err != nil {
			return err
		}
		return expect(body["amount"], netAmount)
	})

	check("แนบสลิปแล้วสถานะเป็น VERIFYING พร้อมชื่อธนาคารที่โอนเข้า", func() error {
		orderID, _, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
			map[string]any{"slipFileName": "slip-pay-smoke.jpg", "bankId": 2}, 200); err != nil {
			return err
		}
		body, err := paymentOf(customer, orderID)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "VERIFYING"); err != nil {
			return err
		}
		if err := expect(body["bankName"], "ธนาคารไทยพาณิชย์"); err != nil {
			return err
		}
		if body["transferDate"] == nil {
			return fmt.Errorf("ไม่ได้บันทึกวันที่โอน")
		}
		return expect(body["slipImageUrl"], "slip-pay-smoke.jpg")
	})

	check("ฝ่ายขายตรวจผ่านแล้วสถานะเป็น SUCCESS พร้อมผู้ตรวจและเวลา", func() error {
		orderID, _, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
			map[string]any{"slipFileName": "slip-pay-ok.jpg", "bankId": 1}, 200); err != nil {
			return err
		}
		if _, err := post(sales, fmt.Sprintf("/api/orders/%d/verify-payment", orderID), nil, 200); err != nil {
			return err
		}
		body, err := paymentOf(sales, orderID)
		if err != nil {
			return err
		}
		successPaymentID = int(body["paymentId"].(float64))
		if err := expect(body["status"], "SUCCESS"); err != nil {
			return err
		}
		if body["verifiedDate"] == nil || body["verifiedBy"] == "" {
			return fmt.Errorf("ไม่ได้บันทึกผู้ตรวจหรือเวลาที่ตรวจ: %v", body)
		}
		return expect(body["code"], fmt.Sprintf("PAY-%d", successPaymentID))
	})

	check("ปฏิเสธสลิปแล้วสถานะเป็น REJECTED พร้อมเหตุผล", func() error {
		orderID, _, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
			map[string]any{"slipFileName": "slip-pay-bad.jpg"}, 200); err != nil {
			return err
		}
		if _, err := post(sales, fmt.Sprintf("/api/orders/%d/reject-payment", orderID),
			map[string]any{"note": "ยอดเงินในสลิปไม่ตรงกับใบสั่งซื้อ"}, 200); err != nil {
			return err
		}
		body, err := paymentOf(sales, orderID)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "REJECTED"); err != nil {
			return err
		}
		return expect(body["rejectReason"], "ยอดเงินในสลิปไม่ตรงกับใบสั่งซื้อ")
	})

	check("โอนเข้าบัญชีที่ไม่มีอยู่ → 404 BANK_NOT_FOUND", func() error {
		orderID, _, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		return expectError("POST", fmt.Sprintf("/api/orders/%d/payment", orderID), customer,
			map[string]any{"slipFileName": "slip.jpg", "bankId": 999999}, 404, "BANK_NOT_FOUND")
	})

	check("คำสั่งซื้อตั้งต้นมีแถวการชำระเงินครบ (SO-1002 ชำระสำเร็จแล้ว)", func() error {
		body, err := paymentOf(sales, 1002)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "SUCCESS"); err != nil {
			return err
		}
		return expect(body["orderCode"], "SO-1002")
	})

	section("หน้ารายการรับชำระเงินของฝ่ายขาย")

	check("ฝ่ายขายเห็นรายการรับชำระทั้งหมด", func() error {
		items, err := getList(sales, "/api/payments")
		if err != nil {
			return err
		}
		if len(items) < 4 {
			return fmt.Errorf("ได้ %d รายการ ต้องอย่างน้อย 4", len(items))
		}
		return nil
	})
	check("กรองด้วยสถานะ SUCCESS ได้", func() error {
		items, err := getList(manager, "/api/payments?status=SUCCESS")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ไม่มีรายการที่ชำระสำเร็จเลย")
		}
		for _, entry := range items {
			if err := expect(entry.(map[string]any)["status"], "SUCCESS"); err != nil {
				return err
			}
		}
		return nil
	})
	check("สถานะที่ไม่มีอยู่ → 422 INVALID_PAYMENT_STATUS", func() error {
		return expectError("GET", "/api/payments?status=PENDING", sales, nil, 422, "INVALID_PAYMENT_STATUS")
	})
	check("เปิดรายการรับชำระรายตัวด้วยรหัสได้", func() error {
		body, err := get(sales, fmt.Sprintf("/api/payments/%d", successPaymentID))
		if err != nil {
			return err
		}
		return expect(body["status"], "SUCCESS")
	})
	check("รหัสการชำระเงินที่ไม่มีอยู่ → 404 PAYMENT_NOT_FOUND", func() error {
		return expectError("GET", "/api/payments/999999", sales, nil, 404, "PAYMENT_NOT_FOUND")
	})
	check("คลังสินค้าเปิดหน้ารับชำระเงินไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/payments", warehouse, nil, 403)
	})
	check("ลูกค้าเปิดการชำระเงินของใบคนอื่นไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/orders/1002/payment", customer, nil, 403)
	})

	section("รายงานการรับชำระ (StoreManager.generates)")

	var reportID int
	check("ออกรายงานแล้วตัวเลขเพิ่มตามใบที่เพิ่งตรวจผ่าน", func() error {
		before, err := generateReport(manager)
		if err != nil {
			return err
		}
		orderID, netAmount, err := openUnpaidOrder(customer, sales)
		if err != nil {
			return err
		}
		if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
			map[string]any{"slipFileName": "slip-report.jpg", "bankId": 3}, 200); err != nil {
			return err
		}
		if _, err := post(sales, fmt.Sprintf("/api/orders/%d/verify-payment", orderID), nil, 200); err != nil {
			return err
		}

		after, err := generateReport(manager)
		if err != nil {
			return err
		}
		reportID = int(after["reportId"].(float64))

		gotCount := int(after["itemCount"].(float64)) - int(before["itemCount"].(float64))
		if gotCount != 1 {
			return fmt.Errorf("จำนวนใบเพิ่มขึ้น %d ต้องการ 1", gotCount)
		}
		gotTotal := after["totalReceived"].(float64) - before["totalReceived"].(float64)
		if math.Abs(gotTotal-netAmount) > 0.01 {
			return fmt.Errorf("ยอดรวมเพิ่มขึ้น %.2f ต้องการ %.2f", gotTotal, netAmount)
		}
		return expect(after["code"], fmt.Sprintf("PRP%03d", reportID))
	})
	check("รายงานที่ออกไปแล้วอ่านย้อนหลังได้", func() error {
		items, err := getList(manager, "/api/payment-reports")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reportId"].(float64)) == reportID {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบรายงาน PRP%03d ในรายการ", reportID)
	})
	check("ช่วงวันที่กลับหัว → 422 REPORT_PERIOD_RANGE", func() error {
		return expectError("POST", "/api/payment-reports", manager, map[string]any{
			"periodStart": daysFromNow(1),
			"periodEnd":   daysFromNow(-1),
		}, 422, "REPORT_PERIOD_RANGE")
	})
	check("ฝ่ายขายออกรายงานสรุปยอดไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/payment-reports", sales, map[string]any{
			"periodStart": daysFromNow(-1),
			"periodEnd":   daysFromNow(1),
		}, 403)
	})
	check("ลูกค้าเปิดรายงานสรุปยอดไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/payment-reports", customer, nil, 403)
	})
}
