// dto_order.go — รูปร่าง JSON ของคำสั่งซื้อลูกค้าและโปรโมชั่น
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type orderItemDTO struct {
	BookID    int     `json:"bookId"`
	Title     string  `json:"title"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unitPrice"`
	LineTotal float64 `json:"lineTotal"`
}

type orderHistoryDTO struct {
	Status      model.OrderStatus `json:"status"`
	StatusLabel string            `json:"statusLabel"`
	ChangedDate time.Time         `json:"changedDate"`
	ChangedBy   string            `json:"changedBy,omitempty"`
	Note        string            `json:"note,omitempty"`
}

type orderShipmentDTO struct {
	ShipmentID     int                  `json:"shipmentId"`
	TrackingNumber string               `json:"trackingNumber"`
	Carrier        string               `json:"carrier"`
	RecipientName  string               `json:"recipientName"`
	ShippedDate    model.Date           `json:"shippedDate"`
	Status         model.ShipmentStatus `json:"status"`
}

type orderDTO struct {
	OrderID              int                `json:"orderId"`
	Code                 string             `json:"code"`
	CustomerID           int                `json:"customerId"`
	CustomerName         string             `json:"customerName"`
	CustomerPhone        string             `json:"customerPhone,omitempty"`
	CustomerEmail        string             `json:"customerEmail,omitempty"`
	Channel              model.OrderChannel `json:"channel"`
	ChannelLabel         string             `json:"channelLabel"`
	OrderDate            time.Time          `json:"orderDate"`
	ShippingAddress      string             `json:"shippingAddress"`
	Status               model.OrderStatus  `json:"status"`
	StatusLabel          string             `json:"statusLabel"`
	Subtotal             float64            `json:"subtotal"`
	DiscountAmount       float64            `json:"discountAmount"`
	NetAmount            float64            `json:"netAmount"`
	PromotionID          *int               `json:"promotionId,omitempty"`
	PromotionName        string             `json:"promotionName,omitempty"`
	DiscountCode         string             `json:"discountCode,omitempty"`
	SlipFileName         string             `json:"slipFileName,omitempty"`
	ItemCount            int                `json:"itemCount"`
	Closed               bool               `json:"closed"`
	CanCancel            bool               `json:"canCancel"`
	CancelReason         string             `json:"cancelReason,omitempty"`
	RefundBankName       string             `json:"refundBankName,omitempty"`
	RefundAccountNo      string             `json:"refundAccountNo,omitempty"`
	RefundAccountName    string             `json:"refundAccountName,omitempty"`
	RefundStatus         string             `json:"refundStatus,omitempty"`
	RefundStatusLabel    string             `json:"refundStatusLabel,omitempty"`
	RefundNote           string             `json:"refundNote,omitempty"`
	RefundedAt           *time.Time         `json:"refundedAt,omitempty"`
	RefundedBy           string             `json:"refundedBy,omitempty"`
	OutOfStockNote       string             `json:"outOfStockNote,omitempty"`
	RestockEstimate      string             `json:"restockEstimate,omitempty"`
	RestockDate          *model.Date        `json:"restockDate,omitempty"`
	CustomerChoice       string             `json:"customerChoice,omitempty"`
	ReplacementBookID    *int               `json:"replacementBookId,omitempty"`
	ReplacementBookTitle string             `json:"replacementBookTitle,omitempty"`
	ReplacementNote      string             `json:"replacementNote,omitempty"`
	Items                []orderItemDTO     `json:"items"`
	Timeline             []orderHistoryDTO  `json:"timeline"`
	Shipment             *orderShipmentDTO  `json:"shipment,omitempty"`
}

type promotionDTO struct {
	PromotionID     int                   `json:"promotionId"`
	Code            string                `json:"code"`
	Name            string                `json:"name"`
	Type            model.PromotionType   `json:"type"`
	TypeLabel       string                `json:"typeLabel"`
	ConditionDetail string                `json:"conditionDetail"`
	DiscountValue   float64               `json:"discountValue"`
	IsPercent       bool                  `json:"isPercent"`
	MinQty          int                   `json:"minQty"`
	MinAmount       float64               `json:"minAmount"`
	StartDate       model.Date            `json:"startDate"`
	EndDate         model.Date            `json:"endDate"`
	Status          model.PromotionStatus `json:"status"`
	// DisplayStatus คำนวณจากวันสิ้นสุด — โปรโมชั่นที่หมดอายุอ่านเป็น EXPIRED โดยไม่ต้องมีใครไปกดปิด
	DisplayStatus model.PromotionStatus `json:"displayStatus"`
	StatusLabel   string                `json:"statusLabel"`
	// Overlapping — โปรโมชั่นชนิดเดียวกันที่ช่วงวันที่ทับกัน (คำเตือน ไม่ใช่ข้อผิดพลาด)
	Overlapping []int `json:"overlapping"`
}

