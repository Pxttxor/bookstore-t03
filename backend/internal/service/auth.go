// Package service — กฎทางธุรกิจของ U1–U10 และการคุมขอบเขต transaction
//
// auth.go — เข้าสู่ระบบและออก JWT
package service

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

// Identity — ผู้ใช้ที่ล็อกอินอยู่ อ่านจาก JWT ในทุก request ที่ต้องยืนยันตัวตน
//
// พนักงานมี EmployeeID · ลูกค้ามี CustomerID · ทั้งสองฝ่ายมี PersonID เสมอ
// ระบบย่อยใหม่ที่ต้องบันทึกว่า "ใครทำรายการ" ให้ใช้ PersonID เป็น FK
type Identity struct {
	EmployeeID string     `json:"employeeId,omitempty"`
	CustomerID int        `json:"customerId,omitempty"`
	PersonID   int        `json:"personId"`
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Role       model.Role `json:"role"`
}

// IsCustomer — ตัวตนนี้เป็นลูกค้า ไม่ใช่พนักงานหลังร้าน
func (i Identity) IsCustomer() bool { return i.Role == model.RoleCustomer }

type AuthService struct {
	db     *gorm.DB
	people *repository.PersonRepository
	secret []byte
	ttl    time.Duration
}

func NewAuthService(db *gorm.DB, people *repository.PersonRepository,
	secret []byte, ttl time.Duration) *AuthService {
	return &AuthService{db: db, people: people, secret: secret, ttl: ttl}
}

// LoginResult — สิ่งที่ POST /api/auth/login ตอบกลับ
type LoginResult struct {
	Token string   `json:"token"`
	User  Identity `json:"user"`
}

// Login — ตรวจอีเมลกับรหัสผ่านแล้วออก token
//
// ไม่แยกข้อความระหว่าง "ไม่พบอีเมล" กับ "รหัสผ่านผิด" เพื่อไม่ให้เดาได้ว่าอีเมลไหนมีอยู่จริง
func (s *AuthService) Login(email, password string) (*LoginResult, error) {
	var employee model.Employee
	err := s.db.Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).
		First(&employee).Error
	switch {
	case err == nil:
		if bcrypt.CompareHashAndPassword([]byte(employee.PasswordHash), []byte(password)) != nil {
			return nil, model.ErrInvalidCredentials
		}
		return s.result(identityOf(employee))
	case errors.Is(err, gorm.ErrRecordNotFound):
		// ไม่ใช่พนักงาน — ลองหาในบัญชีลูกค้าต่อ
		return s.loginCustomer(email, password)
	default:
		return nil, err
	}
}

// loginCustomer — เข้าสู่ระบบด้วยบัญชีลูกค้า (กรอกชื่อผู้ใช้หรืออีเมลก็ได้)
//
// ต่างจากพนักงานตรงที่บัญชีลูกค้ามีสถานะ — ยังไม่ยืนยัน OTP หรือถูกระงับ จะเข้าไม่ได้
// กรณีนี้บอกสาเหตุตรง ๆ เพราะผู้ใช้ต้องรู้ว่าต้องไปยืนยันตัวตนก่อน ไม่ใช่การเดาบัญชี
func (s *AuthService) loginCustomer(username, password string) (*LoginResult, error) {
	account, err := s.people.FindAccountByUsername(username)
	if errors.Is(err, model.ErrAccountNotFound) {
		return nil, model.ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	if bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(password)) != nil {
		return nil, model.ErrInvalidCredentials
	}

	switch account.Status {
	case model.AccountStatusUnverified:
		return nil, model.ErrAccountNotVerified
	case model.AccountStatusSuspended:
		return nil, model.ErrAccountSuspended
	}

	identity, err := s.customerIdentity(account.PersonID)
	if err != nil {
		return nil, err
	}

	account.RecordLogin(time.Now())
	if err := s.people.SaveAccount(account); err != nil {
		return nil, err
	}
	return s.result(*identity)
}

// customerIdentity — ประกอบตัวตนของลูกค้าจาก person + customer
func (s *AuthService) customerIdentity(personID int) (*Identity, error) {
	person, err := s.people.FindPerson(personID)
	if err != nil {
		return nil, err
	}
	customer, err := s.people.FindCustomerByPersonID(personID)
	if err != nil {
		return nil, err
	}
	return &Identity{
		CustomerID: customer.CustomerID,
		PersonID:   person.PersonID,
		Name:       person.Name(),
		Email:      person.Email,
		Role:       model.RoleCustomer,
	}, nil
}

// result — ออก token ให้ตัวตนที่ตรวจผ่านแล้ว
func (s *AuthService) result(identity Identity) (*LoginResult, error) {
	token, err := s.issue(identity)
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: identity}, nil
}

// Me — ข้อมูลล่าสุดของเจ้าของ token (เผื่อบทบาทหรือชื่อถูกแก้หลังออก token)
func (s *AuthService) Me(current Identity) (*Identity, error) {
	if current.IsCustomer() {
		return s.customerIdentity(current.PersonID)
	}

	var employee model.Employee
	err := s.db.First(&employee, "employee_id = ?", current.EmployeeID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrEmployeeNotFound
	}
	if err != nil {
		return nil, err
	}
	identity := identityOf(employee)
	return &identity, nil
}

func identityOf(e model.Employee) Identity {
	return Identity{
		EmployeeID: e.EmployeeID,
		PersonID:   e.PersonID,
		Name:       e.Name(),
		Email:      e.Email,
		Role:       e.Role,
	}
}

func (s *AuthService) issue(identity Identity) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":   identity.EmployeeID, // ว่างสำหรับลูกค้า — ใช้ cid แทน
		"pid":   identity.PersonID,
		"cid":   identity.CustomerID,
		"name":  identity.Name,
		"email": identity.Email,
		"role":  string(identity.Role),
		"iat":   now.Unix(),
		"exp":   now.Add(s.ttl).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", err
	}
	return signed, nil
}

// Verify — ตรวจลายเซ็นและวันหมดอายุของ token แล้วคืนตัวตนที่อยู่ข้างใน
func (s *AuthService) Verify(raw string) (*Identity, error) {
	parsed, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("วิธีเซ็น token ไม่ถูกต้อง")
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !parsed.Valid {
		return nil, model.ErrUnauthenticated
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, model.ErrUnauthenticated
	}

	identity := Identity{
		EmployeeID: claimString(claims, "sub"),
		PersonID:   claimInt(claims, "pid"),
		CustomerID: claimInt(claims, "cid"),
		Name:       claimString(claims, "name"),
		Email:      claimString(claims, "email"),
		Role:       model.Role(claimString(claims, "role")),
	}
	if !identity.Role.IsValid() {
		return nil, model.ErrUnauthenticated
	}
	// พนักงานต้องมีรหัสพนักงาน · ลูกค้าต้องมีรหัสลูกค้า — ขาดไปคือ token ไม่สมบูรณ์
	if identity.IsCustomer() {
		if identity.CustomerID == 0 {
			return nil, model.ErrUnauthenticated
		}
	} else if identity.EmployeeID == "" {
		return nil, model.ErrUnauthenticated
	}
	return &identity, nil
}

func claimString(claims jwt.MapClaims, key string) string {
	if value, ok := claims[key].(string); ok {
		return value
	}
	return ""
}

// claimInt — ตัวเลขใน JWT ถูก unmarshal กลับมาเป็น float64 เสมอ
func claimInt(claims jwt.MapClaims, key string) int {
	if value, ok := claims[key].(float64); ok {
		return int(value)
	}
	return 0
}
