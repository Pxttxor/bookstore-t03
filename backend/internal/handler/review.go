// review.go — handler ของรีวิวลูกค้า คำตอบกลับ และรายงานรีวิวผิดปกติ
//
// การตัดสินรายงานไม่มีเส้นทางของตัวเอง — เกิดพร้อมกับ POST /api/reviews/{id}/moderate
// เพราะสถานะของรีวิวกับผลของรายงานต้องตรงกันเสมอ (ดู ReviewService.Moderate)
package handler

import (
	"net/http"
	"strconv"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// registerReviewRoutes — ระบบย่อยรีวิวลูกค้า
//
// ลูกค้าเขียนรีวิวและดูของตัวเอง · ฝ่ายขายกับผู้จัดการตรวจสอบ (can.moderateReview)
// · คิวรายงานเป็นของผู้จัดการคนเดียว (can.manageReportedReviews)
func (h *Handler) registerReviewRoutes(register registrar) {
	register("POST /api/reviews", roleCustomer, h.submitReview)
	register("GET /api/reviews", roleReviewAudience, h.listReviews)
	register("GET /api/reviews/{id}", roleReviewAudience, h.getReview)
	register("GET /api/books/{id}/reviews", roleAnyUser, h.listBookReviews)

	register("POST /api/reviews/{id}/moderate", roleReviewStaff, h.moderateReview)
	register("POST /api/reviews/{id}/replies", roleReviewStaff, h.replyToReview)
	register("POST /api/reviews/{id}/report", roleReviewStaff, h.reportReview)

	register("GET /api/review-reports", roleManager, h.listReviewReports)
	register("GET /api/review-reports/{id}", roleManager, h.getReviewReport)
}

func (h *Handler) submitReview(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReviewInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.Submit(*current, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toReviewDTO(*row))
}

func (h *Handler) listReviews(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}

	query := r.URL.Query()
	filter := repository.ReviewFilter{Status: model.ReviewStatus(query.Get("status"))}
	if bookID, err := strconv.Atoi(query.Get("bookId")); err == nil {
		filter.BookID = bookID
	}
	filter.Flagged = boolParam(query.Get("flagged"))
	filter.Reported = boolParam(query.Get("reported"))

	rows, err := h.reviews.List(*current, filter)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReviewDTOs(rows))
}

// boolParam — ตัวกรองสามสถานะ: ไม่ส่งมา = ไม่กรอง · "true"/"false" = กรองตามค่านั้น
func boolParam(raw string) *bool {
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return nil
	}
	return &value
}

func (h *Handler) getReview(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.Get(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReviewDTO(*row))
}

// listBookReviews — รีวิวที่ขึ้นหน้าร้านของหนังสือเล่มหนึ่ง (เฉพาะที่ตรวจสอบผ่านแล้ว)
func (h *Handler) listBookReviews(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	rows, err := h.reviews.ForBook(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReviewDTOs(rows))
}

func (h *Handler) moderateReview(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ModerateInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.Moderate(id, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReviewDTO(*row))
}

func (h *Handler) replyToReview(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReplyInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.Reply(id, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toReviewDTO(*row))
}

func (h *Handler) reportReview(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReportInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.Report(id, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toReportDTO(*row))
}

func (h *Handler) listReviewReports(w http.ResponseWriter, r *http.Request) {
	rows, err := h.reviews.Reports(model.ApprovalStatus(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReportDTOs(rows))
}

func (h *Handler) getReviewReport(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.reviews.GetReport(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReportDTO(*row))
}
