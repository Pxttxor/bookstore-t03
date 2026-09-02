// order.go — คำสั่งซื้อของลูกค้า (เจ้าของคลาส: จิรพนธ์ อยู่หลาย)
// อ้างอิง class diagram: Sub1-Order.md
//
//	Customer "1" --> "*" Order : places
//	Order "1" *-- "*" OrderItem : items
//	Order "1" *-- "*" OrderStatusHistory : timeline
//	Order "*" --> "0..1" Promotion : applies
//	OrderItem "*" --> "1" Book : book
package model

import (
	"fmt"
	"time"
)

// Order — คำสั่งซื้อหนึ่งใบ
//
// PromotionID เป็น pointer เพราะคำสั่งซื้อส่วนใหญ่ไม่ได้ใช้โปรโมชั่น (0..1 ใน diagram)
// SlipFileName เป็นการจำลองการแนบสลิป เช่นเดียวกับที่การส่งอีเมลเป็นการจำลอง
type Order struct {
	OrderID         int                  `gorm:"column:order_id;primaryKey;autoIncrement" json:"orderId"`
	CustomerID      int                  `gorm:"column:customer_id;not null;index" json:"customerId"`
	Channel         OrderChannel         `gorm:"column:channel;type:varchar(20);not null" json:"channel"`
	OrderDate       time.Time            `gorm:"column:order_date;type:timestamptz;not null" json:"orderDate"`
	ShippingAddress string               `gorm:"column:shipping_address;type:text;not null" json:"shippingAddress"`
	Status          OrderStatus          `gorm:"column:status;type:varchar(30);not null;index" json:"status"`
	Subtotal        float64              `gorm:"column:subtotal;type:numeric(12,2);not null" json:"subtotal"`
	DiscountAmount  float64              `gorm:"column:discount_amount;type:numeric(12,2);not null" json:"discountAmount"`
	NetAmount       float64              `gorm:"column:net_amount;type:numeric(12,2);not null" json:"netAmount"`
	PromotionID     *int                 `gorm:"column:promotion_id" json:"promotionId,omitempty"`
	SlipFileName    string               `gorm:"column:slip_file_name;type:varchar(200)" json:"slipFileName,omitempty"`
	Items           []OrderItem          `gorm:"foreignKey:OrderID;references:OrderID;constraint:OnDelete:CASCADE" json:"items"`
	Timeline        []OrderStatusHistory `gorm:"foreignKey:OrderID;references:OrderID;constraint:OnDelete:CASCADE" json:"timeline"`
}

func (Order) TableName() string { return "customer_order" }

// OrderItem — หนังสือหนึ่งเล่มในคำสั่งซื้อ · PK ผสม (order_id, book_id)
//
// เก็บ UnitPrice ไว้กับรายการ เพราะราคาปกของหนังสืออาจเปลี่ยนหลังลูกค้าสั่งไปแล้ว
// ใบเดิมต้องยังอ่านได้ตามราคาที่ตกลงกันตอนนั้น
type OrderItem struct {
	OrderID   int     `gorm:"column:order_id;primaryKey" json:"-"`
	BookID    int     `gorm:"column:book_id;primaryKey" json:"bookId"`
	Quantity  int     `gorm:"column:quantity;not null" json:"quantity"`
	UnitPrice float64 `gorm:"column:unit_price;type:numeric(12,2);not null" json:"unitPrice"`
	LineTotal float64 `gorm:"column:line_total;type:numeric(12,2);not null" json:"lineTotal"`
}

func (OrderItem) TableName() string { return "customer_order_item" }

// OrderStatusHistory — บันทึกทุกครั้งที่สถานะเปลี่ยน
type OrderStatusHistory struct {
	HistoryID   int         `gorm:"column:history_id;primaryKey;autoIncrement" json:"historyId"`
	OrderID     int         `gorm:"column:order_id;not null;index" json:"-"`
	Status      OrderStatus `gorm:"column:status;type:varchar(30);not null" json:"status"`
	ChangedDate time.Time   `gorm:"column:changed_date;type:timestamptz;not null" json:"changedDate"`
	ChangedBy   string      `gorm:"column:changed_by;type:varchar(200)" json:"changedBy,omitempty"`
	Note        string      `gorm:"column:note;type:text" json:"note,omitempty"`
}

func (OrderStatusHistory) TableName() string { return "customer_order_status_history" }

