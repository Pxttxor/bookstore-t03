package model

import (
	"testing"
	"time"
)

func sampleOrder() Order {
	order := Order{OrderID: 1001, Status: OrderStatusPendingConfirm}
	_ = order.AddItem(Book{BookID: 101, Price: 438}, 2)
	_ = order.AddItem(Book{BookID: 109, Price: 483}, 1)
	order.CalcTotal()
	return order
}

func TestOrderAddItem(t *testing.T) {
	order := sampleOrder()

	if len(order.Items) != 2 {
		t.Fatalf("ได้ %d รายการ ต้องการ 2", len(order.Items))
	}
	if order.Items[0].LineTotal != 876 {
		t.Errorf("ยอดรวมรายการ = %.2f ต้องการ 876", order.Items[0].LineTotal)
	}
	if order.ItemCount() != 3 {
		t.Errorf("จำนวนเล่มรวม = %d ต้องการ 3", order.ItemCount())
	}

	if err := order.AddItem(Book{BookID: 101, Price: 438}, 1); err != ErrDuplicateBookInDocument {
		t.Errorf("หนังสือซ้ำต้องถูกปฏิเสธ ได้ %v", err)
	}
	if err := order.AddItem(Book{BookID: 102, Price: 369}, 0); err != ErrInvalidQuantity {
		t.Errorf("จำนวน 0 ต้องถูกปฏิเสธ ได้ %v", err)
	}
}

func TestOrderCalcTotal(t *testing.T) {
	order := sampleOrder()
	if order.Subtotal != 1359 || order.NetAmount != 1359 {
		t.Fatalf("ยอดรวม = %.2f ยอดสุทธิ = %.2f ต้องการ 1359 ทั้งคู่", order.Subtotal, order.NetAmount)
	}

	order.DiscountAmount = 359
	if got := order.CalcTotal(); got != 1000 {
		t.Errorf("ยอดสุทธิหลังลด = %.2f ต้องการ 1000", got)
	}

	// ส่วนลดเกินยอดก่อนลดต้องถูกตัดลงมา ไม่งั้นยอดสุทธิจะติดลบ
	order.DiscountAmount = 5000
	if got := order.CalcTotal(); got != 0 {
		t.Errorf("ส่วนลดเกินยอด ยอดสุทธิ = %.2f ต้องการ 0", got)
	}
	if order.DiscountAmount != 1359 {
		t.Errorf("ส่วนลดต้องถูกตัดเหลือเท่ายอดก่อนลด ได้ %.2f", order.DiscountAmount)
	}
}

func TestOrderStatusHappyPath(t *testing.T) {
	order := sampleOrder()
	at := time.Date(2026, 8, 30, 5, 0, 0, 0, time.UTC)

	path := []OrderStatus{
		OrderStatusStockConfirmed, OrderStatusVerifyingPayment, OrderStatusPaid,
		OrderStatusPacking, OrderStatusReadyToShip, OrderStatusShipped, OrderStatusDelivered,
	}
	for _, next := range path {
		if err := order.UpdateStatus(next, "ณัฐวุฒิ แสงจันทร์", "", at); err != nil {
			t.Fatalf("เปลี่ยนเป็น %s ไม่สำเร็จ: %v", next, err)
		}
	}
	if len(order.Timeline) != len(path) {
		t.Fatalf("timeline มี %d แถว ต้องการ %d", len(order.Timeline), len(path))
	}
	if !order.IsClosed() {
		t.Error("ส่งถึงแล้วต้องถือว่าใบปิด")
	}
	// ใบที่ปิดแล้วเดินต่อไม่ได้
	if err := order.UpdateStatus(OrderStatusCancelled, "ณัฐวุฒิ แสงจันทร์", "ยกเลิก", at); err == nil {
		t.Error("ใบที่ส่งถึงแล้วยกเลิกไม่ได้")
	}
}

func TestOrderStatusRejectsSkippingSteps(t *testing.T) {
	order := sampleOrder()
	at := time.Now()

	// ข้ามจากรอยืนยันไปแพ็กเลยไม่ได้
	err := order.UpdateStatus(OrderStatusPacking, "สมชาย ใจดี", "", at)
	domain, ok := err.(*DomainError)
	if !ok || domain.Code != "ORDER_TRANSITION_REJECTED" {
		t.Fatalf("ข้ามขั้นตอนต้องได้ ORDER_TRANSITION_REJECTED ได้ %v", err)
	}
	if order.Status != OrderStatusPendingConfirm || len(order.Timeline) != 0 {
		t.Fatalf("เปลี่ยนไม่ผ่านแล้วต้องไม่แตะอะไรเลย: %s / %d แถว", order.Status, len(order.Timeline))
	}

	if err := order.UpdateStatus(OrderStatus("SHIPPED_MAYBE"), "สมชาย ใจดี", "", at); err != ErrInvalidOrderStatus {
		t.Errorf("สถานะนอก enum ต้องได้ ErrInvalidOrderStatus ได้ %v", err)
	}
}

// ช่องทางอื่นที่ยังไม่ได้ชำระเดินผ่าน WAITING_PAYMENT ได้
func TestOrderWaitingPaymentBranch(t *testing.T) {
	order := sampleOrder()
	order.Channel = OrderChannelPhone
	at := time.Now()

	for _, next := range []OrderStatus{
		OrderStatusStockConfirmed, OrderStatusWaitingPayment, OrderStatusVerifyingPayment, OrderStatusPaid,
	} {
		if err := order.UpdateStatus(next, "ณัฐวุฒิ แสงจันทร์", "", at); err != nil {
			t.Fatalf("เปลี่ยนเป็น %s ไม่สำเร็จ: %v", next, err)
		}
	}
	if order.Status != OrderStatusPaid {
		t.Errorf("สถานะสุดท้าย = %s ต้องการ PAID", order.Status)
	}
}

