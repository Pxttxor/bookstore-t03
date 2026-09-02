// promotion.go — โปรโมชั่นและส่วนลด (คลาสของจิรพนธ์ อยู่หลาย)
//
// ผู้จัดการร้านเป็นเจ้าของงานนี้ทั้งหมด (`StoreManager.managePromotion()`)
// กฎที่ตัดสินได้จากใบเดียว (ใช้ได้ไหม · ลดเท่าไร · ทับช่วงกันไหม) อยู่บนเมธอดของ model
package service

import (
	"strings"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type PromotionService struct {
	db         *gorm.DB
	promotions *repository.PromotionRepository
}

func NewPromotionService(db *gorm.DB, promotions *repository.PromotionRepository) *PromotionService {
	return &PromotionService{db: db, promotions: promotions}
}

// PromotionInput — ฟอร์มเพิ่ม/แก้ไขโปรโมชั่น
type PromotionInput struct {
	Name            string                `json:"name"`
	Type            model.PromotionType   `json:"type"`
	ConditionDetail string                `json:"conditionDetail"`
	DiscountValue   float64               `json:"discountValue"`
	IsPercent       bool                  `json:"isPercent"`
	MinQty          int                   `json:"minQty"`
	MinAmount       float64               `json:"minAmount"`
	StartDate       model.Date            `json:"startDate"`
	EndDate         model.Date            `json:"endDate"`
	Status          model.PromotionStatus `json:"status"`
}

// PromotionStatusInput — เปิด/ปิดใช้งานโปรโมชั่น
type PromotionStatusInput struct {
	Status model.PromotionStatus `json:"status"`
}

// PromotionView — โปรโมชั่นพร้อมสถานะที่หน้าจอแสดงจริงและรายการที่ช่วงวันที่ทับกัน
//
// Overlapping ไม่ใช่ข้อผิดพลาด เป็นคำเตือนให้ผู้จัดการเห็นก่อนตัดสินใจ (`Promotion.overlaps()`)
type PromotionView struct {
	Promotion     model.Promotion
	DisplayStatus model.PromotionStatus
	Overlapping   []int
}

func (s *PromotionService) List() ([]PromotionView, error) {
	promotions, err := s.promotions.List()
	if err != nil {
		return nil, err
	}

	views := make([]PromotionView, len(promotions))
	for i, promotion := range promotions {
		views[i] = s.view(promotion, promotions)
	}
	return views, nil
}

func (s *PromotionService) Get(promotionID int) (*PromotionView, error) {
	promotion, err := s.promotions.Find(s.db, promotionID)
	if err != nil {
		return nil, err
	}
	all, err := s.promotions.List()
	if err != nil {
		return nil, err
	}
	view := s.view(*promotion, all)
	return &view, nil
}

func (s *PromotionService) Create(input PromotionInput) (*PromotionView, error) {
	promotion, err := s.clean(input)
	if err != nil {
		return nil, err
	}
	if err := s.promotions.Create(&promotion); err != nil {
		return nil, err
	}
	return s.Get(promotion.PromotionID)
}

func (s *PromotionService) Update(promotionID int, input PromotionInput) (*PromotionView, error) {
	if _, err := s.promotions.Find(s.db, promotionID); err != nil {
		return nil, err
	}
	promotion, err := s.clean(input)
	if err != nil {
		return nil, err
	}

	promotion.PromotionID = promotionID
	if err := s.promotions.Save(&promotion); err != nil {
		return nil, err
	}
	return s.Get(promotionID)
}

// SetStatus — เปิด/ปิดใช้งาน · EXPIRED ตั้งเองไม่ได้ เพราะคำนวณจากวันสิ้นสุด
func (s *PromotionService) SetStatus(promotionID int, input PromotionStatusInput) (*PromotionView, error) {
	if input.Status != model.PromotionStatusActive && input.Status != model.PromotionStatusInactive {
		return nil, model.Validation("INVALID_PROMOTION_STATUS",
			"ตั้งได้เฉพาะ ใช้งาน หรือ ปิดใช้งาน เท่านั้น")
	}

	promotion, err := s.promotions.Find(s.db, promotionID)
	if err != nil {
		return nil, err
	}
	promotion.Status = input.Status
	if err := s.promotions.Save(promotion); err != nil {
		return nil, err
	}
	return s.Get(promotionID)
}

// Delete — ลบโปรโมชั่นที่ยังไม่เคยถูกใช้
// ใบที่ใช้ไปแล้วต้องอ่านย้อนหลังได้ ผู้จัดการจึงต้องปิดใช้งานแทนการลบ
func (s *PromotionService) Delete(promotionID int) error {
	if _, err := s.promotions.Find(s.db, promotionID); err != nil {
		return err
	}
	used, err := s.promotions.UsedByOrders(promotionID)
	if err != nil {
		return err
	}
	if used {
		return model.Conflict("PROMOTION_IN_USE",
			"โปรโมชั่นนี้ถูกใช้กับคำสั่งซื้อไปแล้ว ปิดใช้งานแทนการลบ")
	}
	return s.promotions.Delete(promotionID)
}

// clean — ตรวจฟอร์มแล้วประกอบเป็นแถวที่พร้อมเขียน
func (s *PromotionService) clean(input PromotionInput) (model.Promotion, error) {
	promotion := model.Promotion{
		Name:            strings.TrimSpace(input.Name),
		Type:            input.Type,
		ConditionDetail: strings.TrimSpace(input.ConditionDetail),
		DiscountValue:   input.DiscountValue,
		IsPercent:       input.IsPercent,
		MinQty:          input.MinQty,
		MinAmount:       input.MinAmount,
		StartDate:       input.StartDate,
		EndDate:         input.EndDate,
		Status:          input.Status,
	}
	if promotion.Status == "" {
		promotion.Status = model.PromotionStatusActive
	}

	if promotion.Name == "" {
		return promotion, model.Validation("MISSING_FIELDS", "กรุณากรอกชื่อโปรโมชั่น")
	}
	if !promotion.Type.IsValid() {
		return promotion, model.Validation("INVALID_PROMOTION_TYPE", "ชนิดโปรโมชั่นไม่ถูกต้อง")
	}
	if promotion.Status != model.PromotionStatusActive && promotion.Status != model.PromotionStatusInactive {
		return promotion, model.Validation("INVALID_PROMOTION_STATUS",
			"ตั้งได้เฉพาะ ใช้งาน หรือ ปิดใช้งาน เท่านั้น")
	}
	if promotion.DiscountValue <= 0 {
		return promotion, model.Validation("INVALID_DISCOUNT_VALUE", "ส่วนลดต้องมากกว่า 0")
	}
	if promotion.IsPercent && promotion.DiscountValue > 100 {
		return promotion, model.Validation("INVALID_DISCOUNT_VALUE", "ส่วนลดเป็นเปอร์เซ็นต์ต้องไม่เกิน 100")
	}
	if promotion.MinQty < 0 || promotion.MinAmount < 0 {
		return promotion, model.Validation("INVALID_PROMOTION_CONDITION", "เงื่อนไขขั้นต่ำต้องไม่ติดลบ")
	}
	if promotion.EndDate.Before(promotion.StartDate) {
		return promotion, model.ErrPromotionDateRange
	}
	return promotion, nil
}

func (s *PromotionService) view(promotion model.Promotion, all []model.Promotion) PromotionView {
	var overlapping []int
	for _, other := range all {
		if promotion.Overlaps(other) {
			overlapping = append(overlapping, other.PromotionID)
		}
	}
	return PromotionView{
		Promotion:     promotion,
		DisplayStatus: promotion.DisplayStatus(model.Today()),
		Overlapping:   overlapping,
	}
}
