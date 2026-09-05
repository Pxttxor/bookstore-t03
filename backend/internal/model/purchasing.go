// purchasing.go — ระบบย่อยที่ 2: จัดซื้อจากผู้จัดจำหน่าย (U5–U10)
// อ้างอิง class diagram: Sub2-Purchasing.md
//
// ตารางลูกทั้ง 4 ตาราง (PRItem/POItem/GRItem/ReturnItem) ใช้ PK ผสม (parentId, bookId)
// ตามตาราง schema ในเอกสารที่ส่ง → หนังสือเล่มเดียวซ้ำในเอกสารฉบับเดียวไม่ได้
package model

import "time"

// ── ใบขอสั่งซื้อ (PR) — U6, U7 ──────────────────────────────────────────

type PurchaseRequisition struct {
	PRID        int      `gorm:"column:pr_id;primaryKey" json:"prId"`
	CreatedDate Date     `gorm:"column:created_date;type:date;not null" json:"createdDate"`
	Status      PRStatus `gorm:"column:status;type:varchar(20);not null;index" json:"status"`

	// association: WarehouseStaff "1" --> "*" PurchaseRequisition : creates
	// เก็บชื่อพนักงานตามที่หน้าจอแสดง ส่วน FK ตัวจริงคือ RequestedByID → employee(employee_id)
	RequestedBy   string `gorm:"column:requested_by;type:varchar(200);not null" json:"requestedBy"`
	RequestedByID string `gorm:"column:requested_by_id;type:varchar(20);index" json:"-"`

	// ส่วนขยาย: class diagram ไม่ได้ใส่ supplierId ไว้บน PR แต่ U6 ให้เลือกผู้จัดจำหน่ายก่อนเสมอ
	// (precondition "ผู้จัดจำหน่ายมีสถานะ ACTIVE") และ U7 ต้องใช้ตอนออก PO
	SupplierID int `gorm:"column:supplier_id;not null;index" json:"supplierId"`

	// ส่วนขยาย: U7 ตีกลับต้องมีเหตุผล · อนุมัติเกินงบต้องบันทึกเหตุผล
	RejectionReason string `gorm:"column:rejection_reason;type:text" json:"rejectionReason,omitempty"`
	OverBudgetNote  string `gorm:"column:over_budget_note;type:text" json:"overBudgetNote,omitempty"`

	// composition (◆): PurchaseRequisition "1" *-- "*" PurchaseRequisitionItem : items
	Items []PurchaseRequisitionItem `gorm:"foreignKey:PRID;references:PRID;constraint:OnDelete:CASCADE" json:"items"`
}

func (PurchaseRequisition) TableName() string { return "purchase_requisition" }

type PurchaseRequisitionItem struct {
	PRID      int     `gorm:"column:pr_id;primaryKey" json:"-"`
	BookID    int     `gorm:"column:book_id;primaryKey" json:"bookId"`
	Quantity  int     `gorm:"column:quantity;not null" json:"quantity"`
	UnitPrice float64 `gorm:"column:unit_price;type:numeric(12,2);not null" json:"unitPrice"`
}

func (PurchaseRequisitionItem) TableName() string { return "purchase_requisition_item" }

// Submit — DRAFT → SUBMITTED (U6 postcondition: ใบขอสั่งซื้ออยู่สถานะ "รออนุมัติ")
// ใบที่ถูกตีกลับแก้แล้วส่งใหม่ได้ ตาม SCR-21 ที่เปิดใบ REJECTED ขึ้นมาแก้ต่อได้
func (pr *PurchaseRequisition) Submit() error {
	if pr.Status != PRStatusDraft && pr.Status != PRStatusRejected {
		return Conflict("PR_NOT_SUBMITTABLE",
			"ส่งขออนุมัติไม่ได้: สถานะปัจจุบันคือ "+pr.Status.Label())
	}
	pr.Status = PRStatusSubmitted
	pr.RejectionReason = ""
	return nil
}

// Approve — SUBMITTED → APPROVED (U7)
func (pr *PurchaseRequisition) Approve() error {
	if pr.Status != PRStatusSubmitted {
		return Conflict("PR_NOT_PENDING",
			"อนุมัติไม่ได้: สถานะปัจจุบันคือ "+pr.Status.Label())
	}
	pr.Status = PRStatusApproved
	return nil
}

