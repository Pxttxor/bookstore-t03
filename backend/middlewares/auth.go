package middlewares

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims โครงสร้างข้อมูลที่เก็บไว้ภายใน Token
type JWTClaims struct {
	UserID int    `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"` // customer, sales, manager, warehouse, delivery
	jwt.RegisteredClaims
}

// GenerateToken สร้าง JWT Token ใหม่สำหรับผู้ใช้
func GenerateToken(userID int, email string, role string, secret string, duration time.Duration) (string, error) {
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "default-dev-secret-key-12345"
		}
	}

	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// AuthRequired ตรวจสอบความถูกต้องของ JWT Token จาก Authorization Header
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "กรุณาแนบ Token เข้าสู่ระบบ (Authorization: Bearer <token>)"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "default-dev-secret-key-12345"
		}

		// ตรวจสอบและถอดรหัส JWT Token
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		})

		// หาก Token ไม่ถูกต้องหรือหมดอายุ
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token ไม่ถูกต้องหรือหมดอายุการใช้งาน"})
			c.Abort()
			return
		}

		// ดึงข้อมูล Claims ออกมาเก็บใน Gin Context เพื่อให้ Controller ดึงไปใช้ต่อได้
		if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("user_role", claims.Role)
		}

		c.Next()
	}
}

// AuthorizeRole ตรวจสอบสิทธิ์ (Role) ของผู้ใช้งานว่ามีสิทธิ์เรียกใช้ Endpoint นี้หรือไม่
func AuthorizeRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "ไม่พบข้อมูลสิทธิ์ของผู้ใช้งาน"})
			c.Abort()
			return
		}

		userRole, ok := roleVal.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "ข้อมูลสิทธิ์ผู้ใช้งานไม่ถูกต้อง"})
			c.Abort()
			return
		}

		// ตรวจสอบว่า Role ของ User อยู่ในชุดที่อนุญาตหรือไม่
		for _, allowed := range allowedRoles {
			if strings.EqualFold(userRole, allowed) {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("คุณไม่มีสิทธิ์เข้าถึง (ต้องใช้สิทธิ์: %s)", strings.Join(allowedRoles, ", ")),
		})
		c.Abort()
	}
}
