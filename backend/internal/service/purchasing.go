// purchasing.go — กฎทางธุรกิจของระบบย่อยจัดซื้อ (U5–U10)
//
// สี่ขั้นตอนที่แตะหลายตารางพร้อมกันถูกครอบด้วยทรานแซกชันเดียว และล็อกแถวเอกสารด้วย
// SELECT ... FOR UPDATE กันการยิงซ้อน (เช่นกดรับสินค้าสองครั้งพร้อมกัน):
//
//	U7  อนุมัติ PR → อัปเดต PR + ออก PO + แจ้งเตือน
//	U9  รับสินค้า  → ออก GRN + เพิ่มจำนวนที่รับ + ปรับสถานะ PO + เคลื่อนไหวสต็อก + แจ้งเตือน
//	U10 เปิดใบคืน  → ออกใบคืน + ตัดสต็อก + ปิด PO ถ้าคืนครบ
//	U10 ชดเชย      → ปิดใบคืน + เพิ่มสต็อกคืนถ้าเป็นสินค้าทดแทน
package service

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

// DefaultLeadDays — ระยะเวลาส่งมอบตั้งต้นตอนออก PO
// U8 จะเขียนทับด้วยวันที่ผู้จัดจำหน่ายยืนยันจริง
const DefaultLeadDays = 14

type PurchasingService struct {
	db            *gorm.DB
	purchasing    *repository.PurchasingRepository
	suppliers     *repository.SupplierRepository
	inventory     *repository.InventoryRepository
	notifications *repository.NotificationRepository
}

func NewPurchasingService(
	db *gorm.DB,
	purchasing *repository.PurchasingRepository,
	suppliers *repository.SupplierRepository,
	inventory *repository.InventoryRepository,
	notifications *repository.NotificationRepository,
) *PurchasingService {
	return &PurchasingService{
		db: db, purchasing: purchasing, suppliers: suppliers,
		inventory: inventory, notifications: notifications,
	}
}

// ── DTO ที่หน้าจอส่งเข้ามา ───────────────────────────────────────────────

type RequisitionLineInput struct {
	BookID    int     `json:"bookId"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unitPrice"`
}

// RequisitionInput — ฟอร์ม SCR-21 · Submit = true คือกดส่งขออนุมัติเลย ไม่ใช่แค่บันทึกร่าง
type RequisitionInput struct {
	SupplierID int                    `json:"supplierId"`
	Items      []RequisitionLineInput `json:"items"`
	Submit     bool                   `json:"submit"`
}

type ApproveInput struct {
	OverBudgetNote string `json:"overBudgetNote"`
}

type RejectInput struct {
	Reason string `json:"reason"`
}

type ConfirmInput struct {
	ExpectedDeliveryDate string `json:"expectedDeliveryDate"`
}

type ReceiptLineInput struct {
	BookID      int    `json:"bookId"`
	ReceivedQty int    `json:"receivedQty"`
	Condition   string `json:"condition"`
	Note        string `json:"note"`
}

// ReceiptInput — ฟอร์ม SCR-25
type ReceiptInput struct {
	DeliveryNoteNo string             `json:"deliveryNoteNo"`
	Lines          []ReceiptLineInput `json:"lines"`
}

type ReturnLineInput struct {
	BookID   int    `json:"bookId"`
	Quantity int    `json:"quantity"`
	Reason   string `json:"reason"`
	Evidence string `json:"evidence"`
}

// ReturnInput — ฟอร์ม SCR-26
type ReturnInput struct {
	Reason string            `json:"reason"`
	Items  []ReturnLineInput `json:"items"`
}

type EscalateInput struct {
	Note string `json:"note"`
}

type CompensationInput struct {
	Type string `json:"type"`
	Note string `json:"note"`
}

// BudgetSummary — แถบงบประมาณบน SCR-23
type BudgetSummary struct {
	Budget    float64 `json:"budget"`
	Committed float64 `json:"committed"`
	Remaining float64 `json:"remaining"`
}

// ── U5 แจ้งเตือนสินค้าถึงจุดสั่งซื้อ ─────────────────────────────────────

