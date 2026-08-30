// seed_order.go — คำสั่งซื้อลูกค้าตั้งต้น (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// `SEED_ORDERS` ฝั่ง frontend สร้างจากข้อมูลของหน้าร้าน ซึ่งอ้างหนังสือด้วย slug ของ storefront
// และคิดเงินเป็นดอลลาร์ (ดู deviation ใน frontend/CLAUDE.md) · ฝั่งนี้มีตาราง book จริง
// จึงแปลงเป็น book_id กับราคาปกเป็นบาทตาม seedBooks แล้วเก็บชื่อ/ที่อยู่ลูกค้าไว้เหมือนเดิม
// สคริปต์อ่านของแบบนี้ไม่ได้ จึงเขียนมือแล้วผูกลูกค้าด้วยอีเมลตอน seed
//
// หมายเหตุ: รายการเคลื่อนไหวสต็อกใน seed_inventory.go ที่อ้าง SO-1001/SO-1003 เป็นข้อมูล
// ประกอบที่มีมาก่อนตาราง customer_order จำนวนจึงไม่ตรงกับใบที่ seed ที่นี่ — เป็นข้อมูลสาธิต
// คนละชุด ไม่ได้ผูกกันด้วย FK
package database

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// seedOrderLine — หนังสือหนึ่งเล่มในคำสั่งซื้อตั้งต้น (ราคาต่อหน่วยดึงจาก seedBooks ตอน seed)
type seedOrderLine struct {
	BookID   int
	Quantity int
}

// seedOrderRow — คำสั่งซื้อหนึ่งใบพร้อมลำดับสถานะที่เดินมาถึงปัจจุบัน
type seedOrderRow struct {
	OrderID       int
	CustomerEmail string
	Channel       model.OrderChannel
	OrderDate     string // ISO-8601
	Address       string
	SlipFileName  string
	Lines         []seedOrderLine
	// Timeline เรียงตามเวลา ตัวสุดท้ายคือสถานะปัจจุบันของใบนี้
	Timeline []seedOrderStep
}

type seedOrderStep struct {
	Status model.OrderStatus
	At     string // ISO-8601
	Note   string
}

// seedOrders — คำสั่งซื้อสามใบที่ครอบสถานะสำคัญคนละช่วง
// ใบหนึ่งรอฝ่ายขายยืนยัน ใบหนึ่งรอฝ่ายจัดส่ง อีกใบส่งถึงแล้ว
// ทุกบทบาทจึงมีของให้ดูตั้งแต่เข้าระบบครั้งแรก
var seedCustomerOrders = []seedOrderRow{
	{
		OrderID: 1001, CustomerEmail: "napat@example.com", Channel: model.OrderChannelWebsite,
		OrderDate:    "2026-08-04T02:10:00.000Z",
		Address:      "88/12 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
		SlipFileName: "slip-1001.jpg",
		Lines:        []seedOrderLine{{BookID: 109, Quantity: 1}, {BookID: 101, Quantity: 2}},
		Timeline: []seedOrderStep{
			{model.OrderStatusPendingConfirm, "2026-08-04T02:10:00.000Z", "รับคำสั่งซื้อ"},
		},
	},
	{
		OrderID: 1002, CustomerEmail: "kanya@example.com", Channel: model.OrderChannelWebsite,
		OrderDate:    "2026-08-03T01:00:00.000Z",
		Address:      "199 หมู่ 4 ตำบลสุรนารี อำเภอเมือง จังหวัดนครราชสีมา 30000",
		SlipFileName: "slip-1002.png",
		Lines:        []seedOrderLine{{BookID: 106, Quantity: 1}, {BookID: 104, Quantity: 1}},
		Timeline: []seedOrderStep{
			{model.OrderStatusPendingConfirm, "2026-08-03T01:00:00.000Z", "รับคำสั่งซื้อ"},
			{model.OrderStatusStockConfirmed, "2026-08-03T02:00:00.000Z", "ยืนยันสต็อกแล้ว"},
			{model.OrderStatusVerifyingPayment, "2026-08-03T02:05:00.000Z", "แนบหลักฐานการชำระเงิน"},
			{model.OrderStatusPaid, "2026-08-03T03:00:00.000Z", "ตรวจสอบการชำระเงินแล้ว"},
			{model.OrderStatusPacking, "2026-08-03T06:00:00.000Z", "กำลังแพ็กสินค้า"},
			{model.OrderStatusReadyToShip, "2026-08-03T08:30:00.000Z", "พร้อมจัดส่ง"},
		},
	},
	{
		OrderID: 1003, CustomerEmail: "somsak@example.com", Channel: model.OrderChannelWebsite,
		OrderDate:    "2026-07-30T01:00:00.000Z",
		Address:      "45/7 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง จังหวัดเชียงใหม่ 50200",
		SlipFileName: "slip-1003.jpg",
		Lines:        []seedOrderLine{{BookID: 110, Quantity: 1}},
		Timeline: []seedOrderStep{
			{model.OrderStatusPendingConfirm, "2026-07-30T01:00:00.000Z", "รับคำสั่งซื้อ"},
			{model.OrderStatusStockConfirmed, "2026-07-30T02:00:00.000Z", "ยืนยันสต็อกแล้ว"},
			{model.OrderStatusVerifyingPayment, "2026-07-30T02:05:00.000Z", "แนบหลักฐานการชำระเงิน"},
			{model.OrderStatusPaid, "2026-07-30T03:00:00.000Z", "ตรวจสอบการชำระเงินแล้ว"},
			{model.OrderStatusPacking, "2026-07-30T05:00:00.000Z", "กำลังแพ็กสินค้า"},
			{model.OrderStatusReadyToShip, "2026-07-30T07:00:00.000Z", "พร้อมจัดส่ง"},
			{model.OrderStatusShipped, "2026-07-31T02:00:00.000Z", "ส่งมอบให้ขนส่งแล้ว"},
			{model.OrderStatusDelivered, "2026-08-01T04:30:00.000Z", "ลูกค้าได้รับสินค้าแล้ว"},
		},
	},
}

