// order.go — คำสั่งซื้อของลูกค้า (คลาสของจิรพนธ์ อยู่หลาย)
//
// class diagram: Customer "1" --> "*" Order · Order "1" *-- "*" OrderItem
// Order "1" *-- "*" OrderStatusHistory · Order "*" --> "0..1" Promotion · Order ..> StockTransaction
//
// การเปลี่ยนสถานะทุกครั้งเดินผ่าน Order.UpdateStatus ซึ่งเป็นตัวคุมตารางการเปลี่ยนสถานะ
// ที่นี่รับผิดชอบเฉพาะสิ่งที่ต้องอ่านหลายตาราง — สต็อกพอไหม โปรโมชั่นใช้ได้ไหม ใครต้องรู้เรื่องต่อ
package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type OrderService struct {
	db            *gorm.DB
	orders        *repository.OrderRepository
	promotions    *repository.PromotionRepository
	books         *repository.BookRepository
	inventory     *repository.InventoryRepository
	people        *repository.PersonRepository
	payments      *repository.PaymentRepository
	deliveries    *repository.DeliveryRepository
	members       *repository.MembershipRepository
	notifications *repository.NotificationRepository
}

func NewOrderService(
	db *gorm.DB,
	orders *repository.OrderRepository,
	promotions *repository.PromotionRepository,
	books *repository.BookRepository,
	inventory *repository.InventoryRepository,
	people *repository.PersonRepository,
	payments *repository.PaymentRepository,
	deliveries *repository.DeliveryRepository,
	members *repository.MembershipRepository,
	notifications *repository.NotificationRepository,
) *OrderService {
	return &OrderService{
		db: db, orders: orders, promotions: promotions, books: books,
		inventory: inventory, people: people, payments: payments,
		deliveries: deliveries, members: members, notifications: notifications,
	}
}

// ── DTO ที่หน้าจอส่งเข้ามา ───────────────────────────────────────────────

type OrderLineInput struct {
	BookID   int `json:"bookId"`
	Quantity int `json:"quantity"`
}

// PlaceOrderInput — ฟอร์มสั่งซื้อ
//
// ลูกค้าที่ล็อกอินอยู่ไม่ต้องส่ง customerId และ channel มา (ระบบเติมให้เป็นตัวเองกับ WEBSITE)
// ฝ่ายขายที่รับออร์เดอร์ทางโทรศัพท์หรือข้อความต้องระบุทั้งสองอย่าง
type PlaceOrderInput struct {
	CustomerID      int                `json:"customerId"`
	Channel         model.OrderChannel `json:"channel"`
	ShippingAddress string             `json:"shippingAddress"`
	PromotionID     *int               `json:"promotionId,omitempty"`
	SlipFileName    string             `json:"slipFileName"`
	BankID          *int               `json:"bankId,omitempty"`
	Items           []OrderLineInput   `json:"items"`
}

// PaymentSlipInput — หลักฐานการโอน · BankID ระบุหรือไม่ก็ได้ (0..1 ใน class diagram)
type PaymentSlipInput struct {
	SlipFileName string `json:"slipFileName"`
	BankID       *int   `json:"bankId,omitempty"`
}

// OrderNoteInput — เหตุผลที่แนบมากับการยกเลิกหรือปฏิเสธ
type OrderNoteInput struct {
	Note string `json:"note"`
}

// OrderView — คำสั่งซื้อพร้อมชื่อลูกค้า ชื่อหนังสือ และโปรโมชั่นที่ใช้
type OrderView struct {
	Order         model.Order
	CustomerName  string
	CustomerEmail string
	Books         map[int]model.Book
	Promotion     *model.Promotion
}

// ── อ่าน ────────────────────────────────────────────────────────────────

// List — รายการคำสั่งซื้อ · ลูกค้าเห็นเฉพาะของตัวเองเสมอ ไม่ว่าจะส่งตัวกรองอะไรมา
func (s *OrderService) List(current Identity, status model.OrderStatus) ([]OrderView, error) {
	if status != "" && !status.IsValid() {
		return nil, model.ErrInvalidOrderStatus
	}

	filter := repository.OrderFilter{Status: status}
	if current.IsCustomer() {
		filter.CustomerID = current.CustomerID
	}

	orders, err := s.orders.List(filter)
	if err != nil {
		return nil, err
	}
	return s.views(orders)
}

