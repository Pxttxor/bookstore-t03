// order.go — คำสั่งซื้อของลูกค้า
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
	CustomerName    string             `json:"customerName,omitempty"`
	CustomerPhone   string             `json:"customerPhone,omitempty"`
	Channel         model.OrderChannel `json:"channel"`
	ShippingAddress string             `json:"shippingAddress"`
	PromotionID     *int               `json:"promotionId,omitempty"`
	DiscountCode    string             `json:"discountCode,omitempty"`
	SlipFileName    string             `json:"slipFileName"`
	BankID          *int               `json:"bankId,omitempty"`
	Items           []OrderLineInput   `json:"items"`
}

// DiscountValidationResult — ผลการตรวจคูปองส่วนลด
type DiscountValidationResult struct {
	Code           string  `json:"code"`
	RewardName     string  `json:"rewardName"`
	DiscountAmount float64 `json:"discountAmount"`
}

// PaymentSlipInput — หลักฐานการโอน · BankID ระบุหรือไม่ก็ได้ (0..1 ใน class diagram)
type PaymentSlipInput struct {
	SlipFileName string `json:"slipFileName"`
	BankID       *int   `json:"bankId,omitempty"`
}

// OrderNoteInput — เหตุผลที่แนบมากับการยกเลิกหรือปฏิเสธ
type OrderNoteInput struct {
	Note              string `json:"note"`
	RefundBankName    string `json:"refundBankName,omitempty"`
	RefundAccountNo   string `json:"refundAccountNo,omitempty"`
	RefundAccountName string `json:"refundAccountName,omitempty"`
}

// RefundBankInput — ข้อมูลบัญชีสำหรับรับเงินคืน
type RefundBankInput struct {
	RefundBankName    string `json:"refundBankName"`
	RefundAccountNo   string `json:"refundAccountNo"`
	RefundAccountName string `json:"refundAccountName"`
}

// RefundConfirmInput — ข้อความบันทึกยืนยันการคืนเงิน
type RefundConfirmInput struct {
	Note string `json:"note"`
}

// OutOfStockInput — ข้อมูลแจ้งสินค้าหมดและระยะเวลาเติมสต็อก
type OutOfStockInput struct {
	Note            string      `json:"note"`
	RestockEstimate string      `json:"restockEstimate"`
	RestockDate     *model.Date `json:"restockDate,omitempty"`
}

// CustomerChoiceInput — ตัวเลือกที่ลูกค้าเลือกกรณีสินค้าหมดสต็อก
type CustomerChoiceInput struct {
	Choice            string `json:"choice"` // "WAIT_RESTOCK" | "CHANGE_PRODUCT" | "CANCEL"
	ReplacementBookID *int   `json:"replacementBookId,omitempty"`
	Note              string `json:"note,omitempty"`
	RefundBankName    string `json:"refundBankName,omitempty"`
	RefundAccountNo   string `json:"refundAccountNo,omitempty"`
	RefundAccountName string `json:"refundAccountName,omitempty"`
}

// ApproveExchangeInput — ยืนยันการเปลี่ยนหนังสือในคำสั่งซื้อ
type ApproveExchangeInput struct {
	OldBookID         *int   `json:"oldBookId,omitempty"`
	ReplacementBookID int    `json:"replacementBookId"`
	Note              string `json:"note,omitempty"`
}

// OrderShipmentInfo — พัสดุของคำสั่งซื้อที่จัดส่งแล้ว
type OrderShipmentInfo struct {
	ShipmentID     int                  `json:"shipmentId"`
	TrackingNumber string               `json:"trackingNumber"`
	Carrier        string               `json:"carrier"`
	RecipientName  string               `json:"recipientName"`
	ShippedDate    model.Date           `json:"shippedDate"`
	Status         model.ShipmentStatus `json:"status"`
}

