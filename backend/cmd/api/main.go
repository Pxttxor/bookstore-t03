// Command api — เซิร์ฟเวอร์ REST ของระบบจัดการผู้จัดจำหน่าย (U1–U4) และระบบจัดซื้อ (U5–U10)
//
//	go run ./cmd/api -migrate -seed   สร้าง schema + ใส่ข้อมูลตั้งต้น แล้วเปิดเซิร์ฟเวอร์
//	go run ./cmd/api                  เปิดเซิร์ฟเวอร์เฉย ๆ
//
// ค่าตั้งต้นอ่านจากไฟล์ .env (ดูตัวอย่างที่ .env.example)
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bookstore-t03/internal/config"
	"bookstore-t03/internal/database"
	"bookstore-t03/internal/handler"
	"bookstore-t03/internal/repository"
	"bookstore-t03/internal/service"
)

func main() {
	migrate := flag.Bool("migrate", false, "สร้าง/อัปเดต schema ก่อนเปิดเซิร์ฟเวอร์")
	seed := flag.Bool("seed", false, "ใส่ข้อมูลตั้งต้นถ้าฐานข้อมูลยังว่าง")
	exitAfterSetup := flag.Bool("setup-only", false, "ทำ migrate/seed แล้วจบ ไม่ต้องเปิดเซิร์ฟเวอร์")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("อ่านค่าตั้งต้นไม่สำเร็จ: %v", err)
	}

	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("%v", err)
	}

	if *migrate {
		if err := database.Migrate(db); err != nil {
			log.Fatalf("%v", err)
		}
		log.Println("[migrate] สร้าง schema เรียบร้อย")
	}
	if *seed {
		if err := database.Seed(db); err != nil {
			log.Fatalf("%v", err)
		}
	}
	if *exitAfterSetup {
		return
	}

	supplierRepo := repository.NewSupplierRepository(db)
	purchasingRepo := repository.NewPurchasingRepository(db)
	inventoryRepo := repository.NewInventoryRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)

	authService := service.NewAuthService(db, cfg.JWTSecret, cfg.TokenTTL)
	supplierService := service.NewSupplierService(db, supplierRepo, purchasingRepo, inventoryRepo)
	purchasingService := service.NewPurchasingService(db, purchasingRepo, supplierRepo, inventoryRepo, notificationRepo)

	api := handler.New(authService, supplierService, purchasingService, inventoryRepo, notificationRepo)
	routes := api.Routes(handler.RouteConfig{Auth: authService, CORSOrigins: cfg.CORSOrigins})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           routes,
		ReadHeaderTimeout: 10 * time.Second,
		// การแนบรูปหลักฐานใน U10 เป็น data URL ซึ่ง body ใหญ่กว่าปกติ จึงให้เวลาเขียนนานหน่อย
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("เปิดเซิร์ฟเวอร์ที่ http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("เซิร์ฟเวอร์หยุดทำงาน: %v", err)
		}
	}()

	// ปิดอย่างนุ่มนวล ให้ request ที่ค้างอยู่ทำงานจบก่อน
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("กำลังปิดเซิร์ฟเวอร์...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("ปิดเซิร์ฟเวอร์ไม่เรียบร้อย: %v", err)
	}
}
