// handler.go — handler ทุกตัวและตารางเส้นทาง
package handler

import (
	"net/http"

	"bookstore-t03/internal/httpx"
	"bookstore-t03/internal/middleware"
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

type Handler struct {
	auth          *service.AuthService
	suppliers     *service.SupplierService
	purchasing    *service.PurchasingService
	inventory     *repository.InventoryRepository
	notifications *repository.NotificationRepository
}

func New(
	auth *service.AuthService,
	suppliers *service.SupplierService,
	purchasing *service.PurchasingService,
	inventory *repository.InventoryRepository,
	notifications *repository.NotificationRepository,
) *Handler {
	return &Handler{
		auth: auth, suppliers: suppliers, purchasing: purchasing,
		inventory: inventory, notifications: notifications,
	}
}

// Routes — ตารางเส้นทางทั้งหมด ใช้ ServeMux ของ stdlib (Go 1.22 ขึ้นไปรองรับ method + {param})
//
// สิทธิ์ของแต่ละเส้นทางตรงกับ can.* ใน frontend/src/admin/permissions.ts
// หน้าจอซ่อนหรือปิดปุ่มให้แล้ว แต่ต้องตรวจซ้ำที่นี่เพราะยิง API ตรงได้
func (h *Handler) Routes(cfg RouteConfig) http.Handler {
	mux := http.NewServeMux()

	// ── เปิดสาธารณะ ─────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/health", h.health)
	mux.HandleFunc("POST /api/auth/login", h.login)

	staff := []model.Role{model.RoleWarehouse, model.RoleManager, model.RoleSales, model.RoleDelivery}
	office := []model.Role{model.RoleWarehouse, model.RoleManager, model.RoleSales}
	purchasingRoles := []model.Role{model.RoleWarehouse, model.RoleManager}
	warehouse := []model.Role{model.RoleWarehouse}
	manager := []model.Role{model.RoleManager}

	protected := func(pattern string, roles []model.Role, handler http.HandlerFunc) {
		mux.Handle(pattern, middleware.Chain(handler,
			middleware.RequireAuth(cfg.Auth),
			middleware.RequireRole(roles...),
		))
	}

	protected("GET /api/auth/me", staff, h.me)

	// ── ผู้จัดจำหน่าย U1–U4 ─────────────────────────────────────────────
	protected("GET /api/suppliers", office, h.listSuppliers)                        // U4 · can.viewSuppliers
	protected("GET /api/suppliers/{id}", office, h.getSupplier)                     // U4
	protected("GET /api/suppliers/{id}/orders", office, h.supplierOrders)           // U4
	protected("POST /api/suppliers", warehouse, h.createSupplier)                   // U1 · can.editSuppliers
	protected("PUT /api/suppliers/{id}", warehouse, h.updateSupplier)               // U2 · can.editSuppliers
	protected("POST /api/suppliers/{id}/deactivate", manager, h.deactivateSupplier) // U3 · can.deactivateSupplier

	// ── หนังสือและสินค้าคงคลัง (ตารางประกอบ รองรับ U5) ─────────────────
	protected("GET /api/books", office, h.listBooks)
	protected("GET /api/inventory", office, h.listInventory)                             // can.viewStock
	protected("GET /api/inventory/alerts", warehouse, h.reorderAlerts)                   // U5 · can.viewAlerts
	protected("PUT /api/inventory/{bookId}/reorder-point", warehouse, h.setReorderPoint) // U5 · can.setReorderPoint

	// ── ใบขอสั่งซื้อ U6–U7 ──────────────────────────────────────────────
	protected("GET /api/requisitions", purchasingRoles, h.listRequisitions) // can.viewPurchasing
	protected("GET /api/requisitions/{id}", purchasingRoles, h.getRequisition)
	protected("POST /api/requisitions", warehouse, h.createRequisition)             // U6 · can.createRequisition
	protected("PUT /api/requisitions/{id}", warehouse, h.updateRequisition)         // U6
	protected("POST /api/requisitions/{id}/submit", warehouse, h.submitRequisition) // U6
	protected("POST /api/requisitions/{id}/approve", manager, h.approveRequisition) // U7 · can.approveRequisition
	protected("POST /api/requisitions/{id}/reject", manager, h.rejectRequisition)   // U7

	// ── ใบสั่งซื้อ U8–U10 ───────────────────────────────────────────────
	protected("GET /api/orders", purchasingRoles, h.listOrders)
	protected("GET /api/orders/{id}", purchasingRoles, h.getOrder)
	protected("POST /api/orders/{id}/send", warehouse, h.sendOrder)       // U8 · can.sendOrder
	protected("POST /api/orders/{id}/confirm", warehouse, h.confirmOrder) // U8
	protected("GET /api/orders/{id}/receipts", purchasingRoles, h.listOrderReceipts)
	protected("POST /api/orders/{id}/receipts", warehouse, h.receiveGoods) // U9 · can.receiveGoods
	protected("GET /api/orders/{id}/returns", purchasingRoles, h.listOrderReturns)
	protected("POST /api/orders/{id}/returns", warehouse, h.createReturn) // U10 · can.createReturn

	protected("GET /api/receipts", purchasingRoles, h.listReceipts)
	protected("GET /api/returns", purchasingRoles, h.listReturns)
	protected("GET /api/returns/{id}", purchasingRoles, h.getReturn)
	protected("POST /api/returns/{id}/escalate", warehouse, h.escalateReturn)         // U10
	protected("POST /api/returns/{id}/compensation", warehouse, h.recordCompensation) // U10

	protected("GET /api/purchasing/budget", purchasingRoles, h.budget) // U7 · แถบงบบน SCR-23

	// ── การแจ้งเตือน ────────────────────────────────────────────────────
	protected("GET /api/notifications", staff, h.listNotifications)
	protected("POST /api/notifications/{id}/read", staff, h.markNotificationRead)
	protected("POST /api/notifications/read-all", staff, h.markAllNotificationsRead)

	return middleware.Chain(mux,
		middleware.Recover,
		middleware.RequestLog,
		middleware.CORS(cfg.CORSOrigins),
	)
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
