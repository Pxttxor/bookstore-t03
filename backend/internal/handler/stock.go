// stock.go — handler ของการปรับยอด การตรวจนับ และรายงานผลต่างสต็อก
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

// registerStockRoutes — ระบบย่อยสินค้าคงคลัง (ส่วนที่นอกเหนือจากที่ U5/U9/U10 ใช้)
//
// คลังสินค้าเป็นเจ้าของงานตรวจนับและการปรับยอด · ผู้จัดการเป็นผู้ตัดสินผลต่างเท่านั้น
func (h *Handler) registerStockRoutes(register registrar) {
	register("GET /api/inventory/low-stock", roleOffice, h.lowStock)
	register("POST /api/inventory/adjust", roleWarehouse, h.adjustStock)

	register("GET /api/stock-counts", roleStock, h.listStockCounts)
	register("GET /api/stock-counts/{id}", roleStock, h.getStockCount)
	register("POST /api/stock-counts", roleWarehouse, h.saveStockCount)

	register("GET /api/discrepancies", roleStock, h.listDiscrepancies)
	register("POST /api/discrepancies/{id}/approve", roleManager, h.approveDiscrepancy)
	register("POST /api/discrepancies/{id}/reject", roleManager, h.rejectDiscrepancy)
}

func (h *Handler) lowStock(w http.ResponseWriter, _ *http.Request) {
	rows, err := h.stock.LowStock()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toStockRowDTOs(rows))
}

func (h *Handler) adjustStock(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.AdjustInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	txns, err := h.stock.AdjustStock(body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, txns)
}

func (h *Handler) listStockCounts(w http.ResponseWriter, _ *http.Request) {
	views, err := h.stock.ListStockCounts()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toStockCountDTOs(views))
}

func (h *Handler) getStockCount(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.stock.GetStockCount(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toStockCountDTO(*view))
}

func (h *Handler) saveStockCount(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.StockCountInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.stock.SaveStockCount(body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toStockCountDTO(*view))
}

func (h *Handler) listDiscrepancies(w http.ResponseWriter, r *http.Request) {
	views, err := h.stock.ListDiscrepancies(model.ApprovalStatus(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toDiscrepancyDTOs(views))
}

func (h *Handler) approveDiscrepancy(w http.ResponseWriter, r *http.Request) {
	h.decideDiscrepancy(w, r, model.ApprovalStatusApproved)
}

func (h *Handler) rejectDiscrepancy(w http.ResponseWriter, r *http.Request) {
	h.decideDiscrepancy(w, r, model.ApprovalStatusRejected)
}

func (h *Handler) decideDiscrepancy(w http.ResponseWriter, r *http.Request, status model.ApprovalStatus) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.DecisionInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.stock.Decide(id, status, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toDiscrepancyDTO(*view))
}