// Get — คำสั่งซื้อหนึ่งใบ · ลูกค้าเปิดของคนอื่นไม่ได้
func (s *OrderService) Get(current Identity, orderID int) (*OrderView, error) {
	order, err := s.orders.Find(s.db, orderID)
	if err != nil {
		return nil, err
	}
	if current.IsCustomer() && order.CustomerID != current.CustomerID {
		return nil, model.ErrForbidden
	}
	return s.view(*order)
}

// ── สั่งซื้อ ────────────────────────────────────────────────────────────

// Place — ลูกค้าสั่งซื้อ (`Customer.placeOrder()` ใน class diagram)
//
// ยังไม่ตัดสต็อกตอนนี้ — ฝ่ายขายต้องยืนยันสต็อกก่อน แล้วของจะออกจากคลังจริงตอนแพ็ก
func (s *OrderService) Place(input PlaceOrderInput, current Identity) (*OrderView, error) {
	order, err := s.buildOrder(input, current)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.orders.Create(tx, order); err != nil {
			return err
		}
		if input.BankID != nil {
			exists, err := s.payments.BankExists(tx, *input.BankID)
			if err != nil {
				return err
			}
			if !exists {
				return model.ErrBankNotFound
			}
		}
		if err := s.openPayment(tx, order, input.BankID); err != nil {
			return err
		}
		body := fmt.Sprintf("%s · %s · ฿%.2f · %d เล่ม",
			model.FormatOrderCode(order.OrderID), order.Channel.Label(),
			order.NetAmount, order.ItemCount())
		return pushBothChannels(tx, s.notifications, model.RoleSales,
			model.NotifyOrderPlaced, "มีคำสั่งซื้อใหม่รอยืนยัน", body,
			fmt.Sprintf("/admin/orders/%d", order.OrderID))
	})
	if err != nil {
		return nil, err
	}
	return s.view(*order)
}

// buildOrder — ตรวจฟอร์มแล้วประกอบเป็นคำสั่งซื้อที่พร้อมเขียนลงฐานข้อมูล
func (s *OrderService) buildOrder(input PlaceOrderInput, current Identity) (*model.Order, error) {
	customerID, channel := input.CustomerID, input.Channel
	if current.IsCustomer() {
		// ลูกค้าสั่งให้ตัวเองเท่านั้น ส่ง customerId ของคนอื่นมาก็ไม่มีผล
		customerID, channel = current.CustomerID, model.OrderChannelWebsite
	}
	if !channel.IsValid() {
		return nil, model.ErrInvalidOrderChannel
	}

	customer, err := s.people.FindCustomer(customerID)
	if err != nil {
		return nil, err
	}

	address := strings.TrimSpace(input.ShippingAddress)
	if address == "" && channel != model.OrderChannelWebsite {
		address = strings.TrimSpace(customer.Customer.Address)
	}
	if address == "" || address == "—" || address == "-" {
		return nil, model.ErrAddressRequired
	}
	if channel == model.OrderChannelWebsite && strings.TrimSpace(input.SlipFileName) == "" {
		return nil, model.ErrSlipRequired
	}
	if len(input.Items) == 0 {
		return nil, model.ErrNoOrderItems
	}

	now := time.Now().UTC()
	order := &model.Order{
		CustomerID:      customerID,
		Channel:         channel,
		OrderDate:       now,
		ShippingAddress: address,
		Status:          model.OrderStatusPendingConfirm,
		SlipFileName:    strings.TrimSpace(input.SlipFileName),
	}

	for _, line := range input.Items {
		book, err := s.books.Find(s.db, line.BookID)
		if err != nil {
			return nil, err
		}
		if book.Status != model.BookStatusActive {
			return nil, model.ErrBookNotForSale
		}
		if err := order.AddItem(*book, line.Quantity); err != nil {
			return nil, err
		}
	}
	order.CalcTotal()

	if err := s.applyPromotion(order, input.PromotionID); err != nil {
		return nil, err
	}
	order.Timeline = []model.OrderStatusHistory{{
		Status: order.Status, ChangedDate: now, ChangedBy: current.Name,
		Note: "รับคำสั่งซื้อ",
	}}
	return order, nil
}