// seedCustomerOrderRows — สร้างคำสั่งซื้อตั้งต้น
//
// ผูกลูกค้าด้วยอีเมลแทนการฝัง customer_id ไว้ เพราะรหัสลูกค้าเป็น auto increment
// จะเป็นเลขอะไรขึ้นกับลำดับที่ seed ลงไป
func seedCustomerOrderRows(tx *gorm.DB) (int, error) {
	empty, err := tableEmpty[model.Order](tx, "คำสั่งซื้อลูกค้า")
	if err != nil || !empty {
		return 0, err
	}

	prices := make(map[int]model.Book, len(seedBooks))
	for _, book := range seedBooks {
		prices[book.BookID] = book
	}

	for _, row := range seedCustomerOrders {
		customerID, err := customerIDByEmail(tx, row.CustomerEmail)
		if err != nil {
			return 0, err
		}

		order := model.Order{
			OrderID:         row.OrderID,
			CustomerID:      customerID,
			Channel:         row.Channel,
			OrderDate:       mustTime(row.OrderDate),
			ShippingAddress: row.Address,
			Status:          row.Timeline[len(row.Timeline)-1].Status,
			SlipFileName:    row.SlipFileName,
		}
		for _, line := range row.Lines {
			book, ok := prices[line.BookID]
			if !ok {
				return 0, fmt.Errorf("คำสั่งซื้อ %d อ้างหนังสือ %d ที่ไม่มีในข้อมูลตั้งต้น",
					row.OrderID, line.BookID)
			}
			order.Items = append(order.Items, model.OrderItem{
				OrderID:   row.OrderID,
				BookID:    line.BookID,
				Quantity:  line.Quantity,
				UnitPrice: book.Price,
				LineTotal: book.Price * float64(line.Quantity),
			})
		}
		order.CalcTotal()

		for _, step := range row.Timeline {
			order.Timeline = append(order.Timeline, model.OrderStatusHistory{
				OrderID:     row.OrderID,
				Status:      step.Status,
				ChangedDate: mustTime(step.At),
				ChangedBy:   "ระบบ (ข้อมูลตั้งต้น)",
				Note:        step.Note,
			})
		}

		if err := tx.Create(&order).Error; err != nil {
			return 0, fmt.Errorf("ใส่คำสั่งซื้อ %d ไม่สำเร็จ: %w", row.OrderID, err)
		}
	}
	return len(seedCustomerOrders), nil
}

// customerIDByEmail — หารหัสลูกค้าจากอีเมลใน person
func customerIDByEmail(tx *gorm.DB, email string) (int, error) {
	var customer model.Customer
	err := tx.Joins("JOIN person p ON p.person_id = customer.person_id").
		Where("lower(p.email) = ?", email).
		First(&customer).Error
	if err != nil {
		return 0, fmt.Errorf("หาลูกค้าอีเมล %s ไม่เจอ: %w", email, err)
	}
	return customer.CustomerID, nil
}