// Reject — SUBMITTED → REJECTED (U7)
func (pr *PurchaseRequisition) Reject(reason string) error {
	if pr.Status != PRStatusSubmitted {
		return Conflict("PR_NOT_PENDING",
			"ตีกลับไม่ได้: สถานะปัจจุบันคือ "+pr.Status.Label())
	}
	if reason == "" {
		return ErrReasonRequired
	}
	pr.Status = PRStatusRejected
	pr.RejectionReason = reason
	return nil
}

// Editable — SCR-21 เปิดแก้ได้เฉพาะใบร่างและใบที่ถูกตีกลับ
func (pr *PurchaseRequisition) Editable() bool {
	return pr.Status == PRStatusDraft || pr.Status == PRStatusRejected
}

// ── ใบสั่งซื้อ (PO) — U7, U8, U9, U10 ────────────────────────────────────

type PurchaseOrder struct {
	POID                 int      `gorm:"column:po_id;primaryKey" json:"poId"`
	OrderDate            Date     `gorm:"column:order_date;type:date;not null" json:"orderDate"`
	ExpectedDeliveryDate Date     `gorm:"column:expected_delivery_date;type:date;not null" json:"expectedDeliveryDate"`
	Status               POStatus `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	TotalAmount          float64  `gorm:"column:total_amount;type:numeric(12,2);not null" json:"totalAmount"`

	// association: Supplier "1" --> "*" PurchaseOrder : receives
	SupplierID int `gorm:"column:supplier_id;not null;index" json:"supplierId"`
	// association: PurchaseOrder "1" --> "0..1" PurchaseRequisition : based on (nullable)
	PRID *int `gorm:"column:pr_id;index" json:"prId,omitempty"`
	// association: StoreManager "1" --> "*" PurchaseOrder : approves
	ApprovedBy   string `gorm:"column:approved_by;type:varchar(200)" json:"approvedBy,omitempty"`
	ApprovedByID string `gorm:"column:approved_by_id;type:varchar(20);index" json:"-"`

	// ส่วนขยาย: POStatus ไม่มีค่าสำหรับ "รอยืนยัน" — ใบที่ส่งแล้วแต่ยังไม่ยืนยันคือ
	// APPROVED ที่มี SentAt แล้ว frontend คำนวณป้ายเองด้วย poDisplayStatus()
	SentAt      *time.Time `gorm:"column:sent_at;type:timestamptz" json:"sentAt,omitempty"`
	ConfirmedAt *time.Time `gorm:"column:confirmed_at;type:timestamptz" json:"confirmedAt,omitempty"`

	// composition (◆): PurchaseOrder "1" *-- "*" PurchaseOrderItem : items
	Items []PurchaseOrderItem `gorm:"foreignKey:POID;references:POID;constraint:OnDelete:CASCADE" json:"items"`
}

func (PurchaseOrder) TableName() string { return "purchase_order" }

type PurchaseOrderItem struct {
	POID        int     `gorm:"column:po_id;primaryKey" json:"-"`
	BookID      int     `gorm:"column:book_id;primaryKey" json:"bookId"`
	Quantity    int     `gorm:"column:quantity;not null" json:"quantity"`
	UnitPrice   float64 `gorm:"column:unit_price;type:numeric(12,2);not null" json:"unitPrice"`
	ReceivedQty int     `gorm:"column:received_qty;not null;default:0" json:"receivedQty"`
}

func (PurchaseOrderItem) TableName() string { return "purchase_order_item" }

// RecalculateTotal — คำนวณยอดรวมใหม่จากทุกรายการ แล้วเก็บลง TotalAmount
func (po *PurchaseOrder) RecalculateTotal() float64 {
	po.TotalAmount = DocumentTotal(po.Items)
	return po.TotalAmount
}

// Approve — PENDING_APPROVAL → APPROVED (class diagram: +approve())
func (po *PurchaseOrder) Approve() error {
	if po.Status != POStatusPendingApproval {
		return Conflict("PO_NOT_PENDING",
			"อนุมัติไม่ได้: สถานะปัจจุบันคือ "+po.Status.Label())
	}
	po.Status = POStatusApproved
	return nil
}

// Reject — ยกเลิกใบสั่งซื้อ → CANCELLED (class diagram: +reject())
// POStatus ไม่มีค่า REJECTED — ใบสั่งซื้อที่ถูกปฏิเสธ/ยกเลิกถือเป็น CANCELLED
//
// ยกเลิกได้จากทุกสถานะที่เอกสารยังไม่ปิด (PENDING_APPROVAL/APPROVED/CONFIRMED/RECEIVED_PARTIAL)
// ปิดไม่ได้เมื่อใบถึงจุดจบแล้ว (RECEIVED_FULL รับครบ · RETURNED คืนครบ · CANCELLED ยกเลิกไปแล้ว)
//
// SCR-24 Abnormal (U8): ผู้จัดจำหน่ายแจ้งเลิกส่งกลางคัน — ถ้าไม่มีทางออกนี้ ใบที่ค้าง
// RECEIVED_PARTIAL ตลอดไปจะทำให้ OutstandingOrderCount นับเป็นคงค้างถาวร แล้ว U3 ปิดใช้งาน
// ผู้จัดจำหน่ายรายนั้นไม่ได้เลย (ดู README หัวข้อจุดที่ต่างจาก class diagram)
//
// **ไม่คืนสต็อกที่รับเข้ามาแล้ว** — received_qty ที่มีอยู่คือของจริงในคลัง ไม่ใช่ของที่ต้องเคลียร์คืน
func (po *PurchaseOrder) Reject() error {
	switch po.Status {
	case POStatusReceivedFull, POStatusReturned, POStatusCancelled:
		return Conflict("PO_ALREADY_CLOSED",
			"ยกเลิกไม่ได้: ใบสั่งซื้อปิดรายการแล้ว สถานะปัจจุบันคือ "+po.Status.Label())
	}
	po.Status = POStatusCancelled
	return nil
}

// Send — U8: บันทึกว่าส่งใบสั่งซื้อให้ผู้จัดจำหน่ายแล้ว สถานะยังคงเป็น APPROVED
// หน้าจอจะอ่านเป็น "รอยืนยัน" เพราะ SentAt ถูกตั้งค่าแล้ว
func (po *PurchaseOrder) Send(at time.Time) error {
	if po.Status != POStatusApproved {
		return Conflict("PO_NOT_SENDABLE",
			"ส่งใบสั่งซื้อไม่ได้: สถานะปัจจุบันคือ "+po.Status.Label())
	}
	po.SentAt = &at
	return nil
}

// Confirm — APPROVED (ส่งแล้ว) → CONFIRMED พร้อมวันที่ผู้จัดจำหน่ายยืนยัน (U8)
func (po *PurchaseOrder) Confirm(expected Date, at time.Time) error {
	if po.Status != POStatusApproved {
		return Conflict("PO_NOT_CONFIRMABLE",
			"ยืนยันไม่ได้: ต้องอนุมัติก่อน (สถานะปัจจุบันคือ "+po.Status.Label()+")")
	}
	if po.SentAt == nil {
		return ErrOrderNotSent
	}
	po.Status = POStatusConfirmed
	po.ConfirmedAt = &at
	po.ExpectedDeliveryDate = expected
	return nil
}

// CanReceive — U9 precondition: ใบสั่งซื้อต้องยืนยันแล้ว หรือรับไปแล้วบางส่วน
func (po *PurchaseOrder) CanReceive() error {
	if po.Status != POStatusConfirmed && po.Status != POStatusReceivedPartial {
		return Conflict("PO_NOT_RECEIVABLE",
			"รับสินค้าไม่ได้: สถานะปัจจุบันคือ "+po.Status.Label())
	}
	return nil
}

// ApplyReceipt — เพิ่มจำนวนที่รับแล้วของแต่ละรายการจากใบรับสินค้า แล้วปรับสถานะ PO
// รับครบทุกรายการ → RECEIVED_FULL · รับได้บ้าง → RECEIVED_PARTIAL (ใบยังเปิดรอส่งงวดถัดไป)
func (po *PurchaseOrder) ApplyReceipt(gr *GoodsReceipt) {
	for _, received := range gr.Items {
		for i := range po.Items {
			if po.Items[i].BookID == received.BookID {
				po.Items[i].ReceivedQty += received.ReceivedQty
			}
		}
	}
	if po.ReceivedInFull() {
		po.Status = POStatusReceivedFull
		return
	}
	for _, item := range po.Items {
		if item.ReceivedQty > 0 {
			po.Status = POStatusReceivedPartial
			return
		}
	}
}

// ReceivedInFull — ทุกรายการรับครบตามจำนวนที่สั่งแล้วหรือยัง
func (po *PurchaseOrder) ReceivedInFull() bool {
	for _, item := range po.Items {
		if item.ReceivedQty < item.Quantity {
			return false
		}
	}
	return true
}

// OrderedQty — จำนวนที่สั่งของหนังสือเล่มหนึ่ง (0 ถ้าไม่มีในใบสั่งซื้อ)
func (po *PurchaseOrder) OrderedQty(bookID int) int {
	for _, item := range po.Items {
		if item.BookID == bookID {
			return item.Quantity
		}
	}
	return 0
}

// ReceivedQty — จำนวนที่รับเข้าคลังแล้วของหนังสือเล่มหนึ่ง
func (po *PurchaseOrder) ReceivedQty(bookID int) int {
	for _, item := range po.Items {
		if item.BookID == bookID {
			return item.ReceivedQty
		}
	}
	return 0
}

// HasBook — หนังสือเล่มนี้อยู่ในใบสั่งซื้อหรือไม่
func (po *PurchaseOrder) HasBook(bookID int) bool {
	for _, item := range po.Items {
		if item.BookID == bookID {
			return true
		}
	}
	return false
}

// ── ใบรับสินค้าเข้าคลัง (GRN) — U9 ──────────────────────────────────────

type GoodsReceipt struct {
	GRID         int      `gorm:"column:gr_id;primaryKey" json:"grId"`
	POID         int      `gorm:"column:po_id;not null;index" json:"poId"`
	ReceivedDate Date     `gorm:"column:received_date;type:date;not null" json:"receivedDate"`
	Status       GRStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`

	// ส่วนขยาย: SCR-25 บังคับกรอกเลขที่ใบส่งของและผู้รับ
	DeliveryNoteNo string `gorm:"column:delivery_note_no;type:varchar(100);not null" json:"deliveryNoteNo"`
	ReceivedBy     string `gorm:"column:received_by;type:varchar(200);not null" json:"receivedBy"`

	// composition (◆): GoodsReceipt "1" *-- "*" GoodsReceiptItem : items
	Items []GoodsReceiptItem `gorm:"foreignKey:GRID;references:GRID;constraint:OnDelete:CASCADE" json:"items"`
}

