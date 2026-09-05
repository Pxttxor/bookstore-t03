// membership.go — ระบบสมาชิกและแต้มสะสม
//
// การ "สะสมแต้ม" ไม่ได้อยู่ที่นี่ แต่อยู่ใน OrderService.Deliver เพราะแต้มเกิดพร้อมกับ
// การยืนยันรับสินค้าและต้องเขียนในทรานแซกชันเดียวกัน — เหตุผลเดียวกับการตรวจสลิปใน P5
// และการเปิดพัสดุใน P6 · ที่นี่รับผิดชอบระดับสมาชิก การอ่านแต้ม การแลกของรางวัล
// และการปรับแต้มด้วยมือของผู้จัดการ
package service

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

type MembershipService struct {
	db      *gorm.DB
	members *repository.MembershipRepository
}

func NewMembershipService(db *gorm.DB, members *repository.MembershipRepository) *MembershipService {
	return &MembershipService{db: db, members: members}
}

// ── DTO ที่หน้าจอส่งเข้ามา ───────────────────────────────────────────────

// TierInput — ฟอร์มเพิ่ม/แก้ไขระดับสมาชิกของผู้จัดการ (`StoreManager.manageMemberTier()`)
type TierInput struct {
	Name                   string  `json:"name"`
	MinAccumulatedPurchase float64 `json:"minAccumulatedPurchase"`
	PointRate              float64 `json:"pointRate"`
	Benefits               string  `json:"benefits"`
}

// RewardInput — ฟอร์มเพิ่ม/แก้ไขของรางวัล
type RewardInput struct {
	Name          string           `json:"name"`
	Type          model.RewardType `json:"type"`
	PointCost     int              `json:"pointCost"`
	DiscountValue float64          `json:"discountValue"`
}

// PointAdjustmentInput — ผู้จัดการหักแต้มที่หมดอายุหรือคืนรายการที่ผิดพลาด
type PointAdjustmentInput struct {
	Type   model.PointTxnType `json:"type"`
	Points int                `json:"points"`
	Note   string             `json:"note"`
}

// MemberView — สมาชิกพร้อมชื่อลูกค้าและระดับที่หน้าจอต้องแสดง
type MemberView struct {
	Member       model.Member
	CustomerName string
	Tier         model.MembershipTier
}

// RedemptionView — การแลกพร้อมชื่อของรางวัล (หน้าจอไม่ต้องยิงถามซ้ำทีละใบ)
type RedemptionView struct {
	Redemption model.Redemption
	RewardName string
	RewardType model.RewardType
}

// ── ระดับสมาชิก ─────────────────────────────────────────────────────────

func (s *MembershipService) Tiers() ([]model.MembershipTier, error) {
	return s.members.ListTiers(s.db)
}

func (s *MembershipService) CreateTier(input TierInput) (*model.MembershipTier, error) {
	tier, err := s.cleanTier(input)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		taken, err := s.members.TierNameTaken(tx, tier.Name, 0)
		if err != nil {
			return err
		}
		if taken {
			return model.ErrTierNameTaken
		}
		return s.members.CreateTier(tx, &tier)
	})
	if err != nil {
		return nil, err
	}
	return &tier, nil
}

func (s *MembershipService) UpdateTier(tierID int, input TierInput) (*model.MembershipTier, error) {
	fresh, err := s.cleanTier(input)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		current, err := s.members.FindTier(tx, tierID)
		if err != nil {
			return err
		}
		taken, err := s.members.TierNameTaken(tx, fresh.Name, tierID)
		if err != nil {
			return err
		}
		if taken {
			return model.ErrTierNameTaken
		}

		current.Name = fresh.Name
		current.MinAccumulatedPurchase = fresh.MinAccumulatedPurchase
		current.PointRate = fresh.PointRate
		current.Benefits = fresh.Benefits
		fresh = *current
		return s.members.SaveTier(tx, current)
	})
	if err != nil {
		return nil, err
	}
	return &fresh, nil
}

// DeleteTier — ลบระดับที่ยังไม่มีสมาชิกอยู่เท่านั้น (member.tier_id เป็น NOT NULL)
func (s *MembershipService) DeleteTier(tierID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.members.FindTier(tx, tierID); err != nil {
			return err
		}
		count, err := s.members.TierMemberCount(tx, tierID)
		if err != nil {
			return err
		}
		if count > 0 {
			return model.ErrTierInUse
		}
		return s.members.DeleteTier(tx, tierID)
	})
}

// cleanTier — ตรวจฟอร์มแล้วประกอบเป็นระดับที่พร้อมเขียนลงฐานข้อมูล
func (s *MembershipService) cleanTier(input TierInput) (model.MembershipTier, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return model.MembershipTier{}, model.Validation("MISSING_FIELDS", "กรุณากรอกชื่อระดับสมาชิก")
	}
	if input.MinAccumulatedPurchase < 0 {
		return model.MembershipTier{}, model.ErrInvalidMinPurchase
	}
	if input.PointRate <= 0 {
		return model.MembershipTier{}, model.ErrInvalidPointRate
	}
	return model.MembershipTier{
		Name:                   name,
		MinAccumulatedPurchase: input.MinAccumulatedPurchase,
		PointRate:              input.PointRate,
		Benefits:               strings.TrimSpace(input.Benefits),
	}, nil
}

