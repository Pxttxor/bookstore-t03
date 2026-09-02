// returns.go — U10 บันทึกส่งคืนสินค้าให้ผู้จัดจำหน่าย
//
// เปิดใบคืน → ตัดสต็อกออก → ปิด PO ถ้าคืนครบ
// ส่งต่อผู้จัดการเมื่อผู้จัดจำหน่ายปฏิเสธ → บันทึกการชดเชย (คืนสต็อกถ้าเป็นสินค้าทดแทน)
package service

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

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
