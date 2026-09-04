// Command smoke — เดินสถานการณ์จริงของทุกระบบย่อยผ่าน API ที่รันอยู่ แล้วสรุปผลเป็น PASS/FAIL
//
//	go run ./cmd/api -migrate -seed     (หน้าต่างหนึ่ง)
//	go run ./cmd/smoke                  (อีกหน้าต่างหนึ่ง)
//
// ครอบทั้งเส้นทางปกติและเส้นทางผิดปกติของ Figma spec §6 ที่ต้องมีฐานข้อมูลจริงถึงจะตรวจได้
// (กฎที่อยู่ในชั้น model ล้วนตรวจด้วย go test ./... ไปแล้ว)
//
// ตัวเลือก: -base http://localhost:8080 (ค่าเริ่มต้น)
//
// หมายเหตุ: สคริปต์นี้เขียนข้อมูลจริงลงฐานข้อมูล — รันกับฐานข้อมูลทดสอบเท่านั้น
//
// เคสของแต่ละระบบย่อยอยู่ในไฟล์ flow_*.go ของตัวเอง — ห้ามตั้งชื่อลงท้าย _test.go
// เพราะ Go จะไม่คอมไพล์เข้า binary แล้วผลจะออกมา "ผ่าน 0 เคส" ซึ่งดูเหมือนผ่าน
package main

import (
	"flag"
	"fmt"
	"os"
)

var baseURL = flag.String("base", "http://localhost:8080", "ที่อยู่ของ API")

func main() {
	flag.Parse()

	fmt.Println("== ตรวจการทำงานของ API ร้านหนังสือออนไลน์ ==")
	fmt.Printf("   ปลายทาง: %s\n\n", *baseURL)

	if _, _, err := request("GET", "/api/health", "", nil); err != nil {
		fmt.Printf("ต่อ API ไม่ได้: %v\nสั่ง `go run ./cmd/api -migrate -seed` ก่อน แล้วรันใหม่\n", err)
		os.Exit(1)
	}

	e := &env{
		warehouse: login("warehouse@bookhaven.co.th"),
		manager:   login("manager@bookhaven.co.th"),
		sales:     login("sales@bookhaven.co.th"),
		delivery:  login("delivery@bookhaven.co.th"),
	}

	runPermissionFlow(e)
	runPersonFlow(e)
	runBookFlow(e)
	runCatalogueFlow(e)
	runInventoryFlow(e)
	runOrderFlow(e)
	runPaymentFlow(e)
	runDeliveryFlow(e)
	runMembershipFlow(e)
	runReviewFlow(e)
	runSupplierFlow(e)
	runPurchasingFlow(e)

	fmt.Printf("\n== สรุป: ผ่าน %d · ไม่ผ่าน %d ==\n", passed, failed)

	// ผ่าน 0 เคส = ไม่มี flow ไหนทำงานเลย ซึ่งเป็นการผ่านหลอก ๆ
	// (มักเกิดจากตั้งชื่อไฟล์ flow ผิดเป็น _test.go แล้ว Go ไม่คอมไพล์เข้า binary)
	if failed > 0 || passed == 0 {
		os.Exit(1)
	}
}