// OrderView — คำสั่งซื้อพร้อมชื่อลูกค้า ชื่อหนังสือ และโปรโมชั่นที่ใช้
type OrderView struct {
	Order                model.Order
	CustomerName         string
	CustomerPhone        string
	CustomerEmail        string
	Books                map[int]model.Book
	Promotion            *model.Promotion
	Shipment             *OrderShipmentInfo
	ReplacementBookTitle string
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
		if order.DiscountCode != "" {
			redemption, err := s.members.FindRedemptionByCode(tx, order.DiscountCode)
			if err != nil {
				return err
			}
			if redemption.IsUsed() {
				return model.ErrDiscountCodeAlreadyUsed
			}
			if err := s.members.MarkRedemptionUsed(tx, redemption.RedemptionID, order.OrderID, order.OrderDate); err != nil {
				return err
			}
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
		if err := pushBothChannels(tx, s.notifications, model.RoleSales,
			model.NotifyOrderPlaced, "มีคำสั่งซื้อใหม่รอยืนยัน", body,
			fmt.Sprintf("/admin/orders/%d", order.OrderID)); err != nil {
			return err
		}
		return pushCustomerNotification(tx, s.notifications, order.CustomerID,
			model.NotifyOrderPlaced, "คำสั่งซื้อได้รับการบันทึกแล้ว",
			fmt.Sprintf("%s · ยอดชำระ ฿%.2f รอตรวจสอบการชำระเงิน", model.FormatOrderCode(order.OrderID), order.NetAmount),
			fmt.Sprintf("/orders/%d", order.OrderID))
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
	customerName := strings.TrimSpace(input.CustomerName)
	if customerName == "" {
		customerName = customer.Person.Name()
	}
	customerPhone := strings.TrimSpace(input.CustomerPhone)
	if customerPhone == "" {
		customerPhone = customer.Person.Phone
	}

	order := &model.Order{
		CustomerID:      customerID,
		CustomerName:    customerName,
		CustomerPhone:   customerPhone,
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
	if err := s.applyDiscountCode(order, input.DiscountCode, current); err != nil {
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

// applyPromotion — ผูกโปรโมชั่นที่ลูกค้าเลือก หรือค้นหาโปรโมชั่นที่เข้าเงื่อนไขให้อัตโนมัติ แล้วคำนวณส่วนลดใหม่
func (s *OrderService) applyPromotion(order *model.Order, promotionID *int) error {
	today := model.Today()

	// 1. กรณีลูกค้าระบุโปรโมชั่นมาเจาะจง
	if promotionID != nil && *promotionID > 0 {
		promotion, err := s.promotions.Find(s.db, *promotionID)
		if err != nil {
			return err
		}
		if !promotion.IsApplicable(*order, today) {
			return model.ErrPromotionNotApplicable
		}

		order.PromotionID = promotionID
		order.DiscountAmount = promotion.CalcDiscount(*order)
		order.CalcTotal()
		return nil
	}

	// 2. กรณีไม่ได้ระบุโปรโมชั่นมา (auto-apply): หาโปรโมชั่น ACTIVE ที่เข้าเงื่อนไขทั้งหมด
	// แล้วเลือกตัวที่ให้ส่วนลดสูงสุดแก่ลูกค้าโดยอัตโนมัติ
	activePromos, err := s.promotions.Active()
	if err != nil {
		return err
	}

	var bestPromo *model.Promotion
	var maxDiscount float64
	for i := range activePromos {
		promo := &activePromos[i]
		if promo.IsApplicable(*order, today) {
			discount := promo.CalcDiscount(*order)
			if discount > maxDiscount {
				maxDiscount = discount
				bestPromo = promo
			}
		}
	}

	if bestPromo != nil && maxDiscount > 0 {
		promoID := bestPromo.PromotionID
		order.PromotionID = &promoID
		order.DiscountAmount = maxDiscount
		order.CalcTotal()
	}

	return nil
}

// applyDiscountCode — ตรวจสอบและนำโค้ดส่วนลดจากการแลกแต้มมาหักออกจากยอดคำสั่งซื้อ
func (s *OrderService) applyDiscountCode(order *model.Order, rawCode string, current Identity) error {
	code := strings.TrimSpace(rawCode)
	if code == "" {
		return nil
	}

	redemption, err := s.members.FindRedemptionByCode(s.db, code)
	if err != nil {
		return err
	}
	if current.IsCustomer() {
		member, err := s.members.FindMemberByCustomer(s.db, current.CustomerID)
		if err != nil {
			return err
		}
		if redemption.MemberID != member.Member.MemberID {
			return model.ErrDiscountCodeNotOwned
		}
	}
	if redemption.IsUsed() {
		return model.ErrDiscountCodeAlreadyUsed
	}

	reward, err := s.members.FindReward(s.db, redemption.RewardID)
	if err != nil {
		return err
	}
	if reward.Type != model.RewardTypeDiscount || reward.DiscountValue <= 0 {
		return model.ErrDiscountCodeNotDiscount
	}

	order.DiscountCode = redemption.CouponCode
	order.DiscountAmount += reward.DiscountValue
	if order.DiscountAmount > order.Subtotal {
		order.DiscountAmount = order.Subtotal
	}
	order.CalcTotal()
	return nil
}

// ValidateDiscountCode — ตรวจสอบความถูกต้องและสิทธิ์ของโค้ดส่วนลดก่อนการสั่งซื้อ
func (s *OrderService) ValidateDiscountCode(current Identity, rawCode string, subtotal float64) (*DiscountValidationResult, error) {
	code := strings.TrimSpace(rawCode)
	if code == "" {
		return nil, model.ErrDiscountCodeEmpty
	}

	redemption, err := s.members.FindRedemptionByCode(s.db, code)
	if err != nil {
		return nil, err
	}
	if current.IsCustomer() {
		member, err := s.members.FindMemberByCustomer(s.db, current.CustomerID)
		if err != nil {
			return nil, err
		}
		if redemption.MemberID != member.Member.MemberID {
			return nil, model.ErrDiscountCodeNotOwned
		}
	}
	if redemption.IsUsed() {
		return nil, model.ErrDiscountCodeAlreadyUsed
	}

	reward, err := s.members.FindReward(s.db, redemption.RewardID)
	if err != nil {
		return nil, err
	}
	if reward.Type != model.RewardTypeDiscount || reward.DiscountValue <= 0 {
		return nil, model.ErrDiscountCodeNotDiscount
	}

	discount := reward.DiscountValue
	if subtotal > 0 && discount > subtotal {
		discount = subtotal
	}

	return &DiscountValidationResult{
		Code:           redemption.CouponCode,
		RewardName:     reward.Name,
		DiscountAmount: discount,
	}, nil
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
			if order.Status == model.OrderStatusRejected {
				order.CancelReason = ""
			}
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
			if err := pushBothChannels(tx, s.notifications, model.RoleWarehouse,
				model.NotifyOrderPaid, "คำสั่งซื้อชำระเงินแล้ว รอแพ็กสินค้า", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID)); err != nil {
				return err
			}
			return pushCustomerNotification(tx, s.notifications, order.CustomerID,
				model.NotifyOrderPaid, "การชำระเงินได้รับการยืนยันแล้ว",
				fmt.Sprintf("%s · ทางร้านกำลังจัดเตรียมและแพ็กสินค้าเพื่อจัดส่ง", model.FormatOrderCode(order.OrderID)),
				fmt.Sprintf("/orders/%d", order.OrderID))
		})
}

// RejectPayment — สลิปไม่ผ่าน ต้องบอกเหตุผลให้ลูกค้ารู้
func (s *OrderService) RejectPayment(orderID int, input OrderNoteInput, by string) (*OrderView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		return nil, model.ErrReasonRequired
	}
	return s.advance(orderID, model.OrderStatusRejected, by, note,
		func(tx *gorm.DB, order *model.Order) error {
			order.CancelReason = note
			if err := s.decidePayment(tx, orderID, note, by); err != nil {
				return err
			}
			return pushCustomerNotification(tx, s.notifications, order.CustomerID,
				model.NotifyPaymentRejected, "การชำระเงินไม่ถูกต้อง โปรดอัปโหลดสลิปใหม่",
				fmt.Sprintf("%s · เหตุผล: %s", model.FormatOrderCode(order.OrderID), note),
				fmt.Sprintf("/orders/%d", order.OrderID))
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
			if err := s.recordShipment(tx, order, input); err != nil {
				return err
			}
			trackingInfo := ""
			if input.TrackingNumber != "" {
				trackingInfo = fmt.Sprintf(" · เลขพัสดุ: %s", input.TrackingNumber)
			}
			return pushCustomerNotification(tx, s.notifications, order.CustomerID,
				model.NotifyOrderShipped, "คำสั่งซื้อของคุณถูกจัดส่งแล้ว",
				fmt.Sprintf("%s · สินค้าถูกส่งมอบให้บริษัทขนส่งแล้ว%s", model.FormatOrderCode(order.OrderID), trackingInfo),
				fmt.Sprintf("/orders/%d", order.OrderID))
		})
}

