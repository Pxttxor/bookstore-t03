// flow_membership.go — ระบบสมาชิกและแต้มสะสม
//
// flow นี้เดินคำสั่งซื้อของตัวเองจนถึง "ส่งถึงแล้ว" เพราะแต้มเกิดที่ขั้นนั้นขั้นเดียว
// การแพ็กตัดสต็อกจริง จึงคืนยอดกลับให้ตอนจบเหมือน flow คำสั่งซื้อและ flow จัดส่ง
//
// ใช้เล่ม 113 (฿581) จำนวน 6 เล่ม = ฿3,486 เพื่อให้ได้แต้มหลักสิบ พอสำหรับ
// การแลกของรางวัลและการหักแต้มในเคสถัด ๆ ไปโดยไม่ต้องเดาว่ามีแต้มพอไหม
package main

import (
	"fmt"
	"time"
)

const (
	membershipBookID = 113
	membershipQty    = 6
)

// deliveredOrder — สั่งซื้อหนึ่งใบแล้วเดินจนลูกค้ารับของแล้ว คืนรหัสใบและยอดสุทธิ
//
// ใช้ร่วมกันระหว่าง flow สมาชิก (ต้องมีใบที่ส่งถึงแล้วถึงจะได้แต้ม) กับ flow รีวิว
// (ต้องมีใบที่ส่งถึงแล้วถึงจะเขียนรีวิวได้) · ผู้เรียกเป็นคนคืนยอดสต็อกเองตอนจบ
func deliveredOrder(customer, sales, warehouse, delivery string, lines []any) (int, float64, error) {
	body, err := post(customer, "/api/orders", orderBody(lines, 0), 201)
	if err != nil {
		return 0, 0, fmt.Errorf("สั่งซื้อไม่สำเร็จ: %w", err)
	}
	orderID := int(body["orderId"].(float64))
	net, _ := body["netAmount"].(float64)

	if _, err := post(sales, fmt.Sprintf("/api/orders/%d/confirm-stock", orderID), nil, 200); err != nil {
		return 0, 0, fmt.Errorf("ยืนยันสต็อกไม่ได้: %w", err)
	}
	if _, err := post(customer, fmt.Sprintf("/api/orders/%d/payment", orderID),
		map[string]any{"slipFileName": "slip-membership-smoke.jpg", "bankId": 1}, 200); err != nil {
		return 0, 0, fmt.Errorf("แนบสลิปไม่ได้: %w", err)
	}

	steps := []struct {
		token string
		path  string
		body  any
	}{
		{sales, "verify-payment", nil},
		{warehouse, "pack", nil},
		{warehouse, "ready", nil},
		{delivery, "ship", shipBody(1, fmt.Sprintf("TH-MBR-%d", time.Now().UnixNano()%100000))},
		{delivery, "deliver", nil},
	}
	for _, step := range steps {
		_, err := post(step.token, fmt.Sprintf("/api/orders/%d/%s", orderID, step.path), step.body, 200)
		if err != nil {
			return 0, 0, fmt.Errorf("เดินถึงขั้น %s ไม่ได้: %w", step.path, err)
		}
	}
	return orderID, net, nil
}

// tierBody — ฟอร์มระดับสมาชิกของผู้จัดการ
func tierBody(name string, minPurchase, rate float64) map[string]any {
	return map[string]any{
		"name":                   name,
		"minAccumulatedPurchase": minPurchase,
		"pointRate":              rate,
		"benefits":               "สิทธิประโยชน์สำหรับทดสอบระบบ",
	}
}

// rewardBody — ฟอร์มของรางวัลของผู้จัดการ
func rewardBody(name, kind string, pointCost int, discount float64) map[string]any {
	return map[string]any{
		"name":          name,
		"type":          kind,
		"pointCost":     pointCost,
		"discountValue": discount,
	}
}

