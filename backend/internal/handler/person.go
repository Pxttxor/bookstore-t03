// person.go — handler ของบุคคล ลูกค้า และบัญชีผู้ใช้
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// registerAuthRoutes — สมัครสมาชิกและยืนยันตัวตน (เส้นทางสาธารณะลงทะเบียนใน routes.go)
func (h *Handler) registerAuthRoutes(register registrar) {
	register("GET /api/auth/me", roleAnyUser, h.me)
}

// registerCustomerRoutes — ข้อมูลลูกค้าและบัญชีผู้ใช้
func (h *Handler) registerCustomerRoutes(register registrar) {
	// เส้นทาง /me ต้องมาก่อน /{id} ในการอ่าน แต่ ServeMux ของ Go 1.22 เลือกตัวที่เจาะจงกว่าให้เอง
	register("GET /api/customers/me", roleCustomer, h.myProfile)
	register("PUT /api/customers/me", roleCustomer, h.updateMyProfile)
	register("GET /api/customers", roleCatalogue, h.listCustomers)    // can.viewCustomers
	register("GET /api/customers/{id}", roleCatalogue, h.getCustomer) // can.viewCustomers
	register("POST /api/accounts/{id}/suspend", roleManager, h.suspendAccount)
	register("POST /api/accounts/{id}/reactivate", roleManager, h.reactivateAccount)
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var body service.RegisterInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	result, err := h.people.Register(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.Created(w, result)
}

func (h *Handler) verifyOtp(w http.ResponseWriter, r *http.Request) {
	var body service.VerifyOtpInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	account, err := h.people.VerifyOtp(body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toAccountDTO(account))
}

func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.people.ListCustomers(repository.CustomerFilter{
		Query: r.URL.Query().Get("q"),
	})
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCustomerDTOs(rows))
}

func (h *Handler) getCustomer(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.people.GetCustomer(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCustomerDTO(*row))
}

func (h *Handler) myProfile(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.people.Profile(*current)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCustomerDTO(*row))
}

func (h *Handler) updateMyProfile(w http.ResponseWriter, r *http.Request) {
	current, err := identity(r)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	var body service.ProfileInput
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, err)
		return
	}
	row, err := h.people.UpdateProfile(*current, body)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toCustomerDTO(*row))
}

func (h *Handler) suspendAccount(w http.ResponseWriter, r *http.Request) {
	h.changeAccount(w, r, h.people.SuspendAccount)
}

func (h *Handler) reactivateAccount(w http.ResponseWriter, r *http.Request) {
	h.changeAccount(w, r, h.people.ReactivateAccount)
}

func (h *Handler) changeAccount(
	w http.ResponseWriter, r *http.Request, apply func(int) (*model.UserAccount, error),
) {
	id, err := httpx.PathInt(r, "id")
	if err != nil {
		httpx.Error(w, err)
		return
	}
	account, err := apply(id)
	if err != nil {
		httpx.Error(w, err)
		return
	}
	httpx.OK(w, toAccountDTO(account))
}
