// purchasing_test.go — ทดสอบ state machine และการคำนวณของเอกสารจัดซื้อ
//
// ทดสอบเฉพาะกฎที่อยู่ในชั้น model ล้วน ไม่ต้องมีฐานข้อมูล จึงรัน `go test ./...` ได้ทุกที่
// กฎที่ต้องอ่านหลายตาราง (งบประมาณ, ใบสั่งซื้อคงค้าง, คืนเกินจำนวนที่รับ) อยู่ในชั้น service
// และตรวจด้วย cmd/smoke ที่ยิงผ่าน API จริง
package model

import (
	"testing"
	"time"
)

func TestPRStatusTransitions(t *testing.T) {
	tests := []struct {
		name    string
		from    PRStatus
		action  func(*PurchaseRequisition) error
		want    PRStatus
		wantErr bool
	}{
		{"ร่าง ส่งขออนุมัติได้", PRStatusDraft,
			func(pr *PurchaseRequisition) error { return pr.Submit() }, PRStatusSubmitted, false},
		{"ตีกลับแล้ว แก้เสร็จส่งใหม่ได้", PRStatusRejected,
			func(pr *PurchaseRequisition) error { return pr.Submit() }, PRStatusSubmitted, false},
		{"ส่งไปแล้ว ส่งซ้ำไม่ได้", PRStatusSubmitted,
			func(pr *PurchaseRequisition) error { return pr.Submit() }, PRStatusSubmitted, true},
		{"อนุมัติแล้ว ส่งใหม่ไม่ได้", PRStatusApproved,
			func(pr *PurchaseRequisition) error { return pr.Submit() }, PRStatusApproved, true},

		{"รออนุมัติ อนุมัติได้", PRStatusSubmitted,
			func(pr *PurchaseRequisition) error { return pr.Approve() }, PRStatusApproved, false},
		{"ร่าง อนุมัติไม่ได้", PRStatusDraft,
			func(pr *PurchaseRequisition) error { return pr.Approve() }, PRStatusDraft, true},

		{"รออนุมัติ ตีกลับได้", PRStatusSubmitted,
			func(pr *PurchaseRequisition) error { return pr.Reject("ราคาสูงเกินไป") }, PRStatusRejected, false},
		{"ร่าง ตีกลับไม่ได้", PRStatusDraft,
			func(pr *PurchaseRequisition) error { return pr.Reject("ราคาสูงเกินไป") }, PRStatusDraft, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr := &PurchaseRequisition{Status: tt.from}
			err := tt.action(pr)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, ต้องการ error = %v", err, tt.wantErr)
			}
			if pr.Status != tt.want {
				t.Errorf("สถานะ = %s, ต้องการ %s", pr.Status, tt.want)
			}
		})
	}
}

// U7 ตีกลับต้องมีเหตุผลเสมอ
func TestRejectRequiresReason(t *testing.T) {
	pr := &PurchaseRequisition{Status: PRStatusSubmitted}
	if err := pr.Reject(""); err == nil {
		t.Fatal("ตีกลับโดยไม่ใส่เหตุผลต้องไม่ผ่าน")
	}
	if pr.Status != PRStatusSubmitted {
		t.Errorf("สถานะไม่ควรเปลี่ยนเมื่อตีกลับไม่สำเร็จ ได้ %s", pr.Status)
	}
}

// ส่งใหม่หลังถูกตีกลับต้องล้างเหตุผลเดิมทิ้ง ไม่ให้ค้างบนหน้าจอ
func TestSubmitClearsRejectionReason(t *testing.T) {
	pr := &PurchaseRequisition{Status: PRStatusRejected, RejectionReason: "ราคาสูงเกินไป"}
	if err := pr.Submit(); err != nil {
		t.Fatalf("ส่งใหม่ควรผ่าน: %v", err)
	}
	if pr.RejectionReason != "" {
		t.Errorf("เหตุผลตีกลับควรถูกล้าง ได้ %q", pr.RejectionReason)
	}
}

