// main.go — เดโมของ 2 ระบบย่อย (คำสั่งซื้อ + โปรโมชั่น)
//
//	คำสั่งซื้อ: เพิ่มรายการ → คิดยอด → ใช้โปรโมชั่นลดราคา → เดินสถานะ (บันทึกไทม์ไลน์)
//	โปรโมชั่น: ตรวจเงื่อนไข/คำนวณส่วนลด → เช็กช่วงเวลาโปรทับซ้อน → ผู้จัดการปิดใช้งาน
//
// รัน: go run .   (จากโฟลเดอร์ B6708429-jiraphon)
package main

import (
	"fmt"
	"time"

	"bookstore-t03/model"
)

func main() {
	now := time.Now()

	// ───────── ระบบย่อยที่ 1: จัดการคำสั่งซื้อลูกค้า ─────────
	customer := model.Customer{
		CustomerID:     9001,
		Name:           "จิรพนธ์ อยู่หลาย",
		Email:          "jiraphon@example.com",
		Address:        "ขอนแก่น",
		RegisteredDate: now,
	}
	book1 := model.Book{BookID: 101, Title: "เรียน Go ให้สนุก", Price: 350, Status: model.BookStatusActive}
	book2 := model.Book{BookID: 102, Title: "ออกแบบระบบ", Price: 250, Status: model.BookStatusActive}

	order := &model.Order{
		OrderID:         5001,
		Channel:         model.OrderChannelWebsite,
		OrderDate:       now,
		ShippingAddress: customer.Address,
		Status:          model.OrderStatusPendingConfirm,
		CustomerID:      customer.CustomerID,
		Customer:        &customer, // เชื่อมโยงกับ Customer
	}
	order.AddItem(book1, 2)
	order.AddItem(book2, 1)
	order.CalcTotal()
	fmt.Printf("คำสั่งซื้อ #%d | ลูกค้า: %s (%s) | ช่องทาง: %s (%s) | ยอดรวมย่อย: %.2f บาท\n",
		order.OrderID, order.Customer.Name, order.Customer.Email, order.Channel, order.Channel.String(), order.Subtotal)

	for i, item := range order.Items {
		fmt.Printf("  └─ รายการที่ %d: %s (x%d) @ %.2f = %.2f บาท\n",
			i+1, item.Book.Title, item.Quantity, item.UnitPrice, item.LineTotal)
	}

	// ───────── ระบบย่อยที่ 2: โปรโมชั่นและส่วนลด ─────────
	festival := &model.Promotion{
		PromotionID: 1, Name: "ลดเทศกาลหนังสือ 10%", Type: model.PromotionTypeFestivalDiscount,
		DiscountValue: 10, IsPercent: true, MinQty: 1, MinAmount: 100,
		StartDate: now.AddDate(0, 0, -1), EndDate: now.AddDate(0, 0, 7), Status: model.PromotionStatusActive,
	}
	
	// ใช้ฟังก์ชัน ApplyPromotion ที่เชื่อมการคำนวณและผูก PromotionID เข้ากับ Order
	applied := order.ApplyPromotion(festival)
	if applied {
		fmt.Printf("ใช้โปร '%s' (%s - %s) | ส่วนลด %.2f | ยอดสุทธิ %.2f บาท\n",
			order.Promotion.Name, order.Promotion.Type, order.Promotion.Type.String(), order.DiscountAmount, order.NetAmount)
	}

	// เดินสถานะคำสั่งซื้อ (พนักงานฝ่ายขายดูแล)
	sales := &model.SalesStaff{StaffID: 40, Name: "พนักงานฝ่ายขาย A"}
	must(sales.HandleOrder(order, model.OrderStatusStockConfirmed, "ยืนยันสต็อกเรียบร้อย"))
	must(sales.HandleOrder(order, model.OrderStatusWaitingPayment, "รอชำระเงินจากลูกค้า"))
	fmt.Printf("สถานะคำสั่งซื้อล่าสุด: %s (%s) | ไทม์ไลน์ %d รายการ:\n", 
		order.Status, order.Status.String(), len(order.History))
	for _, h := range order.History {
		fmt.Printf("  └─ [%s] %s (%s) - หมายเหตุ: %s\n",
			h.ChangedDate.Format("15:04:05"), h.Status, h.Status.String(), h.Note)
	}

	// เช็กโปรทับซ้อน + ผู้จัดการปิดใช้งานโปรตัวที่สอง
	coupon := &model.Promotion{
		PromotionID: 2, Name: "คูปองลด 50 บาท", Type: model.PromotionTypeCoupon,
		DiscountValue: 50, IsPercent: false, MinAmount: 300,
		StartDate: now, EndDate: now.AddDate(0, 0, 14), Status: model.PromotionStatusActive,
	}
	fmt.Printf("โปร '%s' กับ '%s' ช่วงเวลาทับซ้อนกัน? %v\n",
		festival.Name, coupon.Name, festival.Overlaps(coupon))

	manager := &model.StoreManager{StaffID: 20, Name: "ผู้จัดการ B"}
	manager.ManagePromotion(coupon, model.PromotionStatusInactive)
	fmt.Printf("ผู้จัดการปิดโปร '%s' → สถานะ: %s (%s)\n", coupon.Name, coupon.Status, coupon.Status.String())
}

// must หยุดโปรแกรมถ้าเดโมล้มเหลว (ใช้เฉพาะในเดโม)
func must(err error) {
	if err != nil {
		panic(err)
	}
}
