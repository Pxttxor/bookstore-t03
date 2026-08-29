// purchasing.go — ระบบย่อยที่ 2: จัดซื้อจากผู้จัดจำหน่าย (Purchasing, U5–U10)
// อ้างอิง class diagram: Sub2-Purchasing.md
package model

import (
	"fmt"
	"time"
)

// PRStatus — สถานะใบขอสั่งซื้อ (PR)
type PRStatus string

const (
	PRStatusDraft     PRStatus = "DRAFT"     // ร่าง
	PRStatusSubmitted PRStatus = "SUBMITTED" // ส่งขออนุมัติ
	PRStatusApproved  PRStatus = "APPROVED"  // อนุมัติแล้ว
	PRStatusRejected  PRStatus = "REJECTED"  // ปฏิเสธ
)

// IsValid ตรวจว่าค่าสถานะ PR อยู่ในชุดที่กำหนดไว้หรือไม่
func (s PRStatus) IsValid() bool {
	switch s {
	case PRStatusDraft, PRStatusSubmitted, PRStatusApproved, PRStatusRejected:
		return true
	}
	return false
}

// POStatus — สถานะใบสั่งซื้อ (PO)
type POStatus string

const (
	POStatusPendingApproval POStatus = "PENDING_APPROVAL" // รออนุมัติ
	POStatusApproved        POStatus = "APPROVED"         // อนุมัติแล้ว
	POStatusConfirmed       POStatus = "CONFIRMED"        // ผู้จัดจำหน่ายยืนยันแล้ว
	POStatusReceivedPartial POStatus = "RECEIVED_PARTIAL" // รับสินค้าบางส่วน
	POStatusReceivedFull    POStatus = "RECEIVED_FULL"    // รับสินค้าครบแล้ว
	POStatusReturned        POStatus = "RETURNED"         // ส่งคืนแล้ว
	POStatusCancelled       POStatus = "CANCELLED"        // ยกเลิก
)

// IsValid ตรวจว่าค่าสถานะ PO อยู่ในชุดที่กำหนดไว้หรือไม่
func (s POStatus) IsValid() bool {
	switch s {
	case POStatusPendingApproval, POStatusApproved, POStatusConfirmed,
		POStatusReceivedPartial, POStatusReceivedFull, POStatusReturned, POStatusCancelled:
		return true
	}
	return false
}

// PurchaseRequisition — ใบขอสั่งซื้อ (PR)
type PurchaseRequisition struct {
	PRID             int
	CreatedDate      time.Time
	Status           PRStatus
	CreatedByStaffID int                       // WarehouseStaff "1" --> "*" PR (creates)
	Items            []PurchaseRequisitionItem // composition: PR "1" *-- "*" PRItem
}

// PurchaseRequisitionItem — รายการในใบขอสั่งซื้อ
type PurchaseRequisitionItem struct {
	BookID    int // FK ไปยัง Book
	Quantity  int
	UnitPrice float64
}

// Submit — ส่ง PR ขออนุมัติ (DRAFT → SUBMITTED)
func (pr *PurchaseRequisition) Submit() error {
	if pr.Status != PRStatusDraft {
		return fmt.Errorf("ส่งขออนุมัติไม่ได้: สถานะปัจจุบันคือ %s", pr.Status)
	}
	pr.Status = PRStatusSubmitted
	return nil
}

// Approve — อนุมัติ PR
func (pr *PurchaseRequisition) Approve() error {
	if pr.Status != PRStatusSubmitted {
		return fmt.Errorf("อนุมัติไม่ได้: สถานะปัจจุบันคือ %s", pr.Status)
	}
	pr.Status = PRStatusApproved
	return nil
}

// Reject — ปฏิเสธ PR 
func (pr *PurchaseRequisition) Reject() error {
	if pr.Status != PRStatusSubmitted {
		return fmt.Errorf("ปฏิเสธไม่ได้: สถานะปัจจุบันคือ %s", pr.Status)
	}
	pr.Status = PRStatusRejected
	return nil
}

// PurchaseOrder — ใบสั่งซื้อ (PO)
type PurchaseOrder struct {
	POID                 int
	OrderDate            time.Time
	ExpectedDeliveryDate time.Time
	Status               POStatus
	TotalAmount          float64
	SupplierID           int                 // Supplier "1" --> "*" PO (receives)
	RequisitionID        int                 // PO "1" --> "0..1" PR (based on); 0 = ไม่ได้อ้างอิง PR
	ApprovedByManagerID  int                 // StoreManager "1" --> "*" PO (approves)
	Items                []PurchaseOrderItem // composition: PO "1" *-- "*" POItem
}

// PurchaseOrderItem — รายการในใบสั่งซื้อ
type PurchaseOrderItem struct {
	BookID      int // FK ไปยัง Book
	Quantity    int
	UnitPrice   float64
	ReceivedQty int // จำนวนที่รับเข้าคลังแล้ว
}

