// Package handler — ชั้น HTTP: อ่าน request แปลงเป็น DTO เรียก service แล้วเขียน response
//
// dto.go — โครงสร้างที่ส่งออกทาง JSON
//
// ไม่ส่ง struct ของ model ออกตรง ๆ ทั้งหมด เพราะสัญญาที่หน้าจอคาดหวังต่างจากรูปในฐานข้อมูล
// สองจุด: SupplierBook ต้องมีรายละเอียดหนังสือติดไปด้วย และการชดเชยของใบส่งคืนเป็น object ซ้อน
package handler

import (
	"time"

	"bookstore-t03/internal/model"
)

// supplierBookDTO — แบนรายละเอียดหนังสือเข้ามาในรายการที่ผู้จัดจำหน่ายเสนอขาย
// ตรงกับ interface SupplierBook ใน frontend/src/admin/suppliers/suppliers.ts
type supplierBookDTO struct {
	BookID       int     `json:"bookId"`
	ISBN         string  `json:"isbn"`
	Title        string  `json:"title"`
	Author       string  `json:"author"`
	Publisher    string  `json:"publisher"`
	SupplyPrice  float64 `json:"supplyPrice"`
	LeadTimeDays int     `json:"leadTimeDays"`
}

type supplierDTO struct {
	SupplierID   int                         `json:"supplierId"`
	CompanyName  string                      `json:"companyName"`
	ContactName  string                      `json:"contactName"`
	Phone        string                      `json:"phone"`
	Email        string                      `json:"email"`
	Address      string                      `json:"address"`
	TradeTerms   string                      `json:"tradeTerms"`
	CreditTerms  string                      `json:"creditTerms"`
	Status       model.SupplierStatus        `json:"status"`
	StatusLabel  string                      `json:"statusLabel"`
	Code         string                      `json:"code"`
	Books        []supplierBookDTO           `json:"books"`
	EditHistory  []model.SupplierEditLog     `json:"editHistory"`
	Deactivation *model.SupplierDeactivation `json:"deactivation,omitempty"`
}

func toSupplierDTO(supplier model.Supplier) supplierDTO {
	books := make([]supplierBookDTO, 0, len(supplier.Books))
	for _, entry := range supplier.Books {
		dto := supplierBookDTO{
			BookID:       entry.BookID,
			SupplyPrice:  entry.SupplyPrice,
			LeadTimeDays: entry.LeadTimeDays,
		}
		if entry.Book != nil {
			dto.ISBN = entry.Book.ISBN
			dto.Title = entry.Book.Title
			dto.Author = entry.Book.Author
			dto.Publisher = entry.Book.Publisher
		}
		books = append(books, dto)
	}

	history := supplier.EditHistory
	if history == nil {
		history = []model.SupplierEditLog{}
	}

	return supplierDTO{
		SupplierID:   supplier.SupplierID,
		CompanyName:  supplier.CompanyName,
		ContactName:  supplier.ContactName,
		Phone:        supplier.Phone,
		Email:        supplier.Email,
		Address:      supplier.Address,
		TradeTerms:   supplier.TradeTerms,
		CreditTerms:  supplier.CreditTerms,
		Status:       supplier.Status,
		StatusLabel:  supplier.Status.Label(),
		Code:         model.FormatSupplierCode(supplier.SupplierID),
		Books:        books,
		EditHistory:  history,
		Deactivation: supplier.Deactivation,
	}
}

func toSupplierDTOs(suppliers []model.Supplier) []supplierDTO {
	out := make([]supplierDTO, 0, len(suppliers))
	for _, supplier := range suppliers {
		out = append(out, toSupplierDTO(supplier))
	}
	return out
}

// compensationDTO — การชดเชยของใบส่งคืน เก็บแบนในฐานข้อมูลแต่ส่งออกเป็น object
// ตรงกับ interface Compensation ฝั่ง frontend
type compensationDTO struct {
	Type model.CompensationType `json:"type"`
	Note string                 `json:"note"`
	At   time.Time              `json:"at"`
	By   string                 `json:"by"`
}

type purchaseReturnDTO struct {
	ReturnID       int                        `json:"returnId"`
	POID           int                        `json:"poId"`
	ReturnDate     model.Date                 `json:"returnDate"`
	Reason         string                     `json:"reason"`
	Status         model.ReturnStatus         `json:"status"`
	StatusLabel    string                     `json:"statusLabel"`
	Code           string                     `json:"code"`
	CreatedBy      string                     `json:"createdBy"`
	EscalationNote string                     `json:"escalationNote,omitempty"`
	Compensation   *compensationDTO           `json:"compensation,omitempty"`
	Items          []model.PurchaseReturnItem `json:"items"`
}

