// seed_person.go — ข้อมูลตั้งต้นของลูกค้าและบัญชีผู้ใช้ (เขียนด้วยมือ ไม่ใช่ไฟล์ generated)
//
// frontend ไม่มี SEED_CUSTOMERS ให้ gen_seed.py อ่าน — หน้าจอเก็บลูกค้าเป็นแค่ชื่อกับที่อยู่
// ที่ฝังอยู่ในคำสั่งซื้อ (`SEED_ORDERS` ใน frontend/src/admin/orders/orders.ts)
// จึงคัด "ชื่อ + ที่อยู่" จากตรงนั้นมาตรงตัว แล้วเติมอีเมล/เบอร์/บัญชีเข้าไปเอง
// เพื่อให้ P4 ผูก Order เข้ากับ customer_id ได้โดยไม่ต้องแก้ข้อมูลย้อนหลัง
//
// สามรายนี้ครอบสถานะบัญชีครบทั้งสามค่า (ACTIVE / UNVERIFIED / SUSPENDED)
// เพื่อให้ cmd/smoke ทดสอบเส้นทางล็อกอินได้ทุกเส้นโดยไม่ต้องสร้างข้อมูลเอง
package database

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
)

// รหัสผ่านของบัญชีลูกค้าตั้งต้น — แยกจาก seedPassword ของพนักงานเพื่อไม่ให้เข้าใจผิดว่าใช้ร่วมกัน
const seedCustomerPassword = "customer1234"

// seedCustomerRow — ลูกค้าหนึ่งรายที่กระจายลงสามตาราง (person → customer → user_account)
type seedCustomerRow struct {
	Person         model.Person
	Address        string
	RegisteredDate string // "YYYY-MM-DD"
	Username       string
	Status         model.AccountStatus
}

// seedCustomers — ลูกค้าตั้งต้น 3 ราย · ชื่อและที่อยู่ตรงกับ SEED_ORDERS ฝั่ง frontend
var seedCustomers = []seedCustomerRow{
	{
		Person: model.Person{FirstName: "ณภัทร", LastName: "วงศ์สว่าง",
			Phone: "089-200-2001", Email: "napat@example.com"},
		Address:        "88/12 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
		RegisteredDate: "2026-05-20",
		Username:       "napat@example.com",
		Status:         model.AccountStatusActive,
	},
	{
		Person: model.Person{FirstName: "กัญญา", LastName: "ศรีสาย",
			Phone: "089-200-2002", Email: "kanya@example.com"},
		Address:        "199 หมู่ 4 ตำบลสุรนารี อำเภอเมือง จังหวัดนครราชสีมา 30000",
		RegisteredDate: "2026-06-15",
		Username:       "kanya@example.com",
		// สมัครแล้วแต่ยังไม่ยืนยัน OTP — smoke ใช้พิสูจน์ว่าล็อกอินไม่ได้
		Status: model.AccountStatusUnverified,
	},
	{
		Person: model.Person{FirstName: "สมศักดิ์", LastName: "ใจดี",
			Phone: "089-200-2003", Email: "somsak@example.com"},
		Address:        "45/7 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง จังหวัดเชียงใหม่ 50200",
		RegisteredDate: "2026-07-02",
		Username:       "somsak@example.com",
		// ถูกผู้จัดการระงับ — smoke ใช้พิสูจน์ทั้งเส้นล็อกอินและเส้นปลดระงับ
		Status: model.AccountStatusSuspended,
	},
}

// seedCustomerRows — สร้างลูกค้าตั้งต้นทีละราย
//
// ใช้ seedIfEmpty[T] ตรง ๆ ไม่ได้เพราะหนึ่งรายกระจายลงสามตาราง และ customer/user_account
// ต้องรู้ person_id ที่เพิ่งเกิด · เช็คความว่างที่ตาราง customer ตัวเดียวก็พอ
// เพราะ person มีแถวของพนักงานปนอยู่แล้วจาก backfillPersons()
func seedCustomerRows(tx *gorm.DB, passwordHash string) (int, error) {
	empty, err := tableEmpty[model.Customer](tx, "ลูกค้า")
	if err != nil || !empty {
		return 0, err
	}

	for _, row := range seedCustomers {
		person := row.Person
		if err := tx.Create(&person).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลบุคคล %s ไม่สำเร็จ: %w", person.Email, err)
		}
		customer := model.Customer{
			PersonID:       person.PersonID,
			Address:        row.Address,
			RegisteredDate: mustDate(row.RegisteredDate),
		}
		if err := tx.Create(&customer).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลลูกค้า %s ไม่สำเร็จ: %w", person.Email, err)
		}
		account := model.UserAccount{
			PersonID:     person.PersonID,
			Username:     row.Username,
			PasswordHash: passwordHash,
			Status:       row.Status,
		}
		if err := tx.Create(&account).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลบัญชีผู้ใช้ %s ไม่สำเร็จ: %w", row.Username, err)
		}
	}
	return len(seedCustomers), nil
}

// seedEmployeeRows — พนักงานตั้งต้น พร้อมแถว person ของแต่ละคน
//
// ต้องสร้าง person ให้ก่อนแล้วผูก person_id เอง เพราะ `employee.person_id` เป็น NOT NULL
// และมี unique index (`uq_employee_person`) ตั้งแต่ P1 · ปล่อยให้เป็น 0 ทั้งสี่แถวไม่ได้
// (`backfillPersons()` ช่วยได้เฉพาะฐานที่มีพนักงานอยู่ก่อนแล้ว ไม่ใช่ฐานเปล่า)
func seedEmployeeRows(tx *gorm.DB, passwordHash string) (int, error) {
	empty, err := tableEmpty[model.Employee](tx, "พนักงาน")
	if err != nil || !empty {
		return 0, err
	}

	for _, row := range seedEmployees {
		person := model.Person{
			FirstName: row.FirstName,
			LastName:  row.LastName,
			Phone:     row.Phone,
			Email:     row.Email,
		}
		if err := tx.Create(&person).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลบุคคล %s ไม่สำเร็จ: %w", person.Email, err)
		}

		employee := row
		employee.PersonID = person.PersonID
		employee.PasswordHash = passwordHash
		if err := tx.Create(&employee).Error; err != nil {
			return 0, fmt.Errorf("ใส่ข้อมูลพนักงาน %s ไม่สำเร็จ: %w", employee.Email, err)
		}
	}
	return len(seedEmployees), nil
}
