// membership.go — ระบบสมาชิกและแต้มสะสม
// อ้างอิง class diagram: Sub2-Membership-Loyalty.md
//
//	Member "*" --> "1" MembershipTier : tier
//	Member "1" *-- "*" PointTransaction : points
//	Member "1" *-- "*" Redemption : redeems
//	PointTransaction "*" --> "0..1" Order : from
//	Redemption "*" --> "1" Reward : reward
//	StoreManager "1" --> "*" MembershipTier : defines
package model

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// PointExpiryYears — แต้มที่ได้รับมีอายุกี่ปี (ตรงกับ AddDate(1, 0, 0))
const PointExpiryYears = 1

// MembershipTier — ระดับสมาชิกที่ผู้จัดการร้านเป็นคนกำหนด (`StoreManager.manageMemberTier()`)
//
// PointRate = แต้มที่ได้ต่อยอดซื้อ 1 บาท (0.01 = ซื้อครบ 100 บาทได้ 1 แต้ม)
// เป็นคอลัมน์เดียวในโปรเจกต์ที่เก็บทศนิยม 4 ตำแหน่ง เพราะ numeric(12,2) ปัด 0.015 เป็น 0.02
type MembershipTier struct {
	TierID                 int     `gorm:"column:tier_id;primaryKey;autoIncrement" json:"tierId"`
	Name                   string  `gorm:"column:name;type:varchar(100);not null" json:"name"`
	MinAccumulatedPurchase float64 `gorm:"column:min_accumulated_purchase;type:numeric(12,2);not null" json:"minAccumulatedPurchase"`
	PointRate              float64 `gorm:"column:point_rate;type:numeric(12,4);not null" json:"pointRate"`
	Benefits               string  `gorm:"column:benefits;type:text" json:"benefits"`
}

func (MembershipTier) TableName() string { return "membership_tier" }

// Member — ลูกค้าที่สะสมแต้มได้
//
// class diagram วางไว้เป็น Customer <|-- Member · แมปลงตารางแบบเดียวกับ customer → person
// (class-table inheritance "เพิ่มพ่อ ไม่ย้ายลูก") — CustomerID จึงเป็นทั้ง FK และกุญแจ unique
// ลูกค้าที่สมัครสำเร็จได้แถวนี้ทุกคน ดู PersonService.Register
type Member struct {
	MemberID                 int                `gorm:"column:member_id;primaryKey;autoIncrement" json:"memberId"`
	CustomerID               int                `gorm:"column:customer_id;not null;uniqueIndex" json:"customerId"`
	JoinDate                 Date               `gorm:"column:join_date;type:date;not null" json:"joinDate"`
	PointBalance             int                `gorm:"column:point_balance;not null" json:"pointBalance"`
	TotalAccumulatedPurchase float64            `gorm:"column:total_accumulated_purchase;type:numeric(12,2);not null" json:"totalAccumulatedPurchase"`
	TierID                   int                `gorm:"column:tier_id;not null;index" json:"tierId"`
	PointTxns                []PointTransaction `gorm:"foreignKey:MemberID;references:MemberID;constraint:OnDelete:CASCADE" json:"-"`
	Redemptions              []Redemption       `gorm:"foreignKey:MemberID;references:MemberID;constraint:OnDelete:CASCADE" json:"-"`
}

func (Member) TableName() string { return "member" }

// PointTransaction — แต้มที่เพิ่มหรือลดหนึ่งครั้ง
//
// Points เก็บเครื่องหมายในตัว (EARN บวก · REDEEM/EXPIRE ลบ) เหมือนสมุดบัญชี
// BalanceAfter เก็บยอดหลังรายการนั้น จึงย้อนอ่านประวัติได้โดยไม่ต้องบวกสะสมใหม่ทุกครั้ง
//
// Note ไม่มีใน class diagram — เพิ่มเพราะการหักแต้มของผู้จัดการต้องบอกเหตุผลได้
// (รูปแบบเดียวกับ Note ของ OrderStatusHistory) · บันทึกเป็น deviation ไว้ใน README
type PointTransaction struct {
	PointTxnID   int          `gorm:"column:point_txn_id;primaryKey;autoIncrement" json:"pointTxnId"`
	MemberID     int          `gorm:"column:member_id;not null;index" json:"-"`
	Type         PointTxnType `gorm:"column:type;type:varchar(20);not null" json:"type"`
	Points       int          `gorm:"column:points;not null" json:"points"`
	EarnedDate   time.Time    `gorm:"column:earned_date;type:timestamptz;not null" json:"earnedDate"`
	ExpiryDate   *Date        `gorm:"column:expiry_date;type:date" json:"expiryDate,omitempty"`
	BalanceAfter int          `gorm:"column:balance_after;not null" json:"balanceAfter"`
	OrderID      *int         `gorm:"column:order_id" json:"orderId,omitempty"`
	Note         string       `gorm:"column:note;type:varchar(200)" json:"note,omitempty"`
}

