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
