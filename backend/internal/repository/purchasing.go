// purchasing.go — เข้าถึงข้อมูลเอกสารจัดซื้อ (PR / PO / GRN / ใบส่งคืน)
package repository

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type PurchasingRepository struct{ db *gorm.DB }

func NewPurchasingRepository(db *gorm.DB) *PurchasingRepository {
	return &PurchasingRepository{db: db}
}

// ── ใบขอสั่งซื้อ ────────────────────────────────────────────────────────

type RequisitionFilter struct {
	Status     model.PRStatus
	SupplierID int
}

func (r *PurchasingRepository) ListRequisitions(filter RequisitionFilter) ([]model.PurchaseRequisition, error) {
	query := r.db.Model(&model.PurchaseRequisition{}).
		Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") }).
		Order("pr_id")
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.SupplierID > 0 {
		query = query.Where("supplier_id = ?", filter.SupplierID)
	}

	var requisitions []model.PurchaseRequisition
	if err := query.Find(&requisitions).Error; err != nil {
		return nil, err
	}
	return requisitions, nil
}

func (r *PurchasingRepository) FindRequisition(prID int) (*model.PurchaseRequisition, error) {
	return r.findRequisition(r.db, prID, false)
}

// LockRequisition — อ่านใบขอสั่งซื้อพร้อมล็อกแถวไว้ กันอนุมัติซ้อนกันสองครั้ง
func (r *PurchasingRepository) LockRequisition(tx *gorm.DB, prID int) (*model.PurchaseRequisition, error) {
	return r.findRequisition(tx, prID, true)
}

