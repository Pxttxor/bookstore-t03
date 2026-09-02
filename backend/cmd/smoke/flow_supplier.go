// flow_supplier.go — U1–U4 จัดการข้อมูลผู้จัดจำหน่าย
package main

import (
	"fmt"
	"time"
)

// runSupplierFlow — U1–U4 จัดการข้อมูลผู้จัดจำหน่าย
func runSupplierFlow(e *env) {
	warehouse, manager := e.warehouse, e.manager

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
}
