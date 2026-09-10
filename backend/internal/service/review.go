// review.go — จัดการรีวิวลูกค้า
//
// สิทธิ์การเขียนรีวิว: ลูกค้าต้องมีคำสั่งซื้อสถานะ "ส่งถึงแล้ว" ที่มีหนังสือเล่มนั้นอยู่
// จึงจะรีวิวได้ · รีวิวที่ ProfanityFilter จับได้ **ไม่ถูกปฏิเสธ** แต่ติดธงเข้าคิวให้พนักงานตรวจ
// (คิว "ตรวจสอบรีวิว" ของหน้าจอมีไว้สำหรับกรณีนี้โดยเฉพาะ)
package service

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type ReviewService struct {
	db            *gorm.DB
	reviews       *repository.ReviewRepository
	orders        *repository.OrderRepository
	books         *repository.BookRepository
	notifications *repository.NotificationRepository
	filter        *model.ProfanityFilter
}

func NewReviewService(
	db *gorm.DB,
	reviews *repository.ReviewRepository,
	orders *repository.OrderRepository,
	books *repository.BookRepository,
	notifications *repository.NotificationRepository,
) *ReviewService {
	return &ReviewService{
		db:            db,
		reviews:       reviews,
		orders:        orders,
		books:         books,
		notifications: notifications,
		filter:        model.DefaultProfanityFilter(),
	}
}

// ReviewInput — ฟอร์มเขียนรีวิวของลูกค้า (`Customer.writeReview()`)
//
// OrderID เป็นใบที่ลูกค้ากดส่งรีวิวมาจริง ๆ — ซื้อเล่มเดิมซ้ำหลายใบจึงรีวิวได้ใบละครั้ง
// ไม่ส่งมา = ให้เซิร์ฟเวอร์เลือกใบที่ส่งถึงแล้วใบล่าสุดให้เอง (พฤติกรรมเดิม)
type ReviewInput struct {
	BookID  int    `json:"bookId"`
	OrderID int    `json:"orderId,omitempty"`
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

// UpdateReviewInput — ฟอร์มแก้ไขรีวิวของลูกค้า
type UpdateReviewInput struct {
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

// ModerateInput — คำสั่งตรวจสอบรีวิวของพนักงาน (`Review.moderate(action)`)
type ModerateInput struct {
	Action model.ModerateAction `json:"action"`
}

// ReplyInput — ข้อความตอบกลับรีวิว
type ReplyInput struct {
	ReplyText string `json:"replyText"`
}

// ReportInput — ฟอร์มส่งรีวิวให้ผู้จัดการพิจารณา
type ReportInput struct {
	Reason string `json:"reason"`
	Detail string `json:"detail,omitempty"`
}

// Submit — ลูกค้าเขียนรีวิวหนังสือที่ได้รับแล้ว
func (s *ReviewService) Submit(current Identity, input ReviewInput) (*repository.ReviewRow, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}
	if _, err := s.books.Find(s.db, input.BookID); err != nil {
		return nil, err
	}

	var created model.Review
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// ต้องเคยซื้อและได้รับของแล้ว — ใบที่พบจะถูกผูกเป็น verified purchase ให้เอง
		// ระบุใบมาเอง (ซื้อเล่มเดิมซ้ำหลายใบ) ก็ตรวจเฉพาะใบนั้น ไม่ระบุ = ใช้ใบล่าสุดเหมือนเดิม
		orderID := input.OrderID
		if orderID > 0 {
			ok, err := s.orders.DeliveredOrderHasBook(tx, current.CustomerID, orderID, input.BookID)
			if err != nil {
				return err
			}
			if !ok {
				return model.ErrReviewNotPurchased
			}
		} else {
			found, err := s.orders.DeliveredOrderForBook(tx, current.CustomerID, input.BookID)
			if err != nil {
				return err
			}
			if found == 0 {
				return model.ErrReviewNotPurchased
			}
			orderID = found
		}

		taken, err := s.reviews.ExistsFor(tx, current.CustomerID, input.BookID, orderID)
		if err != nil {
			return err
		}
		if taken {
			return model.ErrReviewDuplicated
		}

		review := model.Review{
			CustomerID: current.CustomerID,
			BookID:     input.BookID,
			OrderID:    &orderID,
			Rating:     input.Rating,
			Comment:    input.Comment,
		}
		if err := review.Submit(s.filter, time.Now()); err != nil {
			return err
		}
		if err := s.reviews.Create(tx, &review); err != nil {
			return err
		}

		created = review
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.reviews.Find(s.db, created.ReviewID)
}

// Update — ลูกค้าแก้ไขรีวิวของตนเอง
func (s *ReviewService) Update(current Identity, reviewID int, input UpdateReviewInput) (*repository.ReviewRow, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		review, err := s.reviews.FindForUpdate(tx, reviewID)
		if err != nil {
			return err
		}
		if review.CustomerID != current.CustomerID {
			return model.ErrForbidden
		}
		if review.Status == model.ReviewStatusRemoved {
			return model.ErrReviewRemoved
		}
		if err := review.Update(input.Rating, input.Comment, s.filter); err != nil {
			return err
		}
		return s.reviews.Save(tx, review)
	})
	if err != nil {
		return nil, err
	}
	return s.reviews.Find(s.db, reviewID)
}