func (GoodsReceipt) TableName() string { return "goods_receipt" }

type GoodsReceiptItem struct {
	GRID        int           `gorm:"column:gr_id;primaryKey" json:"-"`
	BookID      int           `gorm:"column:book_id;primaryKey" json:"bookId"`
	OrderedQty  int           `gorm:"column:ordered_qty;not null" json:"orderedQty"`
	ReceivedQty int           `gorm:"column:received_qty;not null" json:"receivedQty"`
	Condition   ItemCondition `gorm:"column:condition;type:varchar(20);not null" json:"condition"`
	Note        string        `gorm:"column:note;type:text" json:"note"`
}

func (GoodsReceiptItem) TableName() string { return "goods_receipt_item" }

// ToStockTransactions — สร้างรายการเคลื่อนไหวสต็อกแบบ RECEIVE_IN จากใบรับสินค้า
//
// dependency ใน class diagram: GoodsReceipt ..> StockTransaction : creates IN
// ผูกกลับหา GRN ผ่านคอลัมน์ referenceDoc ตามที่ตาราง schema ระบุ (ไม่มี FK ตรง เพราะ
// ใบรับหนึ่งใบสร้างรายการเคลื่อนไหวหลายรายการ — หนึ่งรายการต่อหนังสือหนึ่งเล่ม)
//
// ของที่มาถึงจริงเข้าสต็อกทั้งหมด ไม่ว่าสภาพดีหรือชำรุด แล้ว U10 ค่อยตัดออกตอนเปิดใบส่งคืน
func (gr *GoodsReceipt) ToStockTransactions() []StockTransaction {
	txns := make([]StockTransaction, 0, len(gr.Items))
	for _, item := range gr.Items {
		if item.ReceivedQty <= 0 {
			continue
		}
		txns = append(txns, StockTransaction{
			BookID:         item.BookID,
			Type:           StockTxnTypeReceiveIn,
			QuantityChange: item.ReceivedQty,
			Reason:         "รับสินค้าเข้าคลัง",
			ReferenceDoc:   FormatGRCode(gr.GRID),
			TxnDate:        gr.ReceivedDate.Time,
		})
	}
	return txns
}