// openPayment — เปิดแถวการชำระเงินคู่กับคำสั่งซื้อ (Order "1" --> "1" Payment)
//
// ใบที่แนบสลิปมาตั้งแต่ตอนสั่ง (เส้นทางเว็บไซต์) เข้าสถานะรอตรวจทันที
// ใบที่ยังไม่ได้ชำระ (โทรศัพท์/ข้อความ) เป็น WAITING ไว้ก่อน
func (s *OrderService) openPayment(tx *gorm.DB, order *model.Order, bankID *int) error {
	payment := model.Payment{
		OrderID: order.OrderID,
		Amount:  order.NetAmount,
		Status:  model.PaymentStatusWaiting,
	}
	if order.SlipFileName != "" {
		if err := payment.UploadSlip(order.SlipFileName, bankID, order.OrderDate); err != nil {
			return err
		}
	}
	return s.payments.Create(tx, &payment)
}

// applyPromotion — ผูกโปรโมชั่นที่ลูกค้าเลือกแล้วคำนวณส่วนลดใหม่
func (s *OrderService) applyPromotion(order *model.Order, promotionID *int) error {
	if promotionID == nil || *promotionID == 0 {
		return nil
	}

	promotion, err := s.promotions.Find(s.db, *promotionID)
	if err != nil {
		return err
	}
	if !promotion.IsApplicable(*order, model.Today()) {
		return model.ErrPromotionNotApplicable
	}

	order.PromotionID = promotionID
	order.DiscountAmount = promotion.CalcDiscount(*order)
	order.CalcTotal()
	return nil
}

// ── เปลี่ยนสถานะ ────────────────────────────────────────────────────────

// ConfirmStock — ฝ่ายขายยืนยันว่ามีของพอ (PENDING_CONFIRM → STOCK_CONFIRMED)
func (s *OrderService) ConfirmStock(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusStockConfirmed, by, "ยืนยันสต็อกแล้ว",
		func(tx *gorm.DB, order *model.Order) error {
			return s.assertStockAvailable(tx, order)
		})
}

// AwaitPayment — ออร์เดอร์ทางโทรศัพท์/ข้อความที่ยังไม่ได้ชำระ (STOCK_CONFIRMED → WAITING_PAYMENT)
func (s *OrderService) AwaitPayment(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusWaitingPayment, by, "รอลูกค้าชำระเงิน", nil)
}

// SubmitPayment — แนบหลักฐานการชำระเงิน (→ VERIFYING_PAYMENT)
//
// ลูกค้าแนบเองได้เฉพาะใบของตัวเอง · ฝ่ายขายแนบแทนได้ทุกใบ (รับสลิปทางแชทหรือโทรศัพท์)
func (s *OrderService) SubmitPayment(
	current Identity, orderID int, input PaymentSlipInput,
) (*OrderView, error) {
	slip := strings.TrimSpace(input.SlipFileName)
	if slip == "" {
		return nil, model.ErrSlipRequired
	}

	return s.advance(orderID, model.OrderStatusVerifyingPayment, current.Name, "แนบหลักฐานการชำระเงิน",
		func(tx *gorm.DB, order *model.Order) error {
			if current.IsCustomer() && order.CustomerID != current.CustomerID {
				return model.ErrForbidden
			}
			if input.BankID != nil {
				exists, err := s.payments.BankExists(tx, *input.BankID)
				if err != nil {
					return err
				}
				if !exists {
					return model.ErrBankNotFound
				}
			}

			payment, err := s.payments.FindByOrderForUpdate(tx, orderID)
			if err != nil {
				return err
			}
			// ยอดอาจเปลี่ยนไปจากตอนเปิดใบถ้ามีการแก้ส่วนลด จึงเขียนยอดล่าสุดลงไปด้วย
			payment.Amount = order.NetAmount
			bankID := input.BankID
			// การเริ่มตรวจจากหน้าคำสั่งซื้อไม่ได้ถามธนาคารซ้ำ ถ้าเคยเลือกไว้
			// ตอน checkout ให้รักษาค่าเดิมแทนการเขียน NULL ทับ
			if bankID == nil {
				bankID = payment.BankID
			}
			if err := payment.UploadSlip(slip, bankID, time.Now()); err != nil {
				return err
			}
			if err := s.payments.Save(tx, payment); err != nil {
				return err
			}

			order.SlipFileName = slip
			return nil
		})
}