// ── สมาชิก ──────────────────────────────────────────────────────────────

func (s *MembershipService) List() ([]MemberView, error) {
	rows, err := s.members.ListMembers()
	if err != nil {
		return nil, err
	}
	return s.views(rows)
}

// Me — สมาชิกของลูกค้าที่ล็อกอินอยู่
func (s *MembershipService) Me(current Identity) (*MemberView, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}
	row, err := s.members.FindMemberByCustomer(s.db, current.CustomerID)
	if err != nil {
		return nil, err
	}
	return s.single(*row)
}

// Get — สมาชิกหนึ่งราย · ลูกค้าเปิดของคนอื่นไม่ได้
func (s *MembershipService) Get(current Identity, memberID int) (*MemberView, error) {
	row, err := s.members.FindMember(s.db, memberID)
	if err != nil {
		return nil, err
	}
	if err := assertMemberOwner(current, row.Member); err != nil {
		return nil, err
	}
	return s.single(*row)
}

// PointHistory — ประวัติแต้มของสมาชิกหนึ่งราย (`Member.points` ใน class diagram)
func (s *MembershipService) PointHistory(
	current Identity, memberID int,
) ([]model.PointTransaction, error) {
	row, err := s.members.FindMember(s.db, memberID)
	if err != nil {
		return nil, err
	}
	if err := assertMemberOwner(current, row.Member); err != nil {
		return nil, err
	}
	return s.members.PointTransactions(memberID)
}

// AdjustPoints — ผู้จัดการหักแต้มหมดอายุหรือคืนรายการที่ผิดพลาด
//
// ต้องบอกเหตุผลเสมอ เพราะเป็นการแก้ยอดที่ไม่มีเอกสารต้นทางให้ย้อนดู
func (s *MembershipService) AdjustPoints(
	memberID int, input PointAdjustmentInput, by string,
) (*MemberView, error) {
	note := strings.TrimSpace(input.Note)
	if note == "" {
		return nil, model.ErrReasonRequired
	}

	var updated model.Member
	err := s.db.Transaction(func(tx *gorm.DB) error {
		member, err := s.members.FindMemberForUpdate(tx, memberID)
		if err != nil {
			return err
		}

		before := len(member.PointTxns)
		if err := member.Adjust(input.Type, input.Points, note+" (โดย "+by+")", time.Now()); err != nil {
			return err
		}
		if err := s.members.SaveMember(tx, member); err != nil {
			return err
		}
		if err := s.members.AddPointTransactions(tx, member.PointTxns[before:]); err != nil {
			return err
		}

		updated = *member
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(Identity{Role: model.RoleManager}, updated.MemberID)
}

// ── ของรางวัล ───────────────────────────────────────────────────────────

func (s *MembershipService) Rewards() ([]model.Reward, error) {
	return s.members.ListRewards(s.db)
}

func (s *MembershipService) CreateReward(input RewardInput) (*model.Reward, error) {
	reward, err := s.cleanReward(input)
	if err != nil {
		return nil, err
	}
	if err := s.members.CreateReward(s.db, &reward); err != nil {
		return nil, err
	}
	return &reward, nil
}

func (s *MembershipService) UpdateReward(rewardID int, input RewardInput) (*model.Reward, error) {
	fresh, err := s.cleanReward(input)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		current, err := s.members.FindReward(tx, rewardID)
		if err != nil {
			return err
		}
		current.Name = fresh.Name
		current.Type = fresh.Type
		current.PointCost = fresh.PointCost
		current.DiscountValue = fresh.DiscountValue
		fresh = *current
		return s.members.SaveReward(tx, current)
	})
	if err != nil {
		return nil, err
	}
	return &fresh, nil
}

// DeleteReward — ลบได้เฉพาะใบที่ยังไม่มีใครแลก (กติกาเดียวกับโปรโมชั่นที่ถูกใช้ไปแล้ว)
func (s *MembershipService) DeleteReward(rewardID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.members.FindReward(tx, rewardID); err != nil {
			return err
		}
		redeemed, err := s.members.RewardRedeemed(tx, rewardID)
		if err != nil {
			return err
		}
		if redeemed {
			return model.ErrRewardRedeemed
		}
		return s.members.DeleteReward(tx, rewardID)
	})
}