// Delete — ลูกค้าลบรีวิวของตนเอง (หรือผู้จัดการลบ)
func (s *ReviewService) Delete(current Identity, reviewID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		review, err := s.reviews.FindForUpdate(tx, reviewID)
		if err != nil {
			return err
		}
		if current.IsCustomer() && review.CustomerID != current.CustomerID {
			return model.ErrForbidden
		}
		return s.reviews.Delete(tx, reviewID)
	})
}

// List — รายการรีวิว · ลูกค้าเห็นเฉพาะรีวิวของตัวเองเสมอ ไม่ว่าจะส่งตัวกรองอะไรมา
// (กติกาเดียวกับ DeliveryService.List และ OrderService.List)
func (s *ReviewService) List(current Identity, filter repository.ReviewFilter) ([]repository.ReviewRow, error) {
	if filter.Status != "" && !filter.Status.IsValid() {
		return nil, model.ErrInvalidReviewStatus
	}
	if current.IsCustomer() {
		filter.CustomerID = current.CustomerID
	}
	return s.reviews.List(filter)
}

func (s *ReviewService) Get(current Identity, reviewID int) (*repository.ReviewRow, error) {
	row, err := s.reviews.Find(s.db, reviewID)
	if err != nil {
		return nil, err
	}
	if current.IsCustomer() && row.Review.CustomerID != current.CustomerID {
		return nil, model.ErrForbidden
	}
	return row, nil
}

// ForBook — รีวิวที่ขึ้นหน้าร้านของหนังสือเล่มหนึ่ง (เฉพาะที่ตรวจสอบผ่านแล้ว)
func (s *ReviewService) ForBook(bookID int) ([]repository.ReviewRow, error) {
	if _, err := s.books.Find(s.db, bookID); err != nil {
		return nil, err
	}
	return s.reviews.List(repository.ReviewFilter{
		BookID: bookID,
		Status: model.ReviewStatusPublished,
	})
}

// Moderate — พนักงานตรวจสอบรีวิว
//
// ถ้ารีวิวนี้มีรายงานที่ยังไม่ถูกตัดสิน ให้ปิดรายงานในทรานแซกชันเดียวกัน:
// เผยแพร่ = รายงานไม่เป็นผล (REJECTED) · ซ่อน/ลบ = รายงานเป็นผล (APPROVED)
// แยกเป็นสองปุ่มไม่ได้ ไม่งั้นสถานะของรีวิวกับผลของรายงานมีโอกาสไม่ตรงกัน
// (เหตุผลเดียวกับการตรวจสลิปที่เขียน customer_order กับ payment พร้อมกัน)
func (s *ReviewService) Moderate(reviewID int, input ModerateInput, by string) (*repository.ReviewRow, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		review, err := s.reviews.FindForUpdate(tx, reviewID)
		if err != nil {
			return err
		}
		if err := review.Moderate(input.Action); err != nil {
			return err
		}
		if err := s.reviews.Save(tx, review); err != nil {
			return err
		}

		decision := model.ApprovalStatusApproved
		if input.Action == model.ModerateActionPublish {
			decision = model.ApprovalStatusRejected
		}
		return s.closePendingReport(tx, reviewID, decision, by)
	})
	if err != nil {
		return nil, err
	}
	return s.reviews.Find(s.db, reviewID)
}