// VerifyPayment — ฝ่ายขายตรวจสลิปแล้วผ่าน (`SalesStaff.verifyPayment()`) → แจ้งคลังให้แพ็ก
func (s *OrderService) VerifyPayment(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusPaid, by, "ตรวจสอบการชำระเงินแล้ว",
		func(tx *gorm.DB, order *model.Order) error {
			if err := s.decidePayment(tx, orderID, "", by); err != nil {
				return err
			}
			body := fmt.Sprintf("%s · ฿%.2f · %d เล่ม",
				model.FormatOrderCode(order.OrderID), order.NetAmount, order.ItemCount())
			return pushBothChannels(tx, s.notifications, model.RoleWarehouse,
				model.NotifyOrderPaid, "คำสั่งซื้อชำระเงินแล้ว รอแพ็กสินค้า", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID))
		})
}

// RejectPayment — สลิปไม่ผ่าน ต้องบอกเหตุผลให้ลูกค้ารู้
func (s *OrderService) RejectPayment(orderID int, input OrderNoteInput, by string) (*OrderView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		return nil, model.ErrReasonRequired
	}
	return s.advance(orderID, model.OrderStatusRejected, by, note,
		func(tx *gorm.DB, _ *model.Order) error {
			return s.decidePayment(tx, orderID, note, by)
		})
}

// decidePayment — ฝ่ายขายตัดสินสลิป · reason ว่าง = ผ่าน · มีข้อความ = ปฏิเสธ
func (s *OrderService) decidePayment(tx *gorm.DB, orderID int, reason, by string) error {
	payment, err := s.payments.FindByOrderForUpdate(tx, orderID)
	if err != nil {
		return err
	}
	if reason == "" {
		err = payment.Verify(by, time.Now())
	} else {
		err = payment.Reject(reason, by, time.Now())
	}
	if err != nil {
		return err
	}
	return s.payments.Save(tx, payment)
}

// Pack — คลังแพ็กสินค้า (PAID → PACKING) แล้ว**ตัดสต็อกจริงตอนนี้**
//
// ตัดตอนแพ็กไม่ใช่ตอนยืนยันสต็อก เพราะของออกจากคลังจริงที่ขั้นนี้ · และตารางการเปลี่ยนสถานะ
// ไม่ให้ยกเลิกใบที่แพ็กแล้ว จึงไม่มีเส้นทางที่ต้องคืนสต็อกกลับ
func (s *OrderService) Pack(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusPacking, by, "กำลังแพ็กสินค้า",
		func(tx *gorm.DB, order *model.Order) error {
			if err := s.assertStockAvailable(tx, order); err != nil {
				return err
			}

			txns := make([]model.StockTransaction, len(order.Items))
			now := time.Now().UTC()
			for i, item := range order.Items {
				txns[i] = model.StockTransaction{
					BookID:         item.BookID,
					Type:           model.StockTxnTypeSaleOut,
					QuantityChange: -item.Quantity,
					Reason:         "ตัดขายตามคำสั่งซื้อ",
					ReferenceDoc:   model.FormatOrderCode(order.OrderID),
					TxnDate:        now,
				}
			}
			return s.inventory.ApplyStrictStockChanges(tx, txns)
		})
}

// ReadyToShip — แพ็กเสร็จ พร้อมให้ฝ่ายจัดส่งมารับ → แจ้งฝ่ายจัดส่ง
func (s *OrderService) ReadyToShip(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusReadyToShip, by, "พร้อมจัดส่ง",
		func(tx *gorm.DB, order *model.Order) error {
			body := fmt.Sprintf("%s · %s", model.FormatOrderCode(order.OrderID), order.ShippingAddress)
			return pushBothChannels(tx, s.notifications, model.RoleDelivery,
				model.NotifyOrderReadyToShip, "มีพัสดุรอจัดส่ง", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID))
		})
}

// Ship — ฝ่ายจัดส่งบันทึกการส่ง พร้อมเปิดรายการพัสดุในทรานแซกชันเดียวกัน
//
// พัสดุกับคำสั่งซื้อต้องเกิดพร้อมกันเสมอ ไม่งั้นจะมีใบที่สถานะ SHIPPED แต่ไม่มีเลขติดตามพัสดุ
// (เหตุผลเดียวกับที่การตรวจสลิปเขียน payment กับ customer_order พร้อมกัน)
func (s *OrderService) Ship(orderID int, input ShipmentInput, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusShipped, by, "ส่งมอบให้ขนส่งแล้ว",
		func(tx *gorm.DB, order *model.Order) error {
			return s.recordShipment(tx, order, input)
		})
}

