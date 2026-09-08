// review.go — จัดการรีวิวลูกค้า
// อ้างอิง class diagram: Sub2-Review.md
//
//	Customer "1" --> "*" Review : writes
//	Review "*" --> "1" Book : about
//	Review "*" --> "0..1" Order : verified buy
//	Review "1" *-- "*" ReviewReply : replies
//	Review "1" --> "0..1" ReviewReport : escalates
//	Review ..> ProfanityFilter : checks
package model

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Review — รีวิวหนังสือหนึ่งชิ้นของลูกค้าหนึ่งคน
//
// OrderID เป็น *int เพราะ diagram กำหนดไว้ 0..1 — รีวิวที่ผูกใบสั่งซื้อได้คือ
// "ซื้อจริงแล้ว" (verified purchase) ส่วนแถวที่ไม่มีใบคือรีวิวเก่าที่นำเข้ามา
// **เส้นทาง API บังคับให้ต้องมีใบที่ส่งถึงแล้วเสมอ** (ดู ReviewService.Submit)
//
// Flagged เก็บผลของ ProfanityFilter ไว้ในแถว ไม่คำนวณสดตอนเปิดดู เพราะรายการคำ
// ต้องห้ามเปลี่ยนได้ แต่ผลที่พนักงานเห็นตอนตรวจต้องเป็นผลของตอนที่ลูกค้าส่งเข้ามา
type Review struct {
	ReviewID    int           `gorm:"column:review_id;primaryKey;autoIncrement" json:"reviewId"`
	CustomerID  int           `gorm:"column:customer_id;not null;index" json:"customerId"`
	BookID      int           `gorm:"column:book_id;not null;index" json:"bookId"`
	OrderID     *int          `gorm:"column:order_id;index" json:"orderId,omitempty"`
	Rating      int           `gorm:"column:rating;not null" json:"rating"`
	Comment     string        `gorm:"column:comment;type:text;not null" json:"comment"`
	Status      ReviewStatus  `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	Flagged     bool          `gorm:"column:flagged;not null;default:false" json:"flagged"`
	CreatedDate time.Time     `gorm:"column:created_date;type:timestamptz;not null" json:"createdDate"`
	Replies     []ReviewReply `gorm:"foreignKey:ReviewID;references:ReviewID;constraint:OnDelete:CASCADE" json:"replies"`
}

func (Review) TableName() string { return "review" }

// ReviewReply — ข้อความตอบกลับรีวิวจากพนักงาน (composition ◆ ของ Review)
//
// diagram วาดไว้เป็น "*" จึงเก็บได้หลายแถว ต่างจากหน้าจอที่แสดงอันล่าสุดอันเดียว
type ReviewReply struct {
	ReplyID     int       `gorm:"column:reply_id;primaryKey;autoIncrement" json:"replyId"`
	ReviewID    int       `gorm:"column:review_id;not null;index" json:"-"`
	ReplyText   string    `gorm:"column:reply_text;type:text;not null" json:"replyText"`
	RepliedDate time.Time `gorm:"column:replied_date;type:timestamptz;not null" json:"repliedDate"`
	RepliedBy   string    `gorm:"column:replied_by;type:varchar(200);not null" json:"repliedBy"`
}

func (ReviewReply) TableName() string { return "review_reply" }

// ReviewReport — รายงานรีวิวผิดปกติที่ฝ่ายขายส่งต่อให้ผู้จัดการร้านพิจารณา
//
// diagram พิมพ์ status เป็น string เฉย ๆ · ใช้ ApprovalStatus ที่มีอยู่แล้วเพราะ
// ค่าตรงกับ managerStatus ฝั่งหน้าจอพอดี (PENDING/APPROVED/REJECTED)
//
// ความหมายของผล: APPROVED = รายงานเป็นผล (รีวิวถูกซ่อนหรือลบ)
// REJECTED = รายงานไม่เป็นผล (รีวิวถูกเผยแพร่) — ยึดตาม SEED_REVIEWS ของหน้าจอ
type ReviewReport struct {
	ReportID     int            `gorm:"column:report_id;primaryKey;autoIncrement" json:"reportId"`
	ReviewID     int            `gorm:"column:review_id;not null;uniqueIndex" json:"reviewId"`
	Reason       string         `gorm:"column:reason;type:varchar(200);not null" json:"reason"`
	Detail       string         `gorm:"column:detail;type:text" json:"detail,omitempty"`
	ReportedBy   string         `gorm:"column:reported_by;type:varchar(200);not null" json:"reportedBy"`
	ReportedDate time.Time      `gorm:"column:reported_date;type:timestamptz;not null" json:"reportedDate"`
	Status       ApprovalStatus `gorm:"column:status;type:varchar(20);not null;index" json:"status"`
	DecidedBy    string         `gorm:"column:decided_by;type:varchar(200)" json:"decidedBy,omitempty"`
	DecidedDate  *time.Time     `gorm:"column:decided_date;type:timestamptz" json:"decidedDate,omitempty"`
}

func (ReviewReport) TableName() string { return "review_report" }

// ── ProfanityFilter (<<service>> ใน diagram — ไม่มีตารางในฐานข้อมูล) ────

// ProfanityFilter — ตัวกรองคำไม่เหมาะสม
type ProfanityFilter struct {
	BannedWords []string
}

// bannedWords — ชุดเดียวกับ BANNED_WORDS ใน frontend/src/admin/reviews/reviews.ts
// มีเทสต์คุมไว้ว่าต้องตรงกันทีละคำ · แก้ที่ไหนต้องแก้อีกที่ด้วย
var bannedWords = []string{
	"ห่วย", "กาก", "โง่", "ควาย", "ขยะ",
	"trash", "stupid", "garbage", "scam",
}

// DefaultProfanityFilter — ตัวกรองที่ระบบใช้จริง
func DefaultProfanityFilter() *ProfanityFilter {
	words := make([]string, len(bannedWords))
	copy(words, bannedWords)
	return &ProfanityFilter{BannedWords: words}
}

// CheckText — คืน true ถ้าพบคำไม่เหมาะสม (`+checkText(text) bool` ใน diagram)
func (p *ProfanityFilter) CheckText(text string) bool {
	if p == nil {
		return false
	}
	lower := strings.ToLower(text)
	for _, word := range p.BannedWords {
		if word != "" && strings.Contains(lower, strings.ToLower(word)) {
			return true
		}
	}
	return false
}

// ── เมธอดตาม class diagram ──────────────────────────────────────────────

// Submit — ลูกค้าส่งรีวิว (`+submit()` ใน class diagram)
//
// รีวิวที่พบคำไม่เหมาะสม **ไม่ถูกปฏิเสธ** แต่ติดธงไว้แล้วเข้าคิวให้พนักงานตัดสิน
// (พฤติกรรมตามหน้าจอ ซึ่งมีคิว "ตรวจสอบรีวิว" ไว้สำหรับกรณีนี้โดยเฉพาะ)
func (r *Review) Submit(filter *ProfanityFilter, at time.Time) error {
	if r.Rating < 1 || r.Rating > 5 {
		return ErrInvalidRating
	}
	r.Comment = strings.TrimSpace(r.Comment)
	if r.Comment == "" {
		return ErrEmptyReviewComment
	}
	if utf8.RuneCountInString(r.Comment) > 75 {
		return ErrReviewCommentTooLong
	}

	r.Flagged = filter.CheckText(r.Comment)
	r.Status = ReviewStatusPublished
	if r.CreatedDate.IsZero() {
		r.CreatedDate = at.UTC()
	}
	return nil
}

// Update — ลูกค้าแก้ไขรีวิว
func (r *Review) Update(rating int, comment string, filter *ProfanityFilter) error {
	if rating < 1 || rating > 5 {
		return ErrInvalidRating
	}
	comment = strings.TrimSpace(comment)
	if comment == "" {
		return ErrEmptyReviewComment
	}
	if utf8.RuneCountInString(comment) > 75 {
		return ErrReviewCommentTooLong
	}

	r.Rating = rating
	r.Comment = comment
	r.Flagged = filter.CheckText(r.Comment)
	r.Status = ReviewStatusPublished
	return nil
}

// Moderate — พนักงานตรวจสอบรีวิว (`+moderate(action)` ใน class diagram)
//
// REMOVED เป็นปลายทาง — รีวิวที่ลบแล้วกู้กลับมาไม่ได้ ต้องให้ลูกค้าเขียนใหม่
func (r *Review) Moderate(action ModerateAction) error {
	if !action.IsValid() {
		return ErrInvalidModerateAction
	}
	if r.Status == ReviewStatusRemoved {
		return ErrReviewRemoved
	}
	r.Status = action.ResultStatus()
	return nil
}

// AddReply — พนักงานตอบกลับรีวิว (composition ◆ Review *-- ReviewReply)
//
// ตอบกลับแล้วรีวิวขึ้นหน้าร้านทันที ตรงกับ reply() ใน ReviewContext.tsx
// (ตอบกลับรีวิวที่ยังไม่ได้ตรวจ = ยอมรับรีวิวนั้นไปในตัว)
func (r *Review) AddReply(text, by string, at time.Time) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return ErrEmptyReplyText
	}
	if r.Status == ReviewStatusRemoved {
		return ErrReviewRemoved
	}

	r.Replies = append(r.Replies, ReviewReply{
		ReviewID:    r.ReviewID,
		ReplyText:   text,
		RepliedDate: at.UTC(),
		RepliedBy:   strings.TrimSpace(by),
	})
	r.Status = ReviewStatusPublished
	return nil
}

// IsVerifiedPurchase — รีวิวนี้มาจากคำสั่งซื้อที่ลูกค้าได้รับของแล้วหรือไม่
// (หน้าจอแสดงป้าย "ซื้อสินค้าจริง" จากค่านี้)
func (r Review) IsVerifiedPurchase() bool { return r.OrderID != nil && *r.OrderID > 0 }

// Decide — ผู้จัดการตัดสินรายงานรีวิว (`StoreManager --> ReviewReport : handles`)
func (p *ReviewReport) Decide(status ApprovalStatus, by string, at time.Time) error {
	if status != ApprovalStatusApproved && status != ApprovalStatusRejected {
		return ErrInvalidApprovalStatus
	}
	if p.Status != ApprovalStatusPending {
		return ErrReportAlreadyDecided
	}

	decided := at.UTC()
	p.Status = status
	p.DecidedBy = strings.TrimSpace(by)
	p.DecidedDate = &decided
	return nil
}

// FormatReviewCode — รหัสที่หน้าจอแสดง (RV001) ตรงกับ formatReviewCode ของ TS
func FormatReviewCode(reviewID int) string { return fmt.Sprintf("RV%03d", reviewID) }
