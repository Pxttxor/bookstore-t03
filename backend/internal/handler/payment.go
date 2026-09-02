// payment.go — handler ของการชำระเงิน บัญชีธนาคาร และรายงานการรับชำระ
//
// การ "ตรวจผ่าน/ปฏิเสธ" ไม่มีเส้นทางของตัวเอง — ใช้ /api/orders/{id}/verify-payment
// กับ /reject-payment ที่มีอยู่แล้ว เพราะเป็นเหตุการณ์เดียวกับการเปลี่ยนสถานะคำสั่งซื้อ
// แยกเป็นสองปุ่มเมื่อไรก็มีโอกาสที่ payment กับ customer_order ไม่ตรงกัน
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

// registerPaymentRoutes — ระบบย่อยตรวจสอบการชำระเงิน
//
// ลูกค้าเห็นบัญชีธนาคารที่ร้านรับโอน และเห็นการชำระเงินของใบตัวเองเท่านั้น
// ฝ่ายขายเป็นผู้ตรวจสลิป (SalesStaff.verifies) · รายงานสรุปยอดเป็นของผู้จัดการ (StoreManager.generates)
func (h *Handler) registerPaymentRoutes(register registrar) {
	register("GET /api/banks", roleAnyUser, h.listBanks) // ลูกค้าต้องเห็นเลขบัญชีตอนจะโอน

	register("GET /api/payments", roleOrderAdmin, h.listPayments)
	register("GET /api/payments/{id}", roleOrderAdmin, h.getPayment)
	register("GET /api/orders/{id}/payment", roleAnyUser, h.getOrderPayment)

	register("GET /api/payment-reports", roleManager, h.listPaymentReports)
	register("POST /api/payment-reports", roleManager, h.generatePaymentReport)
}

func (h *Handler) listBanks(w http.ResponseWriter, _ *http.Request) {
	banks, err := h.payments.Banks()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, banks)
}

func (h *Handler) listPayments(w http.ResponseWriter, r *http.Request) {
	views, err := h.payments.List(model.PaymentStatus(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPaymentDTOs(views))
}

func (h *Handler) getPayment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.payments.Get(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPaymentDTO(*view))
}

// getOrderPayment — การชำระเงินของคำสั่งซื้อใบหนึ่ง (service กรองเจ้าของให้อีกชั้น)
func (h *Handler) getOrderPayment(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.payments.ForOrder(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPaymentDTO(*view))
}

func (h *Handler) listPaymentReports(w http.ResponseWriter, _ *http.Request) {
	reports, err := h.payments.Reports()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPaymentReportDTOs(reports))
}

func (h *Handler) generatePaymentReport(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReportPeriodInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	report, err := h.payments.GenerateReport(body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toPaymentReportDTO(*report))
}
