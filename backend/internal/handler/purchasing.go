// purchasing.go — handler ของระบบย่อยจัดซื้อ (U5–U10) รวมหนังสือ/สินค้าคงคลัง/การแจ้งเตือน
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// registerInventoryRoutes — สินค้าคงคลัง (ตารางประกอบ รองรับ U5)
// ชื่อเดิมคือ registerCatalogueRoutes ซึ่งชนกับแคตตาล็อกหน้าร้านใน catalogue.go
// เส้นทางของหนังสืออยู่ที่ registerBookRoutes ใน book.go
func (h *Handler) registerInventoryRoutes(register registrar) {
	register("GET /api/inventory", roleOffice, h.listInventory)                             // can.viewStock
	register("GET /api/inventory/alerts", roleWarehouse, h.reorderAlerts)                   // U5 · can.viewAlerts
	register("PUT /api/inventory/{bookId}/reorder-point", roleWarehouse, h.setReorderPoint) // U5 · can.setReorderPoint
}

// registerPurchasingRoutes — U6–U10 จัดซื้อจากผู้จัดจำหน่าย
func (h *Handler) registerPurchasingRoutes(register registrar) {
	// ใบขอสั่งซื้อ U6–U7
	register("GET /api/requisitions", rolePurchasing, h.listRequisitions) // can.viewPurchasing
	register("GET /api/requisitions/{id}", rolePurchasing, h.getRequisition)
	register("POST /api/requisitions", roleWarehouse, h.createRequisition)             // U6 · can.createRequisition
	register("PUT /api/requisitions/{id}", roleWarehouse, h.updateRequisition)         // U6
	register("POST /api/requisitions/{id}/submit", roleWarehouse, h.submitRequisition) // U6
	register("POST /api/requisitions/{id}/approve", roleManager, h.approveRequisition) // U7 · can.approveRequisition
	register("POST /api/requisitions/{id}/reject", roleManager, h.rejectRequisition)   // U7

	// ใบสั่งซื้อ U8 · รับสินค้า U9 · ส่งคืน U10
	// ใช้ /api/purchase-orders ไม่ใช่ /api/orders เพราะ Order ของลูกค้าเป็นคนละคลาสใน class diagram
	register("GET /api/purchase-orders", rolePurchasing, h.listPurchaseOrders)
	register("GET /api/purchase-orders/{id}", rolePurchasing, h.getPurchaseOrder)
	register("POST /api/purchase-orders/{id}/send", roleWarehouse, h.sendOrder)       // U8 · can.sendOrder
	register("POST /api/purchase-orders/{id}/confirm", roleWarehouse, h.confirmOrder) // U8
	register("GET /api/purchase-orders/{id}/receipts", rolePurchasing, h.listOrderReceipts)
	register("POST /api/purchase-orders/{id}/receipts", roleWarehouse, h.receiveGoods) // U9 · can.receiveGoods
	register("GET /api/purchase-orders/{id}/returns", rolePurchasing, h.listOrderReturns)
	register("POST /api/purchase-orders/{id}/returns", roleWarehouse, h.createReturn) // U10 · can.createReturn

	register("GET /api/receipts", rolePurchasing, h.listReceipts)
	register("GET /api/returns", rolePurchasing, h.listReturns)
	register("GET /api/returns/{id}", rolePurchasing, h.getReturn)
	register("POST /api/returns/{id}/escalate", roleWarehouse, h.escalateReturn)         // U10
	register("POST /api/returns/{id}/compensation", roleWarehouse, h.recordCompensation) // U10

	register("GET /api/purchasing/budget", rolePurchasing, h.budget) // U7 · แถบงบบน SCR-23
}

// registerNotificationRoutes — SCR-27 ศูนย์ติดต่อและการแจ้งเตือน
func (h *Handler) registerNotificationRoutes(register registrar) {
	register("GET /api/notifications", roleStaff, h.listNotifications)
	register("POST /api/notifications/{id}/read", roleStaff, h.markNotificationRead)
	register("POST /api/notifications/read-all", roleStaff, h.markAllNotificationsRead)
}

// ── สินค้าคงคลัง (U5) ───────────────────────────────────────────────────

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
	httpx.Created(w, toPurchaseOrderDTO(*order))
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

func (h *Handler) listPurchaseOrders(w http.ResponseWriter, r *http.Request) {
	filter := repository.PurchaseOrderFilter{
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
	httpx.OK(w, toPurchaseOrderDTOs(orders))
}

func (h *Handler) getPurchaseOrder(w http.ResponseWriter, r *http.Request) {
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
	httpx.OK(w, toPurchaseOrderDTO(*order))
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
	httpx.OK(w, toPurchaseOrderDTO(*order))
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
	httpx.OK(w, toPurchaseOrderDTO(*order))
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
