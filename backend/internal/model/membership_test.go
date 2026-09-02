package model

import (
	"testing"
	"time"
)

var pointAt = time.Date(2026, 8, 30, 7, 0, 0, 0, time.UTC)

// ระดับตัวอย่างจงใจใส่สลับลำดับ เพื่อพิสูจน์ว่า PickTier ไม่ได้พึ่งลำดับในลิสต์
func sampleTiers() []MembershipTier {
	return []MembershipTier{
		{TierID: 2, Name: "Gold", MinAccumulatedPurchase: 5000, PointRate: 0.015},
		{TierID: 1, Name: "Silver", MinAccumulatedPurchase: 0, PointRate: 0.01},
		{TierID: 3, Name: "Platinum", MinAccumulatedPurchase: 20000, PointRate: 0.02},
	}
}

func sampleMember() Member {
	return Member{
		MemberID: 1, CustomerID: 1, JoinDate: NewDate(pointAt),
		PointBalance: 0, TierID: 1,
	}
}

func TestEarnPointsRoundsDown(t *testing.T) {
	member := sampleMember()
	order := Order{OrderID: 1001, NetAmount: 1290}

	// 1290 * 0.01 = 12.9 → 12 แต้ม
	got := member.EarnPoints(order, 0.01, pointAt)
	if got != 12 {
		t.Errorf("แต้มที่ได้ = %d ต้องการ 12 (ปัดเศษลง)", got)
	}
	if member.CheckPoints() != 12 {
		t.Errorf("แต้มคงเหลือ = %d ต้องการ 12", member.CheckPoints())
	}
	if member.TotalAccumulatedPurchase != 1290 {
		t.Errorf("ยอดสะสม = %.2f ต้องการ 1290", member.TotalAccumulatedPurchase)
	}

	if len(member.PointTxns) != 1 {
		t.Fatalf("ประวัติแต้ม = %d แถว ต้องการ 1", len(member.PointTxns))
	}
	txn := member.PointTxns[0]
	if txn.Type != PointTxnTypeEarn || txn.Points != 12 || txn.BalanceAfter != 12 {
		t.Errorf("รายการ = %+v ต้องการ EARN +12 คงเหลือ 12", txn)
	}
	if txn.OrderID == nil || *txn.OrderID != 1001 {
		t.Error("รายการ EARN ต้องผูกกับคำสั่งซื้อที่เป็นที่มาของแต้ม")
	}
	if txn.ExpiryDate == nil || txn.ExpiryDate.Year() != pointAt.Year()+PointExpiryYears {
		t.Errorf("วันหมดอายุ = %v ต้องการ +%d ปี", txn.ExpiryDate, PointExpiryYears)
	}
}

// ยอดที่น้อยเกินกว่าจะได้แต้มต้องยังนับเข้ายอดสะสม ไม่งั้นเลื่อนระดับไม่ตรงความจริง
func TestEarnPointsBelowOnePointStillAccumulates(t *testing.T) {
	member := sampleMember()

	got := member.EarnPoints(Order{OrderID: 1002, NetAmount: 80}, 0.01, pointAt)
	if got != 0 {
		t.Errorf("แต้มที่ได้ = %d ต้องการ 0", got)
	}
	if member.TotalAccumulatedPurchase != 80 {
		t.Errorf("ยอดสะสม = %.2f ต้องการ 80", member.TotalAccumulatedPurchase)
	}
	if len(member.PointTxns) != 0 {
		t.Errorf("ประวัติแต้ม = %d แถว ต้องการ 0 (ไม่บันทึกรายการแต้มศูนย์)", len(member.PointTxns))
	}
}

func TestRedeemPoints(t *testing.T) {
	member := sampleMember()
	member.PointBalance = 30
	reward := Reward{RewardID: 7, Name: "คูปองส่วนลด 20 บาท",
		Type: RewardTypeDiscount, PointCost: 5, DiscountValue: 20}

	redemption, err := member.RedeemPoints(reward, pointAt)
	if err != nil {
		t.Fatalf("แลกของรางวัลไม่สำเร็จ: %v", err)
	}
	if member.CheckPoints() != 25 {
		t.Errorf("แต้มคงเหลือ = %d ต้องการ 25", member.CheckPoints())
	}
	if redemption.PointsUsed != 5 || redemption.RewardID != 7 {
		t.Errorf("การแลก = %+v ต้องการใช้ 5 แต้มกับของรางวัล 7", *redemption)
	}

	txn := member.PointTxns[len(member.PointTxns)-1]
	if txn.Type != PointTxnTypeRedeem || txn.Points != -5 || txn.BalanceAfter != 25 {
		t.Errorf("รายการ = %+v ต้องการ REDEEM -5 คงเหลือ 25", txn)
	}
	if txn.ExpiryDate != nil {
		t.Error("รายการที่ใช้แต้มไม่ควรมีวันหมดอายุ")
	}
}

func TestRedeemPointsRejectsInsufficientBalance(t *testing.T) {
	member := sampleMember()
	member.PointBalance = 4
	reward := Reward{RewardID: 7, Name: "คูปองส่วนลด 20 บาท", Type: RewardTypeDiscount, PointCost: 5}

	if _, err := member.RedeemPoints(reward, pointAt); err != ErrInsufficientPoints {
		t.Errorf("error = %v ต้องการ ErrInsufficientPoints", err)
	}
	if member.CheckPoints() != 4 {
		t.Errorf("แต้มคงเหลือ = %d ต้องไม่ถูกแตะเมื่อแลกไม่สำเร็จ", member.CheckPoints())
	}
	if len(member.PointTxns) != 0 || len(member.Redemptions) != 0 {
		t.Error("แลกไม่สำเร็จต้องไม่บันทึกประวัติใด ๆ")
	}
}