// Deliver — ลูกค้ารับของแล้ว · ปิดพัสดุและสะสมแต้มให้พร้อมกัน
//
// แต้มเกิดที่ขั้นนี้ขั้นเดียว เพราะ DELIVERED เป็นสถานะปลายทาง (ยกเลิกต่อไม่ได้)
// จึงไม่ต้องมีเส้นทางคืนแต้มเมื่อคำสั่งซื้อถูกยกเลิกทีหลัง
func (s *OrderService) Deliver(orderID int, by string) (*OrderView, error) {
	return s.advance(orderID, model.OrderStatusDelivered, by, "ลูกค้าได้รับสินค้าแล้ว",
		func(tx *gorm.DB, order *model.Order) error {
			if err := s.closeShipment(tx, order); err != nil {
				return err
			}
			if err := s.earnPoints(tx, order); err != nil {
				return err
			}
			return pushCustomerNotification(tx, s.notifications, order.CustomerID,
				model.NotifyOrderDelivered, "คำสั่งซื้อจัดส่งถึงคุณเรียบร้อยแล้ว",
				fmt.Sprintf("%s · ขอบคุณที่สั่งซื้อหนังสือกับ BookHaven", model.FormatOrderCode(order.OrderID)),
				fmt.Sprintf("/orders/%d", order.OrderID))
		})
}