// U8: ส่งได้เฉพาะใบที่อนุมัติแล้ว และยืนยันได้เฉพาะใบที่ส่งไปแล้ว
func TestOrderSendAndConfirm(t *testing.T) {
	now := time.Now()
	expected := Today().AddDays(7)

	t.Run("ยังไม่อนุมัติ ส่งไม่ได้", func(t *testing.T) {
		po := &PurchaseOrder{Status: POStatusPendingApproval}
		if err := po.Send(now); err == nil {
			t.Fatal("ส่งใบที่ยังไม่อนุมัติต้องไม่ผ่าน")
		}
	})

	t.Run("ส่งแล้วสถานะยังเป็นอนุมัติแล้ว", func(t *testing.T) {
		po := &PurchaseOrder{Status: POStatusApproved}
		if err := po.Send(now); err != nil {
			t.Fatalf("ส่งควรผ่าน: %v", err)
		}
		if po.Status != POStatusApproved {
			t.Errorf("สถานะควรคงเป็น APPROVED ได้ %s", po.Status)
		}
		if po.SentAt == nil {
			t.Error("ต้องบันทึกเวลาที่ส่ง")
		}
	})

	t.Run("ยังไม่ส่ง ยืนยันไม่ได้", func(t *testing.T) {
		po := &PurchaseOrder{Status: POStatusApproved}
		if err := po.Confirm(expected, now); err == nil {
			t.Fatal("ยืนยันก่อนส่งต้องไม่ผ่าน")
		}
	})

	t.Run("ส่งแล้วยืนยันได้ พร้อมเขียนวันที่ส่งมอบ", func(t *testing.T) {
		po := &PurchaseOrder{Status: POStatusApproved}
		if err := po.Send(now); err != nil {
			t.Fatalf("ส่งควรผ่าน: %v", err)
		}
		if err := po.Confirm(expected, now); err != nil {
			t.Fatalf("ยืนยันควรผ่าน: %v", err)
		}
		if po.Status != POStatusConfirmed {
			t.Errorf("สถานะ = %s, ต้องการ CONFIRMED", po.Status)
		}
		if po.ExpectedDeliveryDate.String() != expected.String() {
			t.Errorf("วันที่ส่งมอบ = %s, ต้องการ %s", po.ExpectedDeliveryDate, expected)
		}
	})
}

// SCR-24 Abnormal (U8): ยกเลิกได้จากทุกสถานะที่ยังไม่ปิดเอกสาร ปิดไม่ได้เมื่อใบถึงจุดจบแล้ว
func TestOrderReject(t *testing.T) {
	cancellable := []POStatus{
		POStatusPendingApproval, POStatusApproved, POStatusConfirmed, POStatusReceivedPartial,
	}
	for _, status := range cancellable {
		t.Run(string(status)+" ยกเลิกได้", func(t *testing.T) {
			po := &PurchaseOrder{Status: status}
			if err := po.Reject(); err != nil {
				t.Fatalf("ยกเลิกควรผ่าน: %v", err)
			}
			if po.Status != POStatusCancelled {
				t.Errorf("สถานะ = %s, ต้องการ CANCELLED", po.Status)
			}
		})
	}

	closed := []POStatus{POStatusReceivedFull, POStatusReturned, POStatusCancelled}
	for _, status := range closed {
		t.Run(string(status)+" ยกเลิกไม่ได้", func(t *testing.T) {
			po := &PurchaseOrder{Status: status}
			if err := po.Reject(); err == nil {
				t.Fatal("ยกเลิกใบที่ปิดรายการแล้วต้องไม่ผ่าน")
			}
			if po.Status != status {
				t.Errorf("สถานะไม่ควรเปลี่ยนเมื่อยกเลิกไม่สำเร็จ ได้ %s", po.Status)
			}
		})
	}
}

