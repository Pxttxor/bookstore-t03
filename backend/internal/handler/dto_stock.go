// dto_stock.go — รูปร่าง JSON ของยอดคงเหลือ รอบตรวจนับ และรายงานผลต่าง
//
// ทุกก้อนแบนชื่อหนังสือกับป้ายไทยเข้ามา เพราะหน้าจอแสดงคู่กันเสมอ
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type stockRowDTO struct {
	BookID         int       `json:"bookId"`
	Title          string    `json:"title"`
	ISBN           string    `json:"isbn"`
	QuantityOnHand int       `json:"quantityOnHand"`
	ReorderPoint   *int      `json:"reorderPoint,omitempty"`
	LastUpdated    time.Time `json:"lastUpdated"`
	Level          string    `json:"level"`
	LevelLabel     string    `json:"levelLabel"`
	// BelowReorder มาจากจุดสั่งซื้อรายเล่มของ U5 — คนละเกณฑ์กับ Level ที่ใช้ค่าคงที่
	BelowReorder bool `json:"belowReorder"`
}

type stockCountItemDTO struct {
	BookID     int    `json:"bookId"`
	Title      string `json:"title"`
	SystemQty  int    `json:"systemQty"`
	CountedQty int    `json:"countedQty"`
	Variance   int    `json:"variance"`
	ReportID   *int   `json:"reportId,omitempty"`
}

type stockCountDTO struct {
	CountID     int                 `json:"countId"`
	Code        string              `json:"code"`
	CountDate   model.Date          `json:"countDate"`
	Status      string              `json:"status"`
	StatusLabel string              `json:"statusLabel"`
	CountedBy   string              `json:"countedBy"`
	Items       []stockCountItemDTO `json:"items"`
}

type discrepancyDTO struct {
	ReportID       int        `json:"reportId"`
	Code           string     `json:"code"`
	CountID        int        `json:"countId"`
	CountCode      string     `json:"countCode"`
	BookID         int        `json:"bookId"`
	Title          string     `json:"title"`
	Variance       int        `json:"variance"`
	ApprovalStatus string     `json:"approvalStatus"`
	ApprovalLabel  string     `json:"approvalLabel"`
	Note           string     `json:"note"`
	ReportedBy     string     `json:"reportedBy"`
	ReportedAt     time.Time  `json:"reportedAt"`
	ResolvedBy     string     `json:"resolvedBy,omitempty"`
	ResolvedAt     *time.Time `json:"resolvedAt,omitempty"`
}

func toStockRowDTOs(rows []service.StockRow) []stockRowDTO {
	out := make([]stockRowDTO, len(rows))
	for i, row := range rows {
		out[i] = stockRowDTO{
			BookID:         row.Item.BookID,
			Title:          row.Book.Title,
			ISBN:           row.Book.ISBN,
			QuantityOnHand: row.Item.QuantityOnHand,
			ReorderPoint:   row.Item.ReorderPoint,
			LastUpdated:    row.Item.LastUpdated,
			Level:          string(row.Level),
			LevelLabel:     row.Level.Label(),
			BelowReorder:   row.Item.IsBelowReorder(),
		}
	}
	return out
}

func toStockCountDTO(view service.StockCountView) stockCountDTO {
	count := view.Count
	items := make([]stockCountItemDTO, len(count.Items))
	for i, item := range count.Items {
		items[i] = stockCountItemDTO{
			BookID:     item.BookID,
			Title:      view.Books[item.BookID].Title,
			SystemQty:  item.SystemQty,
			CountedQty: item.CountedQty,
			Variance:   item.Variance,
			ReportID:   item.ReportID,
		}
	}
	return stockCountDTO{
		CountID:     count.CountID,
		Code:        model.FormatCountCode(count.CountID),
		CountDate:   count.CountDate,
		Status:      string(count.Status),
		StatusLabel: count.Status.Label(),
		CountedBy:   count.CountedBy,
		Items:       items,
	}
}

func toStockCountDTOs(views []service.StockCountView) []stockCountDTO {
	out := make([]stockCountDTO, len(views))
	for i, view := range views {
		out[i] = toStockCountDTO(view)
	}
	return out
}

func toDiscrepancyDTO(view service.DiscrepancyView) discrepancyDTO {
	report := view.Report
	return discrepancyDTO{
		ReportID:       report.ReportID,
		Code:           model.FormatReportCode(report.ReportID),
		CountID:        report.CountID,
		CountCode:      model.FormatCountCode(report.CountID),
		BookID:         report.BookID,
		Title:          view.Book.Title,
		Variance:       report.Variance,
		ApprovalStatus: string(report.ApprovalStatus),
		ApprovalLabel:  report.ApprovalStatus.Label(),
		Note:           report.Note,
		ReportedBy:     report.ReportedBy,
		ReportedAt:     report.ReportedAt,
		ResolvedBy:     report.ResolvedBy,
		ResolvedAt:     report.ResolvedAt,
	}
}

func toDiscrepancyDTOs(views []service.DiscrepancyView) []discrepancyDTO {
	out := make([]discrepancyDTO, len(views))
	for i, view := range views {
		out[i] = toDiscrepancyDTO(view)
	}
	return out
}