func (r *PurchasingRepository) findRequisition(db *gorm.DB, prID int, lock bool) (*model.PurchaseRequisition, error) {
	query := db.Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") })
	if lock {
		// ล็อกเฉพาะแถวแม่ — ใส่ FOR UPDATE พร้อม preload ไม่ได้ เพราะ GORM ยิงคนละคำสั่ง
		query = db.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	var requisition model.PurchaseRequisition
	err := query.First(&requisition, "pr_id = ?", prID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrRequisitionNotFound
	}
	if err != nil {
		return nil, err
	}
	if lock {
		if err := db.Order("book_id").
			Find(&requisition.Items, "pr_id = ?", prID).Error; err != nil {
			return nil, err
		}
	}
	return &requisition, nil
}

func (r *PurchasingRepository) CreateRequisition(tx *gorm.DB, pr *model.PurchaseRequisition) error {
	return tx.Create(pr).Error
}

// ReplaceRequisitionItems — เขียนทับรายการทั้งชุด (เหตุผลเดียวกับ SupplierRepository.Update)
func (r *PurchasingRepository) ReplaceRequisitionItems(tx *gorm.DB, pr *model.PurchaseRequisition) error {
	if err := tx.Where("pr_id = ?", pr.PRID).Delete(&model.PurchaseRequisitionItem{}).Error; err != nil {
		return err
	}
	if len(pr.Items) == 0 {
		return nil
	}
	for i := range pr.Items {
		pr.Items[i].PRID = pr.PRID
	}
	return tx.Create(&pr.Items).Error
}

func (r *PurchasingRepository) SaveRequisition(tx *gorm.DB, pr *model.PurchaseRequisition) error {
	return tx.Model(&model.PurchaseRequisition{}).
		Where("pr_id = ?", pr.PRID).
		Select("status", "supplier_id", "rejection_reason", "over_budget_note", "requested_by", "requested_by_id").
		Updates(map[string]any{
			"status":           pr.Status,
			"supplier_id":      pr.SupplierID,
			"rejection_reason": pr.RejectionReason,
			"over_budget_note": pr.OverBudgetNote,
			"requested_by":     pr.RequestedBy,
			"requested_by_id":  pr.RequestedByID,
		}).Error
}

// ── ใบสั่งซื้อ ──────────────────────────────────────────────────────────

type PurchaseOrderFilter struct {
	Status     model.POStatus
	SupplierID int
}

func (r *PurchasingRepository) ListOrders(filter PurchaseOrderFilter) ([]model.PurchaseOrder, error) {
	query := r.db.Model(&model.PurchaseOrder{}).
		Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") }).
		Order("po_id")
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.SupplierID > 0 {
		query = query.Where("supplier_id = ?", filter.SupplierID)
	}

	var orders []model.PurchaseOrder
	if err := query.Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *PurchasingRepository) FindOrder(poID int) (*model.PurchaseOrder, error) {
	return r.findOrder(r.db, poID, false)
}

// LockOrder — อ่านใบสั่งซื้อพร้อมล็อกแถว กันการรับสินค้าพร้อมกันสองครั้ง (U9)
func (r *PurchasingRepository) LockOrder(tx *gorm.DB, poID int) (*model.PurchaseOrder, error) {
	return r.findOrder(tx, poID, true)
}

func (r *PurchasingRepository) findOrder(db *gorm.DB, poID int, lock bool) (*model.PurchaseOrder, error) {
	query := db.Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") })
	if lock {
		query = db.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	var order model.PurchaseOrder
	err := query.First(&order, "po_id = ?", poID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrOrderNotFound
	}
	if err != nil {
		return nil, err
	}
	if lock {
		if err := db.Order("book_id").Find(&order.Items, "po_id = ?", poID).Error; err != nil {
			return nil, err
		}
	}
	return &order, nil
}

func (r *PurchasingRepository) CreateOrder(tx *gorm.DB, po *model.PurchaseOrder) error {
	return tx.Create(po).Error
}

// SaveOrderHeader — อัปเดตเฉพาะหัวเอกสาร (รายการอัปเดตแยกด้วย SaveOrderItems)
func (r *PurchasingRepository) SaveOrderHeader(tx *gorm.DB, po *model.PurchaseOrder) error {
	return tx.Model(&model.PurchaseOrder{}).
		Where("po_id = ?", po.POID).
		Updates(map[string]any{
			"status":                 po.Status,
			"expected_delivery_date": po.ExpectedDeliveryDate,
			"total_amount":           po.TotalAmount,
			"sent_at":                po.SentAt,
			"confirmed_at":           po.ConfirmedAt,
			"approved_by":            po.ApprovedBy,
			"approved_by_id":         po.ApprovedByID,
		}).Error
}

// SaveOrderItems — เขียนจำนวนที่รับแล้วกลับลงเฉพาะรายการที่ใบรับสินค้ารอบนี้แตะ (U9)
// เดิมเขียนทับทุกรายการของ PO ทุกครั้งที่รับของ ทั้งที่มีแค่บางเล่มที่เปลี่ยนจริงในแต่ละรอบ
// และทำระหว่างถือ FOR UPDATE ของ PO อยู่
func (r *PurchasingRepository) SaveOrderItems(tx *gorm.DB, po *model.PurchaseOrder, touchedBookIDs []int) error {
	for _, bookID := range touchedBookIDs {
		for _, item := range po.Items {
			if item.BookID != bookID {
				continue
			}
			if err := tx.Model(&model.PurchaseOrderItem{}).
				Where("po_id = ? AND book_id = ?", po.POID, item.BookID).
				Update("received_qty", item.ReceivedQty).Error; err != nil {
				return err
			}
			break
		}
	}
	return nil
}

// OutstandingOrderCount — จำนวนใบสั่งซื้อที่ยังไม่ปิดรายการของผู้จัดจำหน่ายหนึ่งราย
// ใช้กันไม่ให้ปิดใช้งานผู้จัดจำหน่ายที่ยังมีของค้างส่ง (U3 / SCR-14)
func (r *PurchasingRepository) OutstandingOrderCount(db *gorm.DB, supplierID int) (int64, error) {
	closed := []model.POStatus{
		model.POStatusReceivedFull, model.POStatusReturned, model.POStatusCancelled,
	}
	var count int64
	err := db.Model(&model.PurchaseOrder{}).
		Where("supplier_id = ? AND status NOT IN ?", supplierID, closed).
		Count(&count).Error
	return count, err
}

// CommittedAmount — ยอดผูกพันของใบสั่งซื้อทั้งหมด ใช้คิดงบคงเหลือบน SCR-23 (U7)
//
// รวมระดับรายการ (quantity × unit_price) ไม่ใช่ total_amount ของหัวเอกสาร เพราะคอลัมน์นั้น
// อาจค้างถ้าไม่มีใครเรียก RecalculateTotal() ซ้ำ · ใบที่ CANCELLED นับเฉพาะจำนวนที่ "รับจริง"
// (received_qty) ไม่ใช่ 0 เพราะของที่รับเข้าคลังไปแล้วก่อนยกเลิกยังเป็นภาระงบประมาณจริง (ดู
// PurchaseOrder.Reject — ยกเลิกได้จาก RECEIVED_PARTIAL ซึ่งมีรับของมาแล้วบางส่วน)
//
// เดิมโหลด PO ทุกใบพร้อม preload รายการทั้งหมดมาบวกใน Go — เปลี่ยนเป็น SQL aggregate ตัวเดียว
func (r *PurchasingRepository) CommittedAmount(db *gorm.DB) (float64, error) {
	var total float64
	err := db.Model(&model.PurchaseOrderItem{}).
		Joins("JOIN purchase_order ON purchase_order.po_id = purchase_order_item.po_id").
		Select(`COALESCE(SUM(
			CASE WHEN purchase_order.status = ?
				THEN purchase_order_item.received_qty * purchase_order_item.unit_price
				ELSE purchase_order_item.quantity * purchase_order_item.unit_price
			END
		), 0)`, model.POStatusCancelled).
		Scan(&total).Error
	return total, err
}

// ── ใบรับสินค้า ─────────────────────────────────────────────────────────

func (r *PurchasingRepository) ListReceipts(poID int) ([]model.GoodsReceipt, error) {
	query := r.db.Model(&model.GoodsReceipt{}).
		Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") }).
		Order("gr_id")
	if poID > 0 {
		query = query.Where("po_id = ?", poID)
	}

	var receipts []model.GoodsReceipt
	if err := query.Find(&receipts).Error; err != nil {
		return nil, err
	}
	return receipts, nil
}

func (r *PurchasingRepository) CreateReceipt(tx *gorm.DB, gr *model.GoodsReceipt) error {
	return tx.Create(gr).Error
}

// ── ใบส่งคืน ────────────────────────────────────────────────────────────

func (r *PurchasingRepository) ListReturns(poID int) ([]model.PurchaseReturn, error) {
	query := r.db.Model(&model.PurchaseReturn{}).
		Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") }).
		Order("return_id")
	if poID > 0 {
		query = query.Where("po_id = ?", poID)
	}

	var returns []model.PurchaseReturn
	if err := query.Find(&returns).Error; err != nil {
		return nil, err
	}
	return returns, nil
}

func (r *PurchasingRepository) FindReturn(returnID int) (*model.PurchaseReturn, error) {
	return r.findReturn(r.db, returnID, false)
}

// LockReturn — อ่านใบส่งคืนพร้อมล็อกแถว กันส่งเรื่อง/บันทึกการชดเชยซ้อนกันสองครั้ง (U10)
func (r *PurchasingRepository) LockReturn(tx *gorm.DB, returnID int) (*model.PurchaseReturn, error) {
	return r.findReturn(tx, returnID, true)
}

func (r *PurchasingRepository) findReturn(db *gorm.DB, returnID int, lock bool) (*model.PurchaseReturn, error) {
	query := db.Preload("Items", func(q *gorm.DB) *gorm.DB { return q.Order("book_id") })
	if lock {
		// ล็อกเฉพาะแถวแม่ — ใส่ FOR UPDATE พร้อม preload ไม่ได้ เพราะ GORM ยิงคนละคำสั่ง
		query = db.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	var entry model.PurchaseReturn
	err := query.First(&entry, "return_id = ?", returnID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrReturnNotFound
	}
	if err != nil {
		return nil, err
	}
	if lock {
		if err := db.Order("book_id").
			Find(&entry.Items, "return_id = ?", returnID).Error; err != nil {
			return nil, err
		}
	}
	return &entry, nil
}

func (r *PurchasingRepository) CreateReturn(tx *gorm.DB, entry *model.PurchaseReturn) error {
	return tx.Create(entry).Error
}

func (r *PurchasingRepository) SaveReturn(tx *gorm.DB, entry *model.PurchaseReturn) error {
	return tx.Model(&model.PurchaseReturn{}).
		Where("return_id = ?", entry.ReturnID).
		Updates(map[string]any{
			"status":            entry.Status,
			"escalation_note":   entry.EscalationNote,
			"compensation_type": entry.CompensationType,
			"compensation_note": entry.CompensationNote,
			"compensation_by":   entry.CompensationBy,
			"compensation_at":   entry.CompensationAt,
		}).Error
}

// ReturnedQtyByBook — จำนวนที่ส่งคืนไปแล้วของใบสั่งซื้อหนึ่งใบ แยกตามหนังสือ
// ใช้กันไม่ให้คืนเกินจำนวนที่รับเข้าคลังจริง (U10)
func (r *PurchasingRepository) ReturnedQtyByBook(db *gorm.DB, poID int) (map[int]int, error) {
	type row struct {
		BookID int
		Total  int
	}
	var rows []row
	err := db.Model(&model.PurchaseReturnItem{}).
		Select("purchase_return_item.book_id AS book_id, SUM(purchase_return_item.quantity) AS total").
		Joins("JOIN purchase_return ON purchase_return.return_id = purchase_return_item.return_id").
		Where("purchase_return.po_id = ?", poID).
		Group("purchase_return_item.book_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	totals := make(map[int]int, len(rows))
	for _, entry := range rows {
		totals[entry.BookID] = entry.Total
	}
	return totals, nil
}