// U9: รับครบ → RECEIVED_FULL · รับบางส่วน → RECEIVED_PARTIAL (ใบยังเปิดรอรอบถัดไป)
func TestApplyReceipt(t *testing.T) {
	newOrder := func() *PurchaseOrder {
		return &PurchaseOrder{
			Status: POStatusConfirmed,
			Items: []PurchaseOrderItem{
				{BookID: 108, Quantity: 30},
				{BookID: 109, Quantity: 40},
			},
		}
	}

	t.Run("รับบางส่วน", func(t *testing.T) {
		po := newOrder()
		po.ApplyReceipt(&GoodsReceipt{Items: []GoodsReceiptItem{
			{BookID: 108, ReceivedQty: 30},
			{BookID: 109, ReceivedQty: 25},
		}})
		if po.Status != POStatusReceivedPartial {
			t.Errorf("สถานะ = %s, ต้องการ RECEIVED_PARTIAL", po.Status)
		}
		if got := po.ReceivedQty(109); got != 25 {
			t.Errorf("รับแล้วของเล่ม 109 = %d, ต้องการ 25", got)
		}
	})

	t.Run("รับส่วนที่เหลือจนครบ", func(t *testing.T) {
		po := newOrder()
		po.ApplyReceipt(&GoodsReceipt{Items: []GoodsReceiptItem{
			{BookID: 108, ReceivedQty: 30},
			{BookID: 109, ReceivedQty: 25},
		}})
		po.ApplyReceipt(&GoodsReceipt{Items: []GoodsReceiptItem{
			{BookID: 109, ReceivedQty: 15},
		}})
		if po.Status != POStatusReceivedFull {
			t.Errorf("สถานะ = %s, ต้องการ RECEIVED_FULL", po.Status)
		}
		if !po.ReceivedInFull() {
			t.Error("ควรถือว่ารับครบแล้ว")
		}
	})

	t.Run("ยังไม่รับอะไรเลย สถานะไม่เปลี่ยน", func(t *testing.T) {
		po := newOrder()
		po.ApplyReceipt(&GoodsReceipt{Items: []GoodsReceiptItem{{BookID: 108, ReceivedQty: 0}}})
		if po.Status != POStatusConfirmed {
			t.Errorf("สถานะ = %s, ต้องการ CONFIRMED", po.Status)
		}
	})
}

// U9 precondition: รับสินค้าได้เฉพาะใบที่ยืนยันแล้วหรือรับไปบางส่วนแล้ว
func TestCanReceive(t *testing.T) {
	allowed := []POStatus{POStatusConfirmed, POStatusReceivedPartial}
	blocked := []POStatus{
		POStatusPendingApproval, POStatusApproved,
		POStatusReceivedFull, POStatusReturned, POStatusCancelled,
	}

	for _, status := range allowed {
		po := &PurchaseOrder{Status: status}
		if err := po.CanReceive(); err != nil {
			t.Errorf("สถานะ %s ควรรับสินค้าได้: %v", status, err)
		}
	}
	for _, status := range blocked {
		po := &PurchaseOrder{Status: status}
		if err := po.CanReceive(); err == nil {
			t.Errorf("สถานะ %s ไม่ควรรับสินค้าได้", status)
		}
	}
}

// ของที่รับเข้ามาต้องกลายเป็นรายการเคลื่อนไหวสต็อกชนิด RECEIVE_IN ที่อ้างถึงใบรับสินค้า
func TestToStockTransactions(t *testing.T) {
	gr := &GoodsReceipt{
		GRID:         5002,
		ReceivedDate: Today(),
		Items: []GoodsReceiptItem{
			{BookID: 108, ReceivedQty: 30, Condition: ItemConditionNormal},
			{BookID: 109, ReceivedQty: 5, Condition: ItemConditionDamaged},
			{BookID: 110, ReceivedQty: 0, Condition: ItemConditionNormal},
		},
	}

	txns := gr.ToStockTransactions()
	// เล่มที่รับ 0 ไม่ต้องสร้างรายการเคลื่อนไหว
	if len(txns) != 2 {
		t.Fatalf("จำนวนรายการ = %d, ต้องการ 2", len(txns))
	}
	for _, txn := range txns {
		if txn.Type != StockTxnTypeReceiveIn {
			t.Errorf("ชนิด = %s, ต้องการ RECEIVE_IN", txn.Type)
		}
		if txn.ReferenceDoc != "GR-5002" {
			t.Errorf("เอกสารอ้างอิง = %s, ต้องการ GR-5002", txn.ReferenceDoc)
		}
	}
	// ของชำรุดก็เข้าสต็อกก่อน แล้ว U10 ค่อยตัดออกตอนเปิดใบคืน
	if txns[1].QuantityChange != 5 {
		t.Errorf("ของชำรุดควรเข้าสต็อก 5 เล่ม ได้ %d", txns[1].QuantityChange)
	}
}

// U10: ของที่ส่งคืนต้องตัดออกจากสต็อกเป็นค่าติดลบ
func TestReturnToStockTransactions(t *testing.T) {
	entry := &PurchaseReturn{
		ReturnID:   7001,
		ReturnDate: Today(),
		Items: []PurchaseReturnItem{
			{BookID: 112, Quantity: 3, Reason: "ชำรุด"},
		},
	}

	txns := entry.ToStockTransactions()
	if len(txns) != 1 {
		t.Fatalf("จำนวนรายการ = %d, ต้องการ 1", len(txns))
	}
	if txns[0].QuantityChange != -3 {
		t.Errorf("จำนวนที่เปลี่ยน = %d, ต้องการ -3", txns[0].QuantityChange)
	}
	if txns[0].Type != StockTxnTypeReturn {
		t.Errorf("ชนิด = %s, ต้องการ RETURN", txns[0].Type)
	}
	if txns[0].ReferenceDoc != "RT-7001" {
		t.Errorf("เอกสารอ้างอิง = %s, ต้องการ RT-7001", txns[0].ReferenceDoc)
	}
}

