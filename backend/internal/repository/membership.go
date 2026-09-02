// membership.go — ระดับสมาชิก สมาชิก แต้มสะสม ของรางวัล และการแลกแต้ม
// (ระบบย่อยของบัญชาการ อภัยสอน)
package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"bookstore-t03/internal/model"
)

type MembershipRepository struct{ db *gorm.DB }

func NewMembershipRepository(db *gorm.DB) *MembershipRepository {
	return &MembershipRepository{db: db}
}

// ── ระดับสมาชิก ─────────────────────────────────────────────────────────

// ListTiers — เรียงตามเกณฑ์ยอดสะสมจากน้อยไปมาก (ลำดับที่หน้าจอแสดงบันไดระดับ)
func (r *MembershipRepository) ListTiers(db *gorm.DB) ([]model.MembershipTier, error) {
	var tiers []model.MembershipTier
	err := db.Order("min_accumulated_purchase, tier_id").Find(&tiers).Error
	return tiers, err
}

func (r *MembershipRepository) FindTier(db *gorm.DB, tierID int) (*model.MembershipTier, error) {
	var tier model.MembershipTier
	err := db.First(&tier, "tier_id = ?", tierID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrTierNotFound
	}
	if err != nil {
		return nil, err
	}
	return &tier, nil
}

// TierNameTaken — ชื่อระดับซ้ำแบบไม่สนตัวพิมพ์และช่องว่างหัวท้าย (กติกาเดียวกับชื่อหมวดหมู่)
// exceptID > 0 = ข้ามแถวของตัวเองตอนแก้ไข
func (r *MembershipRepository) TierNameTaken(db *gorm.DB, name string, exceptID int) (bool, error) {
	query := db.Model(&model.MembershipTier{}).
		Where("lower(btrim(name)) = ?", strings.ToLower(strings.TrimSpace(name)))
	if exceptID > 0 {
		query = query.Where("tier_id <> ?", exceptID)
	}

	var count int64
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *MembershipRepository) CreateTier(db *gorm.DB, tier *model.MembershipTier) error {
	return db.Create(tier).Error
}

func (r *MembershipRepository) SaveTier(db *gorm.DB, tier *model.MembershipTier) error {
	return db.Model(&model.MembershipTier{}).
		Where("tier_id = ?", tier.TierID).
		Updates(map[string]any{
			"name":                     tier.Name,
			"min_accumulated_purchase": tier.MinAccumulatedPurchase,
			"point_rate":               tier.PointRate,
			"benefits":                 tier.Benefits,
		}).Error
}

func (r *MembershipRepository) TierMemberCount(db *gorm.DB, tierID int) (int64, error) {
	var count int64
	err := db.Model(&model.Member{}).Where("tier_id = ?", tierID).Count(&count).Error
	return count, err
}

func (r *MembershipRepository) DeleteTier(db *gorm.DB, tierID int) error {
	return db.Delete(&model.MembershipTier{}, "tier_id = ?", tierID).Error
}

// ── สมาชิก ──────────────────────────────────────────────────────────────

// MemberRow — สมาชิกพร้อมข้อมูลติดต่อของลูกค้าเจ้าของแถว
// อ่านคู่กันเสมอเพราะหน้าจอต้องแสดงชื่อ จึง join ให้เสร็จที่ชั้นนี้ (แบบเดียวกับ CustomerRow)
type MemberRow struct {
	Member   model.Member
	Customer model.Customer
	Person   model.Person
}

func (r *MembershipRepository) ListMembers() ([]MemberRow, error) {
	var members []model.Member
	if err := r.db.Order("member_id").Find(&members).Error; err != nil {
		return nil, err
	}
	return r.attach(members)
}

