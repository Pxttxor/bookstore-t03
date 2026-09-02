package model

import (
	"testing"
	"time"
)

var reviewAt = time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)

func sampleReview(comment string) Review {
	return Review{
		ReviewID: 1, CustomerID: 1, BookID: 110,
		Rating:   5,
		Headline: "อ่านสนุกมาก",
		Comment:  comment,
	}
}

func TestReviewSubmitSetsPendingAndKeepsCleanTextUnflagged(t *testing.T) {
	review := sampleReview("เนื้อเรื่องดี จัดส่งไว แพ็กมาอย่างดี")

	if err := review.Submit(DefaultProfanityFilter(), reviewAt); err != nil {
		t.Fatalf("ส่งรีวิวไม่ผ่าน: %v", err)
	}
	if review.Status != ReviewStatusPending {
		t.Errorf("สถานะ = %s ต้องการ PENDING", review.Status)
	}
	if review.Flagged {
		t.Error("ข้อความสุภาพต้องไม่ถูกติดธง")
	}
	if review.CreatedDate.IsZero() {
		t.Error("ต้องเติมเวลาที่เขียนรีวิวให้")
	}
}

// รีวิวที่มีคำไม่เหมาะสม **ไม่ถูกปฏิเสธ** แต่ติดธงไว้ให้พนักงานตัดสิน (ตามหน้าจอ)
func TestReviewSubmitFlagsProfanityWithoutRejecting(t *testing.T) {
	review := sampleReview("หนังสือห่วยมาก ไม่คุ้มราคาเลย")

	if err := review.Submit(DefaultProfanityFilter(), reviewAt); err != nil {
		t.Fatalf("รีวิวที่มีคำหยาบต้องบันทึกได้ แต่ได้ error: %v", err)
	}
	if !review.Flagged {
		t.Error("ข้อความที่มีคำต้องห้ามต้องถูกติดธง")
	}
	if review.Status != ReviewStatusPending {
		t.Errorf("สถานะ = %s ต้องการ PENDING เพื่อเข้าคิวตรวจ", review.Status)
	}
}

func TestReviewSubmitRejectsBadRating(t *testing.T) {
	for _, rating := range []int{0, 6, -1} {
		review := sampleReview("ข้อความปกติ")
		review.Rating = rating

		if err := review.Submit(DefaultProfanityFilter(), reviewAt); err != ErrInvalidRating {
			t.Errorf("คะแนน %d ต้องได้ ErrInvalidRating ได้ %v", rating, err)
		}
	}
}

func TestReviewSubmitRejectsEmptyComment(t *testing.T) {
	review := sampleReview("   ")

	if err := review.Submit(DefaultProfanityFilter(), reviewAt); err != ErrEmptyReviewComment {
		t.Errorf("รีวิวที่ไม่มีข้อความต้องได้ ErrEmptyReviewComment ได้ %v", err)
	}
}

func TestReviewModerateEveryAction(t *testing.T) {
	cases := []struct {
		action ModerateAction
		want   ReviewStatus
	}{
		{ModerateActionPublish, ReviewStatusPublished},
		{ModerateActionHide, ReviewStatusHidden},
		{ModerateActionRemove, ReviewStatusRemoved},
	}

	for _, tc := range cases {
		review := sampleReview("ข้อความปกติ")
		review.Status = ReviewStatusPending

		if err := review.Moderate(tc.action); err != nil {
			t.Fatalf("%s: %v", tc.action, err)
		}
		if review.Status != tc.want {
			t.Errorf("%s → %s ต้องการ %s", tc.action, review.Status, tc.want)
		}
		if tc.action.ResultStatus() != tc.want {
			t.Errorf("ResultStatus ของ %s ไม่ตรงกับผลจริง", tc.action)
		}
	}
}

// REMOVED เป็นปลายทาง — ตรงกับ abnormal flow ที่ smoke ตรวจผ่าน API
func TestReviewRemovedIsTerminal(t *testing.T) {
	review := sampleReview("ข้อความปกติ")
	review.Status = ReviewStatusRemoved

	if err := review.Moderate(ModerateActionPublish); err != ErrReviewRemoved {
		t.Errorf("กู้รีวิวที่ลบแล้วต้องได้ ErrReviewRemoved ได้ %v", err)
	}
	if err := review.AddReply("ขอบคุณครับ", "ฝ่ายขาย", reviewAt); err != ErrReviewRemoved {
		t.Errorf("ตอบกลับรีวิวที่ลบแล้วต้องได้ ErrReviewRemoved ได้ %v", err)
	}
}

func TestReviewModerateRejectsUnknownAction(t *testing.T) {
	review := sampleReview("ข้อความปกติ")
	review.Status = ReviewStatusPending

	if err := review.Moderate(ModerateAction("APPROVE")); err != ErrInvalidModerateAction {
		t.Errorf("คำสั่งที่ไม่มีอยู่ต้องได้ ErrInvalidModerateAction ได้ %v", err)
	}
}

