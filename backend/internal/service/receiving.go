// receiving.go — U9 บันทึกรับสินค้าเข้าคลัง
//
// ทั้งขั้นตอนอยู่ในทรานแซกชันเดียว: ออก GRN + เพิ่ม received_qty + ปรับสถานะ PO
// + สร้างรายการเคลื่อนไหวสต็อกชนิด RECEIVE_IN + แจ้งเตือน
// ล็อกแถว PO ด้วย FOR UPDATE ก่อนเสมอ กันกดรับสินค้าซ้อนกันสองครั้ง
package service

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

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
		touchedBookIDs := make([]int, len(receipt.Items))
		for i, item := range receipt.Items {
			touchedBookIDs[i] = item.BookID
		}
		if err := s.purchasing.SaveOrderItems(tx, order, touchedBookIDs); err != nil {
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
