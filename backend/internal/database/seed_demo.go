package database

import (
	"fmt"
	"time"

	"bookstore-t03/internal/model"
	"gorm.io/gorm"
)

const demoActor = "ระบบ (ข้อมูลสาธิต)"

// Migrate may already have inserted these reference tables. Any business data
// disables the extra demo, including a partially populated database. Never use
// an empty child table as permission to adjust somebody's stock or points.
func demoDatabaseEmpty(tx *gorm.DB) (bool, error) {
	for _, entity := range entities {
		switch entity.(type) {
		case *model.Category, *model.ShippingCompany, *model.MembershipTier:
			continue
		}
		var count int64
		if err := tx.Model(entity).Count(&count).Error; err != nil {
			return false, err
		}
		if count != 0 {
			return false, nil
		}
	}
	return true, nil
}

// Only called for a fresh database, inside Seed's transaction. Dates are
// relative to first setup so recent-activity screens have useful examples.
func seedDemoRows(tx *gorm.DB, now time.Time) error {
	start := model.NewDate(now).Time.AddDate(0, 0, -14)
	if err := seedDemoOpeningStock(tx); err != nil {
		return err
	}
	if err := seedDemoOrders(tx, start); err != nil {
		return err
	}
	if err := seedDemoMembership(tx, now); err != nil {
		return err
	}
	if err := seedDemoWarehouse(tx, now.AddDate(0, 0, -2)); err != nil {
		return err
	}
	return seedDemoReports(tx, now)
}

