package handler

import (
	"bookstore-t03/internal/model"
	"bookstore-t03/internal/service"
	"testing"
)

func TestOrderDTOCancellationMatchesStateMachine(t *testing.T) {
	for _, status := range []model.OrderStatus{
		model.OrderStatusPendingConfirm, model.OrderStatusStockConfirmed,
		model.OrderStatusWaitingPayment, model.OrderStatusVerifyingPayment,
		model.OrderStatusPaid, model.OrderStatusPacking, model.OrderStatusReadyToShip,
		model.OrderStatusShipped, model.OrderStatusDelivered,
		model.OrderStatusCancelled, model.OrderStatusRejected,
	} {
		t.Run(string(status), func(t *testing.T) {
			order := model.Order{Status: status}
			dto := toOrderDTO(service.OrderView{Order: order})
			if dto.CanCancel != order.CanTransitionTo(model.OrderStatusCancelled) {
				t.Fatalf("incorrect cancellation affordance for %s", status)
			}
		})
	}
}

func TestOrderDTOCustomerEmail(t *testing.T) {
	view := service.OrderView{
		Order:         model.Order{OrderID: 1, CustomerID: 10},
		CustomerName:  "สมชาย ทดสอบ",
		CustomerEmail: "somchai@example.com",
	}
	dto := toOrderDTO(view)
	if dto.CustomerEmail != "somchai@example.com" {
		t.Fatalf("expected customerEmail to be somchai@example.com, got %q", dto.CustomerEmail)
	}
}

func TestOrderDTOCustomerName(t *testing.T) {
	view := service.OrderView{
		Order:        model.Order{OrderID: 1, CustomerID: 10, CustomerName: "riw2222"},
		CustomerName: "riw2222",
	}
	dto := toOrderDTO(view)
	if dto.CustomerName != "riw2222" {
		t.Fatalf("expected customerName to be riw2222, got %q", dto.CustomerName)
	}
}

func TestOrderDTOShipment(t *testing.T) {
	view := service.OrderView{
		Order: model.Order{OrderID: 1039, CustomerID: 6},
		Shipment: &service.OrderShipmentInfo{
			ShipmentID:     13,
			TrackingNumber: "TH1234",
			Carrier:        "ไปรษณีย์ไทย",
			RecipientName:  "duang fff",
			Status:         model.ShipmentStatusDelivered,
		},
	}
	dto := toOrderDTO(view)
	if dto.Shipment == nil {
		t.Fatalf("expected dto.Shipment not to be nil")
	}
	if dto.Shipment.TrackingNumber != "TH1234" {
		t.Errorf("expected trackingNumber TH1234, got %q", dto.Shipment.TrackingNumber)
	}
	if dto.Shipment.Carrier != "ไปรษณีย์ไทย" {
		t.Errorf("expected carrier ไปรษณีย์ไทย, got %q", dto.Shipment.Carrier)
	}
}