func (s *MembershipService) cleanReward(input RewardInput) (model.Reward, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return model.Reward{}, model.Validation("MISSING_FIELDS", "กรุณากรอกชื่อของรางวัล")
	}
	if !input.Type.IsValid() {
		return model.Reward{}, model.ErrInvalidRewardType
	}
	if input.PointCost <= 0 {
		return model.Reward{}, model.ErrInvalidPointCost
	}
	// ของแถมไม่มีมูลค่าส่วนลด ส่วนคูปองส่วนลดต้องลดได้จริง
	if input.Type == model.RewardTypeDiscount && input.DiscountValue <= 0 {
		return model.Reward{}, model.ErrInvalidDiscountValue
	}

	reward := model.Reward{
		Name:          name,
		Type:          input.Type,
		PointCost:     input.PointCost,
		DiscountValue: input.DiscountValue,
	}
	if reward.Type == model.RewardTypeGift {
		reward.DiscountValue = 0
	}
	return reward, nil
}

// ── การแลกแต้ม ──────────────────────────────────────────────────────────

// Redeem — ลูกค้าแลกแต้มเป็นของรางวัล (`Member.redeemPoints()` ใน class diagram)
//
// ล็อกแถวสมาชิกไว้ตลอดรายการ ไม่งั้นกดรัว ๆ สองครั้งพร้อมกันจะแลกได้เกินแต้มที่มี
// รหัสคูปองเติมทีหลังในทรานแซกชันเดียวกัน เพราะออกจาก redemption_id ที่เพิ่งเกิด
func (s *MembershipService) Redeem(current Identity, rewardID int) (*RedemptionView, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}

	var (
		redemption model.Redemption
		reward     *model.Reward
	)
	err := s.db.Transaction(func(tx *gorm.DB) error {
		found, err := s.members.FindReward(tx, rewardID)
		if err != nil {
			return err
		}
		reward = found

		member, err := s.members.FindMemberByCustomerForUpdate(tx, current.CustomerID)
		if err != nil {
			return err
		}

		before := len(member.PointTxns)
		issued, err := member.RedeemPoints(*reward, time.Now())
		if err != nil {
			return err
		}
		if err := s.members.SaveMember(tx, member); err != nil {
			return err
		}
		if err := s.members.AddPointTransactions(tx, member.PointTxns[before:]); err != nil {
			return err
		}
		if err := s.members.CreateRedemption(tx, issued); err != nil {
			return err
		}

		issued.CouponCode = model.FormatCouponCode(issued.RedemptionID)
		if err := s.members.SetCouponCode(tx, issued.RedemptionID, issued.CouponCode); err != nil {
			return err
		}

		redemption = *issued
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &RedemptionView{
		Redemption: redemption,
		RewardName: reward.Name,
		RewardType: reward.Type,
	}, nil
}

// Redemptions — ประวัติการแลก · ลูกค้าเห็นเฉพาะของตัวเองเสมอ
func (s *MembershipService) Redemptions(current Identity) ([]RedemptionView, error) {
	filter := repository.RedemptionFilter{}
	if current.IsCustomer() {
		row, err := s.members.FindMemberByCustomer(s.db, current.CustomerID)
		if err != nil {
			return nil, err
		}
		filter.MemberID = row.Member.MemberID
	}

	redemptions, err := s.members.ListRedemptions(filter)
	if err != nil {
		return nil, err
	}
	rewards, err := s.members.ListRewards(s.db)
	if err != nil {
		return nil, err
	}
	byReward := make(map[int]model.Reward, len(rewards))
	for _, reward := range rewards {
		byReward[reward.RewardID] = reward
	}

	views := make([]RedemptionView, len(redemptions))
	for i, redemption := range redemptions {
		reward := byReward[redemption.RewardID]
		views[i] = RedemptionView{
			Redemption: redemption,
			RewardName: reward.Name,
			RewardType: reward.Type,
		}
	}
	return views, nil
}

// ── ตัวช่วย ─────────────────────────────────────────────────────────────

// assertMemberOwner — ลูกค้าเปิดข้อมูลสมาชิกของคนอื่นไม่ได้
// (เช็คแบบเดียวกับ DeliveryService.assertOwner แต่ตัดสินจากแถวที่อ่านมาแล้ว ไม่ต้องยิงซ้ำ)
func assertMemberOwner(current Identity, member model.Member) error {
	if current.IsCustomer() && member.CustomerID != current.CustomerID {
		return model.ErrForbidden
	}
	return nil
}

func (s *MembershipService) single(row repository.MemberRow) (*MemberView, error) {
	views, err := s.views([]repository.MemberRow{row})
	if err != nil {
		return nil, err
	}
	return &views[0], nil
}

func (s *MembershipService) views(rows []repository.MemberRow) ([]MemberView, error) {
	views := make([]MemberView, len(rows))
	if len(rows) == 0 {
		return views, nil
	}

	tiers, err := s.members.ListTiers(s.db)
	if err != nil {
		return nil, err
	}
	byTier := make(map[int]model.MembershipTier, len(tiers))
	for _, tier := range tiers {
		byTier[tier.TierID] = tier
	}

	for i, row := range rows {
		views[i] = MemberView{
			Member:       row.Member,
			CustomerName: row.Person.Name(),
			Tier:         byTier[row.Member.TierID],
		}
	}
	return views, nil
}
