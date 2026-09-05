// inventory.go — ระบบย่อยสินค้าคงคลัง
//
// class diagram: InventoryItem "1" *-- "*" StockTransaction · StockCount "1" *-- "*" StockCountItem
// StockCountItem "1" --> "0..1" StockDiscrepancyReport · StockDiscrepancyReport "*" --> "1" StoreManager
//
// สามงานหลัก: ปรับยอดด้วยมือ · บันทึกรอบตรวจนับ · ผู้จัดการตัดสินผลต่าง
// สองอย่างหลังแตะหลายตารางจึงครอบด้วยทรานแซกชันและล็อกแถวเสมอ
package service

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type InventoryService struct {
	db            *gorm.DB
	inventory     *repository.InventoryRepository
	books         *repository.BookRepository
	notifications *repository.NotificationRepository
}

func NewInventoryService(
	db *gorm.DB,
	inventory *repository.InventoryRepository,
	books *repository.BookRepository,
	notifications *repository.NotificationRepository,
) *InventoryService {
	return &InventoryService{db: db, inventory: inventory, books: books, notifications: notifications}
}

// ── DTO ที่หน้าจอส่งเข้ามา ───────────────────────────────────────────────

// AdjustLineInput — ปรับยอดหนังสือหนึ่งเล่ม · QuantityChange ติดลบได้ (ตัดออก)
type AdjustLineInput struct {
	BookID         int    `json:"bookId"`
	QuantityChange int    `json:"quantityChange"`
	Reason         string `json:"reason"`
	// ReferenceDoc อ้างเอกสารต้นเรื่องได้ เช่นรหัสคำสั่งซื้อลูกค้า (SO-1001)
	ReferenceDoc string `json:"referenceDoc"`
}

type AdjustInput struct {
	Lines []AdjustLineInput `json:"lines"`
}

type CountLineInput struct {
	BookID     int `json:"bookId"`
	CountedQty int `json:"countedQty"`
}

type StockCountInput struct {
	Items []CountLineInput `json:"items"`
}

// DecisionInput — เหตุผลที่ผู้จัดการบันทึกตอนตัดสินรายงานผลต่าง
type DecisionInput struct {
	Note string `json:"note"`
}

// StockRow — ยอดคงเหลือพร้อมหนังสือและระดับที่หน้าจอต้องแสดง
type StockRow struct {
	Item  model.InventoryItem
	Book  model.Book
	Level model.StockLevel
}

// StockCountView — รอบตรวจนับพร้อมชื่อหนังสือของทุกรายการ
// หน้าจอต้องแสดงชื่อเรื่องคู่กับจำนวนเสมอ จึงเติมให้ตั้งแต่ชั้นนี้ (แนวเดียวกับ BookView)
type StockCountView struct {
	Count model.StockCount
	Books map[int]model.Book
}

// DiscrepancyView — รายงานผลต่างพร้อมหนังสือที่เกี่ยวข้อง
type DiscrepancyView struct {
	Report model.StockDiscrepancyReport
	Book   model.Book
}

// ── รายงานยอดคงเหลือ ────────────────────────────────────────────────────

// LowStock — หนังสือที่หมดหรือเหลือน้อย (U8 ของระบบย่อยสินค้าคงคลัง)
//
// ใช้เกณฑ์คงที่ LowStockThreshold **คนละอันกับ** จุดสั่งซื้อรายเล่มของ U5
// สองหน้าจอนี้ตอบคนละคำถามและตั้งใจให้แยกกัน
func (s *InventoryService) LowStock() ([]StockRow, error) {
	rows, err := s.stockRows()
	if err != nil {
		return nil, err
	}

	low := make([]StockRow, 0, len(rows))
	for _, row := range rows {
		if row.Level != model.StockLevelOK {
			low = append(low, row)
		}
	}
	return low, nil
}

