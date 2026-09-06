// dto_review.go — รูปร่าง JSON ของรีวิว คำตอบกลับ และรายงานรีวิว
//
// ชื่อฟิลด์ตรงกับ interface Review / ReviewReply / ReviewReport ใน
// frontend/src/admin/reviews/reviews.ts เท่าที่ฝั่งนี้มีข้อมูลจริงให้
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type reviewReplyDTO struct {
	ReplyID     int       `json:"replyId"`
	ReplyText   string    `json:"replyText"`
	RepliedDate time.Time `json:"repliedDate"`
	RepliedBy   string    `json:"repliedBy"`
}

type reviewReportDTO struct {
	ReportID     int                  `json:"reportId"`
	ReviewID     int                  `json:"reviewId"`
	Reason       string               `json:"reason"`
	Detail       string               `json:"detail,omitempty"`
	ReportedBy   string               `json:"reportedBy"`
	ReportedDate time.Time            `json:"reportedDate"`
	Status       model.ApprovalStatus `json:"status"`
	StatusLabel  string               `json:"statusLabel"`
	DecidedBy    string               `json:"decidedBy,omitempty"`
	DecidedDate  *time.Time           `json:"decidedDate,omitempty"`
}

type reviewDTO struct {
	ReviewID         int                `json:"reviewId"`
	Code             string             `json:"code"`
	CustomerID       int                `json:"customerId"`
	CustomerName     string             `json:"customerName"`
	BookID           int                `json:"bookId"`
	BookTitle        string             `json:"bookTitle"`
	Author           string             `json:"author"`
	ISBN             string             `json:"isbn"`
	Price            float64            `json:"price"`
	OrderID          *int               `json:"orderId,omitempty"`
	OrderCode        string             `json:"orderCode,omitempty"`
	VerifiedPurchase bool               `json:"verifiedPurchase"`
	Rating           int                `json:"rating"`
	Comment          string             `json:"comment"`
	Status           model.ReviewStatus `json:"status"`
	StatusLabel      string             `json:"statusLabel"`
	Flagged          bool               `json:"flagged"`
	CreatedDate      time.Time          `json:"createdDate"`
	Replies          []reviewReplyDTO   `json:"replies"`
	Report           *reviewReportDTO   `json:"report,omitempty"`
}

// reportDTO — รายงานพร้อมรีวิวต้นเรื่อง (คิวของผู้จัดการต้องเห็นทั้งสองอย่าง)
type reportDTO struct {
	reviewReportDTO
	Review reviewDTO `json:"review"`
}

func toReviewDTO(row repository.ReviewRow) reviewDTO {
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

	dto := reviewDTO{
		ReviewID:         review.ReviewID,
		Code:             model.FormatReviewCode(review.ReviewID),
		CustomerID:       review.CustomerID,
		CustomerName:     row.Customer.Name(),
		BookID:           review.BookID,
		BookTitle:        row.Book.Title,
		Author:           row.Book.Author,
		ISBN:             row.Book.ISBN,
		Price:            row.Book.Price,
		OrderID:          review.OrderID,
		VerifiedPurchase: review.IsVerifiedPurchase(),
		Rating:           review.Rating,
		Comment:          review.Comment,
		Status:           review.Status,
		StatusLabel:      review.Status.Label(),
		Flagged:          review.Flagged,
		CreatedDate:      review.CreatedDate,
		Replies:          replies,
	}
	if review.OrderID != nil {
		dto.OrderCode = model.FormatOrderCode(*review.OrderID)
	}
	if row.Report != nil {
		report := toReviewReportDTO(*row.Report)
		dto.Report = &report
	}
	return dto
}

func toReviewDTOs(rows []repository.ReviewRow) []reviewDTO {
	out := make([]reviewDTO, len(rows))
	for i, row := range rows {
		out[i] = toReviewDTO(row)
	}
	return out
}

func toReviewReportDTO(report model.ReviewReport) reviewReportDTO {
	return reviewReportDTO{
		ReportID:     report.ReportID,
		ReviewID:     report.ReviewID,
		Reason:       report.Reason,
		Detail:       report.Detail,
		ReportedBy:   report.ReportedBy,
		ReportedDate: report.ReportedDate,
		Status:       report.Status,
		StatusLabel:  report.Status.Label(),
		DecidedBy:    report.DecidedBy,
		DecidedDate:  report.DecidedDate,
	}
}

func toReportDTO(row repository.ReportRow) reportDTO {
	return reportDTO{
		reviewReportDTO: toReviewReportDTO(row.Report),
		Review:          toReviewDTO(row.Review),
	}
}

func toReportDTOs(rows []repository.ReportRow) []reportDTO {
	out := make([]reportDTO, len(rows))
	for i, row := range rows {
		out[i] = toReportDTO(row)
	}
	return out
}