func (PointTransaction) TableName() string { return "point_transaction" }

// Reward — ของรางวัลหรือส่วนลดที่แลกด้วยแต้ม
//
// DiscountValue มีความหมายเฉพาะ RewardTypeDiscount (เป็นจำนวนบาทที่ลดได้)
// ของแถมเก็บเป็น 0 เพราะคิดเป็นตัวเงินไม่ได้
type Reward struct {
	RewardID      int        `gorm:"column:reward_id;primaryKey;autoIncrement" json:"rewardId"`
	Name          string     `gorm:"column:name;type:varchar(200);not null" json:"name"`
	Type          RewardType `gorm:"column:type;type:varchar(20);not null" json:"type"`
	PointCost     int        `gorm:"column:point_cost;not null" json:"pointCost"`
	DiscountValue float64    `gorm:"column:discount_value;type:numeric(12,2);not null" json:"discountValue"`
}

func (Reward) TableName() string { return "reward" }

// Redemption — การแลกแต้มหนึ่งครั้ง
//
// CouponCode ออกจาก redemption_id หลังเขียนแถวแล้ว (ดู FormatCouponCode)
// จึงไม่ซ้ำกันโดยไม่ต้องสุ่มเลข
type Redemption struct {
	RedemptionID int       `gorm:"column:redemption_id;primaryKey;autoIncrement" json:"redemptionId"`
	MemberID     int       `gorm:"column:member_id;not null;index" json:"memberId"`
	RewardID     int       `gorm:"column:reward_id;not null;index" json:"rewardId"`
	PointsUsed   int       `gorm:"column:points_used;not null" json:"pointsUsed"`
	RedeemedDate time.Time `gorm:"column:redeemed_date;type:timestamptz;not null" json:"redeemedDate"`
	CouponCode   string    `gorm:"column:coupon_code;type:varchar(50);not null" json:"couponCode"`
}

func (Redemption) TableName() string { return "redemption" }

// ── กฎที่ตัดสินได้จากเอกสารใบเดียว ──────────────────────────────────────

// CheckPoints — แต้มคงเหลือปัจจุบัน (`+checkPoints() int` ใน class diagram)
func (m Member) CheckPoints() int { return m.PointBalance }

// PointsFor — แต้มที่ได้จากยอดซื้อหนึ่งจำนวน ปัดเศษลงเสมอ
//
// ปัดลงเพราะร้านให้แต้มเป็นจำนวนเต็ม และการปัดขึ้นทำให้ซื้อ 1 บาทก็ได้ 1 แต้ม
func PointsFor(amount, rate float64) int {
	if amount <= 0 || rate <= 0 {
		return 0
	}
	return int(math.Floor(amount * rate))
}

// EarnPoints — สะสมแต้มจากคำสั่งซื้อที่ลูกค้ารับของแล้ว
//
// คิดจากยอดสุทธิหลังหักส่วนลด ไม่ใช่ยอดก่อนลด — ลูกค้าได้แต้มตามเงินที่จ่ายจริง
// ยอดสะสม (totalAccumulatedPurchase) เพิ่มทุกครั้งแม้แต้มจะเป็นศูนย์ เพราะเป็นเกณฑ์เลื่อนระดับ
// คืนจำนวนแต้มที่เพิ่งได้ (0 = ยอดน้อยเกินกว่าจะได้แต้ม ไม่ถือเป็นข้อผิดพลาด)
func (m *Member) EarnPoints(order Order, rate float64, at time.Time) int {
	m.TotalAccumulatedPurchase += order.NetAmount

	points := PointsFor(order.NetAmount, rate)
	if points == 0 {
		return 0
	}

	expiry := NewDate(at.AddDate(PointExpiryYears, 0, 0))
	orderID := order.OrderID

	m.PointBalance += points
	m.PointTxns = append(m.PointTxns, PointTransaction{
		MemberID:     m.MemberID,
		Type:         PointTxnTypeEarn,
		Points:       points,
		EarnedDate:   at.UTC(),
		ExpiryDate:   &expiry,
		BalanceAfter: m.PointBalance,
		OrderID:      &orderID,
		Note:         "สะสมแต้มจาก " + FormatOrderCode(order.OrderID),
	})
	return points
}