func (s *InventoryService) stockRows() ([]StockRow, error) {
	items, err := s.inventory.ListInventory()
	if err != nil {
		return nil, err
	}
	books, err := s.books.BooksByID()
	if err != nil {
		return nil, err
	}

	rows := make([]StockRow, len(items))
	for i, item := range items {
		rows[i] = StockRow{Item: item, Book: books[item.BookID], Level: model.StockLevelOf(item)}
	}
	return rows, nil
}

// TransactionsForBook — ประวัติการเคลื่อนไหวสต็อกของหนังสือเล่มหนึ่ง ล่าสุดขึ้นก่อน
//
// หน้ารายละเอียดหนังสือหลังร้านแสดงตารางนี้ (แท็บการเคลื่อนไหว) · อ่านอย่างเดียว
// รายการถูกเขียนโดย U9 (RECEIVE_IN) · U10 (RETURN) · การปรับยอดด้วยมือ · การแพ็กคำสั่งซื้อลูกค้า
// ตรวจว่ามีหนังสือเล่มนี้จริงก่อน เพื่อให้ id มั่วได้ 404 แทนที่จะได้ลิสต์ว่างที่ดูเหมือนปกติ
func (s *InventoryService) TransactionsForBook(bookID int) ([]model.StockTransaction, error) {
	if _, err := s.books.Find(s.db, bookID); err != nil {
		return nil, err
	}
	return s.inventory.TransactionsForBook(bookID)
}

// AdjustmentTransactions — ประวัติการปรับยอดด้วยมือสำหรับผู้จัดการร้าน
func (s *InventoryService) AdjustmentTransactions() ([]model.StockTransaction, error) {
	return s.inventory.AdjustmentTransactions()
}

// ── ปรับยอดด้วยมือ ──────────────────────────────────────────────────────

// AdjustStock — พนักงานคลังปรับยอดคงเหลือเอง (`InventoryItem.adjust(qty, reason)`)
//
// ตรวจทุกเล่มให้ครบก่อนเขียนอะไรลงไป — abnormal flow ของหน้าจอคือ
// "ยอดคงเหลือติดลบ → ไม่อนุญาตให้บันทึก" การเขียนไปครึ่งทางแล้วค่อยล้มจะแย่กว่า
// จึงใช้ ApplyStrictStockChanges ที่ไม่ปัดยอดขึ้นเป็นศูนย์เหมือนเส้นทางจัดซื้อ
func (s *InventoryService) AdjustStock(input AdjustInput, by string) ([]model.StockTransaction, error) {
	if len(input.Lines) == 0 {
		return nil, model.ErrNoStockLines
	}

	txns := make([]model.StockTransaction, 0, len(input.Lines))
	deltas := map[int]int{}
	now := time.Now().UTC()

	for _, line := range input.Lines {
		if line.QuantityChange == 0 {
			return nil, model.Validation("INVALID_QUANTITY_CHANGE", "จำนวนที่ปรับต้องไม่เป็นศูนย์")
		}
		reason := strings.TrimSpace(line.Reason)
		if reason == "" {
			return nil, model.ErrReasonRequired
		}
		exists, err := s.books.Exists(line.BookID)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, model.ErrBookNotFound
		}

		deltas[line.BookID] += line.QuantityChange
		txns = append(txns, model.StockTransaction{
			BookID:         line.BookID,
			Type:           model.StockTxnTypeAdjustment,
			QuantityChange: line.QuantityChange,
			Reason:         reason,
			ReferenceDoc:   strings.TrimSpace(line.ReferenceDoc),
			TxnDate:        now,
		})
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.assertNoNegativeStock(tx, deltas); err != nil {
			return err
		}
		return s.inventory.ApplyStrictStockChanges(tx, txns)
	})
	if err != nil {
		return nil, err
	}
	return txns, nil
}

// assertNoNegativeStock — ยอดรวมหลังปรับของทุกเล่มต้องไม่ติดลบ (ล็อกแถวไว้ระหว่างตรวจ)
func (s *InventoryService) assertNoNegativeStock(tx *gorm.DB, deltas map[int]int) error {
	bookIDs := make([]int, 0, len(deltas))
	for bookID := range deltas {
		bookIDs = append(bookIDs, bookID)
	}

	items, err := s.inventory.LockItemsByBook(tx, bookIDs)
	if err != nil {
		return err
	}
	for bookID, delta := range deltas {
		item, ok := items[bookID]
		if !ok {
			return model.ErrInventoryNotFound
		}
		if item.QuantityOnHand+delta < 0 {
			return model.ErrNegativeStock
		}
	}
	return nil
}

