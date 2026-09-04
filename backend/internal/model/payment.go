// payment.go — ตรวจสอบการชำระเงิน
// อ้างอิง class diagram: Sub1-Payment-Verification.md
//
//	Order "1" --> "1" Payment : paid by
//	Payment "*" --> "0..1" Bank : via
//	SalesStaff "1" --> "*" Payment : verifies
//	StoreManager "1" --> "*" PaymentReport : generates · PaymentReport ..> Payment : summarizes
package model

import (
	"fmt"
	"time"
)

// Bank — บัญชีธนาคารที่ร้านเปิดรับโอน (ข้อมูลอ้างอิง อ่านอย่างเดียว)
type Bank struct {
	BankID    int    `gorm:"column:bank_id;primaryKey;autoIncrement" json:"bankId"`
	Name      string `gorm:"column:name;type:varchar(200);not null" json:"name"`
	AccountNo string `gorm:"column:account_no;type:varchar(50);not null" json:"accountNo"`
}

func (Bank) TableName() string { return "bank" }

// Payment — การชำระเงินของคำสั่งซื้อหนึ่งใบ
//
// BankID เป็น pointer เพราะลูกค้าอาจไม่ได้ระบุว่าโอนเข้าบัญชีไหน (0..1 ใน diagram)
// VerifiedDate ว่างจนกว่าฝ่ายขายจะตัดสิน · RejectReason มีเฉพาะใบที่ถูกปฏิเสธ
type Payment struct {
	PaymentID    int           `gorm:"column:payment_id;primaryKey;autoIncrement" json:"paymentId"`
	OrderID      int           `gorm:"column:order_id;not null;uniqueIndex" json:"orderId"`
	BankID       *int          `gorm:"column:bank_id" json:"bankId,omitempty"`
	Amount       float64       `gorm:"column:amount;type:numeric(12,2);not null" json:"amount"`
	TransferDate *time.Time    `gorm:"column:transfer_date;type:timestamptz" json:"transferDate,omitempty"`
	SlipImageURL string        `gorm:"column:slip_image_url;type:text" json:"slipImageUrl,omitempty"`
	Status       PaymentStatus `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	VerifiedDate *time.Time    `gorm:"column:verified_date;type:timestamptz" json:"verifiedDate,omitempty"`
	VerifiedBy   string        `gorm:"column:verified_by;type:varchar(200)" json:"verifiedBy,omitempty"`
	RejectReason string        `gorm:"column:reject_reason;type:text" json:"rejectReason,omitempty"`
}

func (Payment) TableName() string { return "payment" }

// UploadSlip — ลูกค้าแนบหลักฐานการโอน (`+uploadSlip(file)` ใน class diagram)
//
// แนบซ้ำได้ถ้ายังไม่ถูกตัดสิน (แนบผิดไฟล์แล้วส่งใหม่) แต่ใบที่ตรวจผ่านแล้วแตะไม่ได้
func (p *Payment) UploadSlip(slipImageURL string, bankID *int, at time.Time) error {
	if p.Status == PaymentStatusSuccess {
		return ErrPaymentAlreadyVerified
	}
	stamp := at.UTC()
	p.SlipImageURL = slipImageURL
	p.BankID = bankID
	p.TransferDate = &stamp
	p.Status = PaymentStatusVerifying
	p.RejectReason = ""
	return nil
}

// Verify — ฝ่ายขายตรวจสลิปแล้วผ่าน (`+verify()` ใน class diagram)
func (p *Payment) Verify(by string, at time.Time) error {
	if p.Status != PaymentStatusVerifying {
		return ErrPaymentNotVerifiable
	}
	stamp := at.UTC()
	p.Status = PaymentStatusSuccess
	p.VerifiedDate = &stamp
	p.VerifiedBy = by
	p.RejectReason = ""
	return nil
}

// Reject — สลิปไม่ผ่าน ต้องบอกเหตุผล (`+reject(reason)` ใน class diagram)
func (p *Payment) Reject(reason, by string, at time.Time) error {
	if p.Status != PaymentStatusVerifying {
		return ErrPaymentNotVerifiable
	}
	if reason == "" {
		return ErrReasonRequired
	}
	stamp := at.UTC()
	p.Status = PaymentStatusRejected
	p.VerifiedDate = &stamp
	p.VerifiedBy = by
	p.RejectReason = reason
	return nil
}

// PaymentReport — สรุปยอดรับชำระของช่วงเวลาหนึ่ง ที่ผู้จัดการสั่งออก
//
// เก็บผลลัพธ์ไว้เป็นแถว ไม่ได้คำนวณสดทุกครั้ง เพราะเป็น "รายงานที่ออก ณ วันหนึ่ง"
// ตัวเลขจึงต้องคงที่แม้ข้อมูลหลังจากนั้นจะเปลี่ยน (ตรงกับ `+generatedDate` ใน diagram)
type PaymentReport struct {
	ReportID      int     `gorm:"column:report_id;primaryKey;autoIncrement" json:"reportId"`
	PeriodStart   Date    `gorm:"column:period_start;type:date;not null" json:"periodStart"`
	PeriodEnd     Date    `gorm:"column:period_end;type:date;not null" json:"periodEnd"`
	TotalReceived float64 `gorm:"column:total_received;type:numeric(12,2);not null" json:"totalReceived"`
	ItemCount     int     `gorm:"column:item_count;not null" json:"itemCount"`
	GeneratedDate Date    `gorm:"column:generated_date;type:date;not null" json:"generatedDate"`
	GeneratedBy   string  `gorm:"column:generated_by;type:varchar(200);not null" json:"generatedBy"`
}

func (PaymentReport) TableName() string { return "payment_report" }

// FormatPaymentCode / FormatPaymentReportCode — รหัสที่หน้าจอแสดง (PAY-1 · PRP001)
func FormatPaymentCode(paymentID int) string      { return fmt.Sprintf("PAY-%d", paymentID) }
func FormatPaymentReportCode(reportID int) string { return fmt.Sprintf("PRP%03d", reportID) }