// Deliver — ลูกค้ารับของแล้ว · ปิดพัสดุและสะสมแต้มให้พร้อมกัน
//
// แต้มเกิดที่ขั้นนี้ขั้นเดียว เพราะ DELIVERED เป็นสถานะปลายทาง (ยกเลิกต่อไม่ได้)
// จึงไม่ต้องมีเส้นทางคืนแต้มเมื่อคำสั่งซื้อถูกยกเลิกทีหลัง
func (s *OrderService) Deliver(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusDelivered, by, "ลูกค้าได้รับสินค้าแล้ว",
		func(tx *gorm.DB, order *model.Order) error {
			if err := s.closeShipment(tx, order.OrderID); err != nil {
				return err
			}
			return s.earnPoints(tx, order)
		})
}

// earnPoints — เติมแต้มสะสมให้เจ้าของใบ (`Member.earnPoints()` ของบัญชาการ)
//
// อัตราแต้มมาจากระดับปัจจุบันของสมาชิก แล้วเลื่อนระดับใหม่ตามยอดสะสมที่เพิ่งเพิ่ม
// ลูกค้าที่ยังไม่มีแถวสมาชิก (ข้อมูลก่อน P7) ให้ผ่านไป ไม่ต้องล้มการยืนยันรับสินค้าทั้งรายการ
// — เหตุผลเดียวกับที่ closeShipment ปล่อยใบเก่าที่ไม่มีพัสดุผ่านไป
func (s *OrderService) earnPoints(tx *gorm.DB, order *model.Order) error {
	member, err := s.members.FindMemberByCustomerForUpdate(tx, order.CustomerID)
	if errors.Is(err, model.ErrMemberNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	tiers, err := s.members.ListTiers(tx)
	if err != nil {
		return err
	}
	var rate float64
	for _, tier := range tiers {
		if tier.TierID == member.TierID {
			rate = tier.PointRate
			break
		}
	}

	before := len(member.PointTxns)
	member.EarnPoints(*order, rate, time.Now())
	if next := model.PickTier(tiers, member.TotalAccumulatedPurchase); next != nil {
		member.TierID = next.TierID
	}
	if err := s.members.SaveMember(tx, member); err != nil {
		return err
	}
	return s.members.AddPointTransactions(tx, member.PointTxns[before:])
}

// recordShipment — เปิดรายการพัสดุของคำสั่งซื้อ (`DeliveryStaff.recordShipment()`)
//
// เดินสองก้าว PREPARING → SHIPPED เพื่อให้ประวัติเล่าเรื่องครบตั้งแต่เปิดรายการ
// ตรงกับ `record()` ใน class diagram ที่กำหนดให้พัสดุเริ่มที่ PREPARING เสมอ
func (s *OrderService) recordShipment(tx *gorm.DB, order *model.Order, input ShipmentInput) error {
	tracking := strings.TrimSpace(input.TrackingNumber)
	if tracking == "" {
		return model.ErrTrackingRequired
	}

	exists, err := s.deliveries.ExistsForOrder(tx, order.OrderID)
	if err != nil {
		return err
	}
	if exists {
		return model.ErrShipmentExists
	}

	found, err := s.deliveries.CarrierExists(tx, input.CarrierID)
	if err != nil {
		return err
	}
	if !found {
		return model.ErrCarrierNotFound
	}

	recipient := strings.TrimSpace(input.RecipientName)
	if recipient == "" {
		row, err := s.people.FindCustomer(order.CustomerID)
		if err != nil {
			return err
		}
		recipient = row.Person.Name()
	}

	now := time.Now()
	shipment := model.Shipment{
		OrderID:        order.OrderID,
		CarrierID:      input.CarrierID,
		TrackingNumber: tracking,
		RecipientName:  recipient,
		ShippedDate:    model.Today(),
	}
	shipment.Record(now)
	if err := shipment.UpdateStatus(
		model.ShipmentStatusShipped, "", "ส่งมอบให้ขนส่งแล้ว", now); err != nil {
		return err
	}
	return s.deliveries.Create(tx, &shipment)
}

// closeShipment — ปิดพัสดุตอนลูกค้ายืนยันรับของ
//
// ใบเก่าที่ยังไม่มีแถวพัสดุ (ข้อมูลตั้งต้นก่อนทำระบบย่อยนี้) ให้ผ่านไปได้ ไม่ต้องล้มทั้งรายการ
func (s *OrderService) closeShipment(tx *gorm.DB, orderID int) error {
	shipment, err := s.deliveries.FindByOrderForUpdate(tx, orderID)
	if errors.Is(err, model.ErrShipmentNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if shipment.Status == model.ShipmentStatusDelivered {
		return nil
	}

	before := len(shipment.Tracking)
	if err := shipment.UpdateStatus(
		model.ShipmentStatusDelivered, "", "ผู้รับเซ็นรับพัสดุแล้ว", time.Now()); err != nil {
		return err
	}
	if err := s.deliveries.Save(tx, shipment); err != nil {
		return err
	}

	fresh := shipment.Tracking[before:]
	for i := range fresh {
		fresh[i].ShipmentID = shipment.ShipmentID
	}
	return s.deliveries.AddTracking(tx, fresh)
}

// Cancel — ยกเลิกคำสั่งซื้อ ต้องมีเหตุผลเสมอ
func (s *OrderService) Cancel(orderID int, input OrderNoteInput, by string) (*OrderView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		return nil, model.ErrReasonRequired
	}
	return s.advance(orderID, model.OrderStatusCancelled, by, note, nil)
}

// advance — โครงร่วมของทุกการเปลี่ยนสถานะ
//
// ล็อกหัวเอกสาร → ให้ hook ตรวจ/ทำงานเพิ่ม → ให้ model ตัดสินว่าเปลี่ยนสถานะได้ไหม
// → บันทึกหัวเอกสารกับแถว timeline ที่เพิ่งเกิด
func (s *OrderService) advance(
	orderID int, next model.OrderStatus, by, note string,
	hook func(tx *gorm.DB, order *model.Order) error,
) (*OrderView, error) {
	var order *model.Order
	err := s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.orders.FindForUpdate(tx, orderID)
		if err != nil {
			return err
		}
		order = found

		if hook != nil {
			if err := hook(tx, order); err != nil {
				return err
			}
		}

		before := len(order.Timeline)
		if err := order.UpdateStatus(next, by, note, time.Now()); err != nil {
			return err
		}
		if err := s.orders.Save(tx, order); err != nil {
			return err
		}
		return s.orders.AddHistory(tx, order.Timeline[before:])
	})
	if err != nil {
		return nil, err
	}
	return s.view(*order)
}

