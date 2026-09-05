// handler_test.go — ตรวจว่าตารางเส้นทางประกอบขึ้นได้จริง
//
// ServeMux จะ panic ทันทีถ้ามีรูปแบบเส้นทางชนกัน (เช่นลงทะเบียน path เดียวกันสองครั้ง)
// ซึ่งปกติจะรู้ตอนรันเซิร์ฟเวอร์เท่านั้น เทสต์นี้ดึงมารู้ตั้งแต่ go test
package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"bookstore-t03/internal/service"
)

// stubAuth — ตัวตรวจ token ปลอม เทสต์นี้สนใจแค่การประกอบเส้นทาง ไม่ได้แตะฐานข้อมูล
type stubAuth struct{}

func (stubAuth) Verify(string) (*service.Identity, error) { return nil, nil }

func newTestRoutes(t *testing.T) http.Handler {
	t.Helper()
	defer func() {
		if recovered := recover(); recovered != nil {
			t.Fatalf("ลงทะเบียนเส้นทางแล้ว panic (น่าจะมีรูปแบบชนกัน): %v", recovered)
		}
	}()

	h := New(Deps{})
	return h.Routes(RouteConfig{Auth: stubAuth{}, CORSOrigins: []string{"http://localhost:5173"}})
}

func TestRoutesRegisterWithoutConflict(t *testing.T) {
	if newTestRoutes(t) == nil {
		t.Fatal("ไม่ได้ handler กลับมา")
	}
}

func TestHealthIsPublic(t *testing.T) {
	routes := newTestRoutes(t)

	recorder := httptest.NewRecorder()
	routes.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	if recorder.Code != http.StatusOK {
		t.Errorf("สถานะ = %d, ต้องการ 200", recorder.Code)
	}
}

// แคตตาล็อกหน้าร้านเปิดสาธารณะ — คนที่ยังไม่ล็อกอินต้องเดินดูหนังสือได้
//
// Deps ของเทสต์ว่าง service จึงเป็น nil และ handler จะ panic แล้วถูก Recover
// แปลงเป็น 500 — ที่เทสต์นี้ต้องการคือ "ไม่ถูก middleware กันไว้" จึงดูว่าไม่ใช่ 401 (มี RequireAuth)
// และไม่ใช่ 404 (ลืมลงทะเบียน) · ห้ามเพิ่มสามเส้นนี้ลง TestProtectedRoutesRequireToken
func TestCatalogueIsPublic(t *testing.T) {
	routes := newTestRoutes(t)

	paths := []string{
		"/api/catalogue",
		"/api/catalogue/categories",
		"/api/catalogue/101",
		"/api/promotions/active",
	}

	for _, path := range paths {
		recorder := httptest.NewRecorder()
		routes.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

		switch recorder.Code {
		case http.StatusUnauthorized:
			t.Errorf("%s ตอบ 401 — เส้นทางนี้ต้องเปิดสาธารณะ (เผลอลงทะเบียนผ่าน register หรือเปล่า)", path)
		case http.StatusNotFound:
			t.Errorf("%s ตอบ 404 — ยังไม่ได้ลงทะเบียนเส้นทางนี้", path)
		}
	}
}