// earnPoints — เติมแต้มสะสมให้เจ้าของใบ (`Member.earnPoints()`)
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

	taken, err := s.deliveries.TrackingExists(tx, tracking)
	if err != nil {
		return err
	}
	if taken {
		return model.ErrTrackingDuplicated
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
		if order.CustomerName != "" {
			recipient = order.CustomerName
		} else {
			row, err := s.people.FindCustomer(order.CustomerID)
			if err != nil {
				return err
			}
			recipient = row.Person.Name()
		}
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
		model.ShipmentStatusShipped, "ศูนย์คัดแยกพัสดุ", "ส่งมอบให้ขนส่งแล้ว", now); err != nil {
		return err
	}
	return s.deliveries.Create(tx, &shipment)
}

// closeShipment — ปิดพัสดุตอนลูกค้ายืนยันรับของ
//
// ใบเก่าที่ยังไม่มีแถวพัสดุ (ข้อมูลตั้งต้นก่อนทำระบบย่อยนี้) ให้ผ่านไปได้ ไม่ต้องล้มทั้งรายการ
func (s *OrderService) closeShipment(tx *gorm.DB, order *model.Order) error {
	shipment, err := s.deliveries.FindByOrderForUpdate(tx, order.OrderID)
	if errors.Is(err, model.ErrShipmentNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if shipment.Status == model.ShipmentStatusDelivered {
		return nil
	}

	loc := strings.TrimSpace(order.ShippingAddress)
	runes := []rune(loc)
	if len(runes) > 200 {
		loc = string(runes[:200])
	}
	if loc == "" {
		loc = "ปลายทางผู้รับ"
	}

	before := len(shipment.Tracking)
	if err := shipment.UpdateStatus(
		model.ShipmentStatusDelivered, loc, "ผู้รับเซ็นรับพัสดุแล้ว", time.Now()); err != nil {
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
	hook := func(tx *gorm.DB, order *model.Order) error {
		order.CancelReason = note
		// คำสั่งซื้อที่ถูกยกเลิกให้ตั้งสถานะคืนเงินเป็น PENDING เสมอ (ยกเว้นกรณีคืนเงินแล้ว)
		if order.RefundStatus != model.RefundStatusRefunded {
			order.RefundStatus = model.RefundStatusPending
		}
		if input.RefundBankName != "" {
			order.RefundBankName = strings.TrimSpace(input.RefundBankName)
		}
		if input.RefundAccountNo != "" {
			order.RefundAccountNo = strings.TrimSpace(input.RefundAccountNo)
		}
		if input.RefundAccountName != "" {
			order.RefundAccountName = strings.TrimSpace(input.RefundAccountName)
		}
		return pushCustomerNotification(tx, s.notifications, order.CustomerID,
			model.NotifyOrderCancelled, "คำสั่งซื้อถูกยกเลิกแล้ว",
			fmt.Sprintf("%s · เหตุผล: %s", model.FormatOrderCode(order.OrderID), note),
			fmt.Sprintf("/orders/%d", order.OrderID))
	}
	return s.advance(orderID, model.OrderStatusCancelled, by, note, hook)
}

// SetRefundBank — บันทึกหรือแก้ไขชื่อธนาคารและเลขบัญชีสำหรับรับเงินคืน
func (s *OrderService) SetRefundBank(orderID int, input RefundBankInput, current Identity) (*OrderView, error) {
	bankName := strings.TrimSpace(input.RefundBankName)
	accountNo := strings.TrimSpace(input.RefundAccountNo)
	accountName := strings.TrimSpace(input.RefundAccountName)
	if bankName == "" || accountNo == "" || accountName == "" {
		return nil, model.Validation("REFUND_INFO_REQUIRED", "กรุณาระบุชื่อธนาคาร เลขที่บัญชี และชื่อนามสกุลผู้รับเงินคืน")
	}

	var digits strings.Builder
	for _, r := range accountNo {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	dStr := digits.String()
	lowerBank := strings.ToLower(bankName)
	isPromptPay := strings.Contains(lowerBank, "promptpay") || strings.Contains(bankName, "พร้อมเพย์")
	is12Digits := strings.Contains(bankName, "ออมสิน") || strings.Contains(bankName, "ธ.ก.ส.") || strings.Contains(lowerBank, "gsb") || strings.Contains(lowerBank, "baac")

	if isPromptPay {
		if len(dStr) != 10 || !strings.HasPrefix(dStr, "0") {
			return nil, model.Validation("INVALID_PROMPTPAY", "หมายเลขโทรศัพท์พร้อมเพย์ต้องเป็นตัวเลข 10 หลักและขึ้นต้นด้วย 0")
		}
	} else if is12Digits {
		if len(dStr) != 12 {
			return nil, model.Validation("INVALID_ACCOUNT_NO", "เลขที่บัญชีธนาคารนี้ต้องเป็นตัวเลข 12 หลัก")
		}
	} else {
		if len(dStr) != 10 {
			return nil, model.Validation("INVALID_ACCOUNT_NO", "เลขที่บัญชีธนาคารต้องเป็นตัวเลข 10 หลัก")
		}
	}
	if len(accountName) < 2 {
		return nil, model.Validation("INVALID_ACCOUNT_NAME", "ชื่อ-นามสกุลผู้รับเงินคืนต้องมีความยาวอย่างน้อย 2 ตัวอักษร")
	}

	var order *model.Order
	err := s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.orders.FindForUpdate(tx, orderID)
		if err != nil {
			return err
		}
		if current.IsCustomer() && found.CustomerID != current.CustomerID {
			return model.ErrForbidden
		}
		// หากลูกค้าเคยกรอกข้อมูลบัญชีไว้ครบถ้วนแล้ว ไม่อนุญาตให้กรอกซ้ำ
		if current.IsCustomer() && found.RefundAccountNo != "" && found.RefundBankName != "" && found.RefundAccountName != "" {
			return model.Validation("REFUND_ALREADY_RECORDED", "ท่านได้บันทึกข้อมูลบัญชีรับเงินคืนไปแล้ว ไม่สามารถบันทึกซ้ำได้")
		}
		found.RefundBankName = bankName
		found.RefundAccountNo = accountNo
		found.RefundAccountName = accountName
		if found.RefundStatus != model.RefundStatusRefunded {
			found.RefundStatus = model.RefundStatusPending
		}
		if err := s.orders.Save(tx, found); err != nil {
			return err
		}
		order = found
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.view(*order)
}

// ConfirmRefund — พนักงานบันทึกว่าคืนเงินลูกค้าแล้ว
func (s *OrderService) ConfirmRefund(orderID int, input RefundConfirmInput, by string) (*OrderView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		note = "คืนเงินลูกค้าไปแล้ว"
	}
	now := time.Now().UTC()

	var order *model.Order
	err := s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.orders.FindForUpdate(tx, orderID)
		if err != nil {
			return err
		}
		found.RefundStatus = model.RefundStatusRefunded
		found.RefundNote = note
		found.RefundedAt = &now
		found.RefundedBy = strings.TrimSpace(by)
		found.Timeline = append(found.Timeline, model.OrderStatusHistory{
			OrderID:     found.OrderID,
			Status:      model.OrderStatusCancelled,
			ChangedDate: now,
			ChangedBy:   strings.TrimSpace(by),
			Note:        "คืนเงินลูกค้าแล้ว: " + note,
		})
		if err := s.orders.Save(tx, found); err != nil {
			return err
		}
		order = found
		return pushCustomerNotification(tx, s.notifications, found.CustomerID,
			model.NotifyRefundCompleted, "ร้านค้าดำเนินการคืนเงินเรียบร้อยแล้ว",
			fmt.Sprintf("%s · ยอดเงิน ฿%.2f ดำเนินการโอนเงินคืนเรียบร้อยแล้ว", model.FormatOrderCode(found.OrderID), found.NetAmount),
			fmt.Sprintf("/orders/%d", found.OrderID))
	})
	if err != nil {
		return nil, err
	}
	return s.view(*order)
}