func toOrderDTO(view service.OrderView) orderDTO {
	order := view.Order

	items := make([]orderItemDTO, len(order.Items))
	for i, item := range order.Items {
		items[i] = orderItemDTO{
			BookID:    item.BookID,
			Title:     view.Books[item.BookID].Title,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
			LineTotal: item.LineTotal,
		}
	}

	timeline := make([]orderHistoryDTO, len(order.Timeline))
	for i, entry := range order.Timeline {
		timeline[i] = orderHistoryDTO{
			Status:      entry.Status,
			StatusLabel: entry.Status.Label(),
			ChangedDate: entry.ChangedDate,
			ChangedBy:   entry.ChangedBy,
			Note:        entry.Note,
		}
	}

	cancelReason := ""
	if order.Status == model.OrderStatusCancelled || order.Status == model.OrderStatusRejected {
		cancelReason = order.CancelReason
		if cancelReason == "" {
			for i := len(order.Timeline) - 1; i >= 0; i-- {
				if order.Timeline[i].Status == model.OrderStatusCancelled || order.Timeline[i].Status == model.OrderStatusRejected {
					cancelReason = order.Timeline[i].Note
					break
				}
			}
		}
	}

	var refundStatusLabel string
	switch order.RefundStatus {
	case model.RefundStatusPending:
		refundStatusLabel = "รอคืนเงิน"
	case model.RefundStatusRefunded:
		refundStatusLabel = "คืนเงินลูกค้าแล้ว"
	}

	statusLabel := order.Status.Label()
	if order.Status == model.OrderStatusCancelled {
		if order.RefundStatus == model.RefundStatusRefunded {
			statusLabel = "คืนเงินแล้ว"
		} else {
			statusLabel = "ยกเลิกและรอคืนเงิน"
		}
	}

	dto := orderDTO{
		OrderID:              order.OrderID,
		CanCancel:            order.CanTransitionTo(model.OrderStatusCancelled),
		Code:                 model.FormatOrderCode(order.OrderID),
		CustomerID:           order.CustomerID,
		CustomerName:         view.CustomerName,
		CustomerPhone:        view.CustomerPhone,
		CustomerEmail:        view.CustomerEmail,
		Channel:              order.Channel,
		ChannelLabel:         order.Channel.Label(),
		OrderDate:            order.OrderDate,
		ShippingAddress:      order.ShippingAddress,
		Status:               order.Status,
		StatusLabel:          statusLabel,
		Subtotal:             order.Subtotal,
		DiscountAmount:       order.DiscountAmount,
		NetAmount:            order.NetAmount,
		PromotionID:          order.PromotionID,
		DiscountCode:         order.DiscountCode,
		SlipFileName:         order.SlipFileName,
		CancelReason:         cancelReason,
		RefundBankName:       order.RefundBankName,
		RefundAccountNo:      order.RefundAccountNo,
		RefundAccountName:    order.RefundAccountName,
		RefundStatus:         order.RefundStatus,
		RefundStatusLabel:    refundStatusLabel,
		RefundNote:           order.RefundNote,
		RefundedAt:           order.RefundedAt,
		RefundedBy:           order.RefundedBy,
		OutOfStockNote:       order.OutOfStockNote,
		RestockEstimate:      order.RestockEstimate,
		RestockDate:          order.RestockDate,
		CustomerChoice:       order.CustomerChoice,
		ReplacementBookID:    order.ReplacementBookID,
		ReplacementBookTitle: view.ReplacementBookTitle,
		ReplacementNote:      order.ReplacementNote,
		ItemCount:            order.ItemCount(),
		Closed:               order.IsClosed(),
		Items:                items,
		Timeline:             timeline,
	}
	if view.Promotion != nil {
		dto.PromotionName = view.Promotion.Name
	}
	if view.Shipment != nil {
		dto.Shipment = &orderShipmentDTO{
			ShipmentID:     view.Shipment.ShipmentID,
			TrackingNumber: view.Shipment.TrackingNumber,
			Carrier:        view.Shipment.Carrier,
			RecipientName:  view.Shipment.RecipientName,
			ShippedDate:    view.Shipment.ShippedDate,
			Status:         view.Shipment.Status,
		}
	}
	return dto
}

func toOrderDTOs(views []service.OrderView) []orderDTO {
	out := make([]orderDTO, len(views))
	for i, view := range views {
		out[i] = toOrderDTO(view)
	}
	return out
}

func toPromotionDTO(view service.PromotionView) promotionDTO {
	promotion := view.Promotion
	overlapping := view.Overlapping
	if overlapping == nil {
		overlapping = []int{}
	}
	return promotionDTO{
		PromotionID:     promotion.PromotionID,
		Code:            model.FormatPromotionCode(promotion.PromotionID),
		Name:            promotion.Name,
		Type:            promotion.Type,
		TypeLabel:       promotion.Type.Label(),
		ConditionDetail: promotion.ConditionDetail,
		DiscountValue:   promotion.DiscountValue,
		IsPercent:       promotion.IsPercent,
		MinQty:          promotion.MinQty,
		MinAmount:       promotion.MinAmount,
		StartDate:       promotion.StartDate,
		EndDate:         promotion.EndDate,
		Status:          promotion.Status,
		DisplayStatus:   view.DisplayStatus,
		StatusLabel:     view.DisplayStatus.Label(),
		Overlapping:     overlapping,
	}
}

func toPromotionDTOs(views []service.PromotionView) []promotionDTO {
	out := make([]promotionDTO, len(views))
	for i, view := range views {
		out[i] = toPromotionDTO(view)
	}
	return out
}

type validateDiscountInput struct {
	Code     string  `json:"code"`
	Subtotal float64 `json:"subtotal"`
}

type discountValidationDTO struct {
	Code           string  `json:"code"`
	RewardName     string  `json:"rewardName"`
	DiscountAmount float64 `json:"discountAmount"`
}