func runMembershipFlow(e *env) {
	warehouse, manager, sales, delivery, customer := e.warehouse, e.manager, e.sales, e.delivery, e.customer
	onHandBefore := onHand(warehouse, membershipBookID)

	// ชื่อต้องไม่ซ้ำทุกรอบ ไม่งั้นรัน smoke ซ้ำจะติด TIER_NAME_TAKEN
	stamp := time.Now().UnixNano() % 100000
	tierName := fmt.Sprintf("ระดับทดสอบ %d", stamp)
	rewardName := fmt.Sprintf("ของรางวัลทดสอบ %d", stamp)

	var (
		memberID       int
		tierID         int
		rewardID       int
		pricyRewardID  int
		balanceBefore  int
		totalBefore    float64
		pointRate      float64
		earnedOrderID  int
		earnedNetTotal float64
	)

	section("ระดับสมาชิก (StoreManager.manageMemberTier)")

	check("ทุกคนที่ล็อกอินเห็นระดับสมาชิกตั้งต้นครบ 3 ระดับ", func() error {
		items, err := getList(customer, "/api/membership-tiers")
		if err != nil {
			return err
		}
		if len(items) < 3 {
			return fmt.Errorf("ได้ %d ระดับ ต้องอย่างน้อย 3", len(items))
		}
		return expect(items[0].(map[string]any)["name"], "Silver")
	})
	check("ฝ่ายขายสร้างระดับสมาชิกไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/membership-tiers", sales, tierBody(tierName, 100, 0.01), 403)
	})
	check("ผู้จัดการสร้างระดับใหม่ได้", func() error {
		body, err := post(manager, "/api/membership-tiers", tierBody(tierName, 90000, 0.05), 201)
		if err != nil {
			return err
		}
		tierID = int(body["tierId"].(float64))
		return expect(body["pointRate"], 0.05)
	})
	check("ชื่อระดับซ้ำ → 409 TIER_NAME_TAKEN", func() error {
		return expectError("POST", "/api/membership-tiers", manager,
			tierBody(" "+tierName+" ", 95000, 0.06), 409, "TIER_NAME_TAKEN")
	})
	check("อัตราการให้แต้มเป็นศูนย์ → 422 INVALID_POINT_RATE", func() error {
		return expectError("POST", "/api/membership-tiers", manager,
			tierBody(tierName+" ศูนย์", 1000, 0), 422, "INVALID_POINT_RATE")
	})
	check("ยอดสะสมขั้นต่ำติดลบ → 422 INVALID_MIN_PURCHASE", func() error {
		return expectError("POST", "/api/membership-tiers", manager,
			tierBody(tierName+" ติดลบ", -1, 0.01), 422, "INVALID_MIN_PURCHASE")
	})
	check("ชื่อว่าง → 422 MISSING_FIELDS", func() error {
		return expectError("POST", "/api/membership-tiers", manager,
			tierBody("", 1000, 0.01), 422, "MISSING_FIELDS")
	})
	check("ผู้จัดการแก้ระดับที่เพิ่งสร้างได้", func() error {
		body, err := put(manager, fmt.Sprintf("/api/membership-tiers/%d", tierID),
			tierBody(tierName, 99000, 0.08), 200)
		if err != nil {
			return err
		}
		return expect(body["minAccumulatedPurchase"], 99000.0)
	})
	check("ลบระดับที่ยังมีสมาชิกอยู่ไม่ได้ → 409 TIER_IN_USE", func() error {
		return expectError("DELETE", "/api/membership-tiers/1", manager, nil, 409, "TIER_IN_USE")
	})
	check("ลบระดับที่ยังไม่มีใครอยู่ได้ → 204", func() error {
		return expectStatus("DELETE", fmt.Sprintf("/api/membership-tiers/%d", tierID), manager, nil, 204)
	})
	check("ลบระดับที่ไม่มีอยู่ → 404 TIER_NOT_FOUND", func() error {
		return expectError("DELETE", "/api/membership-tiers/999999", manager, nil, 404, "TIER_NOT_FOUND")
	})

	section("สมาชิก (Customer <|-- Member)")

	check("ลูกค้าที่เพิ่งสมัครเป็นสมาชิกอัตโนมัติ", func() error {
		body, err := get(customer, "/api/members/me")
		if err != nil {
			return err
		}
		memberID = int(body["memberId"].(float64))
		balanceBefore = int(body["pointBalance"].(float64))
		totalBefore = body["totalAccumulatedPurchase"].(float64)
		pointRate = body["pointRate"].(float64)

		if err := expect(body["code"], fmt.Sprintf("MBR%04d", memberID)); err != nil {
			return err
		}
		if body["tierName"] == "" || body["tierName"] == nil {
			return fmt.Errorf("สมาชิกต้องมีระดับเสมอ: %v", body)
		}
		if pointRate <= 0 {
			return fmt.Errorf("อัตราการให้แต้ม = %v ต้องมากกว่าศูนย์", pointRate)
		}
		return nil
	})
	check("ฝ่ายขายเห็นรายชื่อสมาชิกทั้งหมด", func() error {
		items, err := getList(sales, "/api/members")
		if err != nil {
			return err
		}
		// ลูกค้าตั้งต้น 3 ราย + ลูกค้าที่ flow สมัครสมาชิกสร้างขึ้นในรอบนี้
		if len(items) < 4 {
			return fmt.Errorf("ได้ %d ราย ต้องอย่างน้อย 4", len(items))
		}
		return nil
	})
	check("ลูกค้าเปิดหน้ารายชื่อสมาชิกไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/members", customer, nil, 403)
	})
	check("ลูกค้าดูประวัติแต้มของสมาชิกคนอื่นไม่ได้ → 403 FORBIDDEN", func() error {
		other := 1
		if memberID == other {
			other = 2
		}
		return expectError("GET", fmt.Sprintf("/api/members/%d/point-transactions", other),
			customer, nil, 403, "FORBIDDEN")
	})
	check("เปิดสมาชิกที่ไม่มีอยู่ → 404 MEMBER_NOT_FOUND", func() error {
		return expectError("GET", "/api/members/999999", manager, nil, 404, "MEMBER_NOT_FOUND")
	})

	section("สะสมแต้มตอนลูกค้ารับสินค้า (Member.earnPoints)")

	check("เดินคำสั่งซื้อใบใหม่จนส่งถึงลูกค้า", func() error {
		orderID, net, err := deliveredOrder(customer, sales, warehouse, delivery,
			[]any{orderLine(membershipBookID, membershipQty)})
		if err != nil {
			return err
		}
		earnedOrderID, earnedNetTotal = orderID, net
		if earnedNetTotal <= 0 {
			return fmt.Errorf("ยอดสุทธิ = %.2f ต้องมากกว่าศูนย์", earnedNetTotal)
		}
		return nil
	})
	check("แต้มเพิ่มตามยอดสุทธิคูณอัตราของระดับ (ปัดเศษลง)", func() error {
		body, err := get(customer, "/api/members/me")
		if err != nil {
			return err
		}
		want := int(earnedNetTotal * pointRate)
		got := int(body["pointBalance"].(float64)) - balanceBefore
		if got != want {
			return fmt.Errorf("แต้มที่ได้ = %d ต้องการ %d (ยอด %.2f × อัตรา %v)",
				got, want, earnedNetTotal, pointRate)
		}
		total := body["totalAccumulatedPurchase"].(float64)
		if total != totalBefore+earnedNetTotal {
			return fmt.Errorf("ยอดสะสม = %.2f ต้องการ %.2f", total, totalBefore+earnedNetTotal)
		}
		return nil
	})
	check("ระดับสมาชิกเลื่อนตามยอดสะสมล่าสุด", func() error {
		body, err := get(customer, "/api/members/me")
		if err != nil {
			return err
		}
		total := body["totalAccumulatedPurchase"].(float64)

		tiers, err := getList(customer, "/api/membership-tiers")
		if err != nil {
			return err
		}
		want := ""
		best := -1.0
		for _, entry := range tiers {
			tier := entry.(map[string]any)
			min := tier["minAccumulatedPurchase"].(float64)
			if min <= total && min > best {
				best, want = min, tier["name"].(string)
			}
		}
		return expect(body["tierName"], want)
	})
	check("ประวัติแต้มมีแถว EARN ที่ผูกกับคำสั่งซื้อใบนั้น", func() error {
		items, err := getList(customer, fmt.Sprintf("/api/members/%d/point-transactions", memberID))
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ยังไม่มีประวัติแต้มเลย")
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["type"], "EARN"); err != nil {
			return err
		}
		if err := expect(latest["typeLabel"], "ได้รับแต้ม"); err != nil {
			return err
		}
		if latest["orderId"] == nil || int(latest["orderId"].(float64)) != earnedOrderID {
			return fmt.Errorf("รายการล่าสุดไม่ได้ผูกกับใบ %d: %v", earnedOrderID, latest)
		}
		if latest["expiryDate"] == nil {
			return fmt.Errorf("แต้มที่ได้รับต้องมีวันหมดอายุ: %v", latest)
		}
		return nil
	})

	section("ของรางวัล (Reward)")

	check("ทุกคนที่ล็อกอินเห็นของรางวัลตั้งต้น", func() error {
		items, err := getList(customer, "/api/rewards")
		if err != nil {
			return err
		}
		if len(items) < 5 {
			return fmt.Errorf("ได้ %d ใบ ต้องอย่างน้อย 5", len(items))
		}
		cheapest := items[0].(map[string]any)
		rewardID = int(cheapest["rewardId"].(float64))
		return expect(cheapest["typeLabel"], "ส่วนลด")
	})
	check("ลูกค้าสร้างของรางวัลไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/rewards", customer,
			rewardBody(rewardName, "GIFT", 10, 0), 403)
	})
	check("ผู้จัดการเพิ่มของรางวัลที่แต้มสูงมาก", func() error {
		body, err := post(manager, "/api/rewards",
			rewardBody(rewardName, "DISCOUNT", 999999, 500), 201)
		if err != nil {
			return err
		}
		pricyRewardID = int(body["rewardId"].(float64))
		return expect(body["typeLabel"], "ส่วนลด")
	})
	check("ของแถมถูกบังคับให้มูลค่าส่วนลดเป็นศูนย์", func() error {
		body, err := post(manager, "/api/rewards", rewardBody(rewardName+" ของแถม", "GIFT", 15, 99), 201)
		if err != nil {
			return err
		}
		if err := expect(body["discountValue"], 0.0); err != nil {
			return err
		}
		// เก็บกวาดทันที ของรางวัลใบนี้มีไว้ตรวจกฎเรื่องมูลค่าเท่านั้น
		return expectStatus("DELETE", fmt.Sprintf("/api/rewards/%d",
			int(body["rewardId"].(float64))), manager, nil, 204)
	})
	check("ชนิดของรางวัลไม่ถูกต้อง → 422 INVALID_REWARD_TYPE", func() error {
		return expectError("POST", "/api/rewards", manager,
			rewardBody(rewardName+" ผิดชนิด", "VOUCHER", 10, 20), 422, "INVALID_REWARD_TYPE")
	})
	check("แต้มที่ใช้แลกเป็นศูนย์ → 422 INVALID_POINT_COST", func() error {
		return expectError("POST", "/api/rewards", manager,
			rewardBody(rewardName+" ฟรี", "GIFT", 0, 0), 422, "INVALID_POINT_COST")
	})
	check("คูปองส่วนลดที่ลดศูนย์บาท → 422 INVALID_DISCOUNT_VALUE", func() error {
		return expectError("POST", "/api/rewards", manager,
			rewardBody(rewardName+" ลดศูนย์", "DISCOUNT", 10, 0), 422, "INVALID_DISCOUNT_VALUE")
	})
	check("ผู้จัดการแก้ของรางวัลได้", func() error {
		body, err := put(manager, fmt.Sprintf("/api/rewards/%d", pricyRewardID),
			rewardBody(rewardName, "DISCOUNT", 999999, 600), 200)
		if err != nil {
			return err
		}
		return expect(body["discountValue"], 600.0)
	})

	section("แลกแต้ม (Member.redeemPoints)")

	var couponCode string
	check("ลูกค้าแลกของรางวัลได้ แต้มลดลงตามที่ใช้", func() error {
		before, err := get(customer, "/api/members/me")
		if err != nil {
			return err
		}
		balance := int(before["pointBalance"].(float64))

		body, err := post(customer, fmt.Sprintf("/api/rewards/%d/redeem", rewardID), nil, 201)
		if err != nil {
			return err
		}
		couponCode = body["couponCode"].(string)
		used := int(body["pointsUsed"].(float64))
		if couponCode != fmt.Sprintf("RWD%05d", int(body["redemptionId"].(float64))) {
			return fmt.Errorf("รหัสคูปอง = %s ไม่ตรงกับรหัสการแลก", couponCode)
		}

		after, err := get(customer, "/api/members/me")
		if err != nil {
			return err
		}
		if got := int(after["pointBalance"].(float64)); got != balance-used {
			return fmt.Errorf("แต้มคงเหลือ = %d ต้องการ %d", got, balance-used)
		}
		return nil
	})
	check("ประวัติแต้มมีแถว REDEEM ที่แต้มติดลบ", func() error {
		items, err := getList(customer, fmt.Sprintf("/api/members/%d/point-transactions", memberID))
		if err != nil {
			return err
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["type"], "REDEEM"); err != nil {
			return err
		}
		if int(latest["points"].(float64)) >= 0 {
			return fmt.Errorf("แต้มของรายการแลก = %v ต้องติดลบ", latest["points"])
		}
		return nil
	})
	check("แต้มไม่พอ → 409 INSUFFICIENT_POINTS", func() error {
		return expectError("POST", fmt.Sprintf("/api/rewards/%d/redeem", pricyRewardID),
			customer, nil, 409, "INSUFFICIENT_POINTS")
	})
	check("แลกของรางวัลที่ไม่มีอยู่ → 404 REWARD_NOT_FOUND", func() error {
		return expectError("POST", "/api/rewards/999999/redeem", customer, nil, 404, "REWARD_NOT_FOUND")
	})
	check("พนักงานแลกของรางวัลไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/rewards/%d/redeem", rewardID), manager, nil, 403)
	})
	check("ลบของรางวัลที่ถูกแลกไปแล้วไม่ได้ → 409 REWARD_REDEEMED", func() error {
		return expectError("DELETE", fmt.Sprintf("/api/rewards/%d", rewardID),
			manager, nil, 409, "REWARD_REDEEMED")
	})
	check("ลูกค้าเห็นประวัติการแลกของตัวเอง", func() error {
		items, err := getList(customer, "/api/redemptions")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ไม่มีประวัติการแลกเลย")
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["couponCode"], couponCode); err != nil {
			return err
		}
		return expect(latest["memberId"], float64(memberID))
	})
	check("ผู้จัดการเห็นประวัติการแลกของทุกคน", func() error {
		mine, err := getList(customer, "/api/redemptions")
		if err != nil {
			return err
		}
		all, err := getList(manager, "/api/redemptions")
		if err != nil {
			return err
		}
		if len(all) < len(mine) {
			return fmt.Errorf("ผู้จัดการเห็น %d ใบ น้อยกว่าลูกค้า %d ใบ", len(all), len(mine))
		}
		return nil
	})

	section("ปรับแต้มด้วยมือของผู้จัดการ (EXPIRE · REVERSAL)")

	check("ผู้จัดการหักแต้มที่หมดอายุได้", func() error {
		before, err := get(manager, fmt.Sprintf("/api/members/%d", memberID))
		if err != nil {
			return err
		}
		balance := int(before["pointBalance"].(float64))

		body, err := post(manager, fmt.Sprintf("/api/members/%d/point-adjustments", memberID),
			map[string]any{"type": "EXPIRE", "points": 1, "note": "แต้มหมดอายุตามรอบ"}, 200)
		if err != nil {
			return err
		}
		return expect(body["pointBalance"], float64(balance-1))
	})
	check("ประวัติแต้มมีแถว EXPIRE พร้อมเหตุผล", func() error {
		items, err := getList(manager, fmt.Sprintf("/api/members/%d/point-transactions", memberID))
		if err != nil {
			return err
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["type"], "EXPIRE"); err != nil {
			return err
		}
		if latest["note"] == nil || latest["note"] == "" {
			return fmt.Errorf("รายการปรับแต้มต้องมีเหตุผลกำกับ: %v", latest)
		}
		return nil
	})
	check("หักแต้มเกินยอดคงเหลือ → 409 INSUFFICIENT_POINTS", func() error {
		return expectError("POST", fmt.Sprintf("/api/members/%d/point-adjustments", memberID), manager,
			map[string]any{"type": "REVERSAL", "points": 999999, "note": "คืนรายการ"},
			409, "INSUFFICIENT_POINTS")
	})
	check("เพิ่มแต้มมือเปล่าด้วย EARN ไม่ได้ → 422 INVALID_POINT_TXN_TYPE", func() error {
		return expectError("POST", fmt.Sprintf("/api/members/%d/point-adjustments", memberID), manager,
			map[string]any{"type": "EARN", "points": 100, "note": "แถมให้"},
			422, "INVALID_POINT_TXN_TYPE")
	})
	check("ไม่บอกเหตุผล → 422 REASON_REQUIRED", func() error {
		return expectError("POST", fmt.Sprintf("/api/members/%d/point-adjustments", memberID), manager,
			map[string]any{"type": "EXPIRE", "points": 1, "note": "  "},
			422, "REASON_REQUIRED")
	})
	check("ฝ่ายขายปรับแต้มไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/members/%d/point-adjustments", memberID), sales,
			map[string]any{"type": "EXPIRE", "points": 1, "note": "ลอง"}, 403)
	})

	section("เก็บกวาดข้อมูลที่ flow สมาชิกสร้างขึ้น")

	// ของรางวัลใบแพงไม่เคยถูกแลกสำเร็จ (แต้มไม่พอทุกรอบ) จึงลบได้
	// ถ้าไม่ลบ ตาราง reward จะโตขึ้นหนึ่งแถวทุกครั้งที่รัน smoke
	check("ลบของรางวัลที่สร้างไว้ทดสอบ → 204", func() error {
		return expectStatus("DELETE", fmt.Sprintf("/api/rewards/%d", pricyRewardID), manager, nil, 204)
	})

	section("คืนยอดสต็อกที่ flow สมาชิกตัดไป")
	check("คืนยอดเล่มที่ใช้ทดสอบกลับเป็นค่าเดิม", func() error {
		_, err := post(warehouse, "/api/inventory/adjust", map[string]any{
			"lines": []any{map[string]any{
				"bookId":         membershipBookID,
				"quantityChange": membershipQty,
				"reason":         "คืนยอดหลังทดสอบระบบสมาชิก",
				"referenceDoc":   "SMOKE",
			}},
		}, 201)
		if err != nil {
			return err
		}
		return expect(onHand(warehouse, membershipBookID), onHandBefore)
	})
}
