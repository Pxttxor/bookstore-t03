// purchasing.go — handler ของระบบย่อยจัดซื้อ (U5–U10) รวมหนังสือ/สินค้าคงคลัง/การแจ้งเตือน
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// ── หนังสือและสินค้าคงคลัง (U5) ─────────────────────────────────────────

func (h *Handler) listBooks(w http.ResponseWriter, r *http.Request) {
	books, err := h.inventory.ListBooks(r.URL.Query().Get("q"))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, books)
}

func (h *Handler) listInventory(w http.ResponseWriter, _ *http.Request) {
	items, err := h.inventory.ListInventory()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, items)
}

// reorderAlerts — SCR-20 (U5)
func (h *Handler) reorderAlerts(w http.ResponseWriter, _ *http.Request) {
	alerts, err := h.purchasing.ReorderAlerts()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, alerts)
}

// reorderPointRequest — ส่ง null มาได้ เพื่อล้างค่ากลับเป็น "ยังไม่ตั้งจุดสั่งซื้อ"
type reorderPointRequest struct {
	ReorderPoint *int `json:"reorderPoint"`
}

func (h *Handler) setReorderPoint(w http.ResponseWriter, r *http.Request) {
	bookID, err := httpx.PathInt(r, "bookId")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body reorderPointRequest
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	item, err := h.purchasing.SetReorderPoint(bookID, body.ReorderPoint)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, item)
}

// ── ใบขอสั่งซื้อ (U6, U7) ───────────────────────────────────────────────

func (h *Handler) listRequisitions(w http.ResponseWriter, r *http.Request) {
	filter := repository.RequisitionFilter{
		Status:     model.PRStatus(r.URL.Query().Get("status")),
		SupplierID: httpx.QueryInt(r, "supplierId", 0),
	}
	if filter.Status != "" && !filter.Status.IsValid() {
		httpx.Error(w, model.Validation("INVALID_STATUS", "สถานะที่กรองไม่ถูกต้อง: "+string(filter.Status)))
		return
	}

	rows, err := h.purchasing.ListRequisitions(filter)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRequisitionDTOs(rows))
}

func (h *Handler) getRequisition(w http.ResponseWriter, r *http.Request) {
	prID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	requisition, err := h.purchasing.GetRequisition(prID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRequisitionDTO(*requisition))
}

func (h *Handler) createRequisition(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.RequisitionInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	requisition, err := h.purchasing.CreateRequisition(body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toRequisitionDTO(*requisition))
}

func (h *Handler) updateRequisition(w http.ResponseWriter, r *http.Request) {
	prID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.RequisitionInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	requisition, err := h.purchasing.UpdateRequisition(prID, body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRequisitionDTO(*requisition))
}

func (h *Handler) submitRequisition(w http.ResponseWriter, r *http.Request) {
	prID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	requisition, err := h.purchasing.SubmitRequisition(prID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRequisitionDTO(*requisition))
}

// approveRequisition — U7 อนุมัติแล้วได้ใบสั่งซื้อกลับไปเลย
func (h *Handler) approveRequisition(w http.ResponseWriter, r *http.Request) {
	prID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ApproveInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	order, err := h.purchasing.ApproveRequisition(prID, body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toOrderDTO(*order))
}

func (h *Handler) rejectRequisition(w http.ResponseWriter, r *http.Request) {
	prID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.RejectInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	requisition, err := h.purchasing.RejectRequisition(prID, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toRequisitionDTO(*requisition))
}

func (h *Handler) budget(w http.ResponseWriter, _ *http.Request) {
	summary, err := h.purchasing.Budget()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, summary)
}

// ── ใบสั่งซื้อ (U8) ─────────────────────────────────────────────────────

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	filter := repository.OrderFilter{
		Status:     model.POStatus(r.URL.Query().Get("status")),
		SupplierID: httpx.QueryInt(r, "supplierId", 0),
	}
	if filter.Status != "" && !filter.Status.IsValid() {
		httpx.Error(w, model.Validation("INVALID_STATUS", "สถานะที่กรองไม่ถูกต้อง: "+string(filter.Status)))
		return
	}

	orders, err := h.purchasing.ListOrders(filter)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTOs(orders))
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	order, err := h.purchasing.GetOrder(poID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*order))
}

func (h *Handler) sendOrder(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	order, err := h.purchasing.SendOrder(poID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*order))
}

func (h *Handler) confirmOrder(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ConfirmInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	order, err := h.purchasing.ConfirmOrder(poID, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*order))
}

// ── รับสินค้าเข้าคลัง (U9) ──────────────────────────────────────────────

func (h *Handler) listReceipts(w http.ResponseWriter, _ *http.Request) {
	receipts, err := h.purchasing.ListReceipts(0)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReceiptDTOs(receipts))
}

func (h *Handler) listOrderReceipts(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	receipts, err := h.purchasing.ListReceipts(poID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReceiptDTOs(receipts))
}

func (h *Handler) receiveGoods(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReceiptInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	receipt, err := h.purchasing.ReceiveGoods(poID, body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toReceiptDTO(*receipt))
}

// ── ส่งคืนสินค้า (U10) ──────────────────────────────────────────────────

func (h *Handler) listReturns(w http.ResponseWriter, _ *http.Request) {
	entries, err := h.purchasing.ListReturns(0)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReturnDTOs(entries))
}

func (h *Handler) listOrderReturns(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	entries, err := h.purchasing.ListReturns(poID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReturnDTOs(entries))
}

func (h *Handler) getReturn(w http.ResponseWriter, r *http.Request) {
	returnID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	entry, err := h.purchasing.GetReturn(returnID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReturnDTO(*entry))
}

func (h *Handler) createReturn(w http.ResponseWriter, r *http.Request) {
	poID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ReturnInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	entry, err := h.purchasing.CreateReturn(poID, body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toReturnDTO(*entry))
}

func (h *Handler) escalateReturn(w http.ResponseWriter, r *http.Request) {
	returnID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.EscalateInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	entry, err := h.purchasing.EscalateReturn(returnID, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReturnDTO(*entry))
}

func (h *Handler) recordCompensation(w http.ResponseWriter, r *http.Request) {
	returnID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.CompensationInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	entry, err := h.purchasing.RecordCompensation(returnID, body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toReturnDTO(*entry))
}

// ── การแจ้งเตือน ────────────────────────────────────────────────────────

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	notifications, err := h.notifications.ListFor(current.Role)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, notifications)
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.notifications.MarkRead(id); err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.notifications.MarkAllRead(current.Role); err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.NoContent(w)
}
