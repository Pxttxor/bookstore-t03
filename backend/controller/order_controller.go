package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"bookstore-t03/config"
	"bookstore-t03/model"
	"github.com/gin-gonic/gin"
)

// CreateOrderInput — DTO สำหรับรับข้อมูลการสั่งซื้อจาก Frontend
type CreateOrderInput struct {
	CustomerID      int                `json:"customer_id" binding:"required"`
	Channel         model.OrderChannel `json:"channel" binding:"required"`
	ShippingAddress string             `json:"shipping_address" binding:"required"`
	PromotionID     *int               `json:"promotion_id"`
	Items           []struct {
		BookID   int `json:"book_id" binding:"required"`
		Quantity int `json:"quantity" binding:"required,min=1"`
	} `json:"items" binding:"required,min=1"`
}

// UpdateOrderStatusInput — DTO สำหรับพนักงานเปลี่ยนสถานะคำสั่งซื้อ
type UpdateOrderStatusInput struct {
	Status  model.OrderStatus `json:"status" binding:"required"`
	StaffID int               `json:"staff_id" binding:"required"`
	Note    string            `json:"note"`
}

// 1. POST /api/orders — สร้างคำสั่งซื้อใหม่ (Checkout)
func CreateOrder(c *gin.Context) {
	var input CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	if !input.Channel.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ช่องทางการสั่งซื้อไม่ถูกต้อง"})
		return
	}

	// 1. ตรวจสอบว่ามีลูกค้ารายนี้จริงหรือไม่
	var customer model.Customer
	if err := config.DB.First(&customer, input.CustomerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลลูกค้าในระบบ"})
		return
	}

	// 2. สร้างโครงร่าง Order
	order := model.Order{
		CustomerID:      customer.CustomerID,
		Channel:         input.Channel,
		ShippingAddress: input.ShippingAddress,
		OrderDate:       time.Now(),
		Status:          model.OrderStatusPendingConfirm,
	}

	// 3. วนลูปตรวจสอบหนังสือแต่ละเล่ม คิดราคารายการ
	for _, it := range input.Items {
		var book model.Book
		if err := config.DB.First(&book, it.BookID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("ไม่พบหนังสือรหัส %d", it.BookID)})
			return
		}
		if book.Status != model.BookStatusActive {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("หนังสือ '%s' ไม่ได้เปิดจำหน่าย", book.Title)})
			return
		}
		order.AddItem(book, it.Quantity)
	}

	// คำนวณยอดรวมย่อย (Subtotal)
	order.CalcTotal()

	// 4. ถ้ามีการเลือกใช้โปรโมชั่น ให้ดึงมาตรวจสอบและคำนวณส่วนลด
	if input.PromotionID != nil && *input.PromotionID > 0 {
		var promo model.Promotion
		if err := config.DB.First(&promo, *input.PromotionID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบโปรโมชั่นที่ระบุ"})
			return
		}
		if !order.ApplyPromotion(&promo) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "คำสั่งซื้อไม่ตรงตามเงื่อนไขของโปรโมชั่นนี้"})
			return
		}
	}

	// 5. บันทึกไทม์ไลน์เริ่มต้น
	order.History = append(order.History, model.OrderStatusHistory{
		Status:      model.OrderStatusPendingConfirm,
		ChangedDate: time.Now(),
		Note:        "สร้างคำสั่งซื้อผ่าน " + input.Channel.String(),
	})

	// 6. บันทึกลง Database (GORM จะสร้าง Order, OrderItem, OrderStatusHistory พร้อมกันแบบ Transaction)
	if err := config.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ: " + err.Error()})
		return
	}

	// โหลดความสัมพันธ์ที่สมบูรณ์กลับมาแสดงผล
	config.DB.Preload("Customer").
		Preload("Promotion").
		Preload("Items.Book").
		Preload("History").
		First(&order, order.OrderID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "สร้างคำสั่งซื้อสำเร็จ",
		"data":    order,
	})
}

// 2. GET /api/orders — ดึงรายการคำสั่งซื้อทั้งหมด (รองรับ Query filter: status, customer_id)
func GetOrders(c *gin.Context) {
	var orders []model.Order
	query := config.DB.Model(&model.Order{})

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if customerID := c.Query("customer_id"); customerID != "" {
		query = query.Where("customer_id = ?", customerID)
	}

	if err := query.Preload("Customer").
		Preload("Promotion").
		Preload("Items.Book").
		Order("order_date desc").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": orders, "count": len(orders)})
}

// 3. GET /api/orders/:id — ดูรายละเอียดคำสั่งซื้อ 1 รายการ
func GetOrderByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสคำสั่งซื้อต้องเป็นตัวเลข"})
		return
	}

	var order model.Order
	if err := config.DB.Preload("Customer").
		Preload("Promotion").
		Preload("Items.Book").
		Preload("History").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคำสั่งซื้อนี้ในระบบ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": order})
}

// 4. PATCH /api/orders/:id/status — เปลี่ยนสถานะคำสั่งซื้อ (โดย SalesStaff)
func UpdateOrderStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสคำสั่งซื้อต้องเป็นตัวเลข"})
		return
	}

	var input UpdateOrderStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	if !input.Status.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "สถานะคำสั่งซื้อไม่ถูกต้อง"})
		return
	}

	var order model.Order
	if err := config.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคำสั่งซื้อ"})
		return
	}

	// บันทึกการเปลี่ยนสถานะ
	if err := order.UpdateStatus(input.Status, input.Note); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// บันทึกสถานะใหม่ของ Order และเพิ่มประวัติลง OrderStatusHistory
	if err := config.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกสถานะได้"})
		return
	}

	// บันทึกประวัติไทม์ไลน์ล่าสุด
	latestHistory := order.History[len(order.History)-1]
	latestHistory.OrderID = order.OrderID
	config.DB.Create(&latestHistory)

	c.JSON(http.StatusOK, gin.H{
		"message": "เปลี่ยนสถานะคำสั่งซื้อเรียบร้อยแล้ว",
		"status":  order.Status,
		"label":   order.Status.String(),
	})
}

// 5. PATCH /api/orders/:id/cancel — ยกเลิกคำสั่งซื้อ
func CancelOrder(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสคำสั่งซื้อต้องเป็นตัวเลข"})
		return
	}

	var order model.Order
	if err := config.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบคำสั่งซื้อ"})
		return
	}

	if order.Status == model.OrderStatusDelivered || order.Status == model.OrderStatusShipped {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถยกเลิกคำสั่งซื้อที่จัดส่งแล้วได้"})
		return
	}

	if err := order.UpdateStatus(model.OrderStatusCancelled, "ลูกค้ายกเลิกคำสั่งซื้อ"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config.DB.Save(&order)
	latestHistory := order.History[len(order.History)-1]
	latestHistory.OrderID = order.OrderID
	config.DB.Create(&latestHistory)

	c.JSON(http.StatusOK, gin.H{
		"message": "ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว",
		"status":  order.Status,
	})
}