// NotifyOutOfStock — พนักงานแจ้งลูกค้าว่าสินค้าหมดสต็อก (PENDING_CONFIRM / STOCK_CONFIRMED / PAID → OUT_OF_STOCK)
func (s *OrderService) NotifyOutOfStock(orderID int, input OutOfStockInput, by string) (*OrderView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		note = "สินค้าหมดสต็อกชั่วคราว รอลูกค้าตัดสินใจ"
	}
	estimate := strings.TrimSpace(input.RestockEstimate)
	var restockDate *model.Date
	if input.RestockDate != nil && !input.RestockDate.IsZero() {
		restockDate = input.RestockDate
	}
	if estimate == "" && restockDate != nil {
		estimate = restockDate.String()
	}

	hook := func(tx *gorm.DB, order *model.Order) error {
		order.OutOfStockNote = note
		order.RestockEstimate = estimate
		order.RestockDate = restockDate
		order.CustomerChoice = ""
		body := fmt.Sprintf("%s · %s", model.FormatOrderCode(order.OrderID), note)
		if err := pushBothChannels(tx, s.notifications, model.RoleSales,
			model.NotifyOrderOutOfStock, "แจ้งสินค้าหมดสต็อก / รอลูกค้าตัดสินใจ", body,
			fmt.Sprintf("/admin/orders/%d", order.OrderID)); err != nil {
			return err
		}
		estMsg := ""
		if estimate != "" {
			estMsg = fmt.Sprintf(" (กำหนดการเติมสต็อก: %s)", estimate)
		}
		return pushCustomerNotification(tx, s.notifications, order.CustomerID,
			model.NotifyOrderOutOfStock, "สินค้าในคำสั่งซื้อหมดสต็อกชั่วคราว",
			fmt.Sprintf("%s · ทางร้านได้แจ้งกำหนดการเติมสต็อก%s โปรดเลือกวิธีดำเนินการที่หน้าคำสั่งซื้อ", model.FormatOrderCode(order.OrderID), estMsg),
			fmt.Sprintf("/orders/%d", order.OrderID))
	}
	timelineNote := note
	if estimate != "" {
		timelineNote += fmt.Sprintf(" (คาดว่าจะเติมสต็อก: %s)", estimate)
	}
	return s.advance(orderID, model.OrderStatusOutOfStock, by, timelineNote, hook)
}

