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

	// roleStock — คลังสินค้าเป็นเจ้าของงานสต็อก ผู้จัดการเป็นผู้ตัดสินผลต่าง
	// ค่าเท่ากับ rolePurchasing แต่แยกชื่อไว้เพราะเป็นคนละเหตุผล เปลี่ยนแยกกันได้
	roleStock = []model.Role{model.RoleWarehouse, model.RoleManager}

	// คำสั่งซื้อลูกค้าแบ่งหน้าที่ตามบทบาทชัดเจน จึงมีชุดของตัวเอง
	roleSales    = []model.Role{model.RoleSales}
	roleDelivery = []model.Role{model.RoleDelivery}

	// roleDeliveryAdmin — สรุปบัญชีพัสดุเป็นงานของฝ่ายจัดส่ง ผู้จัดการดูได้ด้วย
	roleDeliveryAdmin = []model.Role{model.RoleDelivery, model.RoleManager}

	// roleOrderIntake — ลูกค้าสั่งเอง หรือฝ่ายขายรับออร์เดอร์ทางโทรศัพท์/ข้อความแทน
	roleOrderIntake = []model.Role{model.RoleCustomer, model.RoleSales}

	// roleReviewStaff — ฝ่ายขายเป็นเจ้าของงานตรวจสอบรีวิว ผู้จัดการทำแทนได้
	// (can.moderateReview) · ค่าเท่ากับ roleCatalogue แต่คนละเหตุผล เปลี่ยนแยกกันได้
	roleReviewStaff = []model.Role{model.RoleSales, model.RoleManager}

	// roleReviewAudience — คนที่เปิดดูรีวิวได้ · ลูกค้าเห็นเฉพาะของตัวเอง (service กรองให้)
	roleReviewAudience = []model.Role{model.RoleSales, model.RoleManager, model.RoleCustomer}

	// roleReviewOwner — เจ้าของรีวิวคือลูกค้า หรือผู้จัดการดูแลระบบ
	roleReviewOwner = []model.Role{model.RoleCustomer, model.RoleManager}

	// roleOrderAdmin — ยกเลิกคำสั่งซื้อได้ทั้งฝ่ายขายและผู้จัดการ
	roleOrderAdmin = []model.Role{model.RoleSales, model.RoleManager}
	roleCustomer   = []model.Role{model.RoleCustomer}

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

	// แคตตาล็อกหน้าร้าน — คนเดินดูหนังสือยังไม่ล็อกอิน จึงผ่าน register() ไม่ได้
	// อ่านอย่างเดียว และเห็นเฉพาะเล่มที่ขายอยู่ (CatalogueService คัดให้แล้ว)
	mux.HandleFunc("GET /api/catalogue", h.listCatalogue)
	mux.HandleFunc("GET /api/catalogue/categories", h.listCatalogueCategories)
	mux.HandleFunc("GET /api/catalogue/{id}", h.getCatalogueBook)
	mux.HandleFunc("GET /api/promotions/active", h.listActivePromotions)

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
	h.registerInventoryRoutes(register)    // สินค้าคงคลัง (รองรับ U5)
	h.registerStockRoutes(register)        // ปรับยอด · ตรวจนับ · รายงานผลต่าง
	h.registerOrderRoutes(register)        // คำสั่งซื้อลูกค้า
	h.registerPromotionRoutes(register)    // โปรโมชั่นและส่วนลด
	h.registerPaymentRoutes(register)      // ตรวจสอบการชำระเงิน + รายงานรับชำระ
	h.registerDeliveryRoutes(register)     // พัสดุ · ติดตามสถานะ · สรุปบัญชีพัสดุ
	h.registerMembershipRoutes(register)   // ระดับสมาชิก · แต้มสะสม · ของรางวัล
	h.registerReviewRoutes(register)       // รีวิวลูกค้า · คำตอบกลับ · รายงานรีวิว
	h.registerPurchasingRoutes(register)   // U5–U10
	h.registerNotificationRoutes(register) // SCR-27

	// ลำดับจากนอกเข้าใน: กัน panic → บันทึก log → บีบอัด → CORS → ตารางเส้นทาง
	// Compress อยู่ในชั้น RequestLog เพื่อให้ statusRecorder ยังอ่านสถานะจริงได้
	// และอยู่นอก CORS เพื่อครอบทุกเส้นทาง (OPTIONS ที่ CORS ตัดจบเป็น 204 ไม่ถูกบีบอัด)
	return middleware.Chain(mux,
		middleware.Recover,
		middleware.RequestLog,
		middleware.Compress,
		middleware.CORS(cfg.CORSOrigins),
	)
}
