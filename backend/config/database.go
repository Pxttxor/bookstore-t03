package config

import (
	"fmt"
	"log"

	"bookstore-t03/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// รับ cfg *Config ที่ผ่านการ Load มาจาก config.go
func ConnectDB(cfg *Config) {
	// ดึงค่าเชื่อมต่อ DB จากตัวแปร Config 
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Bangkok", 
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Failed to connect to database!\n", err)
	}

	log.Println("✅ Database connected successfully!")
	DB = database
}

// AutoMigrate ทำการสร้าง/อัปเดต Schema ของตารางใน Database อัตโนมัติจาก Model ทั้งหมด
func AutoMigrate() error {
	if DB == nil {
		return fmt.Errorf("database connection is not initialized")
	}
	return DB.AutoMigrate(
		&model.Book{},
		&model.Customer{},
		&model.SalesStaff{},
		&model.StoreManager{},
		&model.Promotion{},
		&model.Order{},
		&model.OrderItem{},
		&model.OrderStatusHistory{},
	)
}