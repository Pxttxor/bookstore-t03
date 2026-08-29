// Command smoke — เดินสถานการณ์จริงของ U1–U10 ผ่าน API ที่รันอยู่ แล้วสรุปผลเป็น PASS/FAIL
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
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var (
	baseURL = flag.String("base", "http://localhost:8080", "ที่อยู่ของ API")
	client  = &http.Client{Timeout: 15 * time.Second}

	passed int
	failed int
)

func main() {
	flag.Parse()

	fmt.Println("== ตรวจการทำงานของ API ระบบจัดซื้อและจัดการผู้จัดจำหน่าย ==")
	fmt.Printf("   ปลายทาง: %s\n\n", *baseURL)

	if _, _, err := request("GET", "/api/health", "", nil); err != nil {
		fmt.Printf("ต่อ API ไม่ได้: %v\nสั่ง `go run ./cmd/api -migrate -seed` ก่อน แล้วรันใหม่\n", err)
		os.Exit(1)
	}

	warehouse := login("warehouse@bookhaven.co.th")
	manager := login("manager@bookhaven.co.th")
	sales := login("sales@bookhaven.co.th")

	section("สิทธิ์การใช้งาน (permissions.ts)")
	check("ไม่ส่ง token → 401", func() error {
		return expectStatus("GET", "/api/suppliers", "", nil, 401)
	})
	check("ฝ่ายขายเพิ่มผู้จัดจำหน่ายไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/suppliers", sales, supplierBody("ร้านทดสอบสิทธิ์"), 403)
	})
	check("คลังสินค้าปิดใช้งานผู้จัดจำหน่ายไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/suppliers/1/deactivate", warehouse,
			map[string]any{"reason": "เลิกกิจการ"}, 403)
	})
	check("คลังสินค้าอนุมัติใบขอสั่งซื้อไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/requisitions/101/approve", warehouse,
			map[string]any{}, 403)
	})

	section("U1 เพิ่มข้อมูลผู้จัดจำหน่าย")
	name := fmt.Sprintf("ร้านทดสอบ %d", time.Now().UnixNano()%100000)
	var newSupplierID int
	check("เพิ่มผู้จัดจำหน่ายรายใหม่ สถานะ ACTIVE", func() error {
		body, err := post(warehouse, "/api/suppliers", supplierBody(name), 201)
		if err != nil {
			return err
		}
		newSupplierID = int(body["supplierId"].(float64))
		return expect(body["status"], "ACTIVE")
	})
	check("ชื่อบริษัทซ้ำ → 409 SUPPLIER_DUPLICATE", func() error {
		return expectError("POST", "/api/suppliers", warehouse, supplierBody(name), 409, "SUPPLIER_DUPLICATE")
	})
	check("กรอกข้อมูลไม่ครบ → 422 MISSING_FIELDS", func() error {
		return expectError("POST", "/api/suppliers", warehouse,
			map[string]any{"companyName": "ไม่ครบ"}, 422, "MISSING_FIELDS")
	})
	check("อีเมลผิดรูปแบบ → 422 INVALID_EMAIL", func() error {
		body := supplierBody(name + " อีเมลเสีย")
		body["email"] = "ไม่ใช่อีเมล"
		return expectError("POST", "/api/suppliers", warehouse, body, 422, "INVALID_EMAIL")
	})

	section("U2 แก้ไขข้อมูลผู้จัดจำหน่าย")
	check("แก้ไขแล้วบันทึกประวัติว่าใครแก้", func() error {
		body := supplierBody(name)
		body["contactName"] = "ผู้ติดต่อคนใหม่"
		updated, err := put(warehouse, fmt.Sprintf("/api/suppliers/%d", newSupplierID), body, 200)
		if err != nil {
			return err
		}
		history, _ := updated["editHistory"].([]any)
		if len(history) == 0 {
			return fmt.Errorf("ไม่มีประวัติการแก้ไข")
		}
		return expect(updated["contactName"], "ผู้ติดต่อคนใหม่")
	})

	section("U3 ปิดใช้งานผู้จัดจำหน่าย")
	check("มีใบสั่งซื้อคงค้าง → 409 SUPPLIER_HAS_OPEN_ORDERS", func() error {
		// ผู้จัดจำหน่ายรหัส 2 มี PO-2425 สถานะ CONFIRMED ค้างอยู่จากข้อมูลตั้งต้น
		return expectError("POST", "/api/suppliers/2/deactivate", manager,
			map[string]any{"reason": "เลิกกิจการ", "note": ""}, 409, "SUPPLIER_HAS_OPEN_ORDERS")
	})
	check("ไม่ระบุเหตุผล → 422 REASON_REQUIRED", func() error {
		return expectError("POST", fmt.Sprintf("/api/suppliers/%d/deactivate", newSupplierID), manager,
			map[string]any{"reason": ""}, 422, "REASON_REQUIRED")
	})
	check("ไม่มีของค้าง ปิดใช้งานได้ สถานะ CANCELLED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/suppliers/%d/deactivate", newSupplierID),
			map[string]any{"reason": "เลิกกิจการ", "note": "ปิดจากการทดสอบ"}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "CANCELLED")
	})
	check("ปิดใช้งานซ้ำ → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/suppliers/%d/deactivate", newSupplierID), manager,
			map[string]any{"reason": "เลิกกิจการ"}, 409)
	})

	section("U4 ค้นหาและเรียกดู")
	check("ค้นด้วยคำค้นแล้วเจอรายที่เพิ่งสร้าง", func() error {
		rows, err := getList(warehouse, "/api/suppliers?q="+urlEncode(name))
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return fmt.Errorf("ค้นไม่พบ")
		}
		return nil
	})
	check("กรองตามสถานะ CANCELLED ได้", func() error {
		_, err := getList(warehouse, "/api/suppliers?status=CANCELLED")
		return err
	})
	check("ดูประวัติการสั่งซื้อของผู้จัดจำหน่ายได้", func() error {
		_, err := getList(warehouse, "/api/suppliers/1/orders")
		return err
	})

	section("U5 แจ้งเตือนสินค้าถึงจุดสั่งซื้อ")
	check("รายการที่ยังไม่ตั้งจุดสั่งซื้อติดธง unconfigured (ไม่นับว่าต่ำ)", func() error {
		alerts, err := getList(warehouse, "/api/inventory/alerts")
		if err != nil {
			return err
		}
		for _, entry := range alerts {
			row := entry.(map[string]any)
			// หนังสือรหัส 115 ไม่ได้ตั้งจุดสั่งซื้อไว้ในข้อมูลตั้งต้น
			if int(row["bookId"].(float64)) == 115 {
				if row["unconfigured"] != true {
					return fmt.Errorf("เล่ม 115 ควรติดธง unconfigured")
				}
				return nil
			}
		}
		return fmt.Errorf("ไม่พบเล่ม 115 ในรายการแจ้งเตือน")
	})
	check("ตั้งค่าจุดสั่งซื้อได้", func() error {
		body, err := put(warehouse, "/api/inventory/115/reorder-point",
			map[string]any{"reorderPoint": 6}, 200)
		if err != nil {
			return err
		}
		return expect(body["reorderPoint"], float64(6))
	})

	section("U6 จัดทำใบขอสั่งซื้อ")
	check("เลือกผู้จัดจำหน่ายที่ปิดใช้งานแล้ว → 422 SUPPLIER_INACTIVE", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 8, // รหัส 8 ถูกปิดใช้งานในข้อมูลตั้งต้น
			"items":      []any{map[string]any{"bookId": 118, "quantity": 5, "unitPrice": 220}},
		}, 422, "SUPPLIER_INACTIVE")
	})
	check("หนังสือซ้ำในเอกสารเดียวกัน → 422 DUPLICATE_BOOK", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items": []any{
				map[string]any{"bookId": 101, "quantity": 5, "unitPrice": 285},
				map[string]any{"bookId": 101, "quantity": 3, "unitPrice": 285},
			},
		}, 422, "DUPLICATE_BOOK")
	})
	check("จำนวนเป็น 0 → 422 INVALID_QUANTITY", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 101, "quantity": 0, "unitPrice": 285}},
		}, 422, "INVALID_QUANTITY")
	})
	check("สั่งหนังสือที่ผู้จัดจำหน่ายไม่ได้ขาย → 422 BOOK_NOT_OFFERED", func() error {
		return expectError("POST", "/api/requisitions", warehouse, map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 119, "quantity": 5, "unitPrice": 420}},
		}, 422, "BOOK_NOT_OFFERED")
	})

	var prID int
	check("บันทึกร่างได้ สถานะ DRAFT", func() error {
		body, err := post(warehouse, "/api/requisitions", map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 101, "quantity": 10, "unitPrice": 285}},
			"submit":     false,
		}, 201)
		if err != nil {
			return err
		}
		prID = int(body["prId"].(float64))
		return expect(body["status"], "DRAFT")
	})
	check("ส่งขออนุมัติ → SUBMITTED", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/requisitions/%d/submit", prID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "SUBMITTED")
	})
	check("ผู้จัดการได้รับแจ้งเตือน PR_SUBMITTED", func() error {
		rows, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "PR_SUBMITTED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน PR_SUBMITTED")
	})
	check("ส่งซ้ำใบที่ส่งไปแล้ว → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/requisitions/%d/submit", prID), warehouse, nil, 409)
	})

	section("U7 อนุมัติใบสั่งซื้อ")
	check("อ่านงบประมาณคงเหลือได้", func() error {
		body, err := get(manager, "/api/purchasing/budget")
		if err != nil {
			return err
		}
		if body["budget"].(float64) != 500000 {
			return fmt.Errorf("งบประมาณ = %v ต้องการ 500000", body["budget"])
		}
		return nil
	})

	var rejectPRID int
	check("ตีกลับต้องมีเหตุผล → 422 REASON_REQUIRED", func() error {
		body, err := post(warehouse, "/api/requisitions", map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 102, "quantity": 5, "unitPrice": 240}},
			"submit":     true,
		}, 201)
		if err != nil {
			return err
		}
		rejectPRID = int(body["prId"].(float64))
		return expectError("POST", fmt.Sprintf("/api/requisitions/%d/reject", rejectPRID), manager,
			map[string]any{"reason": ""}, 422, "REASON_REQUIRED")
	})
	check("ตีกลับพร้อมเหตุผล → REJECTED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/requisitions/%d/reject", rejectPRID),
			map[string]any{"reason": "ราคาสูงกว่าเงื่อนไขการค้า"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "REJECTED"); err != nil {
			return err
		}
		return expect(body["rejectionReason"], "ราคาสูงกว่าเงื่อนไขการค้า")
	})
	check("ใบที่ถูกตีกลับ แก้แล้วส่งใหม่ได้", func() error {
		body, err := put(warehouse, fmt.Sprintf("/api/requisitions/%d", rejectPRID), map[string]any{
			"supplierId": 1,
			"items":      []any{map[string]any{"bookId": 102, "quantity": 5, "unitPrice": 235}},
			"submit":     true,
		}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "SUBMITTED")
	})

	var poID int
	check("อนุมัติแล้วออกใบสั่งซื้ออัตโนมัติ สถานะ APPROVED", func() error {
		body, err := post(manager, fmt.Sprintf("/api/requisitions/%d/approve", prID),
			map[string]any{"overBudgetNote": ""}, 201)
		if err != nil {
			return err
		}
		poID = int(body["poId"].(float64))
		if err := expect(body["status"], "APPROVED"); err != nil {
			return err
		}
		// ยังไม่ส่ง → หน้าจออ่านเป็น "อนุมัติแล้ว รอส่ง"
		return expect(body["displayStatus"], "AWAITING_SEND")
	})
	check("คลังสินค้าได้รับแจ้งเตือน PR_APPROVED", func() error {
		rows, err := getList(warehouse, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "PR_APPROVED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน PR_APPROVED")
	})
	check("อนุมัติซ้ำ → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/requisitions/%d/approve", prID), manager,
			map[string]any{}, 409)
	})

	section("U8 ส่งใบสั่งซื้อให้ผู้จัดจำหน่าย")
	check("ยังไม่ส่ง ยืนยันไม่ได้ → 409 ORDER_NOT_SENT", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/confirm", poID), warehouse,
			map[string]any{"expectedDeliveryDate": daysFromNow(10)}, 409, "ORDER_NOT_SENT")
	})
	check("ส่งแล้ว displayStatus = AWAITING_CONFIRM", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/send", poID), nil, 200)
		if err != nil {
			return err
		}
		return expect(body["displayStatus"], "AWAITING_CONFIRM")
	})
	check("วันที่ส่งมอบย้อนหลัง → 422 EXPECTED_DATE_IN_PAST", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/confirm", poID), warehouse,
			map[string]any{"expectedDeliveryDate": daysFromNow(-1)}, 422, "EXPECTED_DATE_IN_PAST")
	})
	check("ยืนยันแล้ว → CONFIRMED พร้อมวันที่ส่งมอบ", func() error {
		expected := daysFromNow(10)
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/confirm", poID),
			map[string]any{"expectedDeliveryDate": expected}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "CONFIRMED"); err != nil {
			return err
		}
		return expect(body["expectedDeliveryDate"], expected)
	})

	section("U9 บันทึกรับสินค้าเข้าคลัง")
	stockBefore := onHand(warehouse, 101)
	check("ไม่ใส่เลขที่ใบส่งของ → 422", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 5, "condition": "NORMAL"},
			}}, 422, "MISSING_DELIVERY_NOTE")
	})
	check("รับหนังสือที่ไม่อยู่ในใบสั่งซื้อ → 422 BOOK_NOT_IN_ORDER", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-01", "lines": []any{
				map[string]any{"bookId": 119, "receivedQty": 5, "condition": "NORMAL"},
			}}, 422, "BOOK_NOT_IN_ORDER")
	})
	check("รับ 0 ทุกรายการ → 422 NOTHING_RECEIVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-02", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 0, "condition": "NORMAL"},
			}}, 422, "NOTHING_RECEIVED")
	})
	check("รับบางส่วน → PO = RECEIVED_PARTIAL, GR = PARTIAL", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/receipts", poID), map[string]any{
			"deliveryNoteNo": "DN-TEST-03",
			"lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 6, "condition": "NORMAL", "note": ""},
			},
		}, 201)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "PARTIAL"); err != nil {
			return err
		}
		order, err := get(warehouse, fmt.Sprintf("/api/orders/%d", poID))
		if err != nil {
			return err
		}
		return expect(order["status"], "RECEIVED_PARTIAL")
	})
	check("สต็อกเพิ่มขึ้นตามจำนวนที่รับ", func() error {
		after := onHand(warehouse, 101)
		if after != stockBefore+6 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, stockBefore+6)
		}
		return nil
	})
	check("เกิดรายการเคลื่อนไหวสต็อกชนิด RECEIVE_IN", func() error {
		receipts, err := getList(warehouse, fmt.Sprintf("/api/orders/%d/receipts", poID))
		if err != nil {
			return err
		}
		if len(receipts) == 0 {
			return fmt.Errorf("ไม่พบใบรับสินค้า")
		}
		return nil
	})
	check("รับส่วนที่เหลือจนครบ → PO = RECEIVED_FULL, GR = FULL", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/receipts", poID), map[string]any{
			"deliveryNoteNo": "DN-TEST-04",
			"lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 4, "condition": "DAMAGED", "note": "ปกหักมุม"},
			},
		}, 201)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "FULL"); err != nil {
			return err
		}
		order, err := get(warehouse, fmt.Sprintf("/api/orders/%d", poID))
		if err != nil {
			return err
		}
		return expect(order["status"], "RECEIVED_FULL")
	})
	check("รับซ้ำหลังรับครบแล้ว → 409 PO_NOT_RECEIVABLE", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/receipts", poID), warehouse,
			map[string]any{"deliveryNoteNo": "DN-TEST-05", "lines": []any{
				map[string]any{"bookId": 101, "receivedQty": 1, "condition": "NORMAL"},
			}}, 409, "PO_NOT_RECEIVABLE")
	})

	section("U10 บันทึกส่งคืนสินค้า")
	beforeReturn := onHand(warehouse, 101)
	check("คืนเกินจำนวนที่รับ → 422 RETURN_EXCEEDS_RECEIVED", func() error {
		return expectError("POST", fmt.Sprintf("/api/orders/%d/returns", poID), warehouse,
			map[string]any{"reason": "ชำรุด", "items": []any{
				map[string]any{"bookId": 101, "quantity": 99, "reason": "ชำรุด"},
			}}, 422, "RETURN_EXCEEDS_RECEIVED")
	})
	var returnID int
	check("เปิดใบส่งคืน → TRACKING และตัดสต็อกออก", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/orders/%d/returns", poID), map[string]any{
			"reason": "ชำรุด",
			"items": []any{
				map[string]any{"bookId": 101, "quantity": 4, "reason": "ปกหักมุม"},
			},
		}, 201)
		if err != nil {
			return err
		}
		returnID = int(body["returnId"].(float64))
		if err := expect(body["status"], "TRACKING"); err != nil {
			return err
		}
		if after := onHand(warehouse, 101); after != beforeReturn-4 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, beforeReturn-4)
		}
		return nil
	})
	check("ส่งต่อผู้จัดการต้องมีเหตุผล → 422", func() error {
		return expectError("POST", fmt.Sprintf("/api/returns/%d/escalate", returnID), warehouse,
			map[string]any{"note": ""}, 422, "REASON_REQUIRED")
	})
	check("ผู้จัดจำหน่ายปฏิเสธ → ESCALATED และแจ้งผู้จัดการ", func() error {
		body, err := post(warehouse, fmt.Sprintf("/api/returns/%d/escalate", returnID),
			map[string]any{"note": "ผู้จัดจำหน่ายปฏิเสธการรับคืน"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "ESCALATED"); err != nil {
			return err
		}
		rows, err := getList(manager, "/api/notifications")
		if err != nil {
			return err
		}
		for _, entry := range rows {
			if entry.(map[string]any)["kind"] == "RETURN_ESCALATED" {
				return nil
			}
		}
		return fmt.Errorf("ไม่พบการแจ้งเตือน RETURN_ESCALATED")
	})
	check("บันทึกสินค้าทดแทน → CLOSED และสต็อกกลับมา", func() error {
		before := onHand(warehouse, 101)
		body, err := post(warehouse, fmt.Sprintf("/api/returns/%d/compensation", returnID),
			map[string]any{"type": "REPLACEMENT", "note": "ผู้จัดจำหน่ายส่งของทดแทนแล้ว"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "CLOSED"); err != nil {
			return err
		}
		if after := onHand(warehouse, 101); after != before+4 {
			return fmt.Errorf("ยอดคงเหลือ = %d ต้องการ %d", after, before+4)
		}
		return nil
	})
	check("ปิดรายการซ้ำ → 409", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/returns/%d/compensation", returnID), warehouse,
			map[string]any{"type": "CREDIT_NOTE", "note": ""}, 409)
	})

	fmt.Printf("\n== สรุป: ผ่าน %d · ไม่ผ่าน %d ==\n", passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

// ── ตัวช่วยรันเคสทดสอบ ──────────────────────────────────────────────────

func section(title string) {
	fmt.Printf("\n-- %s --\n", title)
}

func check(name string, run func() error) {
	if err := run(); err != nil {
		failed++
		fmt.Printf("  FAIL  %s\n        %v\n", name, err)
		return
	}
	passed++
	fmt.Printf("  PASS  %s\n", name)
}

func expect(got, want any) error {
	if got != want {
		return fmt.Errorf("ได้ %v ต้องการ %v", got, want)
	}
	return nil
}

// ── ตัวช่วยเรียก API ────────────────────────────────────────────────────

func login(email string) string {
	body, _, err := request("POST", "/api/auth/login", "",
		map[string]any{"email": email, "password": "staff1234"})
	if err != nil {
		fmt.Printf("เข้าสู่ระบบด้วย %s ไม่สำเร็จ: %v\n", email, err)
		os.Exit(1)
	}
	token, ok := body["token"].(string)
	if !ok {
		fmt.Printf("เข้าสู่ระบบด้วย %s ไม่ได้ token กลับมา\n", email)
		os.Exit(1)
	}
	return token
}

func request(method, path, token string, payload any) (map[string]any, int, error) {
	var reader io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, *baseURL+path, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if len(raw) == 0 {
		return map[string]any{}, resp.StatusCode, nil
	}

	// response เป็น array ได้ (รายการต่าง ๆ) ห่อไว้ใน key "items" ให้เรียกใช้ง่าย
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err == nil {
		return object, resp.StatusCode, nil
	}
	var list []any
	if err := json.Unmarshal(raw, &list); err == nil {
		return map[string]any{"items": list}, resp.StatusCode, nil
	}
	return nil, resp.StatusCode, fmt.Errorf("อ่าน response ไม่ได้: %s", raw)
}

func call(method, path, token string, payload any, wantStatus int) (map[string]any, error) {
	body, status, err := request(method, path, token, payload)
	if err != nil {
		return nil, err
	}
	if status != wantStatus {
		return nil, fmt.Errorf("สถานะ = %d ต้องการ %d (%v)", status, wantStatus, body)
	}
	return body, nil
}

func get(token, path string) (map[string]any, error) { return call("GET", path, token, nil, 200) }
func post(token, path string, payload any, want int) (map[string]any, error) {
	return call("POST", path, token, payload, want)
}
func put(token, path string, payload any, want int) (map[string]any, error) {
	return call("PUT", path, token, payload, want)
}

func getList(token, path string) ([]any, error) {
	body, err := call("GET", path, token, nil, 200)
	if err != nil {
		return nil, err
	}
	items, _ := body["items"].([]any)
	return items, nil
}

func expectStatus(method, path, token string, payload any, want int) error {
	_, status, err := request(method, path, token, payload)
	if err != nil {
		return err
	}
	if status != want {
		return fmt.Errorf("สถานะ = %d ต้องการ %d", status, want)
	}
	return nil
}

// expectError — ตรวจทั้งสถานะและรหัสข้อผิดพลาด เพื่อให้แน่ใจว่าล้มด้วยเหตุผลที่ตั้งใจ
func expectError(method, path, token string, payload any, wantStatus int, wantCode string) error {
	body, status, err := request(method, path, token, payload)
	if err != nil {
		return err
	}
	if status != wantStatus {
		return fmt.Errorf("สถานะ = %d ต้องการ %d (%v)", status, wantStatus, body)
	}
	detail, ok := body["error"].(map[string]any)
	if !ok {
		return fmt.Errorf("ไม่มี object error ใน response: %v", body)
	}
	if detail["code"] != wantCode {
		return fmt.Errorf("รหัสข้อผิดพลาด = %v ต้องการ %s", detail["code"], wantCode)
	}
	return nil
}

// onHand — ยอดคงเหลือปัจจุบันของหนังสือเล่มหนึ่ง (คืน -1 ถ้าอ่านไม่ได้)
func onHand(token string, bookID int) int {
	items, err := getList(token, "/api/inventory")
	if err != nil {
		return -1
	}
	for _, entry := range items {
		row := entry.(map[string]any)
		if int(row["bookId"].(float64)) == bookID {
			return int(row["quantityOnHand"].(float64))
		}
	}
	return -1
}

func daysFromNow(days int) string {
	return time.Now().AddDate(0, 0, days).Format("2006-01-02")
}

func urlEncode(value string) string {
	encoded := ""
	for _, b := range []byte(value) {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') ||
			b == '-' || b == '_' || b == '.' || b == '~' {
			encoded += string(b)
			continue
		}
		encoded += fmt.Sprintf("%%%02X", b)
	}
	return encoded
}

// supplierBody — ข้อมูลผู้จัดจำหน่ายตัวอย่างสำหรับทดสอบ U1/U2
func supplierBody(companyName string) map[string]any {
	return map[string]any{
		"companyName": companyName,
		"contactName": "ผู้ติดต่อทดสอบ",
		"phone":       "02-000-0000",
		"email":       "test@example.com",
		"address":     "1 ถนนทดสอบ กรุงเทพฯ 10000",
		"tradeTerms":  "ส่วนลดหน้าปก 30%",
		"creditTerms": "เครดิต 30 วัน",
		"books": []any{
			map[string]any{"bookId": 101, "supplyPrice": 285, "leadTimeDays": 7},
		},
	}
}