// orderTransitions — สถานะที่ไปต่อได้จากแต่ละสถานะ (ORDER_TRANSITIONS ฝั่งหน้าจอ)
//
// เว็บไซต์แนบสลิปตั้งแต่ตอนสั่ง คำสั่งซื้อทางเว็บจึงข้าม WAITING_PAYMENT ไป VERIFYING_PAYMENT เลย
// ส่วน WAITING_PAYMENT เก็บไว้ให้ช่องทางอื่นที่ยังไม่ได้ชำระ
var orderTransitions = map[OrderStatus][]OrderStatus{
	OrderStatusPendingConfirm:   {OrderStatusStockConfirmed, OrderStatusCancelled, OrderStatusRejected},
	OrderStatusStockConfirmed:   {OrderStatusVerifyingPayment, OrderStatusWaitingPayment, OrderStatusCancelled},
	OrderStatusWaitingPayment:   {OrderStatusVerifyingPayment, OrderStatusCancelled},
	OrderStatusVerifyingPayment: {OrderStatusPaid, OrderStatusRejected},
	OrderStatusPaid:             {OrderStatusPacking, OrderStatusCancelled},
	OrderStatusPacking:          {OrderStatusReadyToShip},
	OrderStatusReadyToShip:      {OrderStatusShipped},
	OrderStatusShipped:          {OrderStatusDelivered},
	OrderStatusDelivered:        {},
	OrderStatusCancelled:        {},
	OrderStatusRejected:         {},
}

// CanTransitionTo — เปลี่ยนจากสถานะปัจจุบันไปสถานะนี้ได้ไหม
func (o Order) CanTransitionTo(next OrderStatus) bool {
	for _, allowed := range orderTransitions[o.Status] {
		if allowed == next {
			return true
		}
	}
	return false
}

// UpdateStatus — เปลี่ยนสถานะพร้อมบันทึกลง timeline (`+updateStatus(s)` ใน class diagram)
// การข้ามขั้นตอนถูกปฏิเสธที่นี่ ไม่ใช่ที่ service — ตัดสินได้จากใบเดียว
func (o *Order) UpdateStatus(next OrderStatus, by, note string, at time.Time) error {
	if !next.IsValid() {
		return ErrInvalidOrderStatus
	}
	if !o.CanTransitionTo(next) {
		return OrderTransitionRejected(o.Status, next)
	}
	o.Status = next
	o.Timeline = append(o.Timeline, OrderStatusHistory{
		OrderID:     o.OrderID,
		Status:      next,
		ChangedDate: at.UTC(),
		ChangedBy:   by,
		Note:        note,
	})
	return nil
}

// AddItem — เพิ่มหนังสือลงคำสั่งซื้อ (`+addItem(book, qty)` ใน class diagram)
// ราคาต่อหน่วยคัดจากราคาปกของหนังสือ ณ เวลาที่สั่ง
func (o *Order) AddItem(book Book, quantity int) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}
	for _, item := range o.Items {
		if item.BookID == book.BookID {
			return ErrDuplicateBookInDocument
		}
	}
	o.Items = append(o.Items, OrderItem{
		OrderID:   o.OrderID,
		BookID:    book.BookID,
		Quantity:  quantity,
		UnitPrice: book.Price,
		LineTotal: book.Price * float64(quantity),
	})
	return nil
}

// CalcTotal — คำนวณยอดรวมใหม่จากรายการและส่วนลด (`+calcTotal()` ใน class diagram)
func (o *Order) CalcTotal() float64 {
	subtotal := 0.0
	for i := range o.Items {
		o.Items[i].LineTotal = o.Items[i].UnitPrice * float64(o.Items[i].Quantity)
		subtotal += o.Items[i].LineTotal
	}
	o.Subtotal = subtotal

	if o.DiscountAmount > subtotal {
		o.DiscountAmount = subtotal
	}
	o.NetAmount = subtotal - o.DiscountAmount
	return o.NetAmount
}

// ItemCount — จำนวนเล่มรวมทั้งใบ (หน้าจอแสดงคู่กับยอดเงิน)
func (o Order) ItemCount() int {
	total := 0
	for _, item := range o.Items {
		total += item.Quantity
	}
	return total
}

// IsClosed — ใบที่จบแล้ว ไม่มีปุ่มให้กดต่อ
func (o Order) IsClosed() bool {
	switch o.Status {
	case OrderStatusDelivered, OrderStatusCancelled, OrderStatusRejected:
		return true
	}
	return false
}

// FormatOrderCode — รหัสที่หน้าจอแสดง (SO-1001)
func FormatOrderCode(orderID int) string { return fmt.Sprintf("SO-%d", orderID) }
