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

// CreatePromotionInput — DTO สำหรับการสร้างโปรโมชั่นใหม่
type CreatePromotionInput struct {
	Name            string              `json:"name" binding:"required"`
	Type            model.PromotionType `json:"type" binding:"required"`
	ConditionDetail string              `json:"condition_detail"`
	DiscountValue   float64             `json:"discount_value" binding:"required,gt=0"`
	IsPercent       bool                `json:"is_percent"`
	MinQty          int                 `json:"min_qty"`
	MinAmount       float64             `json:"min_amount"`
	StartDate       time.Time           `json:"start_date" binding:"required"`
	EndDate         time.Time           `json:"end_date" binding:"required"`
}

// UpdatePromotionInput — DTO สำหรับการแก้ไขข้อมูลโปรโมชั่น
type UpdatePromotionInput struct {
	Name            string              `json:"name"`
	Type            model.PromotionType `json:"type"`
	ConditionDetail string              `json:"condition_detail"`
	DiscountValue   float64             `json:"discount_value"`
	IsPercent       bool                `json:"is_percent"`
	MinQty          int                 `json:"min_qty"`
	MinAmount       float64             `json:"min_amount"`
	StartDate       time.Time           `json:"start_date"`
	EndDate         time.Time           `json:"end_date"`
	Status          model.PromotionStatus `json:"status"`
}

// 1. POST /api/promotions — สร้างโปรโมชั่นใหม่ (ผู้จัดการร้าน)
func CreatePromotion(c *gin.Context) {
	var input CreatePromotionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	if !input.Type.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ประเภทโปรโมชั่นไม่ถูกต้อง"})
		return
	}

	if input.EndDate.Before(input.StartDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่มต้น"})
		return
	}

	newPromo := model.Promotion{
		Name:            input.Name,
		Type:            input.Type,
		ConditionDetail: input.ConditionDetail,
		DiscountValue:   input.DiscountValue,
		IsPercent:       input.IsPercent,
		MinQty:          input.MinQty,
		MinAmount:       input.MinAmount,
		StartDate:       input.StartDate,
		EndDate:         input.EndDate,
		Status:          model.PromotionStatusActive,
	}

	// ตรวจสอบช่วงเวลาโปรโมชั่นทับซ้อน (Overlaps) กับโปรโมชั่นประเภทเดียวกันที่ยังเปิดใช้งานอยู่
	var existingPromos []model.Promotion
	config.DB.Where("type = ? AND status = ?", newPromo.Type, model.PromotionStatusActive).Find(&existingPromos)
	for _, p := range existingPromos {
		if newPromo.Overlaps(&p) {
			c.JSON(http.StatusConflict, gin.H{
				"warning": fmt.Sprintf("ช่วงเวลาของโปรโมชั่นนี้ทับซ้อนกับโปรโมชั่น '%s' (#%d)", p.Name, p.PromotionID),
			})
			// หมายเหตุ: ในระบบจริงอาจเลือกบันทึกพร้อมแจ้งเตือน หรือปฏิเสธตาม Requirement
		}
	}

	if err := config.DB.Create(&newPromo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกโปรโมชั่นได้: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "สร้างโปรโมชั่นเรียบร้อยแล้ว",
		"data":    newPromo,
	})
}

// 2. GET /api/promotions — ดึงรายการโปรโมชั่นทั้งหมด (รองรับ Filter: status, type)
func GetPromotions(c *gin.Context) {
	var promotions []model.Promotion
	query := config.DB.Model(&model.Promotion{})

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if promoType := c.Query("type"); promoType != "" {
		query = query.Where("type = ?", promoType)
	}

	if err := query.Order("start_date desc").Find(&promotions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": promotions, "count": len(promotions)})
}

// 3. GET /api/promotions/:id — ดูรายละเอียดโปรโมชั่นรายตัว
func GetPromotionByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสโปรโมชั่นต้องเป็นตัวเลข"})
		return
	}

	var promo model.Promotion
	if err := config.DB.First(&promo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบโปรโมชั่นนี้ในระบบ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": promo})
}

// 4. PUT /api/promotions/:id — แก้ไขข้อมูลโปรโมชั่น
func UpdatePromotion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสโปรโมชั่นต้องเป็นตัวเลข"})
		return
	}

	var promo model.Promotion
	if err := config.DB.First(&promo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบโปรโมชั่น"})
		return
	}

	var input UpdatePromotionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// อัปเดตข้อมูล
	if input.Name != "" {
		promo.Name = input.Name
	}
	if input.Type != "" && input.Type.IsValid() {
		promo.Type = input.Type
	}
	if input.DiscountValue > 0 {
		promo.DiscountValue = input.DiscountValue
	}
	promo.ConditionDetail = input.ConditionDetail
	promo.IsPercent = input.IsPercent
	promo.MinQty = input.MinQty
	promo.MinAmount = input.MinAmount
	if !input.StartDate.IsZero() {
		promo.StartDate = input.StartDate
	}
	if !input.EndDate.IsZero() {
		promo.EndDate = input.EndDate
	}
	if input.Status != "" && input.Status.IsValid() {
		promo.Status = input.Status
	}

	if err := config.DB.Save(&promo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถแก้ไขโปรโมชั่นได้"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "แก้ไขโปรโมชั่นสำเร็จ", "data": promo})
}

// 5. PATCH /api/promotions/:id/status — สลับ/เปลี่ยนสถานะโปรโมชั่น (เปิด/ปิดใช้งาน)
func TogglePromotionStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสโปรโมชั่นต้องเป็นตัวเลข"})
		return
	}

	var promo model.Promotion
	if err := config.DB.First(&promo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบโปรโมชั่น"})
		return
	}

	if promo.Status == model.PromotionStatusActive {
		promo.Status = model.PromotionStatusInactive
	} else {
		promo.Status = model.PromotionStatusActive
	}

	if err := config.DB.Save(&promo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเปลี่ยนสถานะได้"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "เปลี่ยนสถานะโปรโมชั่นเรียบร้อยแล้ว",
		"status":  promo.Status,
		"label":   promo.Status.String(),
	})
}