func TestReviewAddReplyPublishes(t *testing.T) {
	review := sampleReview("ข้อความปกติ")
	review.Status = ReviewStatusPending

	if err := review.AddReply("  ขอบคุณสำหรับรีวิวครับ  ", "พนักงานฝ่ายขาย", reviewAt); err != nil {
		t.Fatalf("ตอบกลับไม่ผ่าน: %v", err)
	}
	if review.Status != ReviewStatusPublished {
		t.Errorf("ตอบกลับแล้วสถานะ = %s ต้องการ PUBLISHED", review.Status)
	}
	if len(review.Replies) != 1 {
		t.Fatalf("คำตอบกลับ = %d แถว ต้องการ 1", len(review.Replies))
	}
	if review.Replies[0].ReplyText != "ขอบคุณสำหรับรีวิวครับ" {
		t.Errorf("ต้องตัดช่องว่างหัวท้ายออก ได้ %q", review.Replies[0].ReplyText)
	}

	if err := review.AddReply("   ", "พนักงานฝ่ายขาย", reviewAt); err != ErrEmptyReplyText {
		t.Errorf("ตอบกลับข้อความว่างต้องได้ ErrEmptyReplyText ได้ %v", err)
	}
}

func TestReviewVerifiedPurchase(t *testing.T) {
	review := sampleReview("ข้อความปกติ")
	if review.IsVerifiedPurchase() {
		t.Error("รีวิวที่ไม่มีใบสั่งซื้อต้องไม่ใช่ verified purchase")
	}

	orderID := 1003
	review.OrderID = &orderID
	if !review.IsVerifiedPurchase() {
		t.Error("รีวิวที่ผูกใบสั่งซื้อแล้วต้องเป็น verified purchase")
	}
}

func TestReviewReportDecideOnlyOnce(t *testing.T) {
	report := ReviewReport{ReportID: 1, ReviewID: 1, Status: ApprovalStatusPending}

	if err := report.Decide(ApprovalStatusApproved, "ผู้จัดการร้าน", reviewAt); err != nil {
		t.Fatalf("ตัดสินรายงานไม่ผ่าน: %v", err)
	}
	if report.DecidedDate == nil || report.DecidedBy == "" {
		t.Error("ต้องบันทึกผู้ตัดสินและเวลาที่ตัดสิน")
	}
	if err := report.Decide(ApprovalStatusRejected, "ผู้จัดการร้าน", reviewAt); err != ErrReportAlreadyDecided {
		t.Errorf("ตัดสินซ้ำต้องได้ ErrReportAlreadyDecided ได้ %v", err)
	}

	pending := ReviewReport{ReportID: 2, ReviewID: 2, Status: ApprovalStatusPending}
	if err := pending.Decide(ApprovalStatusPending, "ผู้จัดการร้าน", reviewAt); err != ErrInvalidApprovalStatus {
		t.Errorf("ผลการตัดสินต้องเป็น APPROVED/REJECTED เท่านั้น ได้ %v", err)
	}
}

// ป้ายไทยต้องตรงกับ REVIEW_STATUS_LABELS และ MODERATE_ACTION_LABELS ของ frontend
// (ระบบย่อยนี้มีหน้าจอจริง จึงยึดข้อความฝั่งหน้าจอ)
func TestReviewLabelsMatchFrontend(t *testing.T) {
	wantStatus := map[ReviewStatus]string{
		ReviewStatusPending:   "รอตรวจสอบ",
		ReviewStatusPublished: "ตรวจสอบสำเร็จ",
		ReviewStatusHidden:    "ซ่อนไว้",
		ReviewStatusRemoved:   "รีวิวที่ถูกลบ",
	}
	for status, want := range wantStatus {
		if got := status.Label(); got != want {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", status, got, want)
		}
	}
	if len(ReviewStatuses()) != len(wantStatus) {
		t.Errorf("ReviewStatuses() = %d ค่า ต้องการ %d", len(ReviewStatuses()), len(wantStatus))
	}

	wantAction := map[ModerateAction]string{
		ModerateActionPublish: "อนุมัติ",
		ModerateActionHide:    "ซ่อนถาวร",
		ModerateActionRemove:  "ลบรีวิว",
	}
	for action, want := range wantAction {
		if got := action.Label(); got != want {
			t.Errorf("ป้ายของ %s = %q ต้องการ %q", action, got, want)
		}
	}
}

// รายการคำต้องห้ามต้องตรงกับ BANNED_WORDS ใน frontend/src/admin/reviews/reviews.ts
// แก้ที่ไหนต้องแก้อีกที่ด้วย ไม่งั้นหน้าจอกับ API ติดธงคนละแบบ
func TestProfanityFilterWordsMatchFrontend(t *testing.T) {
	want := []string{"ห่วย", "กาก", "โง่", "ควาย", "ขยะ", "trash", "stupid", "garbage", "scam"}

	filter := DefaultProfanityFilter()
	if len(filter.BannedWords) != len(want) {
		t.Fatalf("คำต้องห้าม = %d คำ ต้องการ %d", len(filter.BannedWords), len(want))
	}
	for i, word := range want {
		if filter.BannedWords[i] != word {
			t.Errorf("คำที่ %d = %q ต้องการ %q", i, filter.BannedWords[i], word)
		}
	}

	if !filter.CheckText("This book is TRASH") {
		t.Error("ต้องจับได้โดยไม่สนตัวพิมพ์ใหญ่เล็ก")
	}
	if filter.CheckText("หนังสือดีมาก อ่านเพลิน") {
		t.Error("ข้อความสุภาพต้องไม่ถูกจับ")
	}

	// ตัวกรองที่ยังไม่ถูกตั้งค่าไม่ควรทำให้ระบบพัง
	var none *ProfanityFilter
	if none.CheckText("อะไรก็ตาม") {
		t.Error("ตัวกรองที่เป็น nil ต้องคืน false")
	}
}
