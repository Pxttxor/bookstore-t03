// handler.go — โครง Handler และตัวช่วยที่ทุก handler ใช้ร่วมกัน
//
// ตารางเส้นทางอยู่ที่ routes.go · handler แต่ละระบบย่อยอยู่ไฟล์ของตัวเอง
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/middleware"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

// Deps — service และ repository ทั้งหมดที่ชั้น handler ต้องใช้
//
// เป็น struct ไม่ใช่พารามิเตอร์เรียงตำแหน่ง เพราะจำนวนระบบย่อยจะโตขึ้นเรื่อย ๆ
// การเพิ่มระบบย่อยใหม่ = เพิ่มหนึ่งฟิลด์ ไม่กระทบลำดับอาร์กิวเมนต์ของที่มีอยู่
type Deps struct {
	Auth          *service.AuthService
	People        *service.PersonService
	Suppliers     *service.SupplierService
	Books         *service.BookService
	Stock         *service.InventoryService
	Purchasing    *service.PurchasingService
	Inventory     *repository.InventoryRepository
	Notifications *repository.NotificationRepository
}

type Handler struct {
	auth          *service.AuthService
	people        *service.PersonService
	suppliers     *service.SupplierService
	books         *service.BookService
	stock         *service.InventoryService
	purchasing    *service.PurchasingService
	inventory     *repository.InventoryRepository
	notifications *repository.NotificationRepository
}

func New(d Deps) *Handler {
	return &Handler{
		auth:          d.Auth,
		people:        d.People,
		suppliers:     d.Suppliers,
		books:         d.Books,
		stock:         d.Stock,
		purchasing:    d.Purchasing,
		inventory:     d.Inventory,
		notifications: d.Notifications,
	}
}

// RouteConfig — สิ่งที่ตารางเส้นทางต้องใช้จากภายนอก
type RouteConfig struct {
	Auth        middleware.Authenticator
	CORSOrigins []string
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpx.OK(w, map[string]string{"status": "ok"})
}

// identity — ผู้ใช้ปัจจุบัน เส้นทางที่ผ่าน RequireAuth มาแล้วจะมีเสมอ
func identity(r *http.Request) (*service.Identity, error) {
	current, ok := middleware.IdentityFrom(r.Context())
	if !ok {
		return nil, model.ErrUnauthenticated
	}
	return current, nil
}
