// dto_payment.go — รูปร่าง JSON ของการชำระเงินและรายงานการรับชำระ
//
// แบนชื่อธนาคารกับป้ายไทยเข้ามาเหมือนก้อนอื่น ๆ เพราะหน้าจอแสดงคู่กันเสมอ
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type paymentDTO struct {
	PaymentID    int                 `json:"paymentId"`
	Code         string              `json:"code"`
	OrderID      int                 `json:"orderId"`
	OrderCode    string              `json:"orderCode"`
	BankID       *int                `json:"bankId,omitempty"`
	BankName     string              `json:"bankName,omitempty"`
	Amount       float64             `json:"amount"`
	TransferDate *time.Time          `json:"transferDate,omitempty"`
	SlipImageURL string              `json:"slipImageUrl,omitempty"`
	Status       model.PaymentStatus `json:"status"`
	StatusLabel  string              `json:"statusLabel"`
	VerifiedDate *time.Time          `json:"verifiedDate,omitempty"`
	VerifiedBy   string              `json:"verifiedBy,omitempty"`
	RejectReason string              `json:"rejectReason,omitempty"`
}

type paymentReportDTO struct {
	ReportID      int        `json:"reportId"`
	Code          string     `json:"code"`
	PeriodStart   model.Date `json:"periodStart"`
	PeriodEnd     model.Date `json:"periodEnd"`
	TotalReceived float64    `json:"totalReceived"`
	ItemCount     int        `json:"itemCount"`
	GeneratedDate model.Date `json:"generatedDate"`
	GeneratedBy   string     `json:"generatedBy"`
}

func toPaymentDTO(view service.PaymentView) paymentDTO {
	payment := view.Payment
	return paymentDTO{
		PaymentID:    payment.PaymentID,
		Code:         model.FormatPaymentCode(payment.PaymentID),
		OrderID:      payment.OrderID,
		OrderCode:    model.FormatOrderCode(payment.OrderID),
		BankID:       payment.BankID,
		BankName:     view.BankName,
		Amount:       payment.Amount,
		TransferDate: payment.TransferDate,
		SlipImageURL: payment.SlipImageURL,
		Status:       payment.Status,
		StatusLabel:  payment.Status.Label(),
		VerifiedDate: payment.VerifiedDate,
		VerifiedBy:   payment.VerifiedBy,
		RejectReason: payment.RejectReason,
	}
}

func toPaymentDTOs(views []service.PaymentView) []paymentDTO {
	out := make([]paymentDTO, len(views))
	for i, view := range views {
		out[i] = toPaymentDTO(view)
	}
	return out
}

func toPaymentReportDTO(report model.PaymentReport) paymentReportDTO {
	return paymentReportDTO{
		ReportID:      report.ReportID,
		Code:          model.FormatPaymentReportCode(report.ReportID),
		PeriodStart:   report.PeriodStart,
		PeriodEnd:     report.PeriodEnd,
		TotalReceived: report.TotalReceived,
		ItemCount:     report.ItemCount,
		GeneratedDate: report.GeneratedDate,
		GeneratedBy:   report.GeneratedBy,
	}
}

func toPaymentReportDTOs(reports []model.PaymentReport) []paymentReportDTO {
	out := make([]paymentReportDTO, len(reports))
	for i, report := range reports {
		out[i] = toPaymentReportDTO(report)
	}
	return out
}