// ── รอบการตรวจนับ ───────────────────────────────────────────────────────

func (s *InventoryService) ListStockCounts() ([]StockCountView, error) {
	counts, err := s.inventory.ListStockCounts()
	if err != nil {
		return nil, err
	}
	books, err := s.books.BooksByID()
	if err != nil {
		return nil, err
	}

	views := make([]StockCountView, len(counts))
	for i, count := range counts {
		views[i] = StockCountView{Count: count, Books: books}
	}
	return views, nil
}

func (s *InventoryService) GetStockCount(countID int) (*StockCountView, error) {
	count, err := s.inventory.FindStockCount(countID)
	if err != nil {
		return nil, err
	}
	return s.countView(*count)
}

func (s *InventoryService) countView(count model.StockCount) (*StockCountView, error) {
	books, err := s.books.BooksByID()
	if err != nil {
		return nil, err
	}
	return &StockCountView{Count: count, Books: books}, nil
}

// SaveStockCount — บันทึกผลการตรวจนับหนึ่งรอบ (`WarehouseStaff.countStock()`)
//
// ยอดที่ระบบบันทึกไว้ต้องอ่านตอนบันทึก ไม่ใช่ตอนเปิดฟอร์ม ไม่งั้นถ้ามีการรับสินค้าคั่นกลาง
// ผลต่างที่ได้จะเทียบกับยอดที่ล้าสมัยไปแล้ว · แถวที่นับได้ไม่ตรงจะเปิดรายงานให้ผู้จัดการอัตโนมัติ
func (s *InventoryService) SaveStockCount(input StockCountInput, by string) (*StockCountView, error) {
	if len(input.Items) == 0 {
		return nil, model.ErrNoStockLines
	}

	seen := map[int]bool{}
	bookIDs := make([]int, 0, len(input.Items))
	for _, line := range input.Items {
		if line.CountedQty < 0 {
			return nil, model.ErrNegativeCountedQty
		}
		if seen[line.BookID] {
			return nil, model.ErrDuplicateBookInDocument
		}
		exists, err := s.books.Exists(line.BookID)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, model.ErrBookNotFound
		}
		seen[line.BookID] = true
		bookIDs = append(bookIDs, line.BookID)
	}

	count := model.StockCount{
		CountDate: model.Today(),
		Status:    model.StockCountStatusDone,
		CountedBy: by,
	}
	now := time.Now().UTC()

	err := s.db.Transaction(func(tx *gorm.DB) error {
		items, err := s.inventory.LockItemsByBook(tx, bookIDs)
		if err != nil {
			return err
		}
		// สร้างหัวเอกสารก่อน เพื่อให้รายงานผลต่างมี count_id ให้อ้าง
		if err := s.inventory.CreateStockCount(tx, &count); err != nil {
			return err
		}

		lines := make([]model.StockCountItem, 0, len(input.Items))
		reports := 0
		for _, line := range input.Items {
			item, ok := items[line.BookID]
			if !ok {
				return model.ErrInventoryNotFound
			}

			entry := model.StockCountItem{
				CountID:    count.CountID,
				BookID:     line.BookID,
				SystemQty:  item.QuantityOnHand,
				CountedQty: line.CountedQty,
			}
			if entry.ComputeVariance() != 0 {
				report := model.StockDiscrepancyReport{
					CountID:        count.CountID,
					BookID:         line.BookID,
					Variance:       entry.Variance,
					ApprovalStatus: model.ApprovalStatusPending,
					ReportedBy:     by,
					ReportedAt:     now,
				}
				if err := s.inventory.CreateReport(tx, &report); err != nil {
					return err
				}
				entry.ReportID = &report.ReportID
				reports++
			}
			lines = append(lines, entry)
		}

		if err := s.inventory.CreateCountItems(tx, lines); err != nil {
			return err
		}
		count.Items = lines

		if reports == 0 {
			return nil
		}
		body := fmt.Sprintf("%s · พบ %d รายการที่จำนวนไม่ตรง · ผู้ตรวจนับ %s",
			model.FormatCountCode(count.CountID), reports, by)
		return pushBothChannels(tx, s.notifications, model.RoleManager,
			model.NotifyStockDiscrepancy, "พบจำนวนหนังสือคลาดเคลื่อน", body,
			"/admin/stock/discrepancies")
	})
	if err != nil {
		return nil, err
	}
	return s.countView(count)
}

