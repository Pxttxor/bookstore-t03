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
)

// Identity — ผู้ใช้ที่ล็อกอินอยู่ อ่านจาก JWT ในทุก request ที่ต้องยืนยันตัวตน
type Identity struct {
	EmployeeID string     `json:"employeeId"`
	Name       string     `json:"name"`
	Email      string     `json:"email"`
	Role       model.Role `json:"role"`
}

type AuthService struct {
	db     *gorm.DB
	secret []byte
	ttl    time.Duration
}

func NewAuthService(db *gorm.DB, secret []byte, ttl time.Duration) *AuthService {
	return &AuthService{db: db, secret: secret, ttl: ttl}
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
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, model.ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}

	if bcrypt.CompareHashAndPassword([]byte(employee.PasswordHash), []byte(password)) != nil {
		return nil, model.ErrInvalidCredentials
	}

	identity := identityOf(employee)
	token, err := s.issue(identity)
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: identity}, nil
}

// Me — ข้อมูลพนักงานล่าสุดของ token ที่ส่งมา (เผื่อบทบาทถูกแก้หลังออก token)
func (s *AuthService) Me(employeeID string) (*Identity, error) {
	var employee model.Employee
	err := s.db.First(&employee, "employee_id = ?", employeeID).Error
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
	return Identity{EmployeeID: e.EmployeeID, Name: e.Name(), Email: e.Email, Role: e.Role}
}

func (s *AuthService) issue(identity Identity) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":   identity.EmployeeID,
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
		Name:       claimString(claims, "name"),
		Email:      claimString(claims, "email"),
		Role:       model.Role(claimString(claims, "role")),
	}
	if identity.EmployeeID == "" || !identity.Role.IsValid() {
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
