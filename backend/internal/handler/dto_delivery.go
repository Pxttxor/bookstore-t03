// dto_delivery.go — รูปร่าง JSON ของพัสดุ ประวัติการติดตาม และสรุปบัญชีพัสดุ
package handler

import (
	"time"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
)

type shipmentTrackingDTO struct {
	TrackingID  int                  `json:"trackingId"`
	Status      model.ShipmentStatus `json:"status"`
	StatusLabel string               `json:"statusLabel"`
	Location    string               `json:"location,omitempty"`
	UpdateDate  time.Time            `json:"updateDate"`
	Note        string               `json:"note,omitempty"`
}

type shipmentDTO struct {
	ShipmentID     int                   `json:"shipmentId"`
	Code           string                `json:"code"`
	OrderID        int                   `json:"orderId"`
	OrderCode      string                `json:"orderCode"`
	CarrierID      int                   `json:"carrierId"`
	CarrierName    string                `json:"carrierName"`
	TrackingNumber string                `json:"trackingNumber"`
	TrackingURL    string                `json:"trackingUrl,omitempty"`
	RecipientName  string                `json:"recipientName"`
	ShippedDate    model.Date            `json:"shippedDate"`
	Status         model.ShipmentStatus  `json:"status"`
	StatusLabel    string                `json:"statusLabel"`
	Closed         bool                  `json:"closed"`
	Tracking       []shipmentTrackingDTO `json:"tracking"`
}

type deliverySummaryDTO struct {
	SummaryID      int        `json:"summaryId"`
	Code           string     `json:"code"`
	SummaryDate    model.Date `json:"summaryDate"`
	TotalParcels   int        `json:"totalParcels"`
	TotalByCarrier string     `json:"totalByCarrier"`
	GeneratedBy    string     `json:"generatedBy"`
}

func toShipmentDTO(view service.ShipmentView) shipmentDTO {
	shipment := view.Shipment

	tracking := make([]shipmentTrackingDTO, len(shipment.Tracking))
	for i, step := range shipment.Tracking {
		tracking[i] = shipmentTrackingDTO{
			TrackingID:  step.TrackingID,
			Status:      step.Status,
			StatusLabel: step.Status.Label(),
			Location:    step.Location,
			UpdateDate:  step.UpdateDate,
			Note:        step.Note,
		}
	}

	return shipmentDTO{
		ShipmentID:     shipment.ShipmentID,
		Code:           model.FormatShipmentCode(shipment.ShipmentID),
		OrderID:        shipment.OrderID,
		OrderCode:      model.FormatOrderCode(shipment.OrderID),
		CarrierID:      shipment.CarrierID,
		CarrierName:    view.CarrierName,
		TrackingNumber: shipment.TrackingNumber,
		TrackingURL:    view.TrackingURL,
		RecipientName:  shipment.RecipientName,
		ShippedDate:    shipment.ShippedDate,
		Status:         shipment.Status,
		StatusLabel:    shipment.Status.Label(),
		Closed:         shipment.IsClosed(),
		Tracking:       tracking,
	}
}

func toShipmentDTOs(views []service.ShipmentView) []shipmentDTO {
	out := make([]shipmentDTO, len(views))
	for i, view := range views {
		out[i] = toShipmentDTO(view)
	}
	return out
}

func toDeliverySummaryDTO(summary model.DeliverySummary) deliverySummaryDTO {
	return deliverySummaryDTO{
		SummaryID:      summary.SummaryID,
		Code:           model.FormatSummaryCode(summary.SummaryID),
		SummaryDate:    summary.SummaryDate,
		TotalParcels:   summary.TotalParcels,
		TotalByCarrier: summary.TotalByCarrier,
		GeneratedBy:    summary.GeneratedBy,
	}
}

func toDeliverySummaryDTOs(summaries []model.DeliverySummary) []deliverySummaryDTO {
	out := make([]deliverySummaryDTO, len(summaries))
	for i, summary := range summaries {
		out[i] = toDeliverySummaryDTO(summary)
	}
	return out
}