// ReorderAlert — หนึ่งบรรทัดบน SCR-20
type ReorderAlert struct {
	BookID         int     `json:"bookId"`
	Title          string  `json:"title"`
	ISBN           string  `json:"isbn"`
	QuantityOnHand int     `json:"quantityOnHand"`
	ReorderPoint   *int    `json:"reorderPoint,omitempty"`
	SupplierID     int     `json:"supplierId,omitempty"`
	SupplierName   string  `json:"supplierName,omitempty"`
	SupplyPrice    float64 `json:"supplyPrice,omitempty"`
	LeadTimeDays   int     `json:"leadTimeDays,omitempty"`
	// Unconfigured = ยังไม่ได้ตั้งจุดสั่งซื้อ หน้าจอติดป้าย ⚠ และระบบข้ามการตรวจ
	Unconfigured bool `json:"unconfigured"`
}

// ReorderAlerts — รายการที่ถึงจุดสั่งซื้อ พร้อมรายการที่ยังไม่ได้ตั้งค่า
//
// SCR-20 Abnormal (U5): รายการที่ยังไม่ตั้งจุดสั่งซื้อไม่นับว่าต่ำ แต่ยังต้องแสดงให้ไปตั้งค่า
// จึงคืนมาด้วยพร้อมธง Unconfigured แทนที่จะกรองทิ้ง
func (s *PurchasingService) ReorderAlerts() ([]ReorderAlert, error) {
	items, err := s.inventory.ListInventory()
	if err != nil {
		return nil, err
	}
	books, err := s.inventory.BooksByID()
	if err != nil {
		return nil, err
	}
	suppliers, err := s.suppliers.List(repository.SupplierFilter{Status: model.SupplierStatusActive})
	if err != nil {
		return nil, err
	}

	alerts := make([]ReorderAlert, 0)
	for _, item := range items {
		unconfigured := item.ReorderPoint == nil
		if !unconfigured && !item.IsBelowReorder() {
			continue
		}

		book := books[item.BookID]
		alert := ReorderAlert{
			BookID:         item.BookID,
			Title:          book.Title,
			ISBN:           book.ISBN,
			QuantityOnHand: item.QuantityOnHand,
			ReorderPoint:   item.ReorderPoint,
			Unconfigured:   unconfigured,
		}
		// เติมผู้จัดจำหน่ายที่ยังใช้งานอยู่รายแรกที่เสนอขายเล่มนี้ ให้กดสร้าง PR ต่อได้ทันที
		for _, supplier := range suppliers {
			if offer, ok := supplier.Offers(item.BookID); ok {
				alert.SupplierID = supplier.SupplierID
				alert.SupplierName = supplier.CompanyName
				alert.SupplyPrice = offer.SupplyPrice
				alert.LeadTimeDays = offer.LeadTimeDays
				break
			}
		}
		alerts = append(alerts, alert)
	}
	return alerts, nil
}

// SetReorderPoint — ลิงก์ "ตั้งค่าจุดสั่งซื้อ" บน SCR-20
func (s *PurchasingService) SetReorderPoint(bookID int, reorderPoint *int) (*model.InventoryItem, error) {
	if reorderPoint != nil && *reorderPoint < 0 {
		return nil, model.Validation("INVALID_REORDER_POINT", "จุดสั่งซื้อต้องไม่ติดลบ")
	}
	return s.inventory.SetReorderPoint(bookID, reorderPoint)
}

// ── U6 จัดทำใบขอสั่งซื้อ ────────────────────────────────────────────────

func (s *PurchasingService) ListRequisitions(filter repository.RequisitionFilter) ([]model.PurchaseRequisition, error) {
	return s.purchasing.ListRequisitions(filter)
}

func (s *PurchasingService) GetRequisition(prID int) (*model.PurchaseRequisition, error) {
	return s.purchasing.FindRequisition(prID)
}