func TestAdjustOnlyAcceptsExpireAndReversal(t *testing.T) {
	cases := []struct {
		kind PointTxnType
		ok   bool
	}{
		{PointTxnTypeExpire, true},
		{PointTxnTypeReversal, true},
		{PointTxnTypeEarn, false},
		{PointTxnTypeRedeem, false},
	}

	for _, tc := range cases {
		member := sampleMember()
		member.PointBalance = 50

		err := member.Adjust(tc.kind, 10, "ปรับโดยผู้จัดการ", pointAt)
		if tc.ok && err != nil {
			t.Errorf("%s ต้องปรับได้ แต่ได้ error %v", tc.kind, err)
		}
		if !tc.ok && err != ErrInvalidPointTxnType {
			t.Errorf("%s ต้องถูกปฏิเสธด้วย ErrInvalidPointTxnType แต่ได้ %v", tc.kind, err)
		}
	}
}

func TestAdjustCannotDriveBalanceNegative(t *testing.T) {
	member := sampleMember()
	member.PointBalance = 8

	if err := member.Adjust(PointTxnTypeExpire, 9, "หมดอายุ", pointAt); err != ErrInsufficientPoints {
		t.Errorf("error = %v ต้องการ ErrInsufficientPoints", err)
	}
	if err := member.Adjust(PointTxnTypeExpire, 0, "หมดอายุ", pointAt); err != ErrPointsMustBePositive {
		t.Errorf("error = %v ต้องการ ErrPointsMustBePositive", err)
	}
	if member.CheckPoints() != 8 {
		t.Errorf("แต้มคงเหลือ = %d ต้องไม่ถูกแตะเมื่อปรับไม่สำเร็จ", member.CheckPoints())
	}

	if err := member.Adjust(PointTxnTypeExpire, 8, "หมดอายุ", pointAt); err != nil {
		t.Fatalf("หักเท่ายอดคงเหลือพอดีต้องทำได้: %v", err)
	}
	if member.CheckPoints() != 0 {
		t.Errorf("แต้มคงเหลือ = %d ต้องการ 0", member.CheckPoints())
	}
}

func TestPickTier(t *testing.T) {
	tiers := sampleTiers()

	cases := []struct {
		total float64
		want  string
	}{
		{0, "Silver"},
		{4999.99, "Silver"},
		{5000, "Gold"},
		{19999, "Gold"},
		{20000, "Platinum"},
		{999999, "Platinum"},
	}

	for _, tc := range cases {
		tier := PickTier(tiers, tc.total)
		if tier == nil {
			t.Fatalf("ยอดสะสม %.2f ต้องได้ระดับเสมอ", tc.total)
		}
		if tier.Name != tc.want {
			t.Errorf("ยอดสะสม %.2f → %s ต้องการ %s", tc.total, tier.Name, tc.want)
		}
	}
}

// สมาชิกใหม่ต้องมีระดับเสมอ แม้ทุกระดับจะตั้งเกณฑ์ขั้นต่ำไว้สูงกว่ายอดของเขา
func TestPickTierFallsBackToLowest(t *testing.T) {
	tiers := []MembershipTier{
		{TierID: 2, Name: "Gold", MinAccumulatedPurchase: 5000},
		{TierID: 3, Name: "Platinum", MinAccumulatedPurchase: 20000},
	}

	tier := PickTier(tiers, 0)
	if tier == nil || tier.Name != "Gold" {
		t.Errorf("ได้ %v ต้องการระดับที่เกณฑ์ต่ำสุด (Gold)", tier)
	}
	if PickTier(nil, 0) != nil {
		t.Error("ไม่มีระดับให้เลือกเลยต้องได้ nil")
	}
}

func TestMembershipLabelsCoverEveryValue(t *testing.T) {
	for _, kind := range PointTxnTypes() {
		if !kind.IsValid() {
			t.Errorf("%s ต้องเป็นค่าที่ถูกต้อง", kind)
		}
		if PointTxnTypeLabels[kind] == "" {
			t.Errorf("%s ยังไม่มีป้ายไทย", kind)
		}
	}
	for _, kind := range RewardTypes() {
		if !kind.IsValid() {
			t.Errorf("%s ต้องเป็นค่าที่ถูกต้อง", kind)
		}
		if RewardTypeLabels[kind] == "" {
			t.Errorf("%s ยังไม่มีป้ายไทย", kind)
		}
	}
	if PointTxnType("NOPE").IsValid() || RewardType("NOPE").IsValid() {
		t.Error("ค่านอกชุดต้องไม่ผ่าน IsValid")
	}
}

func TestMembershipCodes(t *testing.T) {
	if got := FormatMemberCode(7); got != "MBR0007" {
		t.Errorf("รหัสสมาชิก = %s ต้องการ MBR0007", got)
	}
	if got := FormatCouponCode(42); got != "RWD00042" {
		t.Errorf("รหัสคูปอง = %s ต้องการ RWD00042", got)
	}
}
