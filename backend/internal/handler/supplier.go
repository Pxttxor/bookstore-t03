// supplier.go — handler ของระบบย่อยจัดการข้อมูลผู้จัดจำหน่าย (U1–U4)
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// registerSupplierRoutes — U1–U4 จัดการข้อมูลผู้จัดจำหน่าย
func (h *Handler) registerSupplierRoutes(register registrar) {
	register("GET /api/suppliers", roleOffice, h.listSuppliers)                        // U4 · can.viewSuppliers
	register("GET /api/suppliers/{id}", roleOffice, h.getSupplier)                     // U4
	register("GET /api/suppliers/{id}/orders", roleOffice, h.supplierOrders)           // U4 · SCR-11
	register("POST /api/suppliers", roleWarehouse, h.createSupplier)                   // U1 · can.editSuppliers
	register("PUT /api/suppliers/{id}", roleWarehouse, h.updateSupplier)               // U2 · can.editSuppliers
	register("POST /api/suppliers/{id}/deactivate", roleManager, h.deactivateSupplier) // U3 · can.deactivateSupplier
}

// ── เข้าสู่ระบบ ─────────────────────────────────────────────────────────

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body loginRequest
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	result, err := h.auth.Login(body.Email, body.Password)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, result)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	fresh, err := h.auth.Me(*current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, fresh)
}

// ── U4 ค้นหาและเรียกดู ──────────────────────────────────────────────────

func (h *Handler) listSuppliers(w http.ResponseWriter, r *http.Request) {
	filter := repository.SupplierFilter{
		Query:  r.URL.Query().Get("q"),
		Status: model.SupplierStatus(r.URL.Query().Get("status")),
	}
	if filter.Status != "" && !filter.Status.IsValid() {
		httpx.Error(w, model.Validation("INVALID_STATUS", "สถานะที่กรองไม่ถูกต้อง: "+string(filter.Status)))
		return
	}

	suppliers, err := h.suppliers.List(filter)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toSupplierDTOs(suppliers))
}

func (h *Handler) getSupplier(w http.ResponseWriter, r *http.Request) {
	supplierID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	supplier, err := h.suppliers.Get(supplierID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toSupplierDTO(*supplier))
}

// supplierOrders — ประวัติการสั่งซื้อในหน้ารายละเอียด (SCR-11)
func (h *Handler) supplierOrders(w http.ResponseWriter, r *http.Request) {
	supplierID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	orders, err := h.suppliers.OrdersFor(supplierID)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toPurchaseOrderDTOs(orders))
}

// ── U1 เพิ่ม / U2 แก้ไข / U3 ปิดใช้งาน ───────────────────────────────────

func (h *Handler) createSupplier(w http.ResponseWriter, r *http.Request) {
	var body service.SupplierInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	supplier, err := h.suppliers.Create(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, toSupplierDTO(*supplier))
}

func (h *Handler) updateSupplier(w http.ResponseWriter, r *http.Request) {
	supplierID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}

	var body service.SupplierInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	supplier, err := h.suppliers.Update(supplierID, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toSupplierDTO(*supplier))
}

func (h *Handler) deactivateSupplier(w http.ResponseWriter, r *http.Request) {
	supplierID, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}

	var body service.DeactivateInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	supplier, err := h.suppliers.Deactivate(supplierID, body, current.Name)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toSupplierDTO(*supplier))
}