// The original fixture is an imported inventory snapshot, not a full ledger.
// Record its missing opening balances; do not silently alter stock quantities.
func seedDemoOpeningStock(tx *gorm.DB) error {
	var items []model.InventoryItem
	if err := tx.Order("book_id").Find(&items).Error; err != nil {
		return err
	}
	for _, item := range items {
		var total int
		if err := tx.Model(&model.StockTransaction{}).Where("book_id = ?", item.BookID).
			Select("COALESCE(SUM(quantity_change), 0)").Scan(&total).Error; err != nil {
			return err
		}
		if delta := item.QuantityOnHand - total; delta != 0 {
			row := model.StockTransaction{BookID: item.BookID, Type: model.StockTxnTypeAdjustment,
				QuantityChange: delta, Reason: "ยอดยกมาตัวอย่างก่อนเริ่มประวัติในระบบ",
				ReferenceDoc: "DEMO-OPENING", TxnDate: mustTime("2026-07-01T00:00:00Z")}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func demoOrderPath(target model.OrderStatus) []model.OrderStatus {
	path := []model.OrderStatus{model.OrderStatusPendingConfirm, model.OrderStatusStockConfirmed,
		model.OrderStatusWaitingPayment, model.OrderStatusVerifyingPayment, model.OrderStatusPaid,
		model.OrderStatusPacking, model.OrderStatusReadyToShip, model.OrderStatusShipped, model.OrderStatusDelivered}
	if target == model.OrderStatusCancelled {
		return append(path[:3:3], target)
	}
	if target == model.OrderStatusRejected {
		return append(path[:4:4], target)
	}
	if target == model.OrderStatusOutOfStock {
		return []model.OrderStatus{model.OrderStatusPendingConfirm, model.OrderStatusOutOfStock}
	}
	if target == model.OrderStatusWaitingRestock {
		return []model.OrderStatus{model.OrderStatusPendingConfirm, model.OrderStatusOutOfStock, model.OrderStatusWaitingRestock}
	}
	if target == model.OrderStatusExchange {
		return []model.OrderStatus{model.OrderStatusPendingConfirm, model.OrderStatusOutOfStock, model.OrderStatusExchange}
	}
	for i, status := range path {
		if target == status {
			return path[:i+1]
		}
	}
	return nil
}

func seedDemoOrders(tx *gorm.DB, start time.Time) error {
	customerID, err := customerIDByEmail(tx, "napat@example.com")
	if err != nil {
		return err
	}
	var book model.Book
	if err := tx.First(&book, "book_id = ?", 106).Error; err != nil {
		return err
	}
	// One order per status, plus a failed-delivery example. Original orders stay.
	statuses := append(model.OrderStatuses(), model.OrderStatusShipped)
	for i, target := range statuses {
		at := start.AddDate(0, 0, i)
		order := model.Order{CustomerID: customerID, OrderDate: at, Status: model.OrderStatusPendingConfirm,
			Channel:         []model.OrderChannel{model.OrderChannelWebsite, model.OrderChannelMessage, model.OrderChannelPhone}[i%3],
			ShippingAddress: "99/9 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองนครราชสีมา 30000 (ข้อมูลสาธิต)",
			Items:           []model.OrderItem{{BookID: book.BookID, Quantity: 1, UnitPrice: book.Price, LineTotal: book.Price}},
			Timeline:        []model.OrderStatusHistory{{Status: model.OrderStatusPendingConfirm, ChangedDate: at, ChangedBy: demoActor, Note: "รับคำสั่งซื้อสาธิต"}}}
		order.CalcTotal()
		payment := model.Payment{Amount: order.NetAmount, Status: model.PaymentStatusWaiting}
		var packedAt, shippedAt time.Time
		for j, status := range demoOrderPath(target)[1:] {
			stamp := at.Add(time.Duration(j+1) * time.Hour)
			note := "ข้อมูลสาธิต: " + status.Label()
			if status == model.OrderStatusCancelled {
				note = "ลูกค้าขอยกเลิกก่อนชำระเงิน (ข้อมูลสาธิต)"
			}
			if status == model.OrderStatusVerifyingPayment {
				order.SlipFileName = fmt.Sprintf("demo-slip-%02d.png", i+1)
				if err := payment.UploadSlip(order.SlipFileName, intPtr(i%3+1), stamp); err != nil {
					return err
				}
			}
			if status == model.OrderStatusPaid {
				if err := payment.Verify(demoActor, stamp); err != nil {
					return err
				}
			}
			if status == model.OrderStatusRejected {
				note = "ยอดโอนในหลักฐานไม่ตรงกับคำสั่งซื้อ (ข้อมูลสาธิต)"
				if err := payment.Reject(note, demoActor, stamp); err != nil {
					return err
				}
			}
			if status == model.OrderStatusPacking {
				packedAt = stamp
			}
			if status == model.OrderStatusShipped {
				shippedAt = stamp
			}
			if err := order.UpdateStatus(status, demoActor, note, stamp); err != nil {
				return err
			}
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		payment.OrderID = order.OrderID
		if err := tx.Create(&payment).Error; err != nil {
			return err
		}
		if !packedAt.IsZero() {
			if err := seedDemoStockChange(tx, model.StockTransaction{BookID: book.BookID, Type: model.StockTxnTypeSaleOut,
				QuantityChange: -1, ReferenceDoc: model.FormatOrderCode(order.OrderID), Reason: "แพ็กสินค้าตามคำสั่งซื้อสาธิต", TxnDate: packedAt}); err != nil {
				return err
			}
		}
		if target == model.OrderStatusReadyToShip || !shippedAt.IsZero() {
			shipment := model.Shipment{OrderID: order.OrderID, CarrierID: i%5 + 1,
				TrackingNumber: fmt.Sprintf("DEMO-%06d", order.OrderID), RecipientName: "ณภัทร (ผู้รับสาธิต)",
				ShippedDate: model.NewDate(at)}
			shipment.Record(at.Add(6 * time.Hour))
			if !shippedAt.IsZero() {
				shipment.ShippedDate = model.NewDate(shippedAt)
				if err := shipment.UpdateStatus(model.ShipmentStatusShipped, "ร้านหนังสือ", "ส่งพัสดุสาธิต", shippedAt); err != nil {
					return err
				}
				if err := shipment.UpdateStatus(model.ShipmentStatusInTransit, "ศูนย์คัดแยก", "อยู่ระหว่างขนส่ง", shippedAt.Add(15*time.Minute)); err != nil {
					return err
				}
				if target == model.OrderStatusDelivered || i == len(statuses)-1 {
					next, note := model.ShipmentStatusDelivered, "ผู้รับได้รับสินค้าแล้ว"
					if i == len(statuses)-1 {
						next, note = model.ShipmentStatusFailed, "ติดต่อผู้รับไม่ได้ (ข้อมูลสาธิต)"
					}
					if err := shipment.UpdateStatus(next, "ปลายทาง", note, shippedAt.Add(time.Hour)); err != nil {
						return err
					}
				}
			}
			if err := tx.Create(&shipment).Error; err != nil {
				return err
			}
		}
		if target == model.OrderStatusPaid {
			if err := tx.Create(&model.Notification{To: model.RoleWarehouse, Kind: model.NotifyOrderPaid,
				Title: "คำสั่งซื้อสาธิตรอแพ็ก", Body: model.FormatOrderCode(order.OrderID), Link: fmt.Sprintf("/admin/orders/%d", order.OrderID),
				Channel: model.ChannelInApp, CreatedAt: at.Add(5 * time.Hour)}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func seedDemoStockChange(tx *gorm.DB, row model.StockTransaction) error {
	result := tx.Model(&model.InventoryItem{}).Where("book_id = ? AND quantity_on_hand + ? >= 0", row.BookID, row.QuantityChange).
		Updates(map[string]any{"quantity_on_hand": gorm.Expr("quantity_on_hand + ?", row.QuantityChange), "last_updated": row.TxnDate})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("demo stock unavailable: book %d", row.BookID)
	}
	return tx.Create(&row).Error
}

func seedDemoMembership(tx *gorm.DB, now time.Time) error {
	var members []model.Member
	if err := tx.Order("member_id").Find(&members).Error; err != nil {
		return err
	}
	tiers, err := listTiers(tx)
	if err != nil {
		return err
	}
	for i := range members {
		m := &members[i]
		if m.PointBalance > 0 {
			expiry := model.NewDate(now.AddDate(1, 0, 0))
			m.PointTxns = append(m.PointTxns, model.PointTransaction{MemberID: m.MemberID,
				Type: model.PointTxnTypeEarn, Points: m.PointBalance, BalanceAfter: m.PointBalance,
				EarnedDate: m.JoinDate.Time, ExpiryDate: &expiry, Note: "ยอดยกมาจากการซื้อก่อนเริ่มระบบสาธิต"})
		}
		var orders []model.Order
		if err := tx.Preload("Timeline").Where("customer_id = ? AND order_id > ? AND status = ?", m.CustomerID, 1003, model.OrderStatusDelivered).Find(&orders).Error; err != nil {
			return err
		}
		for _, order := range orders {
			at := order.OrderDate
			for _, step := range order.Timeline {
				if step.Status == model.OrderStatusDelivered {
					at = step.ChangedDate
				}
			}
			tier := model.PickTier(tiers, m.TotalAccumulatedPurchase)
			m.EarnPoints(order, tier.PointRate, at)
			m.TierID = model.PickTier(tiers, m.TotalAccumulatedPurchase).TierID
		}
		if m.PointBalance >= 8 {
			var reward model.Reward
			if err := tx.First(&reward, "reward_id = ?", 1+i/2).Error; err != nil {
				return err
			}
			redemption, err := m.RedeemPoints(reward, now.Add(-time.Hour))
			if err != nil {
				return err
			}
			if err := tx.Create(redemption).Error; err != nil {
				return err
			}
			if err := tx.Model(redemption).Update("coupon_code", model.FormatCouponCode(redemption.RedemptionID)).Error; err != nil {
				return err
			}
		}
		if len(m.PointTxns) > 0 {
			if err := tx.Create(&m.PointTxns).Error; err != nil {
				return err
			}
		}
		if err := tx.Omit("PointTxns", "Redemptions").Save(m).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedDemoWarehouse(tx *gorm.DB, at time.Time) error {
	for i, status := range []model.ReturnStatus{model.ReturnStatusTracking, model.ReturnStatusEscalated, model.ReturnStatusClosed} {
		row := model.PurchaseReturn{POID: 2429, ReturnDate: model.NewDate(at.AddDate(0, 0, i-2)),
			Reason: "พบหน้ากระดาษชำรุดหลังรับสินค้า (ข้อมูลสาธิต)", Status: model.ReturnStatusTracking, CreatedBy: seedWarehouseName,
			Items: []model.PurchaseReturnItem{{BookID: 108, Quantity: 1, Reason: "กระดาษขาด (ข้อมูลสาธิต)"}}}
		if status == model.ReturnStatusEscalated {
			if err := row.Escalate("ผู้จัดจำหน่ายขอตรวจสอบหลักฐานเพิ่มเติม"); err != nil {
				return err
			}
		}
		if status == model.ReturnStatusClosed {
			if err := row.RecordCompensation(model.CompensationType("CREDIT_NOTE"), "ได้รับใบลดหนี้สำหรับสินค้า 1 เล่ม (ข้อมูลสาธิต)", demoActor, at); err != nil {
				return err
			}
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		for _, txn := range row.ToStockTransactions() {
			if err := seedDemoStockChange(tx, txn); err != nil {
				return err
			}
		}
	}
	for i, status := range []model.ApprovalStatus{model.ApprovalStatusPending, model.ApprovalStatusApproved, model.ApprovalStatusRejected} {
		var inventory model.InventoryItem
		if err := tx.First(&inventory, "book_id = ?", 109+i).Error; err != nil {
			return err
		}
		item := model.StockCountItem{BookID: inventory.BookID, SystemQty: inventory.QuantityOnHand, CountedQty: inventory.QuantityOnHand + 1}
		item.ComputeVariance()
		count := model.StockCount{CountDate: model.NewDate(at), Status: model.StockCountStatusDone, CountedBy: seedWarehouseName, Items: []model.StockCountItem{item}}
		if err := tx.Create(&count).Error; err != nil {
			return err
		}
		report := model.StockDiscrepancyReport{CountID: count.CountID, BookID: item.BookID, Variance: item.Variance,
			ApprovalStatus: model.ApprovalStatusPending, Note: "นับได้มากกว่าระบบ 1 เล่ม (ข้อมูลสาธิต)", ReportedBy: seedWarehouseName, ReportedAt: at}
		if status != model.ApprovalStatusPending {
			if err := report.Decide(status, "ตรวจสอบหลักฐานการนับแล้ว (ข้อมูลสาธิต)", demoActor, at.Add(time.Hour)); err != nil {
				return err
			}
		}
		if err := tx.Create(&report).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.StockCountItem{}).Where("count_id = ? AND book_id = ?", count.CountID, item.BookID).Update("report_id", report.ReportID).Error; err != nil {
			return err
		}
		if status == model.ApprovalStatusApproved {
			if err := seedDemoStockChange(tx, model.StockTransaction{BookID: item.BookID, Type: model.StockTxnTypeAdjustment,
				QuantityChange: item.Variance, Reason: "อนุมัติผลต่างจากการตรวจนับสาธิต", ReferenceDoc: model.FormatReportCode(report.ReportID), TxnDate: *report.ResolvedAt}); err != nil {
				return err
			}
		}
	}
	var suppliers []model.Supplier
	if err := tx.Find(&suppliers).Error; err != nil {
		return err
	}
	for _, supplier := range suppliers {
		if err := tx.Create(&model.SupplierEditLog{SupplierID: supplier.SupplierID, At: at, By: seedWarehouseName,
			Summary: "นำเข้าข้อมูลติดต่อและเงื่อนไขการค้าตั้งต้น (ข้อมูลสาธิต)"}).Error; err != nil {
			return err
		}
	}
	demoCustID := 1
	notifications := []model.Notification{
		{To: model.RoleSales, Kind: model.NotifyOrderPlaced, Title: "มีคำสั่งซื้อรอยืนยัน", Body: "SO-1001 รอตรวจสอบสต็อก (ข้อมูลสาธิต)", Link: "/admin/orders/1001"},
		{To: model.RoleDelivery, Kind: model.NotifyOrderReadyToShip, Title: "มีคำสั่งซื้อพร้อมจัดส่ง", Body: "SO-1002 แพ็กเรียบร้อยแล้ว (ข้อมูลสาธิต)", Link: "/admin/orders/1002"},
		{To: model.RoleManager, Kind: model.NotifyStockDiscrepancy, Title: "มีรายงานผลต่างรออนุมัติ", Body: "รอตรวจสอบผลต่างการนับสต็อกสาธิต", Link: "/admin/stock/discrepancies"},
		{To: model.RoleCustomer, CustomerID: &demoCustID, Kind: model.NotifyOrderPlaced, Title: "คำสั่งซื้อได้รับการบันทึกแล้ว", Body: "SO-1001 อยู่ระหว่างดำเนินการจัดเตรียม (ข้อมูลสาธิต)", Link: "/orders/1001"},
	}
	for _, notification := range notifications {
		for _, channel := range []model.NotificationChannel{model.ChannelInApp, model.ChannelEmail} {
			row := notification
			row.Channel, row.CreatedAt = channel, at
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func seedDemoReports(tx *gorm.DB, now time.Time) error {
	start, end := model.NewDate(now.AddDate(0, 0, -30)), model.NewDate(now)
	var report model.PaymentReport
	if err := tx.Table("payment").
		Joins("JOIN customer_order ON customer_order.order_id = payment.order_id").
		Where("payment.status = ? AND customer_order.status NOT IN (?, ?) AND payment.verified_date >= ? AND payment.verified_date < ?",
			model.PaymentStatusSuccess, model.OrderStatusCancelled, model.OrderStatusRejected, start.Time, end.Time.AddDate(0, 0, 1)).
		Select("COALESCE(SUM(payment.amount), 0) AS total_received, COUNT(*) AS item_count").Scan(&report).Error; err != nil {
		return err
	}
	report.PeriodStart, report.PeriodEnd = start, end
	report.GeneratedDate, report.GeneratedBy = end, demoActor
	if err := tx.Create(&report).Error; err != nil {
		return err
	}
	var shipments []model.Shipment
	if err := tx.Order("shipped_date, shipment_id").Find(&shipments).Error; err != nil {
		return err
	}
	var carriers []model.ShippingCompany
	if err := tx.Find(&carriers).Error; err != nil {
		return err
	}
	names := map[int]string{}
	for _, carrier := range carriers {
		names[carrier.CarrierID] = carrier.Name
	}
	for i := 0; i < len(shipments); {
		j := i + 1
		for j < len(shipments) && shipments[j].ShippedDate.Time.Equal(shipments[i].ShippedDate.Time) {
			j++
		}
		summary := model.DeliverySummary{SummaryDate: shipments[i].ShippedDate, GeneratedBy: demoActor}
		summary.Generate(shipments[i:j], names)
		if err := tx.Create(&summary).Error; err != nil {
			return err
		}
		i = j
	}
	return nil
}
