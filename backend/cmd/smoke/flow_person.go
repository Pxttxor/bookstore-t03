// flow_person.go — กลุ่ม People ของ class diagram (Person · Customer · UserAccount)
//
// ครอบตั้งแต่สมัครสมาชิก → ยืนยัน OTP → ล็อกอิน → แก้โปรไฟล์ → ผู้จัดการระงับ/ปลดระงับบัญชี
// รวมทั้งเส้นสิทธิ์ที่ลูกค้าต้องเข้าไม่ได้ และเส้นที่พนักงานหลังร้านต้องเข้าไม่ได้
package main

import (
	"fmt"
	"time"

	"bookstore-t03/internal/model"
)

// seedCustomerPassword — รหัสผ่านของลูกค้าตั้งต้นใน internal/database/seed_person.go
const seedCustomerPassword = "customer1234"

// registerBody — ข้อมูลสมัครสมาชิกตัวอย่าง
func registerBody(email string) map[string]any {
	return map[string]any{
		"firstName": "ทดสอบ",
		"lastName":  "ระบบ",
		"email":     email,
		"phone":     "089-000-0000",
		"address":   "1 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ 10000",
		"password":  seedCustomerPassword,
	}
}

// loginBody — ข้อมูลเข้าสู่ระบบ (ช่อง email รับได้ทั้งอีเมลและชื่อผู้ใช้)
func loginBody(username, password string) map[string]any {
	return map[string]any{"email": username, "password": password}
}