// CustomerDecision — ลูกค้า (หรือพนักงานบันทึกแทนลูกค้า) เลือกการตัดสินใจ (รอของ / เปลี่ยนสินค้า / ยกเลิก)
func (s *OrderService) CustomerDecision(orderID int, input CustomerChoiceInput, current Identity) (*OrderView, error) {
	choice := strings.TrimSpace(input.Choice)
	switch choice {
	case "WAIT_RESTOCK":
		hook := func(tx *gorm.DB, order *model.Order) error {
			if current.IsCustomer() && order.CustomerID != current.CustomerID {
				return model.ErrForbidden
			}
			order.CustomerChoice = "WAIT_RESTOCK"
			body := fmt.Sprintf("%s · ลูกค้าเลือกรอสินค้าเติมสต็อก", model.FormatOrderCode(order.OrderID))
			return pushBothChannels(tx, s.notifications, model.RoleSales,
				model.NotifyCustomerDecision, "ลูกค้าเลือก: รอสินค้าเติมสต็อก", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID))
		}
		note := "ลูกค้ายินดีรอสินค้าเติมสต็อก"
		if input.Note != "" {
			note += ": " + strings.TrimSpace(input.Note)
		}
		return s.advance(orderID, model.OrderStatusWaitingRestock, current.Name, note, hook)

	case "CHANGE_PRODUCT":
		hook := func(tx *gorm.DB, order *model.Order) error {
			if current.IsCustomer() && order.CustomerID != current.CustomerID {
				return model.ErrForbidden
			}
			order.CustomerChoice = "CHANGE_PRODUCT"
			order.CancelReason = "ลูกค้าต้องการเปลี่ยนสินค้า (ยกเลิกรายการทั้งหมดเพื่อคืนเงิน)"
			if input.Note != "" {
				order.CancelReason += ": " + strings.TrimSpace(input.Note)
			}
			if order.RefundStatus != model.RefundStatusRefunded {
				order.RefundStatus = model.RefundStatusPending
			}
			if input.RefundBankName != "" {
				order.RefundBankName = strings.TrimSpace(input.RefundBankName)
			}
			if input.RefundAccountNo != "" {
				order.RefundAccountNo = strings.TrimSpace(input.RefundAccountNo)
			}
			if input.RefundAccountName != "" {
				order.RefundAccountName = strings.TrimSpace(input.RefundAccountName)
			}
			body := fmt.Sprintf("%s · ลูกค้าขอเปลี่ยนสินค้า (ยกเลิกคำสั่งซื้อเพื่อดำเนินการคืนเงิน)", model.FormatOrderCode(order.OrderID))
			return pushBothChannels(tx, s.notifications, model.RoleSales,
				model.NotifyCustomerDecision, "ลูกค้าเลือก: ขอเปลี่ยนสินค้า (ยกเลิกเพื่อคืนเงิน)", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID))
		}
		note := "ลูกค้าขอเปลี่ยนสินค้า (ยกเลิกรายการทั้งหมดและเข้าสู่กระบวนการคืนเงิน)"
		if input.Note != "" {
			note += ": " + strings.TrimSpace(input.Note)
		}
		return s.advance(orderID, model.OrderStatusCancelled, current.Name, note, hook)

	case "CANCEL":
		hook := func(tx *gorm.DB, order *model.Order) error {
			if current.IsCustomer() && order.CustomerID != current.CustomerID {
				return model.ErrForbidden
			}
			order.CustomerChoice = "CANCEL"
			order.CancelReason = "ลูกค้ายกเลิกคำสั่งซื้อเนื่องจากสินค้าหมดสต็อก"
			if order.RefundStatus != model.RefundStatusRefunded {
				order.RefundStatus = model.RefundStatusPending
			}
			if input.RefundBankName != "" {
				order.RefundBankName = strings.TrimSpace(input.RefundBankName)
			}
			if input.RefundAccountNo != "" {
				order.RefundAccountNo = strings.TrimSpace(input.RefundAccountNo)
			}
			if input.RefundAccountName != "" {
				order.RefundAccountName = strings.TrimSpace(input.RefundAccountName)
			}
			body := fmt.Sprintf("%s · ลูกค้ายกเลิกคำสั่งซื้อเนื่องจากสินค้าหมด", model.FormatOrderCode(order.OrderID))
			return pushBothChannels(tx, s.notifications, model.RoleSales,
				model.NotifyCustomerDecision, "ลูกค้าเลือก: ขอยกเลิกคำสั่งซื้อ", body,
				fmt.Sprintf("/admin/orders/%d", order.OrderID))
		}
		note := "ลูกค้ายกเลิกคำสั่งซื้อเนื่องจากสินค้าหมดสต็อก"
		if input.Note != "" {
			note += " (" + strings.TrimSpace(input.Note) + ")"
		}
		return s.advance(orderID, model.OrderStatusCancelled, current.Name, note, hook)

	default:
		return nil, model.Validation("INVALID_CHOICE", "กรุณาเลือกระหว่าง รอของ (WAIT_RESTOCK), เปลี่ยนสินค้า (CHANGE_PRODUCT) หรือ ยกเลิก (CANCEL)")
	}
}

