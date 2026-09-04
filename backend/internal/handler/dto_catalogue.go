// dto_catalogue.go — รูปร่าง JSON ของแคตตาล็อกหน้าร้าน (เส้นทางสาธารณะ)
//
// ต่างจาก bookDTO ของหลังร้านตรงที่แบน "ยอดคงเหลือ" กับ "คะแนนเฉลี่ย" เข้ามาด้วย
// เพราะหน้าร้านต้องใช้ทั้งสองอย่างบนการ์ดทุกใบ ถ้าให้ไปถามทีละเส้นทางจะกลายเป็น
// สามคำขอต่อหนึ่งหน้าจอ · ไม่มี status/statusLabel เพราะที่นี่มีแต่เล่มที่ขายอยู่
package handler

import (
	"math"
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

type catalogueBookDTO struct {
	BookID          int              `json:"bookId"`
	ISBN            string           `json:"isbn"`
	Title           string           `json:"title"`
	Author          string           `json:"author"`
	Publisher       string           `json:"publisher"`
	Price           float64          `json:"price"`
	Description     string           `json:"description"`
	CategoryID      int              `json:"categoryId"`
	CategoryName    string           `json:"categoryName"`
	QuantityOnHand  int              `json:"quantityOnHand"`
	StockLevel      model.StockLevel `json:"stockLevel"`
	StockLevelLabel string           `json:"stockLevelLabel"`
	// RatingAverage ปัดหนึ่งตำแหน่งตรงนี้ เพราะทุกหน้าจอแสดงทศนิยมเดียวเหมือนกันหมด
	// ถ้าปล่อยเป็น 4.666666 ไปให้หน้าจอปัดเอง สองที่ปัดคนละแบบเมื่อไรก็เพี้ยนทันที
	RatingAverage float64 `json:"ratingAverage"`
	RatingCount   int     `json:"ratingCount"`
}

// catalogueReviewDTO — รีวิวที่ลูกค้าเห็นบนหน้ารายละเอียด
//
// ตัดฟิลด์ของงานตรวจสอบออกหมด (flagged · report · customerId) — คนนอกไม่ต้องรู้
// ว่ารีวิวไหนเคยติดธง เหลือแต่สิ่งที่การ์ดรีวิวใช้จริง
type catalogueReviewDTO struct {
	ReviewID         int              `json:"reviewId"`
	CustomerName     string           `json:"customerName"`
	Rating           int              `json:"rating"`
	Headline         string           `json:"headline,omitempty"`
	Comment          string           `json:"comment"`
	VerifiedPurchase bool             `json:"verifiedPurchase"`
	CreatedDate      time.Time        `json:"createdDate"`
	Replies          []reviewReplyDTO `json:"replies"`
}

type catalogueDetailDTO struct {
	catalogueBookDTO
	Reviews []catalogueReviewDTO `json:"reviews"`
}

func toCatalogueBookDTO(row service.CatalogueRow) catalogueBookDTO {
	book := row.Book
	return catalogueBookDTO{
		BookID:          book.BookID,
		ISBN:            book.ISBN,
		Title:           book.Title,
		Author:          book.Author,
		Publisher:       book.Publisher,
		Price:           book.Price,
		Description:     book.Description,
		CategoryID:      book.CategoryID,
		CategoryName:    row.CategoryName,
		QuantityOnHand:  row.QuantityOnHand,
		StockLevel:      row.Level,
		StockLevelLabel: row.Level.Label(),
		RatingAverage:   math.Round(row.Rating.Average*10) / 10,
		RatingCount:     row.Rating.Count,
	}
}

func toCatalogueBookDTOs(rows []service.CatalogueRow) []catalogueBookDTO {
	out := make([]catalogueBookDTO, len(rows))
	for i, row := range rows {
		out[i] = toCatalogueBookDTO(row)
	}
	return out
}

func toCatalogueDetailDTO(detail service.CatalogueDetail) catalogueDetailDTO {
	reviews := make([]catalogueReviewDTO, len(detail.Reviews))
	for i, row := range detail.Reviews {
		reviews[i] = toCatalogueReviewDTO(row)
	}
	return catalogueDetailDTO{
		catalogueBookDTO: toCatalogueBookDTO(detail.CatalogueRow),
		Reviews:          reviews,
	}
}

func toCatalogueReviewDTO(row repository.ReviewRow) catalogueReviewDTO {
	review := row.Review

	replies := make([]reviewReplyDTO, len(review.Replies))
	for i, reply := range review.Replies {
		replies[i] = reviewReplyDTO{
			ReplyID:     reply.ReplyID,
			ReplyText:   reply.ReplyText,
			RepliedDate: reply.RepliedDate,
			RepliedBy:   reply.RepliedBy,
		}
	}

	return catalogueReviewDTO{
		ReviewID:         review.ReviewID,
		CustomerName:     row.Customer.Name(),
		Rating:           review.Rating,
		Headline:         review.Headline,
		Comment:          review.Comment,
		VerifiedPurchase: review.IsVerifiedPurchase(),
		CreatedDate:      review.CreatedDate,
		Replies:          replies,
	}
}
