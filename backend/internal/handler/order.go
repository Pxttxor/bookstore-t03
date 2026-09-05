// order.go — handler ของคำสั่งซื้อลูกค้าและโปรโมชั่น
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

// registerOrderRoutes — คำสั่งซื้อลูกค้า
//
// หน้าที่แบ่งตามบทบาทเหมือน can.* ฝั่งหน้าจอ: ฝ่ายขายรับออร์เดอร์และตรวจการชำระเงิน
// คลังแพ็ก ฝ่ายจัดส่งบันทึกการส่งและการรับของ · ลูกค้าเห็นเฉพาะใบของตัวเอง
func (h *Handler) registerOrderRoutes(register registrar) {
	register("GET /api/orders", roleAnyUser, h.listOrders)      // can.viewOrders + ลูกค้าดูของตัวเอง
	register("GET /api/orders/{id}", roleAnyUser, h.getOrder)   // service กรองเจ้าของให้อีกชั้น
	register("POST /api/orders", roleOrderIntake, h.placeOrder) // Customer.placeOrder()

	register("POST /api/orders/{id}/confirm-stock", roleSales, h.confirmStock)      // can.confirmStock
	register("POST /api/orders/{id}/await-payment", roleSales, h.awaitPayment)      // ช่องทางโทร/ข้อความ
	register("POST /api/orders/{id}/payment", roleOrderIntake, h.submitPayment)     // แนบสลิป
	register("POST /api/orders/{id}/verify-payment", roleSales, h.verifyPayment)    // can.verifyPayment
	register("POST /api/orders/{id}/reject-payment", roleSales, h.rejectPayment)    //
	register("POST /api/orders/{id}/pack", roleWarehouse, h.packOrder)              // can.packOrder
	register("POST /api/orders/{id}/ready", roleWarehouse, h.readyToShip)           //
	register("POST /api/orders/{id}/ship", roleDelivery, h.shipOrder)               // can.shipOrder + เปิดพัสดุ
	register("POST /api/orders/{id}/deliver", roleDelivery, h.deliverOrder)         // can.confirmDelivery
	register("POST /api/orders/{id}/cancel", roleOrderAdmin, h.cancelCustomerOrder) // can.cancelOrder
}

// registerPromotionRoutes — โปรโมชั่น (StoreManager.managePromotion)
func (h *Handler) registerPromotionRoutes(register registrar) {
	register("GET /api/promotions", roleManager, h.listPromotions) // can.viewPromotions
	register("GET /api/promotions/{id}", roleManager, h.getPromotion)
	register("POST /api/promotions", roleManager, h.createPromotion) // can.managePromotion
	register("PUT /api/promotions/{id}", roleManager, h.updatePromotion)
	register("POST /api/promotions/{id}/status", roleManager, h.setPromotionStatus)
	register("DELETE /api/promotions/{id}", roleManager, h.deletePromotion)
}

// ── คำสั่งซื้อ ──────────────────────────────────────────────────────────

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	views, err := h.orders.List(*current, model.OrderStatus(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTOs(views))
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.orders.Get(*current, id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*view))
}

func (h *Handler) placeOrder(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.PlaceOrderInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.orders.Place(body, *current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toOrderDTO(*view))
}

func (h *Handler) confirmStock(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.ConfirmStock(id, by)
	})
}

func (h *Handler) awaitPayment(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.AwaitPayment(id, by)
	})
}

func (h *Handler) submitPayment(w http.ResponseWriter, r *http.Request) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.PaymentSlipInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.orders.SubmitPayment(*current, id, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*view))
}

func (h *Handler) verifyPayment(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.VerifyPayment(id, by)
	})
}

func (h *Handler) rejectPayment(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, r *http.Request) (*service.OrderView, error) {
		var body service.OrderNoteInput
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		return h.orders.RejectPayment(id, body, by)
	})
}

func (h *Handler) packOrder(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.Pack(id, by)
	})
}

func (h *Handler) readyToShip(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.ReadyToShip(id, by)
	})
}

// shipOrder — บันทึกการจัดส่ง · body พกเลขติดตามพัสดุกับบริษัทขนส่งมาด้วย
// (เปิดแถว shipment ในทรานแซกชันเดียวกับการเปลี่ยนสถานะ ดู OrderService.Ship)
func (h *Handler) shipOrder(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, r *http.Request) (*service.OrderView, error) {
		var body service.ShipmentInput
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		return h.orders.Ship(id, body, by)
	})
}

func (h *Handler) deliverOrder(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, _ *http.Request) (*service.OrderView, error) {
		return h.orders.Deliver(id, by)
	})
}

func (h *Handler) cancelCustomerOrder(w http.ResponseWriter, r *http.Request) {
	h.advanceOrder(w, r, func(id int, by string, r *http.Request) (*service.OrderView, error) {
		var body service.OrderNoteInput
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		return h.orders.Cancel(id, body, by)
	})
}

// advanceOrder — โครงร่วมของ handler ที่เปลี่ยนสถานะคำสั่งซื้อหนึ่งใบ
func (h *Handler) advanceOrder(
	w http.ResponseWriter, r *http.Request,
	apply func(id int, by string, r *http.Request) (*service.OrderView, error),
) {
	current, id, err := currentAndID(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := apply(id, current.Name, r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toOrderDTO(*view))
}

// currentAndID — อ่านผู้ทำรายการกับรหัสใน path พร้อมกัน (ใช้ซ้ำเกือบทุก handler ของคำสั่งซื้อ)
func currentAndID(r *http.Request) (*service.Identity, int, error) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		return nil, 0, err
	}
	current, err := identity(r)
	if err != nil {
		return nil, 0, err
	}
	return current, id, nil
}

// ── โปรโมชั่น ───────────────────────────────────────────────────────────

func (h *Handler) listActivePromotions(w http.ResponseWriter, _ *http.Request) {
	views, err := h.promotions.List()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var active []service.PromotionView
	for _, v := range views {
		if v.DisplayStatus == model.PromotionStatusActive {
			active = append(active, v)
		}
	}
	httpx.OK(w, toPromotionDTOs(active))
}

func (h *Handler) listPromotions(w http.ResponseWriter, _ *http.Request) {
	views, err := h.promotions.List()
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPromotionDTOs(views))
}

func (h *Handler) getPromotion(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.promotions.Get(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPromotionDTO(*view))
}

func (h *Handler) createPromotion(w http.ResponseWriter, r *http.Request) {
	var body service.PromotionInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.promotions.Create(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toPromotionDTO(*view))
}

func (h *Handler) updatePromotion(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.PromotionInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.promotions.Update(id, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPromotionDTO(*view))
}

func (h *Handler) setPromotionStatus(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.PromotionStatusInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	view, err := h.promotions.SetStatus(id, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPromotionDTO(*view))
}

func (h *Handler) deletePromotion(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	if err := h.promotions.Delete(id); err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.NoContent(w)
}
