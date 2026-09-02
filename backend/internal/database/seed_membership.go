// seed_membership.go — ข้อมูลตั้งต้นของระบบสมาชิกและแต้มสะสม (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// frontend ไม่มีหน้าจอของระบบย่อยนี้ จึงไม่มี SEED_* ให้ gen_seed.py อ่าน
// ค่าทั้งหมดตั้งขึ้นเองให้พอสาธิตได้ครบทุกเส้นทาง (เลื่อนระดับ · แลกของรางวัล · หักแต้ม)
//
// ยอดสะสมของสมาชิกตั้งต้น **ไม่ได้คำนวณจากคำสั่งซื้อตั้งต้น** — คำสั่งซื้อสามใบนั้นถูกเขียนลง
// ฐานข้อมูลตรง ๆ ไม่ได้เดินผ่าน OrderService.Deliver ซึ่งเป็นที่เดียวที่แต้มเกิด
// ตัวเลขที่นี่จึงเป็น "ยอดยกมา" ของลูกค้าเก่า ไม่ใช่ผลรวมของใบที่เห็นในระบบ
package database

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// seedTiers — ระดับสมาชิกสามระดับ · PointRate = แต้มต่อยอดซื้อ 1 บาท
//
// 0.01 = ซื้อครบ 100 บาทได้ 1 แต้ม · ระดับสูงขึ้นได้แต้มเร็วขึ้น
// migrate ใส่ชุดนี้ให้เองถ้าตารางยังว่าง (backfillTiers) เพราะ member.tier_id ต้องมีปลายทาง
var seedTiers = []model.MembershipTier{
	{TierID: 1, Name: "Silver", MinAccumulatedPurchase: 0, PointRate: 0.01,
		Benefits: "สะสมแต้มทุกยอดซื้อ · แลกคูปองส่วนลดได้"},
	{TierID: 2, Name: "Gold", MinAccumulatedPurchase: 5000, PointRate: 0.015,
		Benefits: "ได้แต้มเพิ่ม 50% · แจ้งหนังสือออกใหม่ก่อนใคร"},
	{TierID: 3, Name: "Platinum", MinAccumulatedPurchase: 20000, PointRate: 0.02,
		Benefits: "ได้แต้มเพิ่มเท่าตัว · ส่งฟรีทุกคำสั่งซื้อ"},
}

// seedRewards — ของรางวัลที่แลกด้วยแต้ม ครอบทั้งสองชนิดของ RewardType
//
// ใบที่ถูกที่สุดตั้งไว้ 5 แต้มโดยตั้งใจ ให้ลูกค้าที่เพิ่งซื้อครั้งเดียวแลกได้จริง
// (cmd/smoke พึ่งข้อนี้ — คำสั่งซื้อหนึ่งใบให้แต้มหลักหน่วยเท่านั้น)
var seedRewards = []model.Reward{
	{RewardID: 1, Name: "คูปองส่วนลด 20 บาท", Type: model.RewardTypeDiscount,
		PointCost: 5, DiscountValue: 20},
	{RewardID: 2, Name: "ที่คั่นหนังสือ BookHaven", Type: model.RewardTypeGift,
		PointCost: 8, DiscountValue: 0},
	{RewardID: 3, Name: "คูปองส่วนลด 50 บาท", Type: model.RewardTypeDiscount,
		PointCost: 12, DiscountValue: 50},
	{RewardID: 4, Name: "คูปองส่วนลด 100 บาท", Type: model.RewardTypeDiscount,
		PointCost: 20, DiscountValue: 100},
	{RewardID: 5, Name: "ถุงผ้า BookHaven", Type: model.RewardTypeGift,
		PointCost: 30, DiscountValue: 0},
}

// seedMemberRow — สมาชิกหนึ่งรายที่ผูกกับลูกค้าตั้งต้นด้วยอีเมล
// (รหัสลูกค้าเป็น auto increment จึงฝังตัวเลขไว้ล่วงหน้าไม่ได้ — เหมือน seed_order.go)
type seedMemberRow struct {
	CustomerEmail string
	JoinDate      string // "YYYY-MM-DD"
	PointBalance  int
	TotalPurchase float64
}

// seedMembers — ลูกค้าตั้งต้นทั้งสามรายเป็นสมาชิก คนละระดับกัน
// ระดับไม่ได้ระบุตรง ๆ แต่ให้ PickTier เลือกจากยอดสะสม เพื่อไม่ให้ข้อมูลขัดกับเกณฑ์ของระดับ
var seedMembers = []seedMemberRow{
	{CustomerEmail: "napat@example.com", JoinDate: "2026-05-20", PointBalance: 68, TotalPurchase: 6820},
	{CustomerEmail: "kanya@example.com", JoinDate: "2026-06-15", PointBalance: 0, TotalPurchase: 0},
	{CustomerEmail: "somsak@example.com", JoinDate: "2026-07-02", PointBalance: 145, TotalPurchase: 21400},
}

// seedMemberRows — เปิดสมาชิกให้ลูกค้าตั้งต้น
//
// ใช้ seedIfEmpty[T] ตรง ๆ ไม่ได้เพราะต้องหา customer_id จากอีเมลก่อน และต้องเลือกระดับ
// จากยอดสะสมของแต่ละราย · backfillMembers() ใน migrate.go ดูแลเส้นทางฐานที่มีลูกค้าอยู่ก่อนแล้ว
func seedMemberRows(tx *gorm.DB) (int, error) {
	empty, err := tableEmpty[model.Member](tx, "สมาชิก")
	if err != nil || !empty {
		return 0, err
	}

	tiers, err := listTiers(tx)
	if err != nil {
		return 0, err
	}

	for _, row := range seedMembers {
		customerID, err := customerIDByEmail(tx, row.CustomerEmail)
		if err != nil {
			return 0, err
		}
		tier := model.PickTier(tiers, row.TotalPurchase)
		if tier == nil {
			return 0, fmt.Errorf("ยังไม่มีระดับสมาชิกให้ %s", row.CustomerEmail)
		}

		member := model.Member{
			CustomerID:               customerID,
			JoinDate:                 mustDate(row.JoinDate),
			PointBalance:             row.PointBalance,
			TotalAccumulatedPurchase: row.TotalPurchase,
			TierID:                   tier.TierID,
		}
		if err := tx.Create(&member).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลสมาชิกของ %s ไม่สำเร็จ: %w", row.CustomerEmail, err)
		}
	}
	return len(seedMembers), nil
}

// listTiers — ระดับสมาชิกทั้งหมดที่มีอยู่จริงในฐานข้อมูล
// (ไม่อ่านจาก seedTiers ตรง ๆ เพราะผู้จัดการอาจแก้เกณฑ์ไปแล้ว)
func listTiers(tx *gorm.DB) ([]model.MembershipTier, error) {
	var tiers []model.MembershipTier
	if err := tx.Order("min_accumulated_purchase").Find(&tiers).Error; err != nil {
		return nil, fmt.Errorf("อ่านระดับสมาชิกไม่สำเร็จ: %w", err)
	}
	return tiers, nil
}
