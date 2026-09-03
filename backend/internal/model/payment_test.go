package model

import (
	"testing"
	"time"
)

func samplePayment() Payment {
	return Payment{PaymentID: 1, OrderID: 1001, Amount: 1359, Status: PaymentStatusWaiting}
}

var paymentAt = time.Date(2026, 8, 30, 6, 0, 0, 0, time.UTC)

func TestPaymentUploadSlip(t *testing.T) {
	payment := samplePayment()
	bankID := 2

	if err := payment.UploadSlip("slip-1001.jpg", &bankID, paymentAt); err != nil {
		t.Fatalf("แนบสลิปครั้งแรกต้องผ่าน ได้ %v", err)
	}
	if payment.Status != PaymentStatusVerifying {
		t.Errorf("สถานะ = %s ต้องการ VERIFYING", payment.Status)
	}
	if payment.SlipImageURL != "slip-1001.jpg" || payment.BankID == nil || *payment.BankID != 2 {
		t.Errorf("ไม่ได้เก็บสลิป/ธนาคารที่ส่งมา: %+v", payment)
	}
	if payment.TransferDate == nil || !payment.TransferDate.Equal(paymentAt) {
		t.Errorf("วันที่โอน = %v ต้องการ %v", payment.TransferDate, paymentAt)
	}
}

// แนบผิดไฟล์แล้วส่งใหม่ได้ ตราบใดที่ยังไม่ถูกตัดสิน · เหตุผลที่เคยถูกปฏิเสธต้องถูกล้าง
func TestPaymentUploadSlipAgainAfterReject(t *testing.T) {
	payment := samplePayment()
	if err := payment.UploadSlip("slip-wrong.jpg", nil, paymentAt); err != nil {
		t.Fatalf("แนบสลิปไม่ผ่าน: %v", err)
	}
	if err := payment.Reject("ยอดเงินในสลิปไม่ตรง", "ฝ่ายขาย", paymentAt); err != nil {
		t.Fatalf("ปฏิเสธไม่ผ่าน: %v", err)
	}

	if err := payment.UploadSlip("slip-right.jpg", nil, paymentAt); err != nil {
		t.Fatalf("แนบสลิปใหม่หลังถูกปฏิเสธต้องทำได้ ได้ %v", err)
	}
	if payment.Status != PaymentStatusVerifying {
		t.Errorf("สถานะ = %s ต้องการ VERIFYING", payment.Status)
	}
	if payment.RejectReason != "" {
		t.Errorf("เหตุผลที่เคยถูกปฏิเสธต้องถูกล้าง ได้ %q", payment.RejectReason)
	}
}

func TestPaymentUploadSlipBlockedAfterSuccess(t *testing.T) {
	payment := samplePayment()
	_ = payment.UploadSlip("slip-1001.jpg", nil, paymentAt)
	_ = payment.Verify("ฝ่ายขาย", paymentAt)

	if err := payment.UploadSlip("slip-again.jpg", nil, paymentAt); err != ErrPaymentAlreadyVerified {
		t.Errorf("แนบทับใบที่ตรวจผ่านแล้วต้องถูกปฏิเสธ ได้ %v", err)
	}
}

func TestPaymentVerify(t *testing.T) {
	payment := samplePayment()

	// ยังไม่แนบสลิป ตรวจไม่ได้
	if err := payment.Verify("ฝ่ายขาย", paymentAt); err != ErrPaymentNotVerifiable {
		t.Errorf("ตรวจใบที่ยังไม่แนบสลิปต้องถูกปฏิเสธ ได้ %v", err)
	}

	_ = payment.UploadSlip("slip-1001.jpg", nil, paymentAt)
	if err := payment.Verify("ณัฐวุฒิ แสงจันทร์", paymentAt); err != nil {
		t.Fatalf("ตรวจผ่านไม่สำเร็จ: %v", err)
	}
	if payment.Status != PaymentStatusSuccess {
		t.Errorf("สถานะ = %s ต้องการ SUCCESS", payment.Status)
	}
	if payment.VerifiedBy != "ณัฐวุฒิ แสงจันทร์" || payment.VerifiedDate == nil {
		t.Errorf("ไม่ได้บันทึกผู้ตรวจ/เวลาที่ตรวจ: %+v", payment)
	}

	// ตรวจซ้ำใบเดิมไม่ได้
	if err := payment.Verify("ฝ่ายขาย", paymentAt); err != ErrPaymentNotVerifiable {
		t.Errorf("ตรวจซ้ำต้องถูกปฏิเสธ ได้ %v", err)
	}
}

func TestPaymentReject(t *testing.T) {
	payment := samplePayment()
	_ = payment.UploadSlip("slip-1001.jpg", nil, paymentAt)

	if err := payment.Reject("", "ฝ่ายขาย", paymentAt); err != ErrReasonRequired {
		t.Errorf("ปฏิเสธโดยไม่บอกเหตุผลต้องถูกปฏิเสธ ได้ %v", err)
	}
	if payment.Status != PaymentStatusVerifying {
		t.Errorf("ปฏิเสธไม่สำเร็จต้องไม่เปลี่ยนสถานะ ได้ %s", payment.Status)
	}

	if err := payment.Reject("ยอดเงินในสลิปไม่ตรง", "ฝ่ายขาย", paymentAt); err != nil {
		t.Fatalf("ปฏิเสธไม่สำเร็จ: %v", err)
	}
	if payment.Status != PaymentStatusRejected || payment.RejectReason != "ยอดเงินในสลิปไม่ตรง" {
		t.Errorf("สถานะ/เหตุผลไม่ถูก: %+v", payment)
	}
}

// ป้ายไทยต้องครบทุกค่าและตรงกับค่าที่ frontend แสดง
func TestPaymentStatusLabels(t *testing.T) {
	want := map[PaymentStatus]string{
		PaymentStatusWaiting:   "รอชำระเงิน",
		PaymentStatusVerifying: "รอตรวจสอบ",
		PaymentStatusSuccess:   "ชำระเงินสำเร็จ",
		PaymentStatusRejected:  "ปฏิเสธการชำระเงิน",
	}
	for status, label := range want {
		if !status.IsValid() {
			t.Errorf("%s ต้องเป็นค่าที่ถูกต้อง", status)
		}
		if got := status.Label(); got != label {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", status, got, label)
		}
	}
	if PaymentStatus("PENDING").IsValid() {
		t.Error("ค่านอกชุดต้องไม่ผ่าน IsValid")
	}
}

func TestFormatPaymentCodes(t *testing.T) {
	if got := FormatPaymentCode(7); got != "PAY-7" {
		t.Errorf("รหัสการชำระเงิน = %q ต้องการ PAY-7", got)
	}
	if got := FormatPaymentReportCode(7); got != "PRP007" {
		t.Errorf("รหัสรายงาน = %q ต้องการ PRP007", got)
	}
}