// CreateRequisition — บันทึกร่างหรือส่งขออนุมัติในคำสั่งเดียว
// (frontend รวมสองอย่างไว้ที่ saveDraft/submitRequisition ซึ่งเขียนทีเดียวเหมือนกัน)
func (s *PurchasingService) CreateRequisition(input RequisitionInput, by Identity) (*model.PurchaseRequisition, error) {
	if err := s.validateRequisition(input); err != nil {
		return nil, err
	}

	requisition := &model.PurchaseRequisition{
		SupplierID:    input.SupplierID,
		CreatedDate:   model.Today(),
		Status:        model.PRStatusDraft,
		RequestedBy:   by.Name,
		RequestedByID: by.EmployeeID,
		Items:         toRequisitionItems(input.Items),
	}
	if input.Submit {
		if err := requisition.Submit(); err != nil {
			return nil, err
		}
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.purchasing.CreateRequisition(tx, requisition); err != nil {
			return err
		}
		if requisition.Status != model.PRStatusSubmitted {
			return nil
		}
		return s.notifySubmitted(tx, requisition)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindRequisition(requisition.PRID)
}

// UpdateRequisition — แก้ใบร่างหรือใบที่ถูกตีกลับ แล้วบันทึกหรือส่งขออนุมัติใหม่
func (s *PurchasingService) UpdateRequisition(prID int, input RequisitionInput, by Identity) (*model.PurchaseRequisition, error) {
	if err := s.validateRequisition(input); err != nil {
		return nil, err
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		requisition, err := s.purchasing.LockRequisition(tx, prID)
		if err != nil {
			return err
		}
		if !requisition.Editable() {
			return model.Conflict("PR_NOT_EDITABLE",
				"แก้ไขไม่ได้: สถานะปัจจุบันคือ "+requisition.Status.Label())
		}

		requisition.SupplierID = input.SupplierID
		requisition.Items = toRequisitionItems(input.Items)
		requisition.RequestedBy = by.Name
		requisition.RequestedByID = by.EmployeeID
		if input.Submit {
			if err := requisition.Submit(); err != nil {
				return err
			}
		}

		if err := s.purchasing.ReplaceRequisitionItems(tx, requisition); err != nil {
			return err
		}
		if err := s.purchasing.SaveRequisition(tx, requisition); err != nil {
			return err
		}
		if !input.Submit {
			return nil
		}
		return s.notifySubmitted(tx, requisition)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindRequisition(prID)
}

// SubmitRequisition — ส่งใบร่างที่บันทึกไว้แล้วขออนุมัติ (U6 postcondition)
func (s *PurchasingService) SubmitRequisition(prID int) (*model.PurchaseRequisition, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		requisition, err := s.purchasing.LockRequisition(tx, prID)
		if err != nil {
			return err
		}
		if err := s.assertSupplierActive(requisition.SupplierID); err != nil {
			return err
		}
		if err := requisition.Submit(); err != nil {
			return err
		}
		if err := s.purchasing.SaveRequisition(tx, requisition); err != nil {
			return err
		}
		return s.notifySubmitted(tx, requisition)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindRequisition(prID)
}

// validateRequisition — กฎของ SCR-21
func (s *PurchasingService) validateRequisition(input RequisitionInput) error {
	if err := s.assertSupplierActive(input.SupplierID); err != nil {
		return err
	}
	if len(input.Items) == 0 {
		return model.ErrEmptyItems
	}

	supplier, err := s.suppliers.FindByID(input.SupplierID)
	if err != nil {
		return err
	}

	seen := make(map[int]bool, len(input.Items))
	for _, line := range input.Items {
		if seen[line.BookID] {
			return model.ErrDuplicateBookInDocument
		}
		seen[line.BookID] = true

		if line.Quantity <= 0 {
			return model.ErrInvalidQuantity
		}
		if line.UnitPrice <= 0 {
			return model.ErrInvalidUnitPrice
		}
		if _, ok := supplier.Offers(line.BookID); !ok {
			return model.ErrBookNotOfferedBySupplier
		}
	}
	return nil
}

// assertSupplierActive — SCR-21 Abnormal (U6): เลือกผู้จัดจำหน่ายที่ปิดใช้งานแล้วไม่ได้
func (s *PurchasingService) assertSupplierActive(supplierID int) error {
	supplier, err := s.suppliers.FindByID(supplierID)
	if err != nil {
		return err
	}
	if !supplier.IsActive() {
		return model.ErrSupplierInactive
	}
	return nil
}

// ── U7 อนุมัติใบสั่งซื้อ ────────────────────────────────────────────────

// Budget — งบประมาณและยอดผูกพันปัจจุบัน (แถบบน SCR-23)
func (s *PurchasingService) Budget() (*BudgetSummary, error) {
	orders, err := s.purchasing.ListOrders(repository.OrderFilter{})
	if err != nil {
		return nil, err
	}
	committed := model.CommittedAmount(orders)
	return &BudgetSummary{
		Budget:    model.PurchaseBudget,
		Committed: committed,
		Remaining: model.PurchaseBudget - committed,
	}, nil
}

// ApproveRequisition — U7 อนุมัติแล้วออกใบสั่งซื้อให้อัตโนมัติ
//
// postcondition ของ use case: ได้ PO สถานะ "อนุมัติแล้ว รอส่งผู้จัดจำหน่าย" (APPROVED)
// ไม่ผ่าน PENDING_APPROVAL เพราะผู้จัดการเพิ่งอนุมัติไปในขั้นตอนนี้เอง
//
// SCR-23 Abnormal: ยอดรวมทำให้เกินงบ ต้องปรับลดรายการหรือส่ง overBudgetNote มาด้วย
func (s *PurchasingService) ApproveRequisition(prID int, input ApproveInput, by Identity) (*model.PurchaseOrder, error) {
	var order *model.PurchaseOrder

	err := s.db.Transaction(func(tx *gorm.DB) error {
		requisition, err := s.purchasing.LockRequisition(tx, prID)
		if err != nil {
			return err
		}
		if err := s.assertSupplierActive(requisition.SupplierID); err != nil {
			return err
		}

		orders, err := s.purchasing.ListOrders(repository.OrderFilter{})
		if err != nil {
			return err
		}
		total := model.DocumentTotal(requisition.Items)
		if model.CommittedAmount(orders)+total > model.PurchaseBudget &&
			strings.TrimSpace(input.OverBudgetNote) == "" {
			return model.ErrOverBudget
		}

		if err := requisition.Approve(); err != nil {
			return err
		}
		requisition.OverBudgetNote = strings.TrimSpace(input.OverBudgetNote)
		if err := s.purchasing.SaveRequisition(tx, requisition); err != nil {
			return err
		}

		items := make([]model.PurchaseOrderItem, len(requisition.Items))
		for i, line := range requisition.Items {
			items[i] = model.PurchaseOrderItem{
				BookID:    line.BookID,
				Quantity:  line.Quantity,
				UnitPrice: line.UnitPrice,
			}
		}
		today := model.Today()
		order = &model.PurchaseOrder{
			PRID:                 &requisition.PRID,
			SupplierID:           requisition.SupplierID,
			OrderDate:            today,
			ExpectedDeliveryDate: today.AddDays(DefaultLeadDays),
			Status:               model.POStatusApproved,
			ApprovedBy:           by.Name,
			ApprovedByID:         by.EmployeeID,
			Items:                items,
		}
		order.RecalculateTotal()
		if err := s.purchasing.CreateOrder(tx, order); err != nil {
			return err
		}

		return s.notify(tx, model.RoleWarehouse, model.NotifyPRApproved,
			"ใบขอสั่งซื้อได้รับอนุมัติ",
			fmt.Sprintf("%s อนุมัติแล้ว ระบบออก %s พร้อมส่งให้ผู้จัดจำหน่าย",
				model.FormatPRCode(prID), model.FormatPOCode(order.POID)),
			fmt.Sprintf("/admin/purchasing/po/%d", order.POID))
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindOrder(order.POID)
}

// RejectRequisition — U7 ตีกลับให้แก้ไข ต้องมีเหตุผลเสมอ
func (s *PurchasingService) RejectRequisition(prID int, input RejectInput) (*model.PurchaseRequisition, error) {
	reason := strings.TrimSpace(input.Reason)

	err := s.db.Transaction(func(tx *gorm.DB) error {
		requisition, err := s.purchasing.LockRequisition(tx, prID)
		if err != nil {
			return err
		}
		if err := requisition.Reject(reason); err != nil {
			return err
		}
		if err := s.purchasing.SaveRequisition(tx, requisition); err != nil {
			return err
		}
		return s.notify(tx, model.RoleWarehouse, model.NotifyPRRejected,
			"ใบขอสั่งซื้อถูกตีกลับ",
			fmt.Sprintf("%s ถูกตีกลับให้แก้ไข · เหตุผล: %s", model.FormatPRCode(prID), reason),
			fmt.Sprintf("/admin/purchasing/pr/%d", prID))
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindRequisition(prID)
}

// ── U8 ส่งใบสั่งซื้อให้ผู้จัดจำหน่าย ─────────────────────────────────────

func (s *PurchasingService) ListOrders(filter repository.OrderFilter) ([]model.PurchaseOrder, error) {
	return s.purchasing.ListOrders(filter)
}

func (s *PurchasingService) GetOrder(poID int) (*model.PurchaseOrder, error) {
	return s.purchasing.FindOrder(poID)
}

// SendOrder — บันทึกว่าส่งใบสั่งซื้อไปแล้ว สถานะยังเป็น APPROVED แต่หน้าจออ่านเป็น "รอยืนยัน"
func (s *PurchasingService) SendOrder(poID int) (*model.PurchaseOrder, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.purchasing.LockOrder(tx, poID)
		if err != nil {
			return err
		}
		if err := order.Send(time.Now().UTC()); err != nil {
			return err
		}
		return s.purchasing.SaveOrderHeader(tx, order)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindOrder(poID)
}

// ConfirmOrder — ผู้จัดจำหน่ายยืนยันพร้อมแจ้งวันที่จะส่งของ (U8 postcondition)
func (s *PurchasingService) ConfirmOrder(poID int, input ConfirmInput) (*model.PurchaseOrder, error) {
	expected, err := model.ParseDate(input.ExpectedDeliveryDate)
	if err != nil {
		return nil, model.Validation("INVALID_DATE", err.Error())
	}
	if expected.Before(model.Today()) {
		return nil, model.ErrExpectedDateInPast
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.purchasing.LockOrder(tx, poID)
		if err != nil {
			return err
		}
		if err := order.Confirm(expected, time.Now().UTC()); err != nil {
			return err
		}
		return s.purchasing.SaveOrderHeader(tx, order)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindOrder(poID)
}

// ── U9 บันทึกรับสินค้าเข้าคลัง ──────────────────────────────────────────

func (s *PurchasingService) ListReceipts(poID int) ([]model.GoodsReceipt, error) {
	return s.purchasing.ListReceipts(poID)
}

// ReceiveGoods — ออกใบรับสินค้า ปรับจำนวนที่รับแล้ว ปรับสถานะ PO และเพิ่มสต็อก ในทรานแซกชันเดียว
// ลำดับตรงกับ sequence diagram SD-U9
func (s *PurchasingService) ReceiveGoods(poID int, input ReceiptInput, by Identity) (*model.GoodsReceipt, error) {
	if strings.TrimSpace(input.DeliveryNoteNo) == "" {
		return nil, model.Validation("MISSING_DELIVERY_NOTE", "ต้องระบุเลขที่ใบส่งของ")
	}

	var receipt *model.GoodsReceipt
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.purchasing.LockOrder(tx, poID)
		if err != nil {
			return err
		}
		if err := order.CanReceive(); err != nil {
			return err
		}

		lines, err := s.buildReceiptLines(order, input.Lines)
		if err != nil {
			return err
		}

		receipt = &model.GoodsReceipt{
			POID:           poID,
			ReceivedDate:   model.Today(),
			DeliveryNoteNo: strings.TrimSpace(input.DeliveryNoteNo),
			ReceivedBy:     by.Name,
			Items:          lines,
		}

		// ปรับจำนวนที่รับแล้วก่อน เพื่อให้รู้ว่าใบนี้ทำให้ PO ครบหรือยัง
		order.ApplyReceipt(receipt)
		if order.Status == model.POStatusReceivedFull {
			receipt.Status = model.GRStatusFull
		} else {
			receipt.Status = model.GRStatusPartial
		}

		if err := s.purchasing.CreateReceipt(tx, receipt); err != nil {
			return err
		}
		if err := s.purchasing.SaveOrderItems(tx, order); err != nil {
			return err
		}
		if err := s.purchasing.SaveOrderHeader(tx, order); err != nil {
			return err
		}

		// ของที่มาถึงเข้าสต็อกทั้งหมด ทั้งของดีและของชำรุด — U10 ตัดของชำรุดออกตอนเปิดใบคืน
		if err := s.inventory.ApplyStockChanges(tx, receipt.ToStockTransactions()); err != nil {
			return err
		}

		received := 0
		for _, line := range receipt.Items {
			received += line.ReceivedQty
		}
		supplier, err := s.suppliers.FindByID(order.SupplierID)
		if err != nil {
			return err
		}
		return s.notifyInApp(tx, model.RoleManager, model.NotifyGRRecorded,
			"บันทึกรับสินค้าเข้าคลัง",
			fmt.Sprintf("%s · %s · รับ %d เล่ม",
				model.FormatPOCode(poID), supplier.CompanyName, received),
			fmt.Sprintf("/admin/purchasing/po/%d", poID))
	})
	if err != nil {
		return nil, err
	}
	return receipt, nil
}

// buildReceiptLines — ตรวจรายการที่กรอกแล้วแปลงเป็นรายการของใบรับสินค้า
//
// รับเกินจำนวนที่สั่งได้ (เหตุผลส่งคืนมีข้อ "เกินจำนวนที่สั่ง") จึงไม่ปิดกั้น
// แต่รับติดลบหรือรับหนังสือที่ไม่ได้อยู่ในใบสั่งซื้อไม่ได้
func (s *PurchasingService) buildReceiptLines(order *model.PurchaseOrder, inputs []ReceiptLineInput) ([]model.GoodsReceiptItem, error) {
	if len(inputs) == 0 {
		return nil, model.ErrEmptyItems
	}

	lines := make([]model.GoodsReceiptItem, 0, len(inputs))
	seen := make(map[int]bool, len(inputs))
	total := 0

	for _, input := range inputs {
		if seen[input.BookID] {
			return nil, model.ErrDuplicateBookInDocument
		}
		seen[input.BookID] = true

		if !order.HasBook(input.BookID) {
			return nil, model.Validation("BOOK_NOT_IN_ORDER",
				fmt.Sprintf("หนังสือรหัส %d ไม่อยู่ในใบสั่งซื้อนี้", input.BookID))
		}
		if input.ReceivedQty < 0 {
			return nil, model.ErrInvalidQuantity
		}

		condition := model.ItemCondition(input.Condition)
		if condition == "" {
			condition = model.ItemConditionNormal
		}
		if !condition.IsValid() {
			return nil, model.Validation("INVALID_CONDITION", "สภาพสินค้าไม่ถูกต้อง: "+input.Condition)
		}

		total += input.ReceivedQty
		lines = append(lines, model.GoodsReceiptItem{
			BookID:      input.BookID,
			OrderedQty:  order.OrderedQty(input.BookID),
			ReceivedQty: input.ReceivedQty,
			Condition:   condition,
			Note:        strings.TrimSpace(input.Note),
		})
	}

	if total == 0 {
		return nil, model.ErrNothingReceived
	}
	return lines, nil
}

// ── U10 บันทึกส่งคืนสินค้า ──────────────────────────────────────────────

func (s *PurchasingService) ListReturns(poID int) ([]model.PurchaseReturn, error) {
	return s.purchasing.ListReturns(poID)
}

func (s *PurchasingService) GetReturn(returnID int) (*model.PurchaseReturn, error) {
	return s.purchasing.FindReturn(returnID)
}

// CreateReturn — เปิดใบส่งคืนจากใบสั่งซื้อ แล้วตัดของออกจากสต็อก
// ถ้าคืนครบทุกหน่วยที่เคยรับเข้ามา ใบสั่งซื้อจะเปลี่ยนเป็น RETURNED
func (s *PurchasingService) CreateReturn(poID int, input ReturnInput, by Identity) (*model.PurchaseReturn, error) {
	if strings.TrimSpace(input.Reason) == "" {
		return nil, model.ErrReasonRequired
	}
	if len(input.Items) == 0 {
		return nil, model.ErrEmptyItems
	}

	var entry *model.PurchaseReturn
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.purchasing.LockOrder(tx, poID)
		if err != nil {
			return err
		}

		alreadyReturned, err := s.purchasing.ReturnedQtyByBook(tx, poID)
		if err != nil {
			return err
		}

		items := make([]model.PurchaseReturnItem, 0, len(input.Items))
		seen := make(map[int]bool, len(input.Items))
		for _, line := range input.Items {
			if seen[line.BookID] {
				return model.ErrDuplicateBookInDocument
			}
			seen[line.BookID] = true

			if line.Quantity <= 0 {
				return model.ErrInvalidQuantity
			}
			if !order.HasBook(line.BookID) {
				return model.Validation("BOOK_NOT_IN_ORDER",
					fmt.Sprintf("หนังสือรหัส %d ไม่อยู่ในใบสั่งซื้อนี้", line.BookID))
			}
			// คืนได้ไม่เกินจำนวนที่รับเข้าคลังจริง หักด้วยที่เคยคืนไปแล้ว
			if alreadyReturned[line.BookID]+line.Quantity > order.ReceivedQty(line.BookID) {
				return model.ErrReturnExceedsReceived
			}
			alreadyReturned[line.BookID] += line.Quantity

			reason := strings.TrimSpace(line.Reason)
			if reason == "" {
				reason = strings.TrimSpace(input.Reason)
			}
			items = append(items, model.PurchaseReturnItem{
				BookID:   line.BookID,
				Quantity: line.Quantity,
				Reason:   reason,
				Evidence: line.Evidence,
			})
		}

		entry = &model.PurchaseReturn{
			POID:       poID,
			ReturnDate: model.Today(),
			Reason:     strings.TrimSpace(input.Reason),
			Status:     model.ReturnStatusTracking,
			CreatedBy:  by.Name,
			Items:      items,
		}
		if err := s.purchasing.CreateReturn(tx, entry); err != nil {
			return err
		}

		// ใบสั่งซื้อถือว่า "ส่งคืน" เมื่อทุกหน่วยที่รับเข้ามาถูกคืนกลับหมดแล้ว
		fullyReturned := true
		for _, item := range order.Items {
			if item.ReceivedQty == 0 || alreadyReturned[item.BookID] < item.ReceivedQty {
				fullyReturned = false
				break
			}
		}
		if fullyReturned {
			order.Status = model.POStatusReturned
			if err := s.purchasing.SaveOrderHeader(tx, order); err != nil {
				return err
			}
		}

		return s.inventory.ApplyStockChanges(tx, entry.ToStockTransactions())
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindReturn(entry.ReturnID)
}

// EscalateReturn — SCR-26 Abnormal (U10): ผู้จัดจำหน่ายปฏิเสธการรับคืน ส่งเรื่องให้ผู้จัดการ
func (s *PurchasingService) EscalateReturn(returnID int, input EscalateInput) (*model.PurchaseReturn, error) {
	note := strings.TrimSpace(input.Note)

	err := s.db.Transaction(func(tx *gorm.DB) error {
		entry, err := s.purchasing.FindReturn(returnID)
		if err != nil {
			return err
		}
		if err := entry.Escalate(note); err != nil {
			return err
		}
		if err := s.purchasing.SaveReturn(tx, entry); err != nil {
			return err
		}
		return s.notify(tx, model.RoleManager, model.NotifyReturnEscalated,
			"ผู้จัดจำหน่ายปฏิเสธการรับคืน",
			fmt.Sprintf("%s · %s", model.FormatPOCode(entry.POID), note),
			fmt.Sprintf("/admin/purchasing/returns/%d", returnID))
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindReturn(returnID)
}

// RecordCompensation — ปิดใบส่งคืนเมื่อได้รับการชดเชยครบ (U10 postcondition)
// ถ้าเป็นสินค้าทดแทน ของชุดใหม่เข้าสต็อกกลับมา
func (s *PurchasingService) RecordCompensation(returnID int, input CompensationInput, by Identity) (*model.PurchaseReturn, error) {
	kind := model.CompensationType(strings.TrimSpace(input.Type))

	err := s.db.Transaction(func(tx *gorm.DB) error {
		entry, err := s.purchasing.FindReturn(returnID)
		if err != nil {
			return err
		}
		if err := entry.RecordCompensation(kind, strings.TrimSpace(input.Note), by.Name, time.Now().UTC()); err != nil {
			return err
		}
		if err := s.purchasing.SaveReturn(tx, entry); err != nil {
			return err
		}
		if kind != model.CompensationReplacement {
			return nil
		}

		replacements := make([]model.StockTransaction, 0, len(entry.Items))
		for _, item := range entry.Items {
			replacements = append(replacements, model.StockTransaction{
				BookID:         item.BookID,
				Type:           model.StockTxnTypeReceiveIn,
				QuantityChange: item.Quantity,
				Reason:         "สินค้าทดแทนจากการส่งคืน",
				ReferenceDoc:   model.FormatPOCode(entry.POID),
				TxnDate:        time.Now().UTC(),
			})
		}
		return s.inventory.ApplyStockChanges(tx, replacements)
	})
	if err != nil {
		return nil, err
	}
	return s.purchasing.FindReturn(returnID)
}

// ── การแจ้งเตือน ────────────────────────────────────────────────────────

// notifySubmitted — U6 postcondition: ใบขอสั่งซื้อวิ่งไปหาผู้จัดการอัตโนมัติ
func (s *PurchasingService) notifySubmitted(tx *gorm.DB, pr *model.PurchaseRequisition) error {
	supplier, err := s.suppliers.FindByID(pr.SupplierID)
	if err != nil {
		return err
	}
	body := fmt.Sprintf("%s · %s · ฿%.2f · ผู้ขอ %s",
		model.FormatPRCode(pr.PRID), supplier.CompanyName,
		model.DocumentTotal(pr.Items), pr.RequestedBy)

	return s.notify(tx, model.RoleManager, model.NotifyPRSubmitted,
		"ใบขอสั่งซื้อรออนุมัติ", body,
		fmt.Sprintf("/admin/purchasing/pr/%d/approve", pr.PRID))
}

// notify — บันทึกแจ้งเตือนทั้งในระบบและ "อีเมล" (อีเมลเป็นการจำลอง ไม่ได้ส่งจริง)
func (s *PurchasingService) notify(tx *gorm.DB, to model.Role, kind model.NotificationKind, title, body, link string) error {
	return s.notifications.Push(tx, []model.Notification{
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelInApp},
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelEmail},
	})
}

// notifyInApp — แจ้งเตือนเฉพาะในระบบ ไม่ส่งอีเมล (การรับสินค้าเป็นข้อมูลภายใน)
func (s *PurchasingService) notifyInApp(tx *gorm.DB, to model.Role, kind model.NotificationKind, title, body, link string) error {
	return s.notifications.Push(tx, []model.Notification{
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelInApp},
	})
}

func toRequisitionItems(inputs []RequisitionLineInput) []model.PurchaseRequisitionItem {
	items := make([]model.PurchaseRequisitionItem, len(inputs))
	for i, input := range inputs {
		items[i] = model.PurchaseRequisitionItem{
			BookID:    input.BookID,
			Quantity:  input.Quantity,
			UnitPrice: input.UnitPrice,
		}
	}
	return items
}