// เส้นทางที่ต้องยืนยันตัวตนต้องตอบ 401 เมื่อไม่ส่ง token — ไม่ใช่ 404 หรือ panic
func TestProtectedRoutesRequireToken(t *testing.T) {
	routes := newTestRoutes(t)

	paths := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/suppliers"},
		{http.MethodGet, "/api/suppliers/1"},
		{http.MethodGet, "/api/suppliers/1/orders"},
		{http.MethodPost, "/api/suppliers"},
		{http.MethodPut, "/api/suppliers/1"},
		{http.MethodPost, "/api/suppliers/1/deactivate"},
		{http.MethodGet, "/api/categories"},
		{http.MethodGet, "/api/books"},
		{http.MethodGet, "/api/books/101"},
		{http.MethodGet, "/api/books/101/change-logs"},
		{http.MethodGet, "/api/books/101/stock-transactions"},
		{http.MethodPost, "/api/books"},
		{http.MethodPut, "/api/books/101"},
		{http.MethodPost, "/api/books/101/status"},
		{http.MethodGet, "/api/inventory"},
		{http.MethodGet, "/api/inventory/alerts"},
		{http.MethodGet, "/api/inventory/low-stock"},
		{http.MethodPost, "/api/inventory/adjust"},
		{http.MethodGet, "/api/stock-counts"},
		{http.MethodGet, "/api/stock-counts/1"},
		{http.MethodPost, "/api/stock-counts"},
		{http.MethodGet, "/api/discrepancies"},
		{http.MethodPost, "/api/discrepancies/1/approve"},
		{http.MethodPost, "/api/discrepancies/1/reject"},
		{http.MethodPut, "/api/inventory/101/reorder-point"},
		{http.MethodGet, "/api/requisitions"},
		{http.MethodGet, "/api/requisitions/101"},
		{http.MethodPost, "/api/requisitions/101/submit"},
		{http.MethodPost, "/api/requisitions/101/approve"},
		{http.MethodPost, "/api/requisitions/101/reject"},
		{http.MethodGet, "/api/purchase-orders"},
		{http.MethodGet, "/api/purchase-orders/2401"},
		{http.MethodPost, "/api/purchase-orders/2401/send"},
		{http.MethodPost, "/api/purchase-orders/2401/confirm"},
		{http.MethodGet, "/api/purchase-orders/2401/receipts"},
		{http.MethodPost, "/api/purchase-orders/2401/receipts"},
		{http.MethodGet, "/api/purchase-orders/2401/returns"},
		{http.MethodPost, "/api/purchase-orders/2401/returns"},
		{http.MethodGet, "/api/receipts"},
		{http.MethodGet, "/api/returns/7001"},
		{http.MethodPost, "/api/returns/7001/escalate"},
		{http.MethodPost, "/api/returns/7001/compensation"},
		{http.MethodGet, "/api/purchasing/budget"},
		{http.MethodGet, "/api/customers"},
		{http.MethodGet, "/api/customers/1"},
		{http.MethodGet, "/api/customers/me"},
		{http.MethodPut, "/api/customers/me"},
		{http.MethodPost, "/api/accounts/1/suspend"},
		{http.MethodPost, "/api/accounts/1/reactivate"},
		{http.MethodGet, "/api/auth/me"},
		{http.MethodGet, "/api/orders"},
		{http.MethodGet, "/api/orders/1001"},
		{http.MethodPost, "/api/orders"},
		{http.MethodPost, "/api/orders/1001/confirm-stock"},
		{http.MethodPost, "/api/orders/1001/await-payment"},
		{http.MethodPost, "/api/orders/1001/payment"},
		{http.MethodPost, "/api/orders/1001/verify-payment"},
		{http.MethodPost, "/api/orders/1001/reject-payment"},
		{http.MethodPost, "/api/orders/1001/pack"},
		{http.MethodPost, "/api/orders/1001/ready"},
		{http.MethodPost, "/api/orders/1001/ship"},
		{http.MethodPost, "/api/orders/1001/deliver"},
		{http.MethodPost, "/api/orders/1001/cancel"},
		{http.MethodGet, "/api/promotions"},
		{http.MethodGet, "/api/promotions/1"},
		{http.MethodPost, "/api/promotions"},
		{http.MethodPut, "/api/promotions/1"},
		{http.MethodPost, "/api/promotions/1/status"},
		{http.MethodDelete, "/api/promotions/1"},
		{http.MethodGet, "/api/banks"},
		{http.MethodGet, "/api/payments"},
		{http.MethodGet, "/api/payments/1"},
		{http.MethodGet, "/api/orders/1001/payment"},
		{http.MethodGet, "/api/payment-reports"},
		{http.MethodPost, "/api/payment-reports"},
		{http.MethodGet, "/api/carriers"},
		{http.MethodGet, "/api/shipments"},
		{http.MethodGet, "/api/shipments/1"},
		{http.MethodGet, "/api/orders/1001/shipment"},
		{http.MethodPost, "/api/shipments/1/tracking"},
		{http.MethodGet, "/api/delivery-summaries"},
		{http.MethodPost, "/api/delivery-summaries"},
		{http.MethodGet, "/api/membership-tiers"},
		{http.MethodPost, "/api/membership-tiers"},
		{http.MethodPut, "/api/membership-tiers/1"},
		{http.MethodDelete, "/api/membership-tiers/1"},
		{http.MethodGet, "/api/members"},
		{http.MethodGet, "/api/members/me"},
		{http.MethodGet, "/api/members/1"},
		{http.MethodGet, "/api/members/1/point-transactions"},
		{http.MethodPost, "/api/members/1/point-adjustments"},
		{http.MethodGet, "/api/rewards"},
		{http.MethodPost, "/api/rewards"},
		{http.MethodPut, "/api/rewards/1"},
		{http.MethodDelete, "/api/rewards/1"},
		{http.MethodPost, "/api/rewards/1/redeem"},
		{http.MethodGet, "/api/redemptions"},
		{http.MethodPost, "/api/reviews"},
		{http.MethodPut, "/api/reviews/1"},
		{http.MethodDelete, "/api/reviews/1"},
		{http.MethodGet, "/api/reviews"},
		{http.MethodGet, "/api/reviews/1"},
		{http.MethodGet, "/api/books/1/reviews"},
		{http.MethodPost, "/api/reviews/1/moderate"},
		{http.MethodPost, "/api/reviews/1/replies"},
		{http.MethodPost, "/api/reviews/1/report"},
		{http.MethodGet, "/api/review-reports"},
		{http.MethodGet, "/api/review-reports/1"},
		{http.MethodGet, "/api/notifications"},
		{http.MethodPost, "/api/notifications/read-all"},
	}

	for _, route := range paths {
		recorder := httptest.NewRecorder()
		routes.ServeHTTP(recorder, httptest.NewRequest(route.method, route.path, nil))

		if recorder.Code != http.StatusUnauthorized {
			t.Errorf("%s %s → %d, ต้องการ 401", route.method, route.path, recorder.Code)
		}
	}
}

// CORS preflight ต้องผ่านโดยไม่ต้องมี token ไม่งั้นเบราว์เซอร์เรียก API ข้ามพอร์ตไม่ได้
func TestCORSPreflight(t *testing.T) {
	routes := newTestRoutes(t)

	request := httptest.NewRequest(http.MethodOptions, "/api/suppliers", nil)
	request.Header.Set("Origin", "http://localhost:5173")
	recorder := httptest.NewRecorder()
	routes.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Errorf("สถานะ = %d, ต้องการ 204", recorder.Code)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Access-Control-Allow-Origin = %q, ต้องการ http://localhost:5173", got)
	}
}