// assertStockAvailable — สต็อกพอสำหรับทุกเล่มในใบนี้ไหม (ล็อกแถวไว้ระหว่างตรวจ)
func (s *OrderService) assertStockAvailable(tx *gorm.DB, order *model.Order) error {
	bookIDs := make([]int, len(order.Items))
	for i, item := range order.Items {
		bookIDs[i] = item.BookID
	}

	items, err := s.inventory.LockItemsByBook(tx, bookIDs)
	if err != nil {
		return err
	}
	for _, line := range order.Items {
		item, ok := items[line.BookID]
		if !ok || item.QuantityOnHand < line.Quantity {
			return model.ErrInsufficientStock
		}
	}
	return nil
}

// ── ตัวช่วยประกอบ view ──────────────────────────────────────────────────

func (s *OrderService) view(order model.Order) (*OrderView, error) {
	views, err := s.views([]model.Order{order})
	if err != nil {
		return nil, err
	}
	return &views[0], nil
}

func (s *OrderService) views(orders []model.Order) ([]OrderView, error) {
	views := make([]OrderView, len(orders))
	if len(orders) == 0 {
		return views, nil
	}

	books, err := s.books.BooksByID()
	if err != nil {
		return nil, err
	}
	customers, err := s.people.ListCustomers(repository.CustomerFilter{})
	if err != nil {
		return nil, err
	}
	names := make(map[int]string, len(customers))
	emails := make(map[int]string, len(customers))
	for _, row := range customers {
		names[row.Customer.CustomerID] = row.Person.Name()
		emails[row.Customer.CustomerID] = row.Person.Email
	}
	promotions, err := s.promotions.List()
	if err != nil {
		return nil, err
	}
	byPromotion := make(map[int]model.Promotion, len(promotions))
	for _, promotion := range promotions {
		byPromotion[promotion.PromotionID] = promotion
	}

	for i, order := range orders {
		views[i] = OrderView{
			Order:         order,
			CustomerName:  names[order.CustomerID],
			CustomerEmail: emails[order.CustomerID],
			Books:         books,
		}
		if order.PromotionID != nil {
			if promotion, ok := byPromotion[*order.PromotionID]; ok {
				views[i].Promotion = &promotion
			}
		}
	}
	return views, nil
}
