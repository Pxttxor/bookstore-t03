// Package config — ค่าตั้งต้นของเซิร์ฟเวอร์ อ่านจาก environment variable
//
// ค่าที่เป็นความลับ (DSN ของฐานข้อมูล, JWT secret) อยู่ในไฟล์ .env ซึ่ง .gitignore กันไม่ให้ขึ้น repo
// ดูตัวอย่างการตั้งค่าได้ที่ .env.example
package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   []byte
	TokenTTL    time.Duration
	// CORSOrigins — โดเมนของ frontend ที่เรียก API นี้ได้ (dev server ของ Vite คือ :5173)
	CORSOrigins []string
}

// Load — อ่านค่าจาก .env (ถ้ามี) แล้วทับด้วย environment variable ของ process
func Load() (*Config, error) {
	// ไม่มี .env ไม่ถือว่าผิด — บน production ตั้งค่าผ่าน environment ตรง ๆ
	_ = godotenv.Load()

	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		return nil, fmt.Errorf("ยังไม่ได้ตั้ง DATABASE_URL — คัดลอก .env.example เป็น .env แล้วกรอกค่าให้ครบ")
	}

	cfg := &Config{
		DatabaseURL: dsn,
		Port:        envOr("PORT", "8080"),
		TokenTTL:    12 * time.Hour,
		CORSOrigins: splitList(envOr("CORS_ORIGINS", "http://localhost:5173")),
	}

	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		// เครื่อง dev ที่ยังไม่ได้ตั้ง secret ให้สุ่มขึ้นมาใหม่ทุกครั้งที่บูต
		// ผลคือ token เดิมใช้ต่อไม่ได้หลังรีสตาร์ต ซึ่งเตือนให้ไปตั้งค่าจริง
		random := make([]byte, 32)
		if _, err := rand.Read(random); err != nil {
			return nil, fmt.Errorf("สุ่ม JWT secret ไม่สำเร็จ: %w", err)
		}
		secret = hex.EncodeToString(random)
		fmt.Println("[config] ยังไม่ได้ตั้ง JWT_SECRET — สุ่มค่าชั่วคราวให้ (token จะใช้ไม่ได้หลังรีสตาร์ต)")
	}
	cfg.JWTSecret = []byte(secret)

	if hours := os.Getenv("TOKEN_TTL_HOURS"); hours != "" {
		n, err := strconv.Atoi(hours)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("TOKEN_TTL_HOURS ต้องเป็นจำนวนเต็มบวก: %q", hours)
		}
		cfg.TokenTTL = time.Duration(n) * time.Hour
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func splitList(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
