package database

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"testing"
	"time"

	"bookstore-t03/internal/model"
	"gorm.io/gorm"
)

func TestDemoOrderPaths(t *testing.T) {
	for _, status := range model.OrderStatuses() {
		t.Run(string(status), func(t *testing.T) {
			path := demoOrderPath(status)
			if len(path) == 0 || path[0] != model.OrderStatusPendingConfirm || path[len(path)-1] != status {
				t.Fatalf("invalid path: %v", path)
			}
			order := model.Order{Status: path[0]}
			for _, step := range path[1:] {
				if err := order.UpdateStatus(step, demoActor, "test reason", time.Now()); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

// Opt-in PostgreSQL integration test. Each test owns a new schema, never the
// public schema or an existing database. No Docker volume is deleted.
func demoTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("SEED_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set SEED_TEST_DATABASE_URL to a disposable local PostgreSQL database")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		t.Fatal("SEED_TEST_DATABASE_URL must be a PostgreSQL URL")
	}
	admin, err := Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	pool, _ := admin.DB()
	t.Cleanup(func() { _ = pool.Close() })
	schema := fmt.Sprintf("seed_test_%d", time.Now().UnixNano())
	if err := admin.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := admin.Exec("DROP SCHEMA " + schema + " CASCADE").Error; err != nil {
			t.Error(err)
		}
	})
	query := u.Query()
	query.Set("search_path", schema)
	u.RawQuery = query.Encode()
	db, err := Open(u.String())
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func demoSnapshot(t *testing.T, db *gorm.DB) map[string]string {
	t.Helper()
	rows := map[string]string{}
	for _, entity := range entities {
		stmt := &gorm.Statement{DB: db}
		if err := stmt.Parse(entity); err != nil {
			t.Fatal(err)
		}
		table := stmt.Schema.Table
		var data string
		if err := db.Raw("SELECT COALESCE(jsonb_agg(x ORDER BY x::text), '[]'::jsonb)::text FROM (SELECT to_jsonb(t) x FROM " + table + " t) s").Scan(&data).Error; err != nil {
			t.Fatal(err)
		}
		rows[table] = data
	}
	return rows
}

func TestDemoSeedIntegration(t *testing.T) {
	db := demoTestDB(t)
	if err := Seed(db); err != nil {
		t.Fatal(err)
	}
	before := demoSnapshot(t, db)
	for table, data := range before {
		if data == "[]" {
			t.Errorf("table %s has no demo data", table)
		}
	}
	assertZero := func(name, query string) {
		t.Helper()
		var count int64
		if err := db.Raw(query).Scan(&count).Error; err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Errorf("%s: %d inconsistent rows", name, count)
		}
	}
	assertZero("stock ledger", `SELECT count(*) FROM inventory_item i WHERE quantity_on_hand <> (SELECT COALESCE(sum(quantity_change),0) FROM stock_transaction t WHERE t.book_id=i.book_id)`)
	assertZero("point ledger", `SELECT count(*) FROM member m WHERE point_balance <> (SELECT COALESCE(sum(points),0) FROM point_transaction t WHERE t.member_id=m.member_id)`)
	assertZero("point running balance", `SELECT count(*) FROM (SELECT balance_after, sum(points) OVER (PARTITION BY member_id ORDER BY earned_date, point_txn_id) expected FROM point_transaction) x WHERE balance_after<>expected`)
	assertZero("payments", `SELECT count(*) FROM customer_order o LEFT JOIN payment p USING (order_id) WHERE p.payment_id IS NULL OR p.amount <> o.net_amount`)
	assertZero("order totals", `SELECT count(*) FROM customer_order o WHERE subtotal<>(SELECT sum(line_total) FROM customer_order_item i WHERE i.order_id=o.order_id) OR net_amount<>subtotal-discount_amount`)
	assertZero("payment report", `SELECT count(*) FROM payment_report r WHERE total_received<>(SELECT COALESCE(sum(p.amount),0) FROM payment p JOIN customer_order o USING (order_id) WHERE p.status='SUCCESS' AND o.status NOT IN ('CANCELLED','REJECTED') AND p.verified_date>=r.period_start AND p.verified_date<r.period_end+1) OR item_count<>(SELECT count(*) FROM payment p JOIN customer_order o USING (order_id) WHERE p.status='SUCCESS' AND o.status NOT IN ('CANCELLED','REJECTED') AND p.verified_date>=r.period_start AND p.verified_date<r.period_end+1)`)
	assertZero("delivery summary", `SELECT count(*) FROM delivery_summary r WHERE total_parcels<>(SELECT count(*) FROM shipment s WHERE s.shipped_date=r.summary_date)`)
	assertZero("redemptions", `SELECT count(*) FROM redemption r JOIN reward w USING (reward_id) WHERE r.points_used<>w.point_cost OR r.coupon_code=''`)
	assertZero("count reports", `SELECT count(*) FROM stock_count_item i JOIN stock_discrepancy_report r ON r.report_id=i.report_id WHERE i.variance<>i.counted_qty-i.system_qty OR r.variance<>i.variance OR r.count_id<>i.count_id OR r.book_id<>i.book_id`)
	assertZero("transfer dates", `SELECT count(*) FROM payment WHERE status='WAITING' AND (transfer_date IS NOT NULL OR slip_image_url<>'')`)
	assertZero("demo packed orders", `SELECT count(*) FROM customer_order o WHERE o.order_id>1003 AND o.status IN ('PACKING','READY_TO_SHIP','SHIPPED','DELIVERED') AND (SELECT COALESCE(sum(quantity_change),0) FROM stock_transaction t WHERE t.reference_doc='SO-'||o.order_id AND t.type='SALE_OUT') <> -(SELECT sum(quantity) FROM customer_order_item i WHERE i.order_id=o.order_id)`)
	assertZero("point order owner", `SELECT count(*) FROM point_transaction t JOIN member m USING (member_id) JOIN customer_order o USING (order_id) WHERE o.customer_id<>m.customer_id OR o.status<>'DELIVERED'`)
	assertZero("return quantities", `SELECT count(*) FROM (SELECT r.po_id,i.book_id,sum(i.quantity) qty FROM purchase_return r JOIN purchase_return_item i USING(return_id) GROUP BY r.po_id,i.book_id) x LEFT JOIN purchase_order_item p USING(po_id,book_id) WHERE p.book_id IS NULL OR x.qty>p.received_qty`)
	assertZero("delivered orders", `SELECT count(*) FROM customer_order o LEFT JOIN shipment s USING(order_id) WHERE o.status='DELIVERED' AND (s.shipment_id IS NULL OR s.status<>'DELIVERED')`)
	assertZero("demo successful payments", `SELECT count(*) FROM customer_order o JOIN payment p USING(order_id) WHERE o.order_id>1003 AND o.status IN ('PAID','PACKING','READY_TO_SHIP','SHIPPED','DELIVERED') AND (p.status<>'SUCCESS' OR p.verified_date IS NULL)`)
	var shipments []model.Shipment
	if err := db.Preload("Tracking", func(tx *gorm.DB) *gorm.DB { return tx.Order("update_date, tracking_id") }).Find(&shipments).Error; err != nil {
		t.Fatal(err)
	}
	for _, shipment := range shipments {
		if len(shipment.Tracking) == 0 || shipment.Tracking[len(shipment.Tracking)-1].Status != shipment.Status {
			t.Fatalf("shipment %d: incomplete timeline", shipment.ShipmentID)
		}
		for i := 1; i < len(shipment.Tracking); i++ {
			previous := model.Shipment{Status: shipment.Tracking[i-1].Status}
			if !previous.CanTransitionTo(shipment.Tracking[i].Status) {
				t.Errorf("shipment %d: invalid transition", shipment.ShipmentID)
			}
		}
	}
	var statuses int64
	if err := db.Model(&model.Order{}).Distinct("status").Count(&statuses).Error; err != nil {
		t.Fatal(err)
	}
	if statuses != int64(len(model.OrderStatuses())) {
		t.Errorf("got %d order statuses", statuses)
	}
	var orders []model.Order
	if err := db.Preload("Timeline", func(tx *gorm.DB) *gorm.DB { return tx.Order("changed_date, history_id") }).Find(&orders).Error; err != nil {
		t.Fatal(err)
	}
	for _, order := range orders {
		if len(order.Timeline) == 0 || order.Timeline[len(order.Timeline)-1].Status != order.Status {
			t.Fatalf("order %d: incomplete timeline", order.OrderID)
		}
		for i := 1; i < len(order.Timeline); i++ {
			previous := model.Order{Status: order.Timeline[i-1].Status}
			if !previous.CanTransitionTo(order.Timeline[i].Status) {
				t.Errorf("order %d: invalid transition", order.OrderID)
			}
		}
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := Seed(db); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, demoSnapshot(t, db)) {
		t.Fatal("second seed changed existing data")
	}
	if err := db.Model(&model.Book{}).Where("book_id = ?", 106).Update("price", 777).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.Notification{}).Where("to_role = ?", model.RoleWarehouse).Update("read", true).Error; err != nil {
		t.Fatal(err)
	}
	before = demoSnapshot(t, db)
	if err := Seed(db); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, demoSnapshot(t, db)) {
		t.Fatal("seed overwrote user edits")
	}
	// Explicit fixture IDs must not collide with subsequent auto IDs.
	var maxID int
	if err := db.Model(&model.Order{}).Select("max(order_id)").Scan(&maxID).Error; err != nil {
		t.Fatal(err)
	}
	order := model.Order{CustomerID: orders[0].CustomerID, Channel: model.OrderChannelWebsite, OrderDate: time.Now(), ShippingAddress: "test", Status: model.OrderStatusPendingConfirm}
	if err := db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	if order.OrderID <= maxID {
		t.Fatal("order sequence was not advanced")
	}
}

