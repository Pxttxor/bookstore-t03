// dto_membership.go — รูปร่าง JSON ของระดับสมาชิก สมาชิก แต้ม ของรางวัล และการแลก
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type memberDTO struct {
	MemberID                 int        `json:"memberId"`
	Code                     string     `json:"code"`
	CustomerID               int        `json:"customerId"`
	CustomerName             string     `json:"customerName"`
	JoinDate                 model.Date `json:"joinDate"`
	PointBalance             int        `json:"pointBalance"`
	TotalAccumulatedPurchase float64    `json:"totalAccumulatedPurchase"`
	TierID                   int        `json:"tierId"`
	TierName                 string     `json:"tierName"`
	PointRate                float64    `json:"pointRate"`
	Benefits                 string     `json:"benefits,omitempty"`
}

type pointTransactionDTO struct {
	PointTxnID   int                `json:"pointTxnId"`
	Type         model.PointTxnType `json:"type"`
	TypeLabel    string             `json:"typeLabel"`
	Points       int                `json:"points"`
	EarnedDate   time.Time          `json:"earnedDate"`
	ExpiryDate   *model.Date        `json:"expiryDate,omitempty"`
	BalanceAfter int                `json:"balanceAfter"`
	OrderID      *int               `json:"orderId,omitempty"`
	OrderCode    string             `json:"orderCode,omitempty"`
	Note         string             `json:"note,omitempty"`
}

type rewardDTO struct {
	RewardID      int              `json:"rewardId"`
	Name          string           `json:"name"`
	Type          model.RewardType `json:"type"`
	TypeLabel     string           `json:"typeLabel"`
	PointCost     int              `json:"pointCost"`
	DiscountValue float64          `json:"discountValue"`
}

type redemptionDTO struct {
	RedemptionID int              `json:"redemptionId"`
	MemberID     int              `json:"memberId"`
	RewardID     int              `json:"rewardId"`
	RewardName   string           `json:"rewardName"`
	RewardType   model.RewardType `json:"rewardType"`
	PointsUsed   int              `json:"pointsUsed"`
	RedeemedDate time.Time        `json:"redeemedDate"`
	CouponCode   string           `json:"couponCode"`
}

func toMemberDTO(view service.MemberView) memberDTO {
	member := view.Member
	return memberDTO{
		MemberID:                 member.MemberID,
		Code:                     model.FormatMemberCode(member.MemberID),
		CustomerID:               member.CustomerID,
		CustomerName:             view.CustomerName,
		JoinDate:                 member.JoinDate,
		PointBalance:             member.PointBalance,
		TotalAccumulatedPurchase: member.TotalAccumulatedPurchase,
		TierID:                   member.TierID,
		TierName:                 view.Tier.Name,
		PointRate:                view.Tier.PointRate,
		Benefits:                 view.Tier.Benefits,
	}
}

func toMemberDTOs(views []service.MemberView) []memberDTO {
	out := make([]memberDTO, len(views))
	for i, view := range views {
		out[i] = toMemberDTO(view)
	}
	return out
}

func toPointTransactionDTO(txn model.PointTransaction) pointTransactionDTO {
	dto := pointTransactionDTO{
		PointTxnID:   txn.PointTxnID,
		Type:         txn.Type,
		TypeLabel:    txn.Type.Label(),
		Points:       txn.Points,
		EarnedDate:   txn.EarnedDate,
		ExpiryDate:   txn.ExpiryDate,
		BalanceAfter: txn.BalanceAfter,
		OrderID:      txn.OrderID,
		Note:         txn.Note,
	}
	if txn.OrderID != nil {
		dto.OrderCode = model.FormatOrderCode(*txn.OrderID)
	}
	return dto
}

func toPointTransactionDTOs(txns []model.PointTransaction) []pointTransactionDTO {
	out := make([]pointTransactionDTO, len(txns))
	for i, txn := range txns {
		out[i] = toPointTransactionDTO(txn)
	}
	return out
}

func toRewardDTO(reward model.Reward) rewardDTO {
	return rewardDTO{
		RewardID:      reward.RewardID,
		Name:          reward.Name,
		Type:          reward.Type,
		TypeLabel:     reward.Type.Label(),
		PointCost:     reward.PointCost,
		DiscountValue: reward.DiscountValue,
	}
}

func toRewardDTOs(rewards []model.Reward) []rewardDTO {
	out := make([]rewardDTO, len(rewards))
	for i, reward := range rewards {
		out[i] = toRewardDTO(reward)
	}
	return out
}

func toRedemptionDTO(view service.RedemptionView) redemptionDTO {
	redemption := view.Redemption
	return redemptionDTO{
		RedemptionID: redemption.RedemptionID,
		MemberID:     redemption.MemberID,
		RewardID:     redemption.RewardID,
		RewardName:   view.RewardName,
		RewardType:   view.RewardType,
		PointsUsed:   redemption.PointsUsed,
		RedeemedDate: redemption.RedeemedDate,
		CouponCode:   redemption.CouponCode,
	}
}

func toRedemptionDTOs(views []service.RedemptionView) []redemptionDTO {
	out := make([]redemptionDTO, len(views))
	for i, view := range views {
		out[i] = toRedemptionDTO(view)
	}
	return out
}
