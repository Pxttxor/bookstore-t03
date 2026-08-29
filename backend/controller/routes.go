package controller

import "github.com/gin-gonic/gin"

// RegisterRoutes ลงทะเบียน API Endpoints ทั้งหมดของระบบ Order และ Promotion เข้ากับ Gin Engine
func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// 🛒 ระบบจัดการคำสั่งซื้อ (Order Endpoints)
		orders := api.Group("/orders")
		{
			orders.POST("", CreateOrder)             // POST   /api/orders           (สร้างคำสั่งซื้อ)
			orders.GET("", GetOrders)                // GET    /api/orders           (ดูรายการคำสั่งซื้อทั้งหมด)
			orders.GET("/:id", GetOrderByID)         // GET    /api/orders/:id       (ดูรายละเอียดคำสั่งซื้อ 1 รายการ)
			orders.PATCH("/:id/status", UpdateOrderStatus) // PATCH  /api/orders/:id/status (เปลี่ยนสถานะคำสั่งซื้อ)
			orders.PATCH("/:id/cancel", CancelOrder) // PATCH  /api/orders/:id/cancel (ยกเลิกคำสั่งซื้อ)
		}

		// 🏷️ ระบบจัดการโปรโมชั่น (Promotion Endpoints)
		promotions := api.Group("/promotions")
		{
			promotions.POST("", CreatePromotion)              // POST   /api/promotions        (สร้างโปรโมชั่นใหม่)
			promotions.GET("", GetPromotions)                 // GET    /api/promotions        (ดูรายการโปรโมชั่นทั้งหมด)
			promotions.GET("/:id", GetPromotionByID)          // GET    /api/promotions/:id    (ดูรายละเอียดโปรโมชั่น 1 รายตัว)
			promotions.PUT("/:id", UpdatePromotion)           // PUT    /api/promotions/:id    (แก้ไขโปรโมชั่น)
			promotions.PATCH("/:id/status", TogglePromotionStatus) // PATCH  /api/promotions/:id/status (เปิด/ปิดใช้งานโปรโมชั่น)
		}
	}
}
