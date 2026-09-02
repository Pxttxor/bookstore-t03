package model

import "testing"

func TestUserAccountVerifyOtp(t *testing.T) {
	account := UserAccount{Status: AccountStatusUnverified}

	if err := account.VerifyOtp("000000"); err != ErrInvalidOtp {
		t.Fatalf("รหัสผิดต้องได้ ErrInvalidOtp ได้ %v", err)
	}
	if account.Status != AccountStatusUnverified {
		t.Fatalf("รหัสผิดแล้วสถานะต้องไม่เปลี่ยน ได้ %s", account.Status)
	}

	if err := account.VerifyOtp(DevOtpCode); err != nil {
		t.Fatalf("รหัสถูกต้องแต่ไม่ผ่าน: %v", err)
	}
	if account.Status != AccountStatusActive {
		t.Fatalf("ยืนยันแล้วต้องเป็น ACTIVE ได้ %s", account.Status)
	}

	// ยืนยันซ้ำไม่ถือเป็นข้อผิดพลาด ผู้ใช้อาจกดลิงก์เดิมสองครั้ง
	if err := account.VerifyOtp(DevOtpCode); err != nil {
		t.Fatalf("ยืนยันซ้ำไม่ควร error: %v", err)
	}
}

func TestSuspendedAccountCannotVerify(t *testing.T) {
	account := UserAccount{Status: AccountStatusSuspended}
	if err := account.VerifyOtp(DevOtpCode); err != ErrAccountSuspended {
		t.Fatalf("บัญชีถูกระงับต้องได้ ErrAccountSuspended ได้ %v", err)
	}
}

func TestAccountSuspendReactivate(t *testing.T) {
	account := UserAccount{Status: AccountStatusActive}

	if err := account.Reactivate(); err != ErrAccountNotSuspended {
		t.Fatalf("บัญชีที่ยังใช้งานอยู่ ปลดระงับไม่ได้ ได้ %v", err)
	}
	if err := account.Suspend(); err != nil {
		t.Fatalf("ระงับไม่สำเร็จ: %v", err)
	}
	if account.CanLogin() {
		t.Fatal("บัญชีที่ถูกระงับต้องล็อกอินไม่ได้")
	}
	if err := account.Suspend(); err != ErrAccountAlreadySuspended {
		t.Fatalf("ระงับซ้ำต้องได้ ErrAccountAlreadySuspended ได้ %v", err)
	}
	if err := account.Reactivate(); err != nil {
		t.Fatalf("ปลดระงับไม่สำเร็จ: %v", err)
	}
	if !account.CanLogin() {
		t.Fatal("ปลดระงับแล้วต้องล็อกอินได้")
	}
}

func TestOnlyActiveAccountCanLogin(t *testing.T) {
	cases := map[AccountStatus]bool{
		AccountStatusUnverified: false,
		AccountStatusActive:     true,
		AccountStatusSuspended:  false,
	}
	for status, want := range cases {
		if got := (UserAccount{Status: status}).CanLogin(); got != want {
			t.Errorf("%s CanLogin() = %v ต้องการ %v", status, got, want)
		}
	}
}

// RoleCustomer ต้องผ่าน IsValid (ไม่งั้น token ของลูกค้าถูกปฏิเสธที่ Verify)
// แต่ต้องไม่นับเป็นพนักงาน (ไม่งั้นหลุดเข้าหลังร้าน)
func TestCustomerRoleIsValidButNotEmployee(t *testing.T) {
	if !RoleCustomer.IsValid() {
		t.Fatal("RoleCustomer ต้องผ่าน IsValid")
	}
	if RoleCustomer.IsEmployee() {
		t.Fatal("RoleCustomer ต้องไม่นับเป็นพนักงาน")
	}
	for _, role := range EmployeeRoles() {
		if !role.IsEmployee() {
			t.Errorf("%s ต้องนับเป็นพนักงาน", role)
		}
		if role == RoleCustomer {
			t.Fatal("EmployeeRoles() ต้องไม่มี RoleCustomer — CHECK ของตาราง employee ใช้ลิสต์นี้")
		}
	}
}

func TestAccountStatusLabels(t *testing.T) {
	for _, status := range []AccountStatus{
		AccountStatusUnverified, AccountStatusActive, AccountStatusSuspended,
	} {
		if !status.IsValid() {
			t.Errorf("%s ต้องเป็นค่าที่ถูกต้อง", status)
		}
		if status.Label() == string(status) {
			t.Errorf("%s ยังไม่มีป้ายภาษาไทย", status)
		}
	}
	if AccountStatus("NOPE").IsValid() {
		t.Fatal("ค่าที่ไม่มีในรายการต้องไม่ผ่าน IsValid")
	}
}

func TestPersonName(t *testing.T) {
	person := Person{FirstName: "สมชาย", LastName: "ใจดี"}
	if got := person.Name(); got != "สมชาย ใจดี" {
		t.Fatalf("Name() = %q", got)
	}
}