// ── ใบส่งคืนสินค้า — U10 ────────────────────────────────────────────────

type PurchaseReturn struct {
	ReturnID   int          `gorm:"column:return_id;primaryKey" json:"returnId"`
	POID       int          `gorm:"column:po_id;not null;index" json:"poId"`
	ReturnDate Date         `gorm:"column:return_date;type:date;not null" json:"returnDate"`
	Reason     string       `gorm:"column:reason;type:varchar(200);not null" json:"reason"`
	Status     ReturnStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`

	// ส่วนขยาย: U10 ต้องรู้ผู้เปิดใบ, เหตุผลตอนส่งต่อผู้จัดการ และรายละเอียดการชดเชย
	CreatedBy        string           `gorm:"column:created_by;type:varchar(200);not null" json:"createdBy"`
	EscalationNote   string           `gorm:"column:escalation_note;type:text" json:"escalationNote,omitempty"`
	CompensationType CompensationType `gorm:"column:compensation_type;type:varchar(20)" json:"-"`
	CompensationNote string           `gorm:"column:compensation_note;type:text" json:"-"`
	CompensationBy   string           `gorm:"column:compensation_by;type:varchar(200)" json:"-"`
	CompensationAt   *time.Time       `gorm:"column:compensation_at;type:timestamptz" json:"-"`

	// composition (◆): PurchaseReturn "1" *-- "*" PurchaseReturnItem : items
	Items []PurchaseReturnItem `gorm:"foreignKey:ReturnID;references:ReturnID;constraint:OnDelete:CASCADE" json:"items"`
}

func (PurchaseReturn) TableName() string { return "purchase_return" }

type PurchaseReturnItem struct {
	ReturnID int    `gorm:"column:return_id;primaryKey" json:"-"`
	BookID   int    `gorm:"column:book_id;primaryKey" json:"bookId"`
	Quantity int    `gorm:"column:quantity;not null" json:"quantity"`
	Reason   string `gorm:"column:reason;type:varchar(200);not null" json:"reason"`
	// ส่วนขยาย: SCR-26 แนบหลักฐานเป็นรูป เก็บเป็น data URL เหมือนฝั่ง frontend
	Evidence string `gorm:"column:evidence;type:text" json:"evidence,omitempty"`
}

func (PurchaseReturnItem) TableName() string { return "purchase_return_item" }

// ToStockTransactions — ตัดของที่ส่งคืนออกจากสต็อก (ชนิด RETURN ค่าติดลบ)
func (r *PurchaseReturn) ToStockTransactions() []StockTransaction {
	txns := make([]StockTransaction, 0, len(r.Items))
	for _, item := range r.Items {
		txns = append(txns, StockTransaction{
			BookID:         item.BookID,
			Type:           StockTxnTypeReturn,
			QuantityChange: -item.Quantity,
			Reason:         item.Reason,
			ReferenceDoc:   FormatReturnCode(r.ReturnID),
			TxnDate:        r.ReturnDate.Time,
		})
	}
	return txns
}

// Escalate — TRACKING → ESCALATED (U10 abnormal: ผู้จัดจำหน่ายปฏิเสธการรับคืน)
func (r *PurchaseReturn) Escalate(note string) error {
	if r.Status != ReturnStatusTracking {
		return Conflict("RETURN_NOT_TRACKING",
			"ส่งต่อผู้จัดการไม่ได้: สถานะปัจจุบันคือ "+r.Status.Label())
	}
	if note == "" {
		return ErrReasonRequired
	}
	r.Status = ReturnStatusEscalated
	r.EscalationNote = note
	return nil
}

// RecordCompensation — บันทึกการชดเชยแล้วปิดรายการ (U10 postcondition)
func (r *PurchaseReturn) RecordCompensation(kind CompensationType, note, by string, at time.Time) error {
	if r.Status == ReturnStatusClosed {
		return Conflict("RETURN_ALREADY_CLOSED", "ใบส่งคืนนี้ปิดรายการไปแล้ว")
	}
	if !kind.IsValid() {
		return Validation("INVALID_COMPENSATION_TYPE", "รูปแบบการชดเชยไม่ถูกต้อง")
	}
	r.Status = ReturnStatusClosed
	r.CompensationType = kind
	r.CompensationNote = note
	r.CompensationBy = by
	r.CompensationAt = &at
	return nil
}