func toReturnDTO(entry model.PurchaseReturn) purchaseReturnDTO {
	dto := purchaseReturnDTO{
		ReturnID:       entry.ReturnID,
		POID:           entry.POID,
		ReturnDate:     entry.ReturnDate,
		Reason:         entry.Reason,
		Status:         entry.Status,
		StatusLabel:    entry.Status.Label(),
		Code:           model.FormatReturnCode(entry.ReturnID),
		CreatedBy:      entry.CreatedBy,
		EscalationNote: entry.EscalationNote,
		Items:          entry.Items,
	}
	if entry.CompensationType != "" && entry.CompensationAt != nil {
		dto.Compensation = &compensationDTO{
			Type: entry.CompensationType,
			Note: entry.CompensationNote,
			At:   *entry.CompensationAt,
			By:   entry.CompensationBy,
		}
	}
	return dto
}

func toReturnDTOs(entries []model.PurchaseReturn) []purchaseReturnDTO {
	out := make([]purchaseReturnDTO, 0, len(entries))
	for _, entry := range entries {
		out = append(out, toReturnDTO(entry))
	}
	return out
}

// requisitionDTO / orderDTO / receiptDTO — เหมือน model แต่เติมป้ายไทยและรหัสเอกสาร
// ให้หน้าจอไม่ต้องประกอบเอง

type requisitionDTO struct {
	model.PurchaseRequisition
	StatusLabel string  `json:"statusLabel"`
	Code        string  `json:"code"`
	Total       float64 `json:"total"`
}

func toRequisitionDTO(pr model.PurchaseRequisition) requisitionDTO {
	return requisitionDTO{
		PurchaseRequisition: pr,
		StatusLabel:         pr.Status.Label(),
		Code:                model.FormatPRCode(pr.PRID),
		Total:               model.DocumentTotal(pr.Items),
	}
}

func toRequisitionDTOs(rows []model.PurchaseRequisition) []requisitionDTO {
	out := make([]requisitionDTO, 0, len(rows))
	for _, pr := range rows {
		out = append(out, toRequisitionDTO(pr))
	}
	return out
}

// displayStatus — POStatus ไม่มีค่าสำหรับ "อนุมัติแล้ว รอส่ง" กับ "รอยืนยัน"
// ใบที่อนุมัติแล้วแยกสองสถานะนี้ด้วยการมี sentAt หรือไม่ (ตรงกับ poDisplayStatus() ฝั่ง frontend)
func displayStatus(po model.PurchaseOrder) (string, string) {
	if po.Status == model.POStatusApproved {
		if po.SentAt != nil {
			return "AWAITING_CONFIRM", "รอยืนยัน"
		}
		return "AWAITING_SEND", "อนุมัติแล้ว รอส่ง"
	}
	return string(po.Status), po.Status.Label()
}

type orderDTO struct {
	model.PurchaseOrder
	DisplayStatus string `json:"displayStatus"`
	StatusLabel   string `json:"statusLabel"`
	Code          string `json:"code"`
}

func toOrderDTO(po model.PurchaseOrder) orderDTO {
	status, label := displayStatus(po)
	return orderDTO{
		PurchaseOrder: po,
		DisplayStatus: status,
		StatusLabel:   label,
		Code:          model.FormatPOCode(po.POID),
	}
}

func toOrderDTOs(rows []model.PurchaseOrder) []orderDTO {
	out := make([]orderDTO, 0, len(rows))
	for _, po := range rows {
		out = append(out, toOrderDTO(po))
	}
	return out
}

type receiptDTO struct {
	model.GoodsReceipt
	StatusLabel string `json:"statusLabel"`
	Code        string `json:"code"`
}

func toReceiptDTO(gr model.GoodsReceipt) receiptDTO {
	return receiptDTO{
		GoodsReceipt: gr,
		StatusLabel:  gr.Status.Label(),
		Code:         model.FormatGRCode(gr.GRID),
	}
}

func toReceiptDTOs(rows []model.GoodsReceipt) []receiptDTO {
	out := make([]receiptDTO, 0, len(rows))
	for _, gr := range rows {
		out = append(out, toReceiptDTO(gr))
	}
	return out
}
