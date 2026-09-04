// client.go — ตัวช่วยเรียก API และนับผลการทดสอบ
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var client = &http.Client{Timeout: 15 * time.Second}

var (
	passed int
	failed int
)

// ── ตัวช่วยรันเคสทดสอบ ──────────────────────────────────────────────────

func section(title string) {
	fmt.Printf("\n-- %s --\n", title)
}

func check(name string, run func() error) {
	if err := run(); err != nil {
		failed++
		fmt.Printf("  FAIL  %s\n        %v\n", name, err)
		return
	}
	passed++
	fmt.Printf("  PASS  %s\n", name)
}

func expect(got, want any) error {
	if got != want {
		return fmt.Errorf("ได้ %v ต้องการ %v", got, want)
	}
	return nil
}

// ── ตัวช่วยเรียก API ────────────────────────────────────────────────────

func login(email string) string {
	body, _, err := request("POST", "/api/auth/login", "",
		map[string]any{"email": email, "password": "staff1234"})
	if err != nil {
		fmt.Printf("เข้าสู่ระบบด้วย %s ไม่สำเร็จ: %v\n", email, err)
		os.Exit(1)
	}
	token, ok := body["token"].(string)
	if !ok {
		fmt.Printf("เข้าสู่ระบบด้วย %s ไม่ได้ token กลับมา\n", email)
		os.Exit(1)
	}
	return token
}

func request(method, path, token string, payload any) (map[string]any, int, error) {
	var reader io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, *baseURL+path, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if len(raw) == 0 {
		return map[string]any{}, resp.StatusCode, nil
	}

	// response เป็น array ได้ (รายการต่าง ๆ) ห่อไว้ใน key "items" ให้เรียกใช้ง่าย
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err == nil {
		return object, resp.StatusCode, nil
	}
	var list []any
	if err := json.Unmarshal(raw, &list); err == nil {
		return map[string]any{"items": list}, resp.StatusCode, nil
	}
	return nil, resp.StatusCode, fmt.Errorf("อ่าน response ไม่ได้: %s", raw)
}

func call(method, path, token string, payload any, wantStatus int) (map[string]any, error) {
	body, status, err := request(method, path, token, payload)
	if err != nil {
		return nil, err
	}
	if status != wantStatus {
		return nil, fmt.Errorf("สถานะ = %d ต้องการ %d (%v)", status, wantStatus, body)
	}
	return body, nil
}

func get(token, path string) (map[string]any, error) { return call("GET", path, token, nil, 200) }
func post(token, path string, payload any, want int) (map[string]any, error) {
	return call("POST", path, token, payload, want)
}
func put(token, path string, payload any, want int) (map[string]any, error) {
	return call("PUT", path, token, payload, want)
}

func getList(token, path string) ([]any, error) {
	body, err := call("GET", path, token, nil, 200)
	if err != nil {
		return nil, err
	}
	items, _ := body["items"].([]any)
	return items, nil
}

func expectStatus(method, path, token string, payload any, want int) error {
	_, status, err := request(method, path, token, payload)
	if err != nil {
		return err
	}
	if status != want {
		return fmt.Errorf("สถานะ = %d ต้องการ %d", status, want)
	}
	return nil
}

// expectError — ตรวจทั้งสถานะและรหัสข้อผิดพลาด เพื่อให้แน่ใจว่าล้มด้วยเหตุผลที่ตั้งใจ
func expectError(method, path, token string, payload any, wantStatus int, wantCode string) error {
	body, status, err := request(method, path, token, payload)
	if err != nil {
		return err
	}
	if status != wantStatus {
		return fmt.Errorf("สถานะ = %d ต้องการ %d (%v)", status, wantStatus, body)
	}
	detail, ok := body["error"].(map[string]any)
	if !ok {
		return fmt.Errorf("ไม่มี object error ใน response: %v", body)
	}
	if detail["code"] != wantCode {
		return fmt.Errorf("รหัสข้อผิดพลาด = %v ต้องการ %s", detail["code"], wantCode)
	}
	return nil
}

// onHand — ยอดคงเหลือปัจจุบันของหนังสือเล่มหนึ่ง (คืน -1 ถ้าอ่านไม่ได้)
// restoreStock — ดึงยอดคงเหลือกลับมาที่เดิมหลังจบ flow ที่ขยับสต็อก
//
// smoke เขียนลงฐานข้อมูลจริงที่ทั้งทีมใช้ร่วมกัน ถ้าไม่คืนยอด หน้าร้านจะโชว์จำนวนที่สะสม
// มาจากการทดสอบ และหน้าแจ้งเตือนจุดสั่งซื้อจะเงียบไปเฉย ๆ โดยไม่มีอะไรฟ้อง
func restoreStock(token string, bookID, want int) {
	diff := want - onHand(token, bookID)
	if diff == 0 {
		return
	}
	_, err := post(token, "/api/inventory/adjust", map[string]any{
		"lines": []any{map[string]any{
			"bookId":         bookID,
			"quantityChange": diff,
			"reason":         "คืนยอดหลังการทดสอบระบบ (smoke)",
			"referenceDoc":   "SMOKE",
		}},
	}, 201)
	if err != nil {
		fmt.Printf("  คืนยอดคงเหลือเล่ม %d ไม่สำเร็จ: %v\n", bookID, err)
	}
}

func onHand(token string, bookID int) int {
	items, err := getList(token, "/api/inventory")
	if err != nil {
		return -1
	}
	for _, entry := range items {
		row := entry.(map[string]any)
		if int(row["bookId"].(float64)) == bookID {
			return int(row["quantityOnHand"].(float64))
		}
	}
	return -1
}

func daysFromNow(days int) string {
	return time.Now().AddDate(0, 0, days).Format("2006-01-02")
}

func urlEncode(value string) string {
	encoded := ""
	for _, b := range []byte(value) {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') ||
			b == '-' || b == '_' || b == '.' || b == '~' {
			encoded += string(b)
			continue
		}
		encoded += fmt.Sprintf("%%%02X", b)
	}
	return encoded
}

// supplierBody — ข้อมูลผู้จัดจำหน่ายตัวอย่างสำหรับทดสอบ U1/U2
func supplierBody(companyName string) map[string]any {
	return map[string]any{
		"companyName": companyName,
		"contactName": "ผู้ติดต่อทดสอบ",
		"phone":       "02-000-0000",
		"email":       "test@example.com",
		"address":     "1 ถนนทดสอบ กรุงเทพฯ 10000",
		"tradeTerms":  "ส่วนลดหน้าปก 30%",
		"creditTerms": "เครดิต 30 วัน",
		"books": []any{
			map[string]any{"bookId": 101, "supplyPrice": 285, "leadTimeDays": 7},
		},
	}
}
