package config

import (
	"log"

	"bookstore-t03/model"
)

// SeedDatabase ทำหน้าที่ใส่ข้อมูลลง Database หากพบว่าตารางว่างอยู่
// ฟังก์ชันนี้จะถูกเรียกใน main.go หลังจากทำ AutoMigrate เสร็จ
func SeedDatabase() {
	if DB == nil {
		log.Println("⚠️ Cannot seed database: DB connection is nil")
		return
	}

	log.Println("🌱 Checking database records for seeding...")

	// 1. Seed ข้อมูลหนังสือเริ่มต้น
	var bookCount int64
	DB.Model(&model.Book{}).Count(&bookCount)
	if bookCount == 0 {
		books := []model.Book{
			{BookID: 101, Title: "เรียน Go ให้สนุก", Price: 350, Status: model.BookStatusActive},
			{BookID: 102, Title: "ออกแบบระบบ", Price: 250, Status: model.BookStatusActive},
		}
		DB.Create(&books)
		log.Println("✅ Seeded Initial Books")
	}

	// 2. Seed ข้อมูลโปรโมชั่นเริ่มต้น
	var promoCount int64
	DB.Model(&model.Promotion{}).Count(&promoCount)
	if promoCount == 0 {
		promotions := []model.Promotion{
			{
				PromotionID:     1,
				Name:            "ลดเทศกาลหนังสือ 10%",
				Type:            model.PromotionTypeFestivalDiscount,
				DiscountValue:   10,
				IsPercent:       true,
				MinQty:          1,
				MinAmount:       100,
				Status:          model.PromotionStatusActive,
			},
		}
		DB.Create(&promotions)
		log.Println("✅ Seeded Initial Promotions")
	}

	log.Println("🌱 Seeding finished")
}

