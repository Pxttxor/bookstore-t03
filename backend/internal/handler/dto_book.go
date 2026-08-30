// dto_book.go — รูปร่าง JSON ของหมวดหมู่ หนังสือ และประวัติการแก้ไข
//
// หน้าจอแสดงชื่อหมวดหมู่และป้ายสถานะคู่กับหนังสือเสมอ จึงแบนเข้ามาที่นี่
// แทนที่จะให้หน้าจอไปหาชื่อจากรายการหมวดหมู่เอง (แนวเดียวกับ supplierBookDTO)
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type bookDTO struct {
	BookID       int              `json:"bookId"`
	ISBN         string           `json:"isbn"`
	Title        string           `json:"title"`
	Author       string           `json:"author"`
	Publisher    string           `json:"publisher"`
	Price        float64          `json:"price"`
	Description  string           `json:"description"`
	CategoryID   int              `json:"categoryId"`
	CategoryName string           `json:"categoryName"`
	Status       model.BookStatus `json:"status"`
	StatusLabel  string           `json:"statusLabel"`
}

type bookChangeLogDTO struct {
	LogID        int       `json:"logId"`
	BookID       int       `json:"bookId"`
	ChangedField string    `json:"changedField"`
	FieldLabel   string    `json:"fieldLabel"`
	OldValue     string    `json:"oldValue"`
	NewValue     string    `json:"newValue"`
	ChangedDate  time.Time `json:"changedDate"`
	ChangedBy    string    `json:"changedBy"`
}

func toBookDTO(view service.BookView) bookDTO {
	book := view.Book
	return bookDTO{
		BookID:       book.BookID,
		ISBN:         book.ISBN,
		Title:        book.Title,
		Author:       book.Author,
		Publisher:    book.Publisher,
		Price:        book.Price,
		Description:  book.Description,
		CategoryID:   book.CategoryID,
		CategoryName: view.CategoryName,
		Status:       book.Status,
		StatusLabel:  book.Status.Label(),
	}
}

func toBookDTOs(views []service.BookView) []bookDTO {
	out := make([]bookDTO, len(views))
	for i, view := range views {
		out[i] = toBookDTO(view)
	}
	return out
}

func toChangeLogDTOs(logs []model.BookChangeLog) []bookChangeLogDTO {
	out := make([]bookChangeLogDTO, len(logs))
	for i, log := range logs {
		out[i] = bookChangeLogDTO{
			LogID:        log.LogID,
			BookID:       log.BookID,
			ChangedField: log.ChangedField,
			FieldLabel:   log.FieldLabel(),
			OldValue:     log.OldValue,
			NewValue:     log.NewValue,
			ChangedDate:  log.ChangedDate,
			ChangedBy:    log.ChangedBy,
		}
	}
	return out
}
