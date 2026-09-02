// flow_review.go — ระบบย่อยรีวิวลูกค้า (ระบบย่อยของดวงกมล กองพันธ์)
//
// ลูกค้าเขียนรีวิวได้เฉพาะหนังสือที่สั่งซื้อและได้รับของแล้ว flow นี้จึงเดินคำสั่งซื้อ
// ของตัวเองจนถึง "ส่งถึงแล้ว" ก่อน (ใช้ deliveredOrder ร่วมกับ flow สมาชิก)
// การแพ็กตัดสต็อกจริง จึงคืนยอดของทุกเล่มในใบตอนจบเหมือน flow อื่น
//
// สั่งสองเล่มในใบเดียว: เล่มหนึ่งไว้เขียนรีวิวสุภาพ อีกเล่มไว้เขียนรีวิวที่มีคำต้องห้าม
// เพื่อตรวจว่า ProfanityFilter ติดธงให้โดยไม่ปฏิเสธการบันทึก
package main

import "fmt"

const (
	reviewCleanBookID   = 116 // เงาในกระจก — ใช้เขียนรีวิวสุภาพ
	reviewFlaggedBookID = 117 // ทางกลับบ้าน — ใช้เขียนรีวิวที่มีคำต้องห้าม
	reviewUnboughtBook  = 102 // The Alchemist — ไม่ได้อยู่ในใบ ใช้ตรวจสิทธิ์
	reviewQty           = 1

	salesName   = "ณัฐวุฒิ แสงจันทร์"
	managerName = "ปิยะพร วงศ์ทอง"
)

func reviewBody(bookID, rating int, headline, comment string) map[string]any {
	return map[string]any{
		"bookId":   bookID,
		"rating":   rating,
		"headline": headline,
		"comment":  comment,
	}
}