// runPersonFlow — สมัครสมาชิก ยืนยันตัวตน และบัญชีผู้ใช้
func runPersonFlow(e *env) {
	warehouse, manager, sales := e.warehouse, e.manager, e.sales

	// อีเมลต้องไม่ซ้ำทุกรอบ ไม่งั้นรัน smoke ซ้ำจะติด EMAIL_TAKEN ตั้งแต่เคสแรก
	email := fmt.Sprintf("smoke%d@example.com", time.Now().UnixNano()%1000000000)

	section("สมัครสมาชิก (Person · Customer · UserAccount)")
	check("สมัครบัญชีลูกค้าใหม่ สถานะ UNVERIFIED", func() error {
		body, err := post("", "/api/auth/register", registerBody(email), 201)
		if err != nil {
			return err
		}
		if body["customerId"] == nil {
			return fmt.Errorf("ไม่ได้ customerId กลับมา: %v", body)
		}
		if err := expect(body["otpHint"], model.DevOtpCode); err != nil {
			return err
		}
		return expect(body["status"], string(model.AccountStatusUnverified))
	})
	check("สมัครด้วยอีเมลเดิม → 409 EMAIL_TAKEN", func() error {
		return expectError("POST", "/api/auth/register", "", registerBody(email), 409, "EMAIL_TAKEN")
	})
	check("รหัสผ่านสั้นกว่า 8 ตัว → 422 PASSWORD_TOO_SHORT", func() error {
		body := registerBody("short" + email)
		body["password"] = "1234"
		return expectError("POST", "/api/auth/register", "", body, 422, "PASSWORD_TOO_SHORT")
	})
	check("อีเมลผิดรูปแบบ → 422 INVALID_EMAIL", func() error {
		return expectError("POST", "/api/auth/register", "", registerBody("ไม่ใช่อีเมล"), 422, "INVALID_EMAIL")
	})
	check("กรอกข้อมูลไม่ครบ → 422 REQUIRED_FIELDS", func() error {
		body := registerBody("blank" + email)
		body["address"] = ""
		return expectError("POST", "/api/auth/register", "", body, 422, "REQUIRED_FIELDS")
	})

	section("ยืนยันตัวตนและเข้าสู่ระบบ")
	check("ยังไม่ยืนยัน OTP ล็อกอินไม่ได้ → 401 ACCOUNT_NOT_VERIFIED", func() error {
		return expectError("POST", "/api/auth/login", "",
			loginBody(email, seedCustomerPassword), 401, "ACCOUNT_NOT_VERIFIED")
	})
	check("รหัส OTP ผิด → 422 INVALID_OTP", func() error {
		return expectError("POST", "/api/auth/verify-otp", "",
			map[string]any{"email": email, "otp": "000000"}, 422, "INVALID_OTP")
	})
	check("ยืนยัน OTP ถูกต้อง สถานะเป็น ACTIVE", func() error {
		body, err := post("", "/api/auth/verify-otp",
			map[string]any{"email": email, "otp": model.DevOtpCode}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], string(model.AccountStatusActive))
	})
	check("ล็อกอินหลังยืนยันแล้ว ได้ token บทบาท customer", func() error {
		body, err := post("", "/api/auth/login", loginBody(email, seedCustomerPassword), 200)
		if err != nil {
			return err
		}
		token, ok := body["token"].(string)
		if !ok || token == "" {
			return fmt.Errorf("ไม่ได้ token กลับมา: %v", body)
		}
		e.customer = token
		user, _ := body["user"].(map[string]any)
		return expect(user["role"], string(model.RoleCustomer))
	})
	check("รหัสผ่านผิด → 401 INVALID_CREDENTIALS", func() error {
		return expectError("POST", "/api/auth/login", "",
			loginBody(email, "wrong-password"), 401, "INVALID_CREDENTIALS")
	})

	section("บัญชีลูกค้าตั้งต้น (ครบทั้งสามสถานะ)")
	check("บัญชี ACTIVE ล็อกอินได้", func() error {
		_, err := post("", "/api/auth/login",
			loginBody("napat@example.com", seedCustomerPassword), 200)
		return err
	})
	check("บัญชี UNVERIFIED ล็อกอินไม่ได้ → 401 ACCOUNT_NOT_VERIFIED", func() error {
		return expectError("POST", "/api/auth/login", "",
			loginBody("kanya@example.com", seedCustomerPassword), 401, "ACCOUNT_NOT_VERIFIED")
	})
	check("บัญชี SUSPENDED ล็อกอินไม่ได้ → 401 ACCOUNT_SUSPENDED", func() error {
		return expectError("POST", "/api/auth/login", "",
			loginBody("somsak@example.com", seedCustomerPassword), 401, "ACCOUNT_SUSPENDED")
	})

	section("โปรไฟล์ลูกค้า")
	check("ลูกค้าอ่านโปรไฟล์ตัวเองได้", func() error {
		body, err := get(e.customer, "/api/customers/me")
		if err != nil {
			return err
		}
		return expect(body["email"], email)
	})
	check("ลูกค้าแก้ที่อยู่จัดส่งของตัวเอง", func() error {
		body, err := put(e.customer, "/api/customers/me", map[string]any{
			"firstName": "ทดสอบ",
			"lastName":  "ระบบ",
			"phone":     "089-111-1111",
			"address":   "99 ที่อยู่ใหม่หลังแก้โปรไฟล์ กรุงเทพฯ 10110",
		}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["phone"], "089-111-1111"); err != nil {
			return err
		}
		return expect(body["address"], "99 ที่อยู่ใหม่หลังแก้โปรไฟล์ กรุงเทพฯ 10110")
	})
	check("แก้โปรไฟล์โดยเว้นช่องบังคับ → 422 REQUIRED_FIELDS", func() error {
		return expectError("PUT", "/api/customers/me", e.customer, map[string]any{
			"firstName": "ทดสอบ", "lastName": "ระบบ", "address": "",
		}, 422, "REQUIRED_FIELDS")
	})
	check("ลูกค้าเข้าหน้าผู้จัดจำหน่ายไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/suppliers", e.customer, nil, 403)
	})
	check("พนักงานคลังดูรายชื่อลูกค้าไม่ได้ → 403", func() error {
		return expectStatus("GET", "/api/customers", warehouse, nil, 403)
	})

	section("รายชื่อลูกค้าและการระงับบัญชี")
	var accountID int
	check("ฝ่ายขายดูรายชื่อลูกค้าได้ เห็นลูกค้าตั้งต้นครบ 3 ราย", func() error {
		items, err := getList(sales, "/api/customers")
		if err != nil {
			return err
		}
		seen := map[string]bool{}
		for _, entry := range items {
			row := entry.(map[string]any)
			seen[fmt.Sprint(row["email"])] = true
		}
		for _, want := range []string{"napat@example.com", "kanya@example.com", "somsak@example.com"} {
			if !seen[want] {
				return fmt.Errorf("ไม่พบลูกค้าตั้งต้น %s ในรายชื่อ %d ราย", want, len(items))
			}
		}
		return nil
	})
	check("ค้นหาลูกค้าด้วยอีเมลแล้วได้รหัสบัญชีกลับมา", func() error {
		items, err := getList(manager, "/api/customers?q="+urlEncode(email))
		if err != nil {
			return err
		}
		if len(items) != 1 {
			return fmt.Errorf("ค้นแล้วได้ %d ราย ต้องการ 1", len(items))
		}
		row := items[0].(map[string]any)
		account, ok := row["account"].(map[string]any)
		if !ok {
			return fmt.Errorf("ลูกค้าไม่มีข้อมูลบัญชี: %v", row)
		}
		accountID = int(account["accountId"].(float64))
		return expect(account["status"], string(model.AccountStatusActive))
	})
	check("ฝ่ายขายระงับบัญชีไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/accounts/%d/suspend", accountID), sales, nil, 403)
	})
	check("ลูกค้าระงับบัญชีไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/accounts/%d/suspend", accountID), e.customer, nil, 403)
	})
	check("ผู้จัดการระงับบัญชี → SUSPENDED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/accounts/%d/suspend", accountID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], string(model.AccountStatusSuspended))
	})
	check("บัญชีที่ถูกระงับล็อกอินไม่ได้ → 401 ACCOUNT_SUSPENDED", func() error {
		return expectError("POST", "/api/auth/login", "",
			loginBody(email, seedCustomerPassword), 401, "ACCOUNT_SUSPENDED")
	})
	check("ระงับซ้ำ → 409 ACCOUNT_ALREADY_SUSPENDED", func() error {
		return expectError("POST", fmt.Sprintf("/api/accounts/%d/suspend", accountID), manager,
			nil, 409, "ACCOUNT_ALREADY_SUSPENDED")
	})
	check("ผู้จัดการปลดระงับ → ACTIVE แล้วล็อกอินได้อีกครั้ง", func() error {
		body, err := post(manager, fmt.Sprintf("/api/accounts/%d/reactivate", accountID), nil, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], string(model.AccountStatusActive)); err != nil {
			return err
		}
		_, err = post("", "/api/auth/login", loginBody(email, seedCustomerPassword), 200)
		return err
	})
	check("ปลดระงับบัญชีที่ไม่ได้ถูกระงับ → 409 ACCOUNT_NOT_SUSPENDED", func() error {
		return expectError("POST", fmt.Sprintf("/api/accounts/%d/reactivate", accountID), manager,
			nil, 409, "ACCOUNT_NOT_SUSPENDED")
	})
	check("ไม่พบบัญชีตามรหัส → 404 ACCOUNT_NOT_FOUND", func() error {
		return expectError("POST", "/api/accounts/999999/suspend", manager, nil, 404, "ACCOUNT_NOT_FOUND")
	})
}
