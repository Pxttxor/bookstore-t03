// payment.go — ตรวจสอบการชำระเงิน
//
// การ "ตรวจผ่าน/ปฏิเสธ" ไม่ได้อยู่ที่นี่ แต่อยู่ใน OrderService เพราะเป็นเหตุการณ์เดียวกัน
// กับการเปลี่ยนสถานะคำสั่งซื้อ — แยกเป็นสองปุ่มเมื่อไรก็มีโอกาสที่สองตารางไม่ตรงกัน
// ที่นี่รับผิดชอบการอ่าน บัญชีธนาคาร และรายงานสรุปยอดของผู้จัดการ
package service

import (
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type PaymentService struct {
	db       *gorm.DB
	payments *repository.PaymentRepository
	orders   *repository.OrderRepository
}

// NewPaymentService — รับ OrderRepository เข้ามาด้วยเพราะการอ่านการชำระเงินของคำสั่งซื้อ
// ต้องรู้ว่าใบนั้นเป็นของลูกค้าคนไหน จึงจะกันไม่ให้ลูกค้าเปิดสลิปของคนอื่นได้
func NewPaymentService(
	db *gorm.DB,
	payments *repository.PaymentRepository,
	orders *repository.OrderRepository,
) *PaymentService {
	return &PaymentService{db: db, payments: payments, orders: orders}
}

// ReportPeriodInput — ช่วงวันที่ที่ผู้จัดการสั่งออกรายงาน
type ReportPeriodInput struct {
	PeriodStart model.Date `json:"periodStart"`
	PeriodEnd   model.Date `json:"periodEnd"`
}

// PaymentView — การชำระเงินพร้อมชื่อธนาคารที่หน้าจอต้องแสดง
type PaymentView struct {
	Payment  model.Payment
	BankName string
}

func (s *PaymentService) Banks() ([]model.Bank, error) {
	return s.payments.ListBanks()
}

func (s *PaymentService) List(status model.PaymentStatus) ([]PaymentView, error) {
	if status != "" && !status.IsValid() {
		return nil, model.Validation("INVALID_PAYMENT_STATUS", "สถานะการชำระเงินไม่ถูกต้อง")
	}
	payments, err := s.payments.List(repository.PaymentFilter{Status: status})
	if err != nil {
		return nil, err
	}
	return s.views(payments)
}

// Get — การชำระเงินหนึ่งรายการ (หน้าตรวจสลิปของฝ่ายขาย)
func (s *PaymentService) Get(paymentID int) (*PaymentView, error) {
	payment, err := s.payments.Find(s.db, paymentID)
	if err != nil {
		return nil, err
	}
	return s.single(*payment)
}

// ForOrder — การชำระเงินของคำสั่งซื้อใบหนึ่ง · ลูกค้าเปิดของคนอื่นไม่ได้
// (เช็คเจ้าของแบบเดียวกับ OrderService.Get เพื่อให้สองเส้นทางตอบเหมือนกันเสมอ)
func (s *PaymentService) ForOrder(current Identity, orderID int) (*PaymentView, error) {
	order, err := s.orders.Find(s.db, orderID)
	if err != nil {
		return nil, err
	}
	if current.IsCustomer() && order.CustomerID != current.CustomerID {
		return nil, model.ErrForbidden
	}
	payment, err := s.payments.FindByOrder(s.db, orderID)
	if err != nil {
		return nil, err
	}
	return s.single(*payment)
}

// ── รายงานการรับชำระ ────────────────────────────────────────────────────

func (s *PaymentService) Reports() ([]model.PaymentReport, error) {
	return s.payments.ListReports()
}

// GenerateReport — ออกรายงานสรุปยอดรับชำระของช่วงหนึ่ง (`StoreManager.generates`)
//
// เก็บตัวเลขที่คำนวณได้ลงเป็นแถว ไม่ได้คำนวณสดตอนเปิดดู เพราะรายงานที่ออกไปแล้ว
// ต้องอ่านได้เหมือนเดิมแม้ข้อมูลหลังจากนั้นจะเปลี่ยน
func (s *PaymentService) GenerateReport(input ReportPeriodInput, by string) (*model.PaymentReport, error) {
	if input.PeriodEnd.Before(input.PeriodStart) {
		return nil, model.ErrReportPeriodRange
	}

	total, count, err := s.payments.SummarizeSuccess(input.PeriodStart, input.PeriodEnd)
	if err != nil {
		return nil, err
	}

	report := model.PaymentReport{
		PeriodStart:   input.PeriodStart,
		PeriodEnd:     input.PeriodEnd,
		TotalReceived: total,
		ItemCount:     count,
		GeneratedDate: model.Today(),
		GeneratedBy:   strings.TrimSpace(by),
	}
	if err := s.payments.CreateReport(&report); err != nil {
		return nil, err
	}
	return &report, nil
}

// single — ห่อ Payment เดี่ยวให้เป็น view (เติมชื่อธนาคาร) ผ่านทางเดียวกับรายการ
func (s *PaymentService) single(payment model.Payment) (*PaymentView, error) {
	views, err := s.views([]model.Payment{payment})
	if err != nil {
		return nil, err
	}
	return &views[0], nil
}

func (s *PaymentService) views(payments []model.Payment) ([]PaymentView, error) {
	views := make([]PaymentView, len(payments))
	if len(payments) == 0 {
		return views, nil
	}

	banks, err := s.payments.ListBanks()
	if err != nil {
		return nil, err
	}
	names := make(map[int]string, len(banks))
	for _, bank := range banks {
		names[bank.BankID] = bank.Name
	}

	for i, payment := range payments {
		views[i] = PaymentView{Payment: payment}
		if payment.BankID != nil {
			views[i].BankName = names[*payment.BankID]
		}
	}
	return views, nil
}