func TestReturnStatusTransitions(t *testing.T) {
	t.Run("ส่งต่อผู้จัดการต้องมีเหตุผล", func(t *testing.T) {
		entry := &PurchaseReturn{Status: ReturnStatusTracking}
		if err := entry.Escalate(""); err == nil {
			t.Fatal("ส่งต่อโดยไม่ใส่เหตุผลต้องไม่ผ่าน")
		}
	})

	t.Run("กำลังติดตาม ส่งต่อได้", func(t *testing.T) {
		entry := &PurchaseReturn{Status: ReturnStatusTracking}
		if err := entry.Escalate("ผู้จัดจำหน่ายปฏิเสธ"); err != nil {
			t.Fatalf("ส่งต่อควรผ่าน: %v", err)
		}
		if entry.Status != ReturnStatusEscalated {
			t.Errorf("สถานะ = %s, ต้องการ ESCALATED", entry.Status)
		}
	})

	t.Run("บันทึกชดเชยแล้วปิดรายการ", func(t *testing.T) {
		entry := &PurchaseReturn{Status: ReturnStatusEscalated}
		err := entry.RecordCompensation(CompensationReplacement, "ส่งของทดแทนแล้ว", "สมชาย ใจดี", time.Now())
		if err != nil {
			t.Fatalf("บันทึกชดเชยควรผ่าน: %v", err)
		}
		if entry.Status != ReturnStatusClosed {
			t.Errorf("สถานะ = %s, ต้องการ CLOSED", entry.Status)
		}
		if entry.CompensationAt == nil {
			t.Error("ต้องบันทึกเวลาที่ชดเชย")
		}
	})

	t.Run("ปิดไปแล้วปิดซ้ำไม่ได้", func(t *testing.T) {
		entry := &PurchaseReturn{Status: ReturnStatusClosed}
		if err := entry.RecordCompensation(CompensationCreditNote, "", "สมชาย ใจดี", time.Now()); err == nil {
			t.Fatal("ปิดรายการซ้ำต้องไม่ผ่าน")
		}
	})

	t.Run("รูปแบบการชดเชยที่ไม่รู้จักต้องไม่ผ่าน", func(t *testing.T) {
		entry := &PurchaseReturn{Status: ReturnStatusTracking}
		if err := entry.RecordCompensation("REFUND", "", "สมชาย ใจดี", time.Now()); err == nil {
			t.Fatal("รูปแบบการชดเชยที่ไม่มีในระบบต้องไม่ผ่าน")
		}
	})
}

func TestRecalculateTotal(t *testing.T) {
	po := &PurchaseOrder{Items: []PurchaseOrderItem{
		{BookID: 101, Quantity: 50, UnitPrice: 285},
		{BookID: 102, Quantity: 40, UnitPrice: 240},
	}}
	want := 50*285.0 + 40*240.0
	if got := po.RecalculateTotal(); got != want {
		t.Errorf("ยอดรวม = %.2f, ต้องการ %.2f", got, want)
	}
	if po.TotalAmount != want {
		t.Errorf("TotalAmount = %.2f, ต้องการ %.2f", po.TotalAmount, want)
	}
}

// U3: ใบสั่งซื้อที่ยังไม่ปิดรายการถือว่าคงค้าง ห้ามปิดใช้งานผู้จัดจำหน่าย
func TestPOStatusIsClosed(t *testing.T) {
	closed := []POStatus{POStatusReceivedFull, POStatusReturned, POStatusCancelled}
	open := []POStatus{
		POStatusPendingApproval, POStatusApproved, POStatusConfirmed, POStatusReceivedPartial,
	}

	for _, status := range closed {
		if !status.IsClosed() {
			t.Errorf("%s ควรถือว่าปิดรายการแล้ว", status)
		}
	}
	for _, status := range open {
		if status.IsClosed() {
			t.Errorf("%s ควรถือว่ายังคงค้าง", status)
		}
	}
}