func runReviewFlow(e *env) {
	warehouse, manager, sales, delivery, customer := e.warehouse, e.manager, e.sales, e.delivery, e.customer

	cleanBefore := onHand(warehouse, reviewCleanBookID)
	flaggedBefore := onHand(warehouse, reviewFlaggedBookID)

	var (
		orderID         int
		cleanReviewID   int
		flaggedReviewID int
		reportID        int
		otherReviewID   int
	)

	section("เตรียมคำสั่งซื้อที่ส่งถึงแล้ว (Review --> Order : verified buy)")

	check("ลูกค้าสั่งซื้อสองเล่มแล้วเดินจนได้รับสินค้า", func() error {
		id, _, err := deliveredOrder(customer, sales, warehouse, delivery, []any{
			orderLine(reviewCleanBookID, reviewQty),
			orderLine(reviewFlaggedBookID, reviewQty),
		})
		if err != nil {
			return err
		}
		orderID = id

		body, err := get(customer, fmt.Sprintf("/api/orders/%d", orderID))
		if err != nil {
			return err
		}
		return expect(body["status"], "DELIVERED")
	})

	section("ลูกค้าเขียนรีวิว (Customer.writeReview · Review.submit)")

	check("รีวิวหนังสือที่ยังไม่เคยซื้อ → 422 REVIEW_NOT_PURCHASED", func() error {
		return expectError("POST", "/api/reviews", customer,
			reviewBody(reviewUnboughtBook, 5, "ยังไม่ได้ซื้อ", "อยากรีวิวเฉย ๆ"),
			422, "REVIEW_NOT_PURCHASED")
	})
	check("ให้คะแนน 0 ดาว → 422 INVALID_RATING", func() error {
		return expectError("POST", "/api/reviews", customer,
			reviewBody(reviewCleanBookID, 0, "ไม่ให้ดาว", "ลืมกดดาว"), 422, "INVALID_RATING")
	})
	check("ให้คะแนน 6 ดาว → 422 INVALID_RATING", func() error {
		return expectError("POST", "/api/reviews", customer,
			reviewBody(reviewCleanBookID, 6, "เกินดาว", "กดเกินไปหนึ่งดาว"), 422, "INVALID_RATING")
	})
	check("ไม่กรอกข้อความรีวิว → 422 EMPTY_REVIEW_COMMENT", func() error {
		return expectError("POST", "/api/reviews", customer,
			reviewBody(reviewCleanBookID, 5, "ไม่มีข้อความ", "   "), 422, "EMPTY_REVIEW_COMMENT")
	})
	check("พนักงานฝ่ายขายเขียนรีวิวแทนลูกค้าไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/reviews", sales,
			reviewBody(reviewCleanBookID, 5, "แทนลูกค้า", "ลองเขียนแทนลูกค้า"), 403)
	})

	check("รีวิวสุภาพบันทึกได้ → PENDING และไม่ถูกติดธง", func() error {
		body, err := post(customer, "/api/reviews",
			reviewBody(reviewCleanBookID, 5, "เนื้อเรื่องดีมาก",
				"อ่านเพลิน จัดส่งไว แพ็กมาอย่างดี แนะนำเลยครับ"), 201)
		if err != nil {
			return err
		}
		cleanReviewID = int(body["reviewId"].(float64))

		if err := expect(body["status"], "PENDING"); err != nil {
			return err
		}
		if err := expect(body["statusLabel"], "รอตรวจสอบ"); err != nil {
			return err
		}
		if err := expect(body["flagged"], false); err != nil {
			return err
		}
		return expect(body["verifiedPurchase"], true)
	})
	check("รีวิวถูกผูกกับใบสั่งซื้อที่ได้รับของแล้วให้อัตโนมัติ", func() error {
		body, err := get(customer, fmt.Sprintf("/api/reviews/%d", cleanReviewID))
		if err != nil {
			return err
		}
		if err := expect(int(body["orderId"].(float64)), orderID); err != nil {
			return err
		}
		return expect(body["orderCode"], fmt.Sprintf("SO-%d", orderID))
	})
	check("รีวิวเล่มเดิมจากใบเดิมซ้ำ → 409 REVIEW_DUPLICATED", func() error {
		return expectError("POST", "/api/reviews", customer,
			reviewBody(reviewCleanBookID, 4, "รีวิวซ้ำ", "เขียนอีกรอบ"), 409, "REVIEW_DUPLICATED")
	})
	check("รีวิวที่มีคำไม่เหมาะสมยังบันทึกได้ แต่ถูกติดธง", func() error {
		body, err := post(customer, "/api/reviews",
			reviewBody(reviewFlaggedBookID, 1, "ไม่คุ้มราคา",
				"สำนวนแปลห่วยมาก อ่านไม่รู้เรื่องเลย"), 201)
		if err != nil {
			return err
		}
		flaggedReviewID = int(body["reviewId"].(float64))

		if err := expect(body["flagged"], true); err != nil {
			return err
		}
		return expect(body["status"], "PENDING")
	})

	section("สิทธิ์การเข้าถึงรีวิว")

	check("คลังสินค้าเปิดคิวรีวิวไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/reviews", warehouse, nil, 403)
	})
	check("ฝ่ายจัดส่งเปิดคิวรีวิวไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/reviews", delivery, nil, 403)
	})
	check("ฝ่ายขายเปิดคิวรายงานของผู้จัดการไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/review-reports", sales, nil, 403)
	})
	check("ลูกค้าตรวจสอบรีวิวเองไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/reviews/%d/moderate", cleanReviewID), customer,
			map[string]any{"action": "PUBLISH"}, 403)
	})
	check("ลูกค้าเห็นเฉพาะรีวิวของตัวเอง", func() error {
		items, err := getList(customer, "/api/reviews")
		if err != nil {
			return err
		}
		if len(items) != 2 {
			return fmt.Errorf("ลูกค้าเห็น %d รีวิว ต้องการ 2 (ของตัวเองเท่านั้น)", len(items))
		}
		return nil
	})
	check("ลูกค้าเปิดรีวิวของคนอื่นไม่ได้ → 403", func() error {
		items, err := getList(sales, "/api/reviews")
		if err != nil {
			return err
		}
		for _, entry := range items {
			row := entry.(map[string]any)
			id := int(row["reviewId"].(float64))
			if id != cleanReviewID && id != flaggedReviewID {
				otherReviewID = id
				break
			}
		}
		if otherReviewID == 0 {
			return fmt.Errorf("ไม่มีรีวิวของลูกค้ารายอื่นในระบบให้ทดสอบ")
		}
		return expectStatus("GET", fmt.Sprintf("/api/reviews/%d", otherReviewID), customer, nil, 403)
	})
	check("รีวิวที่ไม่มีอยู่ → 404 REVIEW_NOT_FOUND", func() error {
		return expectError("GET", "/api/reviews/999999", sales, nil, 404, "REVIEW_NOT_FOUND")
	})
	check("กรองด้วยสถานะที่ไม่มีอยู่ → 422 INVALID_REVIEW_STATUS", func() error {
		return expectError("GET", "/api/reviews?status=UNKNOWN", sales, nil, 422, "INVALID_REVIEW_STATUS")
	})

	section("ฝ่ายขายตรวจสอบรีวิว (SalesStaff.moderateReview)")

	check("ฝ่ายขายเห็นรีวิวที่ติดธงผ่านตัวกรอง flagged=true", func() error {
		items, err := getList(sales, "/api/reviews?flagged=true")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reviewId"].(float64)) == flaggedReviewID {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบรีวิวที่ติดธงในผลลัพธ์ %d แถว", len(items))
	})
	check("รีวิวที่ยังไม่ตรวจยังไม่ขึ้นหน้าร้าน", func() error {
		items, err := getList(customer, fmt.Sprintf("/api/books/%d/reviews", reviewCleanBookID))
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reviewId"].(float64)) == cleanReviewID {
				return fmt.Errorf("รีวิวสถานะ PENDING ไม่ควรขึ้นหน้าร้าน")
			}
		}
		return nil
	})
	check("ตอบกลับด้วยข้อความว่าง → 422 EMPTY_REPLY_TEXT", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/replies", cleanReviewID), sales,
			map[string]any{"replyText": "   "}, 422, "EMPTY_REPLY_TEXT")
	})
	check("ฝ่ายขายตอบกลับแล้วรีวิวขึ้นหน้าร้านทันที", func() error {
		body, err := post(sales, fmt.Sprintf("/api/reviews/%d/replies", cleanReviewID),
			map[string]any{"replyText": "ขอบคุณสำหรับรีวิวครับ ทางร้านดีใจที่คุณลูกค้าประทับใจ"}, 201)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "PUBLISHED"); err != nil {
			return err
		}

		replies, _ := body["replies"].([]any)
		if len(replies) != 1 {
			return fmt.Errorf("คำตอบกลับ = %d แถว ต้องการ 1", len(replies))
		}
		return expect(replies[0].(map[string]any)["repliedBy"], salesName)
	})
	check("รีวิวที่เผยแพร่แล้วขึ้นหน้าร้าน", func() error {
		items, err := getList(customer, fmt.Sprintf("/api/books/%d/reviews", reviewCleanBookID))
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reviewId"].(float64)) == cleanReviewID {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบรีวิวที่เผยแพร่แล้วในหน้าร้าน (%d แถว)", len(items))
	})
	check("คำสั่งตรวจสอบที่ไม่มีอยู่ → 422 INVALID_MODERATE_ACTION", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/moderate", cleanReviewID), sales,
			map[string]any{"action": "APPROVE"}, 422, "INVALID_MODERATE_ACTION")
	})

	section("ส่งรีวิวให้ผู้จัดการพิจารณา (Review --> ReviewReport : escalates)")

	check("รายงานโดยไม่ระบุเหตุผล → 422 EMPTY_REPORT_REASON", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/report", flaggedReviewID), sales,
			map[string]any{"reason": "  "}, 422, "EMPTY_REPORT_REASON")
	})
	check("ฝ่ายขายส่งรีวิวที่ติดธงให้ผู้จัดการ → รายงานสถานะ PENDING", func() error {
		body, err := post(sales, fmt.Sprintf("/api/reviews/%d/report", flaggedReviewID),
			map[string]any{
				"reason": "เนื้อหาไม่เหมาะสม / มีคำหยาบคาย",
				"detail": "พบการใช้คำไม่สุภาพในการรีวิว",
			}, 201)
		if err != nil {
			return err
		}
		reportID = int(body["reportId"].(float64))

		if err := expect(body["status"], "PENDING"); err != nil {
			return err
		}
		if err := expect(body["statusLabel"], "รออนุมัติ"); err != nil {
			return err
		}
		return expect(body["reportedBy"], salesName)
	})
	check("รายงานรีวิวเดิมซ้ำ → 409 REVIEW_REPORTED", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/report", flaggedReviewID), sales,
			map[string]any{"reason": "รายงานซ้ำ"}, 409, "REVIEW_REPORTED")
	})
	check("ผู้จัดการเห็นรายงานในคิวที่ยังไม่ตัดสิน", func() error {
		items, err := getList(manager, "/api/review-reports?status=PENDING")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reportId"].(float64)) == reportID {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบรายงานในคิว (%d แถว)", len(items))
	})
	check("รายงานพกรีวิวต้นเรื่องมาด้วย ไม่ต้องยิงซ้ำ", func() error {
		body, err := get(manager, fmt.Sprintf("/api/review-reports/%d", reportID))
		if err != nil {
			return err
		}
		review, ok := body["review"].(map[string]any)
		if !ok {
			return fmt.Errorf("ไม่มีรีวิวต้นเรื่องใน response")
		}
		return expect(int(review["reviewId"].(float64)), flaggedReviewID)
	})
	check("ผู้จัดการได้รับแจ้งเตือนว่ามีรีวิวรอพิจารณา", func() error {
		items, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if entry.(map[string]any)["kind"] == "REVIEW_REPORTED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบแจ้งเตือน REVIEW_REPORTED ใน %d รายการ", len(items))
	})

	section("ผู้จัดการตัดสิน (StoreManager handles ReviewReport)")

	check("ซ่อนรีวิว → รีวิวเป็น HIDDEN และรายงานถูกตัดสินว่าเป็นผล", func() error {
		body, err := post(manager, fmt.Sprintf("/api/reviews/%d/moderate", flaggedReviewID),
			map[string]any{"action": "HIDE"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "HIDDEN"); err != nil {
			return err
		}

		report, ok := body["report"].(map[string]any)
		if !ok {
			return fmt.Errorf("ไม่มีรายงานติดมากับรีวิว")
		}
		if err := expect(report["status"], "APPROVED"); err != nil {
			return err
		}
		return expect(report["decidedBy"], managerName)
	})
	check("รายงานที่ตัดสินแล้วออกจากคิว PENDING", func() error {
		items, err := getList(manager, "/api/review-reports?status=PENDING")
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reportId"].(float64)) == reportID {
				return fmt.Errorf("รายงานที่ตัดสินแล้วยังอยู่ในคิว")
			}
		}
		return nil
	})
	check("รีวิวที่ถูกซ่อนหายจากหน้าร้าน", func() error {
		items, err := getList(customer, fmt.Sprintf("/api/books/%d/reviews", reviewFlaggedBookID))
		if err != nil {
			return err
		}
		for _, entry := range items {
			if int(entry.(map[string]any)["reviewId"].(float64)) == flaggedReviewID {
				return fmt.Errorf("รีวิวที่ซ่อนแล้วไม่ควรขึ้นหน้าร้าน")
			}
		}
		return nil
	})
	check("ลบรีวิวได้ แล้วสถานะเป็น REMOVED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/reviews/%d/moderate", flaggedReviewID),
			map[string]any{"action": "REMOVE"}, 200)
		if err != nil {
			return err
		}
		return expect(body["statusLabel"], "รีวิวที่ถูกลบ")
	})
	check("ตรวจสอบรีวิวที่ถูกลบแล้วซ้ำ → 409 REVIEW_REMOVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/moderate", flaggedReviewID), manager,
			map[string]any{"action": "PUBLISH"}, 409, "REVIEW_REMOVED")
	})
	check("ตอบกลับรีวิวที่ถูกลบแล้ว → 409 REVIEW_REMOVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/reviews/%d/replies", flaggedReviewID), sales,
			map[string]any{"replyText": "ขอโทษด้วยครับ"}, 409, "REVIEW_REMOVED")
	})

	section("ข้อมูลรีวิวตั้งต้น")

	check("รีวิวตั้งต้นครบทั้งสี่สถานะ", func() error {
		items, err := getList(sales, "/api/reviews")
		if err != nil {
			return err
		}
		seen := map[string]bool{}
		for _, entry := range items {
			seen[entry.(map[string]any)["status"].(string)] = true
		}
		for _, status := range []string{"PENDING", "PUBLISHED", "HIDDEN", "REMOVED"} {
			if !seen[status] {
				return fmt.Errorf("ไม่พบรีวิวสถานะ %s ในระบบ", status)
			}
		}
		return nil
	})
	check("รีวิวเก่าที่ไม่มีใบสั่งซื้อไม่ถูกนับเป็นซื้อสินค้าจริง", func() error {
		items, err := getList(sales, "/api/reviews")
		if err != nil {
			return err
		}
		for _, entry := range items {
			row := entry.(map[string]any)
			if row["orderId"] == nil {
				return expect(row["verifiedPurchase"], false)
			}
		}
		return fmt.Errorf("ไม่พบรีวิวที่ไม่มีใบสั่งซื้อในข้อมูลตั้งต้น")
	})

	section("คืนยอดสต็อกที่ flow รีวิวตัดไป")

	check("คืนยอดทั้งสองเล่มกลับเป็นค่าเดิม", func() error {
		_, err := post(warehouse, "/api/inventory/adjust", map[string]any{
			"lines": []any{
				map[string]any{
					"bookId": reviewCleanBookID, "quantityChange": reviewQty,
					"reason": "คืนยอดหลังทดสอบระบบรีวิว", "referenceDoc": "SMOKE",
				},
				map[string]any{
					"bookId": reviewFlaggedBookID, "quantityChange": reviewQty,
					"reason": "คืนยอดหลังทดสอบระบบรีวิว", "referenceDoc": "SMOKE",
				},
			},
		}, 201)
		if err != nil {
			return err
		}
		if err := expect(onHand(warehouse, reviewCleanBookID), cleanBefore); err != nil {
			return err
		}
		return expect(onHand(warehouse, reviewFlaggedBookID), flaggedBefore)
	})
}