// ── รายงานผลต่าง ────────────────────────────────────────────────────────

func (s *InventoryService) ListDiscrepancies(status model.ApprovalStatus) ([]DiscrepancyView, error) {
	if status != "" && !status.IsValid() {
		return nil, model.Validation("INVALID_APPROVAL_STATUS", "ผลการตัดสินไม่ถูกต้อง")
	}
	reports, err := s.inventory.ListDiscrepancies(status)
	if err != nil {
		return nil, err
	}
	books, err := s.books.BooksByID()
	if err != nil {
		return nil, err
	}

	views := make([]DiscrepancyView, len(reports))
	for i, report := range reports {
		views[i] = DiscrepancyView{Report: report, Book: books[report.BookID]}
	}
	return views, nil
}

// Decide — ผู้จัดการอนุมัติหรือปฏิเสธรายงานผลต่าง
//
// อนุมัติ = **ตั้งยอดคงเหลือเท่าที่นับได้** ไม่ใช่บวก variance ที่เก็บไว้
// เพราะหนังสืออาจเคลื่อนไหวไปแล้วระหว่างรอผู้จัดการตัดสิน · ปฏิเสธ = ยอดไม่ขยับ
func (s *InventoryService) Decide(
	reportID int, status model.ApprovalStatus, input DecisionInput, by string,
) (*DiscrepancyView, error) {
	note := strings.TrimSpace(input.Note)
	if status == model.ApprovalStatusRejected && note == "" {
		return nil, model.ErrReasonRequired
	}

	var report *model.StockDiscrepancyReport
	err := s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.inventory.FindReportForUpdate(tx, reportID)
		if err != nil {
			return err
		}
		report = found

		if err := report.Decide(status, note, by, time.Now()); err != nil {
			return err
		}
		if err := s.inventory.SaveReport(tx, report); err != nil {
			return err
		}
		if status != model.ApprovalStatusApproved {
			return nil
		}
		return s.applyCountedQty(tx, report)
	})
	if err != nil {
		return nil, err
	}
	book, err := s.books.Find(s.db, report.BookID)
	if err != nil {
		return nil, err
	}
	return &DiscrepancyView{Report: *report, Book: *book}, nil
}

// applyCountedQty — ปรับยอดคงเหลือให้เท่ากับจำนวนที่นับได้ พร้อมออกรายการเคลื่อนไหว
func (s *InventoryService) applyCountedQty(tx *gorm.DB, report *model.StockDiscrepancyReport) error {
	counted, err := s.inventory.CountedQty(tx, report.CountID, report.BookID)
	if err != nil {
		return err
	}
	items, err := s.inventory.LockItemsByBook(tx, []int{report.BookID})
	if err != nil {
		return err
	}
	item, ok := items[report.BookID]
	if !ok {
		return model.ErrInventoryNotFound
	}

	change := counted - item.QuantityOnHand
	if change == 0 {
		return nil
	}
	return s.inventory.ApplyStrictStockChanges(tx, []model.StockTransaction{{
		BookID:         report.BookID,
		Type:           model.StockTxnTypeAdjustment,
		QuantityChange: change,
		Reason:         "ปรับปรุงยอดตามผลการตรวจนับ",
		ReferenceDoc:   model.FormatReportCode(report.ReportID),
		TxnDate:        time.Now().UTC(),
	}})
}
