// routes.go — ตารางเส้นทางทั้งหมดของ API
//
// ยังเป็น "ที่เดียว" ตามกติกาของโปรเจกต์ แต่ประกอบจากฟังก์ชัน registerXxxRoutes
// ของแต่ละระบบย่อย เพื่อไม่ให้ไฟล์เดียวยาวเกินอ่านเมื่อครบทั้ง 10 ระบบย่อย
//
// สิทธิ์ของแต่ละเส้นทางตรงกับ can.* ใน frontend/src/admin/permissions.ts
// หน้าจอซ่อนหรือปิดปุ่มให้แล้ว แต่ต้องตรวจซ้ำที่นี่เพราะผู้ใช้ยิง API ตรงได้
package handler

import (
	"net/http"

	"bookstore-t03/internal/middleware"
	"bookstore-t03/internal/model"
)

// ชุดบทบาทที่ใช้ซ้ำ — ประกาศไว้ที่เดียวเพื่อไม่ให้แต่ละระบบย่อยตีความต่างกัน
var (
	roleStaff      = []model.Role{model.RoleWarehouse, model.RoleManager, model.RoleSales, model.RoleDelivery}
	roleOffice     = []model.Role{model.RoleWarehouse, model.RoleManager, model.RoleSales}
	rolePurchasing = []model.Role{model.RoleWarehouse, model.RoleManager}
	roleWarehouse  = []model.Role{model.RoleWarehouse}
	roleManager    = []model.Role{model.RoleManager}

	// roleCatalogue — ฝ่ายขายเป็นเจ้าของแคตตาล็อกและข้อมูลลูกค้า ผู้จัดการดูได้ทั้งหมด
	roleCatalogue = []model.Role{model.RoleSales, model.RoleManager}
	roleCustomer  = []model.Role{model.RoleCustomer}

	// roleAnyUser — ทุกคนที่ล็อกอินแล้ว รวมลูกค้า
	// ใช้เฉพาะเส้นทางที่ service กรองข้อมูลตามเจ้าของให้อีกชั้น
	roleAnyUser = []model.Role{
		model.RoleWarehouse, model.RoleManager, model.RoleSales,
		model.RoleDelivery, model.RoleCustomer,
	}
)

// registrar — ลงทะเบียนเส้นทางหนึ่งเส้นพร้อม RequireAuth + RequireRole
// ระบบย่อยแต่ละตัวรับตัวนี้ไปใช้ จึงลืมใส่ role guard ไม่ได้
type registrar func(pattern string, roles []model.Role, handler http.HandlerFunc)

func (h *Handler) Routes(cfg RouteConfig) http.Handler {
	mux := http.NewServeMux()

	// ── เปิดสาธารณะ ─────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/health", h.health)
	mux.HandleFunc("POST /api/auth/login", h.login)
	mux.HandleFunc("POST /api/auth/register", h.register)    // สมัครบัญชีลูกค้า
	mux.HandleFunc("POST /api/auth/verify-otp", h.verifyOtp) // ยืนยันตัวตนก่อนเข้าใช้งาน

	register := registrar(func(pattern string, roles []model.Role, handler http.HandlerFunc) {
		mux.Handle(pattern, middleware.Chain(handler,
			middleware.RequireAuth(cfg.Auth),
			middleware.RequireRole(roles...),
		))
	})

	h.registerAuthRoutes(register)
	h.registerCustomerRoutes(register)     // ลูกค้า + บัญชีผู้ใช้
	h.registerSupplierRoutes(register)     // U1–U4
	h.registerBookRoutes(register)         // หมวดหมู่ + หนังสือ + ประวัติการแก้ไข
	h.registerCatalogueRoutes(register)    // สินค้าคงคลัง (รองรับ U5)
	h.registerPurchasingRoutes(register)   // U5–U10
	h.registerNotificationRoutes(register) // SCR-27

	return middleware.Chain(mux,
		middleware.Recover,
		middleware.RequestLog,
		middleware.CORS(cfg.CORSOrigins),
	)
}