// RedeemPoints — แลกแต้มเป็นของรางวัล (`+redeemPoints()` ใน class diagram)
//
// คืน Redemption ที่ยังไม่มี CouponCode — รหัสคูปองออกจาก redemption_id
// ซึ่งรู้ได้หลังเขียนแถวลงฐานข้อมูลแล้วเท่านั้น (ดู MembershipService.Redeem)
func (m *Member) RedeemPoints(reward Reward, at time.Time) (*Redemption, error) {
	if reward.PointCost <= 0 {
		return nil, ErrInvalidPointCost
	}
	if m.PointBalance < reward.PointCost {
		return nil, ErrInsufficientPoints
	}

	m.PointBalance -= reward.PointCost
	m.PointTxns = append(m.PointTxns, PointTransaction{
		MemberID:     m.MemberID,
		Type:         PointTxnTypeRedeem,
		Points:       -reward.PointCost,
		EarnedDate:   at.UTC(),
		BalanceAfter: m.PointBalance,
		Note:         "แลก " + reward.Name,
	})

	redemption := Redemption{
		MemberID:     m.MemberID,
		RewardID:     reward.RewardID,
		PointsUsed:   reward.PointCost,
		RedeemedDate: at.UTC(),
	}
	m.Redemptions = append(m.Redemptions, redemption)
	return &redemption, nil
}

// Adjust — ผู้จัดการหักแต้มที่หมดอายุหรือคืนรายการที่ผิดพลาด
//
// รับเฉพาะ EXPIRE กับ REVERSAL · EARN มาจากคำสั่งซื้อเท่านั้น และ REDEEM มาจากการแลก
// เปิดให้เพิ่มแต้มมือเปล่าไม่ได้ ไม่งั้นยอดสะสมกับประวัติคำสั่งซื้อจะเล่าคนละเรื่อง
func (m *Member) Adjust(kind PointTxnType, points int, note string, at time.Time) error {
	if kind != PointTxnTypeExpire && kind != PointTxnTypeReversal {
		return ErrInvalidPointTxnType
	}
	if points <= 0 {
		return ErrPointsMustBePositive
	}
	if points > m.PointBalance {
		return ErrInsufficientPoints
	}

	m.PointBalance -= points
	m.PointTxns = append(m.PointTxns, PointTransaction{
		MemberID:     m.MemberID,
		Type:         kind,
		Points:       -points,
		EarnedDate:   at.UTC(),
		BalanceAfter: m.PointBalance,
		Note:         strings.TrimSpace(note),
	})
	return nil
}

// PickTier — ระดับสูงสุดที่ยอดสะสมถึงเกณฑ์
//
// ลิสต์ไม่ต้องเรียงมาก่อน · ถ้ายอดยังไม่ถึงระดับไหนเลยจะได้ระดับที่เกณฑ์ต่ำที่สุด
// (สมาชิกใหม่ยอด 0 ต้องมีระดับเสมอ เพราะ member.tier_id เป็น NOT NULL)
func PickTier(tiers []MembershipTier, total float64) *MembershipTier {
	var picked, lowest *MembershipTier
	for i := range tiers {
		tier := &tiers[i]
		if lowest == nil || tier.MinAccumulatedPurchase < lowest.MinAccumulatedPurchase {
			lowest = tier
		}
		if total < tier.MinAccumulatedPurchase {
			continue
		}
		if picked == nil || tier.MinAccumulatedPurchase > picked.MinAccumulatedPurchase {
			picked = tier
		}
	}
	if picked != nil {
		return picked
	}
	return lowest
}

// FormatMemberCode / FormatCouponCode — รหัสที่หน้าจอแสดง (MBR0001 · RWD00007)
func FormatMemberCode(memberID int) string { return fmt.Sprintf("MBR%04d", memberID) }

func FormatCouponCode(redemptionID int) string { return fmt.Sprintf("RWD%05d", redemptionID) }
