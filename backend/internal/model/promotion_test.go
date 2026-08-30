package model

import "testing"

func mustDateOf(t *testing.T, value string) Date {
	t.Helper()
	date, err := ParseDate(value)
	if err != nil {
		t.Fatalf("วันที่ %q ไม่ถูกรูปแบบ: %v", value, err)
	}
	return date
}

func samplePromotion(t *testing.T) Promotion {
	t.Helper()
	return Promotion{
		PromotionID: 1, Name: "ลดรับสงกรานต์", Type: PromotionTypeFestival,
		DiscountValue: 15, IsPercent: true,
		StartDate: mustDateOf(t, "2026-04-10"), EndDate: mustDateOf(t, "2026-04-20"),
		Status: PromotionStatusActive,
	}
}

func TestPromotionDisplayStatus(t *testing.T) {
	promotion := samplePromotion(t)

	if got := promotion.DisplayStatus(mustDateOf(t, "2026-04-15")); got != PromotionStatusActive {
		t.Errorf("ยังอยู่ในช่วง ต้องเป็น ACTIVE ได้ %s", got)
	}
	// เลยวันสิ้นสุดแล้วอ่านเป็น EXPIRED เองโดยไม่ต้องมีใครไปกดปิด
	if got := promotion.DisplayStatus(mustDateOf(t, "2026-05-01")); got != PromotionStatusExpired {
		t.Errorf("เลยวันสิ้นสุดแล้ว ต้องเป็น EXPIRED ได้ %s", got)
	}

	// ผู้จัดการปิดใช้งานเอง INACTIVE มาก่อนเสมอ แม้จะยังไม่หมดอายุ
	promotion.Status = PromotionStatusInactive
	if got := promotion.DisplayStatus(mustDateOf(t, "2026-05-01")); got != PromotionStatusInactive {
		t.Errorf("ปิดใช้งานเองต้องเป็น INACTIVE ได้ %s", got)
	}
}

func TestPromotionIsApplicable(t *testing.T) {
	promotion := samplePromotion(t)
	promotion.MinAmount = 500
	promotion.MinQty = 2

	order := Order{}
	_ = order.AddItem(Book{BookID: 101, Price: 438}, 2)
	order.CalcTotal()

	inside := mustDateOf(t, "2026-04-15")
	if !promotion.IsApplicable(order, inside) {
		t.Fatalf("ยอด %.2f และ %d เล่ม ควรเข้าเงื่อนไข", order.Subtotal, order.ItemCount())
	}

	// ยังไม่ถึงวันเริ่ม
	if promotion.IsApplicable(order, mustDateOf(t, "2026-04-01")) {
		t.Error("ยังไม่ถึงวันเริ่มต้น ไม่ควรใช้ได้")
	}
	// หมดอายุแล้ว
	if promotion.IsApplicable(order, mustDateOf(t, "2026-05-01")) {
		t.Error("หมดอายุแล้ว ไม่ควรใช้ได้")
	}

	// ยอดไม่ถึงขั้นต่ำ
	small := Order{}
	_ = small.AddItem(Book{BookID: 122, Price: 204}, 2)
	small.CalcTotal()
	if promotion.IsApplicable(small, inside) {
		t.Errorf("ยอด %.2f ต่ำกว่าขั้นต่ำ %.2f ไม่ควรใช้ได้", small.Subtotal, promotion.MinAmount)
	}

	// จำนวนเล่มไม่ถึงขั้นต่ำ
	single := Order{}
	_ = single.AddItem(Book{BookID: 106, Price: 700}, 1)
	single.CalcTotal()
	if promotion.IsApplicable(single, inside) {
		t.Error("จำนวนเล่มไม่ถึงขั้นต่ำ ไม่ควรใช้ได้")
	}
}

func TestPromotionCalcDiscount(t *testing.T) {
	order := Order{}
	_ = order.AddItem(Book{BookID: 101, Price: 500}, 2)
	order.CalcTotal()

	percent := samplePromotion(t) // 15%
	if got := percent.CalcDiscount(order); got != 150 {
		t.Errorf("ส่วนลด 15%% ของ 1000 = %.2f ต้องการ 150", got)
	}

	fixed := samplePromotion(t)
	fixed.IsPercent = false
	fixed.DiscountValue = 50
	if got := fixed.CalcDiscount(order); got != 50 {
		t.Errorf("ส่วนลดคงที่ = %.2f ต้องการ 50", got)
	}

	// ส่วนลดเกินยอดต้องถูกตัดลงมาเท่ายอด ไม่งั้นยอดสุทธิจะติดลบ
	fixed.DiscountValue = 5000
	if got := fixed.CalcDiscount(order); got != 1000 {
		t.Errorf("ส่วนลดเกินยอด = %.2f ต้องการ 1000", got)
	}
}

func TestPromotionOverlaps(t *testing.T) {
	april := samplePromotion(t)

	same := samplePromotion(t)
	same.PromotionID = 2
	same.StartDate = mustDateOf(t, "2026-04-18")
	same.EndDate = mustDateOf(t, "2026-04-30")
	if !april.Overlaps(same) {
		t.Error("ชนิดเดียวกันและช่วงวันที่ทับกัน ต้องถือว่าทับ")
	}

	later := samplePromotion(t)
	later.PromotionID = 3
	later.StartDate = mustDateOf(t, "2026-05-01")
	later.EndDate = mustDateOf(t, "2026-05-10")
	if april.Overlaps(later) {
		t.Error("ช่วงวันที่ไม่ทับกัน ต้องไม่ถือว่าทับ")
	}

	otherType := same
	otherType.Type = PromotionTypeCoupon
	if april.Overlaps(otherType) {
		t.Error("คนละชนิดกัน ต้องไม่ถือว่าทับ")
	}

	// ตัวเองไม่นับว่าทับกับตัวเอง ไม่งั้นแก้ไขใบเดิมจะเตือนทุกครั้ง
	if april.Overlaps(april) {
		t.Error("ใบเดียวกันต้องไม่ถือว่าทับ")
	}
}

func TestPromotionLabelsMatchFrontend(t *testing.T) {
	types := map[PromotionType]string{
		PromotionTypeFestival: "ส่วนลดเทศกาล",
		PromotionTypeCoupon:   "คูปองส่วนลด",
		PromotionTypeBuyXQty:  "ซื้อครบจำนวน",
	}
	for value, label := range types {
		if got := value.Label(); got != label {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", value, got, label)
		}
	}

	statuses := map[PromotionStatus]string{
		PromotionStatusActive:   "ใช้งาน",
		PromotionStatusInactive: "ปิดใช้งาน",
		PromotionStatusExpired:  "หมดอายุ",
	}
	for value, label := range statuses {
		if got := value.Label(); got != label {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", value, got, label)
		}
	}

	if got := FormatPromotionCode(1); got != "PROMO01" {
		t.Errorf("รหัสโปรโมชั่น = %q ต้องการ PROMO01", got)
	}
}