func (r *MembershipRepository) FindMember(db *gorm.DB, memberID int) (*MemberRow, error) {
	var member model.Member
	err := db.First(&member, "member_id = ?", memberID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.attach([]model.Member{member})
	if err != nil {
		return nil, err
	}
	return &rows[0], nil
}

func (r *MembershipRepository) FindMemberByCustomer(db *gorm.DB, customerID int) (*MemberRow, error) {
	var member model.Member
	err := db.First(&member, "customer_id = ?", customerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.attach([]model.Member{member})
	if err != nil {
		return nil, err
	}
	return &rows[0], nil
}

// FindMemberForUpdate — อ่านพร้อมล็อกแถว กันกดแลกของรางวัลรัว ๆ แล้วแต้มติดลบ
// ไม่ต้อง join อะไร เพราะผู้เรียกกำลังจะเขียนกลับ ไม่ได้เอาไปแสดงผลทันที
func (r *MembershipRepository) FindMemberForUpdate(tx *gorm.DB, memberID int) (*model.Member, error) {
	var member model.Member
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&member, "member_id = ?", memberID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// FindMemberByCustomerForUpdate — ใช้ตอนคำสั่งซื้อส่งถึงแล้วต้องเติมแต้มให้เจ้าของใบ
func (r *MembershipRepository) FindMemberByCustomerForUpdate(
	tx *gorm.DB, customerID int,
) (*model.Member, error) {
	var member model.Member
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&member, "customer_id = ?", customerID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrMemberNotFound
	}
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *MembershipRepository) CreateMember(tx *gorm.DB, member *model.Member) error {
	return tx.Create(member).Error
}

// SaveMember — เขียนยอดแต้ม ยอดสะสม และระดับกลับลงแถวสมาชิก
// ประวัติแต้มเพิ่มด้วย AddPointTransactions ต่างหาก (แบบเดียวกับพัสดุกับประวัติการติดตาม)
func (r *MembershipRepository) SaveMember(tx *gorm.DB, member *model.Member) error {
	return tx.Model(&model.Member{}).
		Where("member_id = ?", member.MemberID).
		Updates(map[string]any{
			"point_balance":              member.PointBalance,
			"total_accumulated_purchase": member.TotalAccumulatedPurchase,
			"tier_id":                    member.TierID,
		}).Error
}

// attach — เติม customer และ person ให้สมาชิกทั้งชุดด้วยคำสั่งละหนึ่งครั้ง (เลี่ยง N+1)
func (r *MembershipRepository) attach(members []model.Member) ([]MemberRow, error) {
	rows := make([]MemberRow, len(members))
	if len(members) == 0 {
		return rows, nil
	}

	customerIDs := make([]int, len(members))
	for i, member := range members {
		customerIDs[i] = member.CustomerID
	}

	var customers []model.Customer
	if err := r.db.Find(&customers, "customer_id IN ?", customerIDs).Error; err != nil {
		return nil, err
	}
	byCustomer := make(map[int]model.Customer, len(customers))
	personIDs := make([]int, 0, len(customers))
	for _, customer := range customers {
		byCustomer[customer.CustomerID] = customer
		personIDs = append(personIDs, customer.PersonID)
	}

	var persons []model.Person
	if len(personIDs) > 0 {
		if err := r.db.Find(&persons, "person_id IN ?", personIDs).Error; err != nil {
			return nil, err
		}
	}
	byPerson := make(map[int]model.Person, len(persons))
	for _, person := range persons {
		byPerson[person.PersonID] = person
	}

	for i, member := range members {
		customer := byCustomer[member.CustomerID]
		rows[i] = MemberRow{Member: member, Customer: customer, Person: byPerson[customer.PersonID]}
	}
	return rows, nil
}

// ── แต้มสะสม ────────────────────────────────────────────────────────────

func (r *MembershipRepository) AddPointTransactions(tx *gorm.DB, rows []model.PointTransaction) error {
	if len(rows) == 0 {
		return nil
	}
	return tx.Create(&rows).Error
}

// PointTransactions — ประวัติแต้มของสมาชิกหนึ่งราย ใหม่สุดขึ้นก่อน
func (r *MembershipRepository) PointTransactions(memberID int) ([]model.PointTransaction, error) {
	var txns []model.PointTransaction
	err := r.db.Where("member_id = ?", memberID).
		Order("earned_date DESC, point_txn_id DESC").Find(&txns).Error
	return txns, err
}

// ── ของรางวัล ───────────────────────────────────────────────────────────

func (r *MembershipRepository) ListRewards(db *gorm.DB) ([]model.Reward, error) {
	var rewards []model.Reward
	err := db.Order("point_cost, reward_id").Find(&rewards).Error
	return rewards, err
}

func (r *MembershipRepository) FindReward(db *gorm.DB, rewardID int) (*model.Reward, error) {
	var reward model.Reward
	err := db.First(&reward, "reward_id = ?", rewardID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrRewardNotFound
	}
	if err != nil {
		return nil, err
	}
	return &reward, nil
}

func (r *MembershipRepository) CreateReward(db *gorm.DB, reward *model.Reward) error {
	return db.Create(reward).Error
}

func (r *MembershipRepository) SaveReward(db *gorm.DB, reward *model.Reward) error {
	return db.Model(&model.Reward{}).
		Where("reward_id = ?", reward.RewardID).
		Updates(map[string]any{
			"name":           reward.Name,
			"type":           reward.Type,
			"point_cost":     reward.PointCost,
			"discount_value": reward.DiscountValue,
		}).Error
}

func (r *MembershipRepository) RewardRedeemed(db *gorm.DB, rewardID int) (bool, error) {
	var count int64
	err := db.Model(&model.Redemption{}).Where("reward_id = ?", rewardID).Count(&count).Error
	return count > 0, err
}

func (r *MembershipRepository) DeleteReward(db *gorm.DB, rewardID int) error {
	return db.Delete(&model.Reward{}, "reward_id = ?", rewardID).Error
}

// ── การแลกแต้ม ──────────────────────────────────────────────────────────

func (r *MembershipRepository) CreateRedemption(tx *gorm.DB, redemption *model.Redemption) error {
	return tx.Create(redemption).Error
}

// SetCouponCode — เติมรหัสคูปองหลังรู้ redemption_id แล้ว (ดู model.FormatCouponCode)
func (r *MembershipRepository) SetCouponCode(tx *gorm.DB, redemptionID int, code string) error {
	return tx.Model(&model.Redemption{}).
		Where("redemption_id = ?", redemptionID).
		Update("coupon_code", code).Error
}

// RedemptionFilter — MemberID > 0 = เฉพาะการแลกของสมาชิกรายนั้น (ลูกค้าเห็นเฉพาะของตัวเอง)
type RedemptionFilter struct {
	MemberID int
}

func (r *MembershipRepository) ListRedemptions(filter RedemptionFilter) ([]model.Redemption, error) {
	query := r.db.Model(&model.Redemption{}).Order("redemption_id DESC")
	if filter.MemberID > 0 {
		query = query.Where("member_id = ?", filter.MemberID)
	}

	var redemptions []model.Redemption
	err := query.Find(&redemptions).Error
	return redemptions, err
}