func TestDemoSeedRollbackIntegration(t *testing.T) {
	db := demoTestDB(t)
	before := demoSnapshot(t, db)
	failure := errors.New("injected report failure")
	if err := db.Callback().Create().Before("gorm:create").Register("seed_test:fail", func(tx *gorm.DB) {
		if tx.Statement.Table == "payment_report" {
			tx.AddError(failure)
		}
	}); err != nil {
		t.Fatal(err)
	}
	err := Seed(db)
	if removeErr := db.Callback().Create().Remove("seed_test:fail"); removeErr != nil {
		t.Fatal(removeErr)
	}
	if !errors.Is(err, failure) {
		t.Fatalf("expected injected failure, got %v", err)
	}
	if !reflect.DeepEqual(before, demoSnapshot(t, db)) {
		t.Fatal("failed seed left partial documents")
	}
	if err := Seed(db); err != nil {
		t.Fatalf("seed retry failed: %v", err)
	}
}

func TestDemoSeedProtectsPartialDatabaseIntegration(t *testing.T) {
	db := demoTestDB(t)
	notification := model.Notification{To: model.RoleManager, Kind: model.NotifyPRSubmitted, Title: "existing", Body: "user data", Link: "/admin", Channel: model.ChannelInApp, CreatedAt: time.Now()}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatal(err)
	}
	if err := Seed(db); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Model(&model.PointTransaction{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("extra demo must be skipped for a partially populated database")
	}
	var saved model.Notification
	if err := db.First(&saved, notification.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Body != "user data" {
		t.Fatal("existing notification overwritten")
	}
}
