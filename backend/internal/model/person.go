// person.go — บุคคลและบัญชีผู้ใช้ (กลุ่ม people ของ class diagram)
//
// class diagram วางลำดับชั้นไว้แบบนี้:
//
//	Person <|-- Employee <|-- {WarehouseStaff, StoreManager, SalesStaff, DeliveryStaff}
//	Person <|-- Customer <|-- Member
//	Person "1" --> "0..1" UserAccount
//
// การแมปลงตาราง (class-table inheritance แบบ "เพิ่มพ่อ ไม่ย้ายลูก"):
//
//   - person เป็นตารางแม่ ถือข้อมูลติดต่อและเป็นปลายทางของ FK ที่ระบบย่อยอื่นอ้างถึงคน
//   - employee ยังถือ employee_id เป็น varchar PK ตามตาราง schema 15 แถวที่ส่งอาจารย์
//     และ **ยังเก็บชื่อ/เบอร์/อีเมลซ้ำกับ person โดยตั้งใจ** — ดู deviation ใน README
//     ถ้าย้ายออก จะต้องรื้อ auth, seed, และ smoke ของ U1–U10 ที่ทำเสร็จแล้วทั้งชุด
//   - subclass ทั้งสี่ของ Employee เป็นค่าในคอลัมน์ role (single-table inheritance)
//     migrate.go เปิด view warehouse_staff / store_manager / sales_staff / delivery_staff ทับให้
package model

import "time"

// ── บุคคล ───────────────────────────────────────────────────────────────

// Person — ข้อมูลติดต่อของคนหนึ่งคน ไม่ว่าจะเป็นพนักงานหรือลูกค้า
//
// class diagram ระบุว่าเป็น abstract แต่ต้องมีตารางจริง เพราะ UserAccount ผูกกับ Person
// ด้วยคอลัมน์เดียวทั้งพนักงานและลูกค้า ถ้าไม่มีตารางแม่จะต้องแยก FK เป็นสองคอลัมน์
type Person struct {
	PersonID  int    `gorm:"column:person_id;primaryKey;autoIncrement" json:"personId"`
	FirstName string `gorm:"column:first_name;type:varchar(100);not null" json:"firstName"`
	LastName  string `gorm:"column:last_name;type:varchar(100);not null" json:"lastName"`
	Phone     string `gorm:"column:phone;type:varchar(50)" json:"phone"`
	Email     string `gorm:"column:email;type:varchar(200);not null" json:"email"`
}

func (Person) TableName() string { return "person" }

// Name — ชื่อเต็มที่หน้าจอแสดง
func (p Person) Name() string { return p.FirstName + " " + p.LastName }

// ── พนักงาน ─────────────────────────────────────────────────────────────

// Employee — พนักงานทุกบทบาท
//
// PersonID ไม่ใส่ not null เพราะ AutoMigrate เพิ่มคอลัมน์ NOT NULL บนตารางที่มีข้อมูลอยู่แล้วไม่ได้
// backfillPersons() ใน migrate.go เติมค่าแล้วค่อยบังคับ NOT NULL ทีหลัง
type Employee struct {
	EmployeeID   string `gorm:"column:employee_id;type:varchar(20);primaryKey" json:"employeeId"`
	PersonID     int    `gorm:"column:person_id;index" json:"personId"`
	FirstName    string `gorm:"column:first_name;type:varchar(100);not null" json:"firstName"`
	LastName     string `gorm:"column:last_name;type:varchar(100);not null" json:"lastName"`
	Phone        string `gorm:"column:phone;type:varchar(50)" json:"phone"`
	Email        string `gorm:"column:email;type:varchar(200);not null;uniqueIndex" json:"email"`
	Role         Role   `gorm:"column:role;type:varchar(20);not null;index" json:"role"`
	PasswordHash string `gorm:"column:password_hash;type:varchar(100);not null" json:"-"`
}

func (Employee) TableName() string { return "employee" }

// Name — ชื่อเต็มที่หน้าจอแสดง (frontend เก็บผู้ทำรายการเป็นชื่อ ไม่ใช่รหัส)
func (e Employee) Name() string { return e.FirstName + " " + e.LastName }

// ── ลูกค้า ──────────────────────────────────────────────────────────────

