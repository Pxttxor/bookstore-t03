// delivery.go — handler ของพัสดุ ประวัติการติดตาม และสรุปบัญชีพัสดุ
//
// การเปิดพัสดุไม่มีเส้นทางของตัวเอง — ใช้ POST /api/orders/{id}/ship ที่มีอยู่แล้ว
// เพราะพัสดุกับคำสั่งซื้อต้องเกิดพร้อมกัน (เหตุผลเดียวกับการตรวจสลิปในระบบชำระเงิน)
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

// registerDeliveryRoutes — ระบบย่อยจัดการการจัดส่ง
//
// ฝ่ายจัดส่งเป็นเจ้าของงานพัสดุ · ลูกค้าเห็นเฉพาะพัสดุของใบตัวเอง (service กรองให้อีกชั้น)
func (h *Handler) registerDeliveryRoutes(register registrar) {
	register("GET /api/carriers", roleStaff, h.listCarriers)

	register("GET /api/shipments", roleAnyUser, h.listShipments)
	register("GET /api/shipments/{id}", roleAnyUser, h.getShipment)
	register("GET /api/orders/{id}/shipment", roleAnyUser, h.getOrderShipment)
	register("POST /api/shipments/{id}/tracking", roleDelivery, h.addTracking)

	register("GET /api/delivery-summaries", roleDeliveryAdmin, h.listDeliverySummaries)
	register("POST /api/delivery-summaries", roleDeliveryAdmin, h.generateDeliverySummary)
}

func (h *Handler) listCarriers(w http.ResponseWriter, _ *http.Request) {
	carriers, err := h.deliveries.Carriers()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, carriers)
}

func (h *Handler) listShipments(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	views, err := h.deliveries.List(*current, model.ShipmentStatus(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toShipmentDTOs(views))
}

func (h *Handler) getShipment(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.deliveries.Get(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toShipmentDTO(*view))
}

func (h *Handler) getOrderShipment(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.deliveries.ForOrder(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toShipmentDTO(*view))
}

func (h *Handler) addTracking(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.TrackingInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.deliveries.UpdateTracking(id, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toShipmentDTO(*view))
}

func (h *Handler) listDeliverySummaries(w http.ResponseWriter, _ *http.Request) {
	summaries, err := h.deliveries.Summaries()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toDeliverySummaryDTOs(summaries))
}

func (h *Handler) generateDeliverySummary(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.SummaryInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	summary, err := h.deliveries.GenerateSummary(body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toDeliverySummaryDTO(*summary))
}