// RecalculateTotal — คำนวณยอดรวมจากทุกรายการใหม่ แล้วเก็บลง TotalAmount
func (po *PurchaseOrder) RecalculateTotal() float64 {
	var total float64
	for _, it := range po.Items {
		total += float64(it.Quantity) * it.UnitPrice
	}
	po.TotalAmount = total
	return total
}

// Approve — อนุมัติใบสั่งซื้อ (PENDING_APPROVAL → APPROVED)
func (po *PurchaseOrder) Approve() error {
	if po.Status != POStatusPendingApproval {
		return fmt.Errorf("อนุมัติไม่ได้: สถานะปัจจุบันคือ %s", po.Status)
	}
	po.Status = POStatusApproved
	return nil
}

// Reject — ปฏิเสธใบสั่งซื้อ (PENDING_APPROVAL → CANCELLED)
// หมายเหตุ: POStatus ไม่มีค่า REJECTED — ใบสั่งซื้อที่ถูกปฏิเสธถือเป็น CANCELLED
func (po *PurchaseOrder) Reject() error {
	if po.Status != POStatusPendingApproval {
		return fmt.Errorf("ปฏิเสธไม่ได้: สถานะปัจจุบันคือ %s", po.Status)
	}
	po.Status = POStatusCancelled
	return nil
}

// Confirm — บันทึกว่าผู้จัดจำหน่ายยืนยันคำสั่งซื้อแล้ว (APPROVED → CONFIRMED)
func (po *PurchaseOrder) Confirm() error {
	if po.Status != POStatusApproved {
		return fmt.Errorf("ยืนยันไม่ได้: ต้องอนุมัติก่อน (สถานะปัจจุบันคือ %s)", po.Status)
	}
	po.Status = POStatusConfirmed
	return nil
}

// ApplyReceipt — อัปเดตจำนวนที่รับแล้วของแต่ละรายการจากใบรับสินค้า แล้วปรับสถานะ PO
// (รับครบ → RECEIVED_FULL, รับบางส่วน → RECEIVED_PARTIAL)
func (po *PurchaseOrder) ApplyReceipt(gr *GoodsReceipt) {
	for _, ri := range gr.Items {
		for i := range po.Items {
			if po.Items[i].BookID == ri.BookID {
				po.Items[i].ReceivedQty += ri.ReceivedQty
			}
		}
	}
	full, any := true, false
	for _, it := range po.Items {
		if it.ReceivedQty > 0 {
			any = true
		}
		if it.ReceivedQty < it.Quantity {
			full = false
		}
	}
	switch {
	case full:
		po.Status = POStatusReceivedFull
	case any:
		po.Status = POStatusReceivedPartial
	}
}

// GoodsReceipt — ใบรับสินค้าเข้าคลัง (GRN)
type GoodsReceipt struct {
	GRID         int
	POID         int // PO "1" --> "*" GoodsReceipt (received via)
	ReceivedDate time.Time
	Status       string
	Items        []GoodsReceiptItem // composition: GoodsReceipt "1" *-- "*" GoodsReceiptItem
}

// GoodsReceiptItem — รายการรับสินค้า
type GoodsReceiptItem struct {
	BookID      int // FK ไปยัง Book
	OrderedQty  int
	ReceivedQty int
	Condition   string // สภาพสินค้าที่รับ เช่น "ดี", "ชำรุด"
}

// ToStockTransactions — สร้างรายการเคลื่อนไหวสต็อกแบบ RECEIVE_IN จากใบรับสินค้า
// dependency ใน diagram: GoodsReceipt ..> StockTransaction (creates IN)
func (gr *GoodsReceipt) ToStockTransactions() []StockTransaction {
	txns := make([]StockTransaction, 0, len(gr.Items))
	for _, it := range gr.Items {
		txns = append(txns, StockTransaction{
			Type:           StockTxnTypeReceiveIn,
			QuantityChange: it.ReceivedQty,
			Reason:         "รับสินค้าเข้าคลังตามใบรับสินค้า",
			ReferenceDoc:   fmt.Sprintf("GR-%d", gr.GRID),
			TxnDate:        gr.ReceivedDate,
		})
	}
	return txns
}

// PurchaseReturn — ใบส่งคืนสินค้า
type PurchaseReturn struct {
	ReturnID   int
	POID       int // PO "1" --> "*" PurchaseReturn (returns)
	ReturnDate time.Time
	Reason     string
	Status     string
	Items      []PurchaseReturnItem // composition: PurchaseReturn "1" *-- "*" PurchaseReturnItem
}

// PurchaseReturnItem — รายการส่งคืน
type PurchaseReturnItem struct {
	BookID   int // FK ไปยัง Book
	Quantity int
	Reason   string
}