// ป้ายไทยต้องตรงกับ ORDER_STATUS_LABELS / CHANNEL_LABELS ฝั่งหน้าจอ
func TestOrderLabelsMatchFrontend(t *testing.T) {
	want := map[OrderStatus]string{
		OrderStatusPendingConfirm:   "รอยืนยันคำสั่งซื้อ",
		OrderStatusStockConfirmed:   "ยืนยันสต็อกแล้ว",
		OrderStatusWaitingPayment:   "รอชำระเงิน",
		OrderStatusVerifyingPayment: "กำลังตรวจสอบการชำระเงิน",
		OrderStatusPaid:             "ชำระเงินแล้ว",
		OrderStatusPacking:          "กำลังแพ็กสินค้า",
		OrderStatusReadyToShip:      "พร้อมจัดส่ง",
		OrderStatusShipped:          "จัดส่งแล้ว",
		OrderStatusDelivered:        "ส่งถึงแล้ว",
		OrderStatusCancelled:        "ยกเลิก",
		OrderStatusRejected:         "ปฏิเสธ",
	}
	if len(OrderStatuses()) != len(want) {
		t.Fatalf("สถานะมี %d ค่า ต้องการ %d", len(OrderStatuses()), len(want))
	}
	for _, status := range OrderStatuses() {
		if got := status.Label(); got != want[status] {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", status, got, want[status])
		}
	}

	channels := map[OrderChannel]string{
		OrderChannelWebsite: "เว็บไซต์",
		OrderChannelMessage: "ข้อความ",
		OrderChannelPhone:   "โทรศัพท์",
	}
	for channel, label := range channels {
		if got := channel.Label(); got != label {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", channel, got, label)
		}
	}
}

func TestFormatOrderCode(t *testing.T) {
	if got := FormatOrderCode(1001); got != "SO-1001" {
		t.Errorf("รหัสคำสั่งซื้อ = %q ต้องการ SO-1001", got)
	}
}

func TestOrderWithApplicablePromotions(t *testing.T) {
	today := mustDateOf(t, "2026-09-05")

	promoCoupon := Promotion{
		PromotionID: 4, Name: "คูปองต้อนรับสมาชิกใหม่", Type: PromotionTypeCoupon,
		DiscountValue: 50, IsPercent: false, MinAmount: 500,
		StartDate: mustDateOf(t, "2026-07-01"), EndDate: mustDateOf(t, "2026-12-31"),
		Status: PromotionStatusActive,
	}
	promoQty := Promotion{
		PromotionID: 5, Name: "ซื้อครบ 3 เล่มลดเพิ่ม", Type: PromotionTypeBuyXQty,
		DiscountValue: 10, IsPercent: true, MinQty: 3,
		StartDate: mustDateOf(t, "2026-08-01"), EndDate: mustDateOf(t, "2026-09-30"),
		Status: PromotionStatusActive,
	}

	// 1. ออร์เดอร์ 2 เล่ม รวม 600 บาท -> เข้าเฉพาะ promoCoupon (ยอด >= 500 แต่จำนวน 2 ไม่ถึง 3)
	order1 := Order{}
	_ = order1.AddItem(Book{BookID: 101, Price: 300}, 2)
	order1.CalcTotal()

	if !promoCoupon.IsApplicable(order1, today) {
		t.Error("order1 (600 บาท) ควรเข้าเงื่อนไข promoCoupon")
	}
	if promoQty.IsApplicable(order1, today) {
		t.Error("order1 (2 เล่ม) ไม่ควรเข้าเงื่อนไข promoQty")
	}
	discount1 := promoCoupon.CalcDiscount(order1)
	if discount1 != 50 {
		t.Errorf("ส่วนลด order1 = %.2f ต้องการ 50", discount1)
	}

	// 2. ออร์เดอร์ 3 เล่ม เล่มละ 300 บาท รวม 900 บาท -> เข้าทั้งสองโปรโมชั่น
	// promoCoupon ให้ 50 บาท, promoQty ให้ 10% ของ 900 = 90 บาท -> promoQty ให้ส่วนลดมากกว่า
	order2 := Order{}
	_ = order2.AddItem(Book{BookID: 101, Price: 300}, 3)
	order2.CalcTotal()

	if !promoCoupon.IsApplicable(order2, today) || !promoQty.IsApplicable(order2, today) {
		t.Error("order2 ควรเข้าเงื่อนไขทั้งสองโปรโมชั่น")
	}
	dCoupon := promoCoupon.CalcDiscount(order2)
	dQty := promoQty.CalcDiscount(order2)
	if dCoupon != 50 || dQty != 90 {
		t.Errorf("dCoupon = %.2f (ต้องการ 50), dQty = %.2f (ต้องการ 90)", dCoupon, dQty)
	}

	// เลือกโปรที่ดีที่สุด
	bestPromo := promoCoupon
	bestDiscount := dCoupon
	if dQty > bestDiscount {
		bestPromo = promoQty
		bestDiscount = dQty
	}
	order2.PromotionID = &bestPromo.PromotionID
	order2.DiscountAmount = bestDiscount
	order2.CalcTotal()

	if order2.DiscountAmount != 90 {
		t.Errorf("ส่วนลดต้องเป็น 90 ได้ %.2f", order2.DiscountAmount)
	}
	if order2.NetAmount != 810 {
		t.Errorf("ยอดสุทธิต้องเป็น 810 ได้ %.2f", order2.NetAmount)
	}
}