// ApproveExchange — พนักงานอนุมัติและเปลี่ยนหนังสือในคำสั่งซื้อ (EXCHANGE_REQUESTED → STOCK_CONFIRMED หรือ PAID)
func (s *OrderService) ApproveExchange(orderID int, input ApproveExchangeInput, by string) (*OrderView, error) {
	if input.ReplacementBookID <= 0 {
		return nil, model.Validation("BOOK_REQUIRED", "กรุณาระบุหนังสือเล่มใหม่ที่จะเปลี่ยน")
	}
	newBook, err := s.books.Find(s.db, input.ReplacementBookID)
	if err != nil {
		return nil, err
	}

	targetStatus := model.OrderStatusStockConfirmed

	hook := func(tx *gorm.DB, order *model.Order) error {
		replaced := false
		for i := range order.Items {
			if input.OldBookID != nil && order.Items[i].BookID == *input.OldBookID {
				order.Items[i].BookID = newBook.BookID
				order.Items[i].UnitPrice = newBook.Price
				order.Items[i].LineTotal = newBook.Price * float64(order.Items[i].Quantity)
				replaced = true
				break
			}
		}
		if !replaced && len(order.Items) > 0 {
			order.Items[0].BookID = newBook.BookID
			order.Items[0].UnitPrice = newBook.Price
			order.Items[0].LineTotal = newBook.Price * float64(order.Items[0].Quantity)
		}

		if err := tx.Where("order_id = ?", order.OrderID).Delete(&model.OrderItem{}).Error; err != nil {
			return err
		}
		for i := range order.Items {
			order.Items[i].OrderID = order.OrderID
		}
		if err := tx.Create(&order.Items).Error; err != nil {
			return err
		}

		order.CalcTotal()
		order.OutOfStockNote = ""
		order.RestockEstimate = ""
		order.CustomerChoice = ""
		order.ReplacementBookID = nil
		order.ReplacementNote = ""

		payment, err := s.payments.FindByOrderForUpdate(tx, orderID)
		if err == nil && payment.Status == model.PaymentStatusSuccess {
			targetStatus = model.OrderStatusPaid
		}
		return nil
	}

	note := "อนุมัติเปลี่ยนสินค้าเป็น " + newBook.Title
	if input.Note != "" {
		note += " (" + strings.TrimSpace(input.Note) + ")"
	}
	return s.advance(orderID, targetStatus, by, note, hook)
}

