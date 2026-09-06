// payment.go — การชำระเงิน บัญชีธนาคาร และรายงานการรับชำระ
package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type PaymentRepository struct{ db *gorm.DB }

func NewPaymentRepository(db *gorm.DB) *PaymentRepository {
	return &PaymentRepository{db: db}
}

// PaymentFilter — ตัวกรองของหน้ารายการรับชำระเงิน
type PaymentFilter struct {
	Status model.PaymentStatus
}

func (r *PaymentRepository) List(filter PaymentFilter) ([]model.Payment, error) {
	query := r.db.Model(&model.Payment{}).Order("payment_id DESC")
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	var payments []model.Payment
	err := query.Find(&payments).Error
	return payments, err
}

func (r *PaymentRepository) Find(db *gorm.DB, paymentID int) (*model.Payment, error) {
	var payment model.Payment
	err := db.First(&payment, "payment_id = ?", paymentID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrPaymentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

// FindByOrder — การชำระเงินของคำสั่งซื้อใบหนึ่ง (1 ต่อ 1 ตาม class diagram)
func (r *PaymentRepository) FindByOrder(db *gorm.DB, orderID int) (*model.Payment, error) {
	var payment model.Payment
	err := db.First(&payment, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrPaymentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

// FindByOrderForUpdate — อ่านพร้อมล็อกแถว ใช้ตอนฝ่ายขายตัดสินสลิป
func (r *PaymentRepository) FindByOrderForUpdate(tx *gorm.DB, orderID int) (*model.Payment, error) {
	var payment model.Payment
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&payment, "order_id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrPaymentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *PaymentRepository) Create(tx *gorm.DB, payment *model.Payment) error {
	return tx.Create(payment).Error
}

func (r *PaymentRepository) Save(tx *gorm.DB, payment *model.Payment) error {
	return tx.Model(&model.Payment{}).
		Where("payment_id = ?", payment.PaymentID).
		Updates(map[string]any{
			"bank_id":        payment.BankID,
			"amount":         payment.Amount,
			"transfer_date":  payment.TransferDate,
			"slip_image_url": payment.SlipImageURL,
			"status":         payment.Status,
			"verified_date":  payment.VerifiedDate,
			"verified_by":    payment.VerifiedBy,
			"reject_reason":  payment.RejectReason,
		}).Error
}

// PaymentsByOrder — แผนที่ orderId → Payment ใช้เติมสถานะการชำระเงินลงรายการคำสั่งซื้อ
func (r *PaymentRepository) PaymentsByOrder() (map[int]model.Payment, error) {
	payments, err := r.List(PaymentFilter{})
	if err != nil {
		return nil, err
	}
	index := make(map[int]model.Payment, len(payments))
	for _, payment := range payments {
		index[payment.OrderID] = payment
	}
	return index, nil
}

// ── บัญชีธนาคาร ─────────────────────────────────────────────────────────

func (r *PaymentRepository) ListBanks() ([]model.Bank, error) {
	var banks []model.Bank
	err := r.db.Order("bank_id").Find(&banks).Error
	return banks, err
}

func (r *PaymentRepository) BankExists(db *gorm.DB, bankID int) (bool, error) {
	var count int64
	err := db.Model(&model.Bank{}).Where("bank_id = ?", bankID).Count(&count).Error
	return count > 0, err
}

// ── รายงานการรับชำระ ────────────────────────────────────────────────────

// SummarizeSuccess — ยอดรวมและจำนวนใบของการชำระเงินที่ผ่านแล้วในช่วงวันที่กำหนด
//
// นับจาก verified_date เพราะรายงานตอบคำถามว่า "รอบนี้ร้านรับเงินเข้ามาเท่าไร"
// ไม่ใช่ "ลูกค้ากดโอนวันไหน" · ปลายทางรวมทั้งวัน จึงเทียบด้วย < วันถัดไป
func (r *PaymentRepository) SummarizeSuccess(start, end model.Date) (float64, int, error) {
	var summary struct {
		Total float64
		Count int
	}
	err := r.db.Table("payment").
		Select("COALESCE(SUM(payment.amount), 0) AS total, COUNT(*) AS count").
		Joins("JOIN customer_order ON customer_order.order_id = payment.order_id").
		Where("payment.status = ?", model.PaymentStatusSuccess).
		Where("customer_order.status NOT IN (?, ?)", model.OrderStatusCancelled, model.OrderStatusRejected).
		Where("payment.verified_date >= ? AND payment.verified_date < ?", start.Time, end.AddDays(1).Time).
		Scan(&summary).Error
	return summary.Total, summary.Count, err
}

func (r *PaymentRepository) ListReports() ([]model.PaymentReport, error) {
	var reports []model.PaymentReport
	err := r.db.Order("report_id DESC").Find(&reports).Error
	return reports, err
}

func (r *PaymentRepository) CreateReport(report *model.PaymentReport) error {
	return r.db.Create(report).Error
}