// closePendingReport — ปิดรายงานที่ยังค้างของรีวิวนี้ ในทรานแซกชันเดียวกับที่เปลี่ยนสถานะรีวิว
//
// ไม่มีรายงาน หรือรายงานถูกตัดสินไปแล้ว = ไม่ต้องทำอะไร (ไม่ใช่ข้อผิดพลาด)
func (s *ReviewService) closePendingReport(
	tx *gorm.DB, reviewID int, decision model.ApprovalStatus, by string,
) error {
	report, err := s.reviews.FindReportByReview(tx, reviewID)
	if err != nil {
		return err
	}
	if report == nil || report.Status != model.ApprovalStatusPending {
		return nil
	}
	if err := report.Decide(decision, by, time.Now()); err != nil {
		return err
	}
	return s.reviews.SaveReport(tx, report)
}

// Reply — พนักงานตอบกลับรีวิว แล้วรีวิวขึ้นหน้าร้าน
//
// ตอบกลับ = ยอมรับรีวิวนั้นไปในตัว (`Review.AddReply` ดันสถานะเป็น PUBLISHED)
// รายงานที่ยังค้างของรีวิวนี้จึงต้องปิดว่า **ไม่เป็นผล** ในทรานแซกชันเดียวกัน
// เหมือนที่ `Moderate` ทำกับคำสั่ง PUBLISH — ไม่งั้นรีวิวขึ้นหน้าร้านแล้วแต่รายงาน
// ยังค้าง PENDING ทำให้คิว "รอตรวจสอบ" ของผู้จัดการไม่ขยับตามที่ตัดสินไป
func (s *ReviewService) Reply(reviewID int, input ReplyInput, by string) (*repository.ReviewRow, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		review, err := s.reviews.FindForUpdate(tx, reviewID)
		if err != nil {
			return err
		}

		before := len(review.Replies)
		if err := review.AddReply(input.ReplyText, by, time.Now()); err != nil {
			return err
		}
		if err := s.reviews.Save(tx, review); err != nil {
			return err
		}

		fresh := review.Replies[before:]
		for i := range fresh {
			fresh[i].ReviewID = review.ReviewID
		}
		if err := s.reviews.AddReplies(tx, fresh); err != nil {
			return err
		}
		return s.closePendingReport(tx, reviewID, model.ApprovalStatusRejected, by)
	})
	if err != nil {
		return nil, err
	}
	return s.reviews.Find(s.db, reviewID)
}

// Report — ฝ่ายขายส่งรีวิวให้ผู้จัดการพิจารณา (Review --> ReviewReport : escalates)
func (s *ReviewService) Report(reviewID int, input ReportInput, by string) (*repository.ReportRow, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, model.ErrEmptyReportReason
	}

	var created model.ReviewReport
	err := s.db.Transaction(func(tx *gorm.DB) error {
		review, err := s.reviews.FindForUpdate(tx, reviewID)
		if err != nil {
			return err
		}
		if review.Status == model.ReviewStatusRemoved {
			return model.ErrReviewRemoved
		}

		// 0..1 ใน diagram — รีวิวหนึ่งชิ้นมีรายงานได้ใบเดียว
		existing, err := s.reviews.FindReportByReview(tx, reviewID)
		if err != nil {
			return err
		}
		if existing != nil {
			return model.ErrReviewReported
		}

		report := model.ReviewReport{
			ReviewID:     reviewID,
			Reason:       reason,
			Detail:       strings.TrimSpace(input.Detail),
			ReportedBy:   strings.TrimSpace(by),
			ReportedDate: time.Now().UTC(),
			Status:       model.ApprovalStatusPending,
		}
		if err := s.reviews.CreateReport(tx, &report); err != nil {
			return err
		}

		body := fmt.Sprintf("%s · %s · %s",
			model.FormatReviewCode(reviewID), reason, strings.TrimSpace(by))
		if err := pushBothChannels(tx, s.notifications, model.RoleManager,
			model.NotifyReviewReported, "รีวิวรอผู้จัดการพิจารณา", body,
			"/admin/reviews"); err != nil {
			return err
		}

		created = report
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.reviews.FindReport(s.db, created.ReportID)
}

// Reports — คิวรายงานรีวิวของผู้จัดการ
func (s *ReviewService) Reports(status model.ApprovalStatus) ([]repository.ReportRow, error) {
	if status != "" && !status.IsValid() {
		return nil, model.ErrInvalidApprovalStatus
	}
	return s.reviews.ListReports(status)
}

func (s *ReviewService) GetReport(reportID int) (*repository.ReportRow, error) {
	return s.reviews.FindReport(s.db, reportID)
}