// Customer — ลูกค้าที่สั่งซื้อหนังสือ
//
// เมธอด placeOrder() / trackShipment() / writeReview() ใน class diagram ต้องอ่านหลายตาราง
// จึงอยู่ในชั้น service ตามกติกา "กฎอยู่ที่ไหน" ไม่ใช่เมธอดบน struct นี้
type Customer struct {
	CustomerID     int     `gorm:"column:customer_id;primaryKey;autoIncrement" json:"customerId"`
	PersonID       int     `gorm:"column:person_id;not null;uniqueIndex" json:"personId"`
	Address        string  `gorm:"column:address;type:text;not null" json:"address"`
	RegisteredDate Date    `gorm:"column:registered_date;type:date;not null" json:"registeredDate"`
	Person         *Person `gorm:"foreignKey:PersonID;references:PersonID;-:migration" json:"person,omitempty"`
}

func (Customer) TableName() string { return "customer" }

// ── บัญชีผู้ใช้ ─────────────────────────────────────────────────────────

// UserAccount — บัญชีเข้าสู่ระบบ ผูกกับ Person แบบ 1 ต่อ 0..1
//
// class diagram แยกคลาสนี้ออกจาก Person เพราะลูกค้าที่สั่งซื้อทางโทรศัพท์อาจยังไม่มีบัญชี
type UserAccount struct {
	AccountID    int           `gorm:"column:account_id;primaryKey;autoIncrement" json:"accountId"`
	PersonID     int           `gorm:"column:person_id;not null;uniqueIndex" json:"personId"`
	Username     string        `gorm:"column:username;type:varchar(100);not null" json:"username"`
	PasswordHash string        `gorm:"column:password_hash;type:varchar(100);not null" json:"-"`
	Status       AccountStatus `gorm:"column:status;type:varchar(20);not null" json:"status"`
	LastLogin    *time.Time    `gorm:"column:last_login;type:timestamptz" json:"lastLogin,omitempty"`
}

func (UserAccount) TableName() string { return "user_account" }

// CanLogin — บัญชีอยู่ในสถานะที่เข้าสู่ระบบได้หรือไม่
// UNVERIFIED = สมัครแล้วแต่ยังไม่ยืนยัน OTP · SUSPENDED = ถูกผู้จัดการระงับ
func (a UserAccount) CanLogin() bool { return a.Status == AccountStatusActive }

// VerifyOtp — ยืนยันรหัส OTP แล้วเปิดใช้งานบัญชี (`+verifyOtp(otp)` ใน class diagram)
//
// ระบบ OTP จริงอยู่นอกขอบเขตวิชา — ใช้รหัสคงที่เหมือนที่การส่งอีเมลเป็นการจำลอง
// บัญชีที่ยืนยันไปแล้วเรียกซ้ำได้ ไม่ถือเป็นข้อผิดพลาด
func (a *UserAccount) VerifyOtp(otp string) error {
	if a.Status == AccountStatusSuspended {
		return ErrAccountSuspended
	}
	if otp != DevOtpCode {
		return ErrInvalidOtp
	}
	a.Status = AccountStatusActive
	return nil
}

// Suspend — ผู้จัดการระงับบัญชี
func (a *UserAccount) Suspend() error {
	if a.Status == AccountStatusSuspended {
		return ErrAccountAlreadySuspended
	}
	a.Status = AccountStatusSuspended
	return nil
}

// Reactivate — ปลดการระงับ กลับมาใช้งานได้
func (a *UserAccount) Reactivate() error {
	if a.Status != AccountStatusSuspended {
		return ErrAccountNotSuspended
	}
	a.Status = AccountStatusActive
	return nil
}

// RecordLogin — บันทึกเวลาเข้าสู่ระบบล่าสุด (`+login()` ใน class diagram)
func (a *UserAccount) RecordLogin(at time.Time) {
	stamp := at.UTC()
	a.LastLogin = &stamp
}

// DevOtpCode — รหัส OTP สำหรับโหมดพัฒนา
//
// ระบบส่ง OTP จริงอยู่นอกขอบเขต เช่นเดียวกับการส่งอีเมลที่บันทึกลงตาราง notification
// แต่ไม่ได้ส่งออกจริง — ประกาศไว้ที่เดียวเพื่อให้ smoke test อ้างถึงได้
const DevOtpCode = "123456"
