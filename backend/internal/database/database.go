// Package database — เปิดการเชื่อมต่อ PostgreSQL ผ่าน GORM, สร้างตาราง และใส่ข้อมูลตั้งต้น
package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open — ต่อฐานข้อมูลตาม DSN แล้วตั้งค่า connection pool
func Open(dsn string) (*gorm.DB, error) {
	gormLogger := logger.New(
		log.New(os.Stdout, "[sql] ", log.LstdFlags),
		logger.Config{
			SlowThreshold: 300 * time.Millisecond,
			LogLevel:      logger.Warn,
			Colorful:      false,
			// ไม่ log ตอน "ไม่พบแถว" เพราะ service ถือว่าเป็นกรณีปกติ (คืน 404 ให้ผู้ใช้)
			IgnoreRecordNotFoundError: true,
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
		// ชื่อตารางกำหนดเองผ่าน TableName() ทุกคลาส ไม่ให้ GORM เติม s ท้ายชื่อ
		// เพื่อให้ \dt ตรงกับตาราง schema 15 แถวในเอกสารที่ส่งอาจารย์
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("ต่อฐานข้อมูลไม่สำเร็จ: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("อ่าน connection pool ไม่สำเร็จ: %w", err)
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping ฐานข้อมูลไม่ผ่าน: %w", err)
	}
	return db, nil
}