// ConfirmRestocked — พนักงานยืนยันว่าสินค้าเข้าสต็อกแล้ว (WAITING_RESTOCK → STOCK_CONFIRMED หรือ PAID)
func (s *OrderService) ConfirmRestocked(orderID int, by string) (*OrderView, error) {
	targetStatus := model.OrderStatusStockConfirmed
	hook := func(tx *gorm.DB, order *model.Order) error {
		if err := s.assertStockAvailable(tx, order); err != nil {
			return err
		}
		order.OutOfStockNote = ""
		order.RestockEstimate = ""
		order.CustomerChoice = ""

		payment, err := s.payments.FindByOrderForUpdate(tx, orderID)
		if err == nil && payment.Status == model.PaymentStatusSuccess {
			targetStatus = model.OrderStatusPaid
		}
		return pushCustomerNotification(tx, s.notifications, order.CustomerID,
			model.NotifyStockRestocked, "สินค้าที่คุณรอเข้าสต็อกแล้ว",
			fmt.Sprintf("%s · สินค้าเข้าสต็อกแล้ว ทางร้านกำลังดำเนินการจัดเตรียมสินค้า", model.FormatOrderCode(order.OrderID)),
			fmt.Sprintf("/orders/%d", order.OrderID))
	}
	return s.advance(orderID, targetStatus, by, "สินค้าเติมสต็อกแล้ว ดำเนินการต่อ", hook)
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

		timelineNote := note
		if next == model.OrderStatusCancelled {
			// คืนสิทธิ์การใช้งานโค้ดส่วนลดจากการแลกแต้ม ให้ลูกค้านำไปใช้ซ้ำได้
			if err := s.members.ResetRedemptionUsed(tx, order.OrderID); err != nil {
				return err
			}
			if order.DiscountCode != "" {
				if err := s.members.ResetRedemptionByCode(tx, order.DiscountCode); err != nil {
					return err
				}
				timelineNote += fmt.Sprintf(" (คืนสิทธิ์โค้ดส่วนลด %s ให้ลูกค้าใช้ซ้ำได้)", order.DiscountCode)
			}
		}

		before := len(order.Timeline)
		if err := order.UpdateStatus(next, by, timelineNote, time.Now()); err != nil {
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
	phones := make(map[int]string, len(customers))
	for _, row := range customers {
		names[row.Customer.CustomerID] = row.Person.Name()
		emails[row.Customer.CustomerID] = row.Person.Email
		phones[row.Customer.CustomerID] = row.Person.Phone
	}
	promotions, err := s.promotions.List()
	if err != nil {
		return nil, err
	}
	byPromotion := make(map[int]model.Promotion, len(promotions))
	for _, promotion := range promotions {
		byPromotion[promotion.PromotionID] = promotion
	}

	orderIDs := make([]int, len(orders))
	for i, order := range orders {
		orderIDs[i] = order.OrderID
	}
	var shipments []model.Shipment
	if len(orderIDs) > 0 {
		if err := s.db.Where("order_id IN ?", orderIDs).Find(&shipments).Error; err != nil {
			return nil, err
		}
	}
	carrierNames, err := s.deliveries.CarrierNames()
	if err != nil {
		carrierNames = make(map[int]string)
	}
	shipmentByOrder := make(map[int]OrderShipmentInfo, len(shipments))
	for _, shp := range shipments {
		carrierName := carrierNames[shp.CarrierID]
		if carrierName == "" {
			carrierName = "ไปรษณีย์ไทย"
		}
		shipmentByOrder[shp.OrderID] = OrderShipmentInfo{
			ShipmentID:     shp.ShipmentID,
			TrackingNumber: shp.TrackingNumber,
			Carrier:        carrierName,
			RecipientName:  shp.RecipientName,
			ShippedDate:    shp.ShippedDate,
			Status:         shp.Status,
		}
	}

	for i, order := range orders {
		custName := order.CustomerName
		if custName == "" {
			custName = names[order.CustomerID]
		}
		custPhone := order.CustomerPhone
		if custPhone == "" {
			custPhone = phones[order.CustomerID]
		}
		views[i] = OrderView{
			Order:         order,
			CustomerName:  custName,
			CustomerPhone: custPhone,
			CustomerEmail: emails[order.CustomerID],
			Books:         books,
		}
		if order.PromotionID != nil {
			if promotion, ok := byPromotion[*order.PromotionID]; ok {
				views[i].Promotion = &promotion
			}
		}
		if shp, ok := shipmentByOrder[order.OrderID]; ok {
			views[i].Shipment = &shp
		}
		if order.ReplacementBookID != nil {
			if replBook, ok := books[*order.ReplacementBookID]; ok {
				views[i].ReplacementBookTitle = replBook.Title
			}
		}
	}
	return views, nil
}
