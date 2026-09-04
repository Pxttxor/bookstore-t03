// person.go — สมัครสมาชิก ยืนยันตัวตน และข้อมูลลูกค้า
//
// class diagram: Person <|-- Customer · Person "1" --> "0..1" UserAccount
// การสมัครหนึ่งครั้งสร้างสามแถวพร้อมกัน (person → customer → user_account)
// จึงต้องอยู่ในทรานแซกชันเดียว ไม่งั้นอาจได้ person ลอยที่ไม่มีลูกค้าผูกอยู่
package service

import (
	"net/mail"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

// MinPasswordLength — ความยาวรหัสผ่านขั้นต่ำของบัญชีลูกค้า
const MinPasswordLength = 8

type PersonService struct {
	db      *gorm.DB
	people  *repository.PersonRepository
	members *repository.MembershipRepository
}

func NewPersonService(
	db *gorm.DB,
	people *repository.PersonRepository,
	members *repository.MembershipRepository,
) *PersonService {
	return &PersonService{db: db, people: people, members: members}
}

// ── DTO ที่หน้าจอส่งเข้ามา ───────────────────────────────────────────────

type RegisterInput struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Address   string `json:"address"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

type VerifyOtpInput struct {
	Email string `json:"email"`
	Otp   string `json:"otp"`
}

type ProfileInput struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Phone     string `json:"phone"`
	Address   string `json:"address"`
}

// RegisterResult — ผลการสมัคร ยังไม่ออก token เพราะบัญชีต้องยืนยัน OTP ก่อน
type RegisterResult struct {
	CustomerID int                 `json:"customerId"`
	Username   string              `json:"username"`
	Status     model.AccountStatus `json:"status"`
	// OtpHint มีเฉพาะโหมดพัฒนา — ระบบส่ง OTP จริงอยู่นอกขอบเขตวิชา
	// เช่นเดียวกับการส่งอีเมลที่บันทึกลงตารางแต่ไม่ได้ส่งออกจริง
	OtpHint string `json:"otpHint"`
}

// Register — สมัครบัญชีลูกค้าใหม่ (สถานะเริ่มต้น UNVERIFIED)
func (s *PersonService) Register(input RegisterInput) (*RegisterResult, error) {
	person, customer, account, err := s.buildRegistration(input)
	if err != nil {
		return nil, err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		// ตรวจซ้ำในทรานแซกชันเดียวกับที่เขียน เพื่อให้ unique index เป็นด่านสุดท้ายจริง ๆ
		taken, err := s.people.PersonEmailTaken(tx, person.Email)
		if err != nil {
			return err
		}
		if taken {
			return model.ErrEmailTaken
		}
		taken, err = s.people.UsernameTaken(tx, account.Username)
		if err != nil {
			return err
		}
		if taken {
			return model.ErrUsernameTaken
		}
		if err := s.people.CreateCustomer(tx, person, customer, account); err != nil {
			return err
		}
		return s.enroll(tx, customer)
	})
	if err != nil {
		return nil, err
	}

	return &RegisterResult{
		CustomerID: customer.CustomerID,
		Username:   account.Username,
		Status:     account.Status,
		OtpHint:    model.DevOtpCode,
	}, nil
}

// enroll — เปิดแถวสมาชิกให้ลูกค้าที่เพิ่งสมัคร (แถวที่สี่ของทรานแซกชันเดียวกัน)
//
// ลูกค้าทุกคนเป็นสมาชิกตั้งแต่สมัคร — class diagram วาง Member เป็น subclass ของ Customer
// และหน้าสมัครของร้านก็เรียกตัวเองว่า "สมัครสมาชิก" อยู่แล้ว · เริ่มที่ระดับต่ำสุด แต้ม 0
func (s *PersonService) enroll(tx *gorm.DB, customer *model.Customer) error {
	tiers, err := s.members.ListTiers(tx)
	if err != nil {
		return err
	}
	tier := model.PickTier(tiers, 0)
	if tier == nil {
		return model.ErrTierNotFound
	}
	return s.members.CreateMember(tx, &model.Member{
		CustomerID: customer.CustomerID,
		JoinDate:   model.Today(),
		TierID:     tier.TierID,
	})
}

// buildRegistration — ตรวจข้อมูลที่กรอกแล้วประกอบเป็นสามแถวที่จะเขียนลงฐานข้อมูล
func (s *PersonService) buildRegistration(
	input RegisterInput,
) (*model.Person, *model.Customer, *model.UserAccount, error) {
	firstName := strings.TrimSpace(input.FirstName)
	lastName := strings.TrimSpace(input.LastName)
	email := strings.TrimSpace(input.Email)
	address := strings.TrimSpace(input.Address)

	if firstName == "" || lastName == "" || email == "" || address == "" {
		return nil, nil, nil, model.Validation("REQUIRED_FIELDS", "กรุณากรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมาย *")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, nil, nil, model.ErrInvalidEmail
	}
	if len(input.Password) < MinPasswordLength {
		return nil, nil, nil, model.ErrPasswordTooShort
	}

	// ไม่กรอกชื่อผู้ใช้ = ใช้อีเมลเป็นชื่อผู้ใช้ (หน้าสมัครของ frontend ถามแค่อีเมล)
	username := strings.TrimSpace(input.Username)
	if username == "" {
		username = email
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, nil, err
	}

	person := &model.Person{
		FirstName: firstName,
		LastName:  lastName,
		Phone:     strings.TrimSpace(input.Phone),
		Email:     email,
	}
	customer := &model.Customer{
		Address:        address,
		RegisteredDate: model.Today(),
	}
	account := &model.UserAccount{
		Username:     username,
		PasswordHash: string(hash),
		Status:       model.AccountStatusUnverified,
	}
	return person, customer, account, nil
}

// VerifyOtp — ยืนยันตัวตนแล้วเปิดใช้งานบัญชี (UserAccount.verifyOtp ใน class diagram)
func (s *PersonService) VerifyOtp(input VerifyOtpInput) (*model.UserAccount, error) {
	account, err := s.people.FindAccountByUsername(input.Email)
	if err != nil {
		return nil, err
	}
	if err := account.VerifyOtp(strings.TrimSpace(input.Otp)); err != nil {
		return nil, err
	}
	if err := s.people.SaveAccount(account); err != nil {
		return nil, err
	}
	return account, nil
}

// ── ข้อมูลลูกค้า ────────────────────────────────────────────────────────

func (s *PersonService) ListCustomers(filter repository.CustomerFilter) ([]repository.CustomerRow, error) {
	return s.people.ListCustomers(filter)
}

func (s *PersonService) GetCustomer(customerID int) (*repository.CustomerRow, error) {
	return s.people.FindCustomer(customerID)
}

// Profile — ข้อมูลของลูกค้าที่ล็อกอินอยู่
func (s *PersonService) Profile(current Identity) (*repository.CustomerRow, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}
	return s.people.FindCustomer(current.CustomerID)
}

// UpdateProfile — ลูกค้าแก้ชื่อ เบอร์ และที่อยู่จัดส่งของตัวเอง
// อีเมลแก้ไม่ได้เพราะเป็นกุญแจที่ใช้ล็อกอิน (แบบเดียวกับ companyName ของผู้จัดจำหน่ายใน U2)
func (s *PersonService) UpdateProfile(current Identity, input ProfileInput) (*repository.CustomerRow, error) {
	if !current.IsCustomer() {
		return nil, model.ErrForbidden
	}

	row, err := s.people.FindCustomer(current.CustomerID)
	if err != nil {
		return nil, err
	}

	firstName := strings.TrimSpace(input.FirstName)
	lastName := strings.TrimSpace(input.LastName)
	address := strings.TrimSpace(input.Address)
	if firstName == "" || lastName == "" {
		return nil, model.Validation("REQUIRED_FIELDS", "กรุณากรอกชื่อและนามสกุล")
	}
	if address == "" {
		address = row.Customer.Address
	}

	person := row.Person
	person.FirstName = firstName
	person.LastName = lastName
	person.Phone = strings.TrimSpace(input.Phone)

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.people.UpdatePerson(&person); err != nil {
			return err
		}
		return s.people.UpdateCustomerAddress(row.Customer.CustomerID, address)
	})
	if err != nil {
		return nil, err
	}
	return s.people.FindCustomer(current.CustomerID)
}

// ── บัญชีผู้ใช้ (ผู้จัดการร้าน) ─────────────────────────────────────────

// SuspendAccount — ระงับบัญชีลูกค้า
func (s *PersonService) SuspendAccount(accountID int) (*model.UserAccount, error) {
	return s.changeAccount(accountID, func(a *model.UserAccount) error { return a.Suspend() })
}

// ReactivateAccount — ปลดการระงับ
func (s *PersonService) ReactivateAccount(accountID int) (*model.UserAccount, error) {
	return s.changeAccount(accountID, func(a *model.UserAccount) error { return a.Reactivate() })
}

func (s *PersonService) changeAccount(
	accountID int, apply func(*model.UserAccount) error,
) (*model.UserAccount, error) {
	account, err := s.people.FindAccount(accountID)
	if err != nil {
		return nil, err
	}
	if err := apply(account); err != nil {
		return nil, err
	}
	if err := s.people.SaveAccount(account); err != nil {
		return nil, err
	}
	return account, nil
}
