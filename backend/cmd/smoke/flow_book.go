// flow_book.go — ระบบย่อยข้อมูลหนังสือ (Category · Book · BookChangeLog)
//
// เพิ่ม/แก้ไข/ปิดการขาย/ค้นหา รวมทั้งประวัติการแก้ไขที่ต้องเกิดทีละฟิลด์ที่เปลี่ยนจริง
// และแถวสินค้าคงคลังที่ต้องถูกเปิดให้หนังสือเล่มใหม่โดยอัตโนมัติ
package main

import (
	"fmt"
	"time"
)

// bookBody — ฟอร์มหนังสือตัวอย่าง
func bookBody(isbn, title string, price float64, categoryID int) map[string]any {
	return map[string]any{
		"isbn":        isbn,
		"title":       title,
		"author":      "ผู้แต่งทดสอบ",
		"publisher":   "สำนักพิมพ์ทดสอบ",
		"price":       price,
		"description": "หนังสือสำหรับทดสอบระบบ",
		"categoryId":  categoryID,
		"status":      "ACTIVE",
	}
}

// changeLogCount — จำนวนแถวประวัติการแก้ไขของหนังสือเล่มหนึ่ง (คืน -1 ถ้าอ่านไม่ได้)
func changeLogCount(token string, bookID int) int {
	items, err := getList(token, fmt.Sprintf("/api/books/%d/change-logs", bookID))
	if err != nil {
		return -1
	}
	return len(items)
}

// runBookFlow — ข้อมูลหนังสือและหมวดหมู่
func runBookFlow(e *env) {
	warehouse, sales := e.warehouse, e.sales

	// ISBN ต้องไม่ซ้ำทุกรอบ ไม่งั้นรัน smoke ซ้ำจะติด ISBN_TAKEN ตั้งแต่เคสแรก
	isbn := fmt.Sprintf("978-616-%06d", time.Now().UnixNano()%1000000)

	section("แคตตาล็อกและหมวดหมู่ (ข้อมูลตั้งต้น)")
	check("อ่านหมวดหมู่ได้ครบ 6 หมวด", func() error {
		items, err := getList(sales, "/api/categories")
		if err != nil {
			return err
		}
		return expect(len(items), 6)
	})
	check("หนังสือมีชื่อหมวดหมู่ติดมาด้วย ไม่ใช่แค่ FK", func() error {
		body, err := get(sales, "/api/books/101")
		if err != nil {
			return err
		}
		if err := expect(body["categoryId"], float64(2)); err != nil {
			return err
		}
		return expect(body["categoryName"], "พัฒนาตนเอง")
	})
	check("หนังสือมีป้ายสถานะไทยติดมาด้วย", func() error {
		body, err := get(sales, "/api/books/101")
		if err != nil {
			return err
		}
		return expect(body["statusLabel"], "ใช้งาน")
	})
	check("ประวัติการแก้ไขตั้งต้นของเล่ม 101 มีอย่างน้อย 1 แถว", func() error {
		items, err := getList(sales, "/api/books/101/change-logs")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("ไม่มีประวัติการแก้ไขตั้งต้น")
		}
		// แถวเก่าสุดคือของ seed — ประวัติเรียงใหม่สุดขึ้นก่อน
		oldest := items[len(items)-1].(map[string]any)
		if err := expect(oldest["changedField"], "price"); err != nil {
			return err
		}
		return expect(oldest["fieldLabel"], "ราคาปก")
	})
	check("คลังสินค้าอ่านแคตตาล็อกได้ (U5–U10 ต้องใช้ชื่อเรื่อง)", func() error {
		items, err := getList(warehouse, "/api/books")
		if err != nil {
			return err
		}
		if len(items) < 23 {
			return fmt.Errorf("ได้หนังสือ %d เล่ม ต้องอย่างน้อย 23", len(items))
		}
		return nil
	})

	section("เพิ่มหนังสือ (Book.add)")
	var bookID int
	check("ฝ่ายขายเพิ่มหนังสือใหม่ได้ สถานะ ACTIVE", func() error {
		body, err := post(sales, "/api/books", bookBody(isbn, "หนังสือทดสอบระบบ", 350, 2), 201)
		if err != nil {
			return err
		}
		bookID = int(body["bookId"].(float64))
		if err := expect(body["status"], "ACTIVE"); err != nil {
			return err
		}
		return expect(body["categoryName"], "พัฒนาตนเอง")
	})
	check("หนังสือเล่มใหม่ได้แถวสินค้าคงคลังยอด 0 ทันที", func() error {
		return expect(onHand(warehouse, bookID), 0)
	})
	check("ISBN ซ้ำ → 409 ISBN_TAKEN", func() error {
		return expectError("POST", "/api/books", sales,
			bookBody(isbn, "อีกเล่มที่ใช้ ISBN เดิม", 200, 1), 409, "ISBN_TAKEN")
	})
	check("กรอกข้อมูลไม่ครบ → 422 MISSING_FIELDS", func() error {
		body := bookBody(isbn+"-x", "", 350, 2)
		return expectError("POST", "/api/books", sales, body, 422, "MISSING_FIELDS")
	})
	check("อ้างหมวดหมู่ที่ไม่มีอยู่ → 404 CATEGORY_NOT_FOUND", func() error {
		return expectError("POST", "/api/books", sales,
			bookBody(isbn+"-y", "หมวดหมู่ผิด", 350, 999), 404, "CATEGORY_NOT_FOUND")
	})
	check("คลังสินค้าเพิ่มหนังสือไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/books", warehouse,
			bookBody(isbn+"-z", "คลังเพิ่มเอง", 350, 2), 403)
	})
	check("ลูกค้าเพิ่มหนังสือไม่ได้ → 403", func() error {
		return expectStatus("POST", "/api/books", e.customer,
			bookBody(isbn+"-c", "ลูกค้าเพิ่มเอง", 350, 2), 403)
	})

	section("แก้ไขหนังสือ (Book.update) และประวัติการแก้ไข")
	check("แก้ราคาแล้วเกิดประวัติหนึ่งแถว บันทึกค่าเดิม→ค่าใหม่", func() error {
		before := changeLogCount(sales, bookID)
		if _, err := put(sales, fmt.Sprintf("/api/books/%d", bookID),
			bookBody(isbn, "หนังสือทดสอบระบบ", 299, 2), 200); err != nil {
			return err
		}
		items, err := getList(sales, fmt.Sprintf("/api/books/%d/change-logs", bookID))
		if err != nil {
			return err
		}
		if len(items) != before+1 {
			return fmt.Errorf("ประวัติเพิ่มขึ้น %d แถว ต้องการ 1", len(items)-before)
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["changedField"], "price"); err != nil {
			return err
		}
		if err := expect(latest["oldValue"], "350"); err != nil {
			return err
		}
		return expect(latest["newValue"], "299")
	})
	check("แก้โดยไม่เปลี่ยนค่าอะไรเลย ไม่เกิดประวัติเพิ่ม", func() error {
		before := changeLogCount(sales, bookID)
		if _, err := put(sales, fmt.Sprintf("/api/books/%d", bookID),
			bookBody(isbn, "หนังสือทดสอบระบบ", 299, 2), 200); err != nil {
			return err
		}
		return expect(changeLogCount(sales, bookID), before)
	})
	check("เปลี่ยนหมวดหมู่ ประวัติเก็บเป็นชื่อหมวดหมู่ไม่ใช่ตัวเลข", func() error {
		if _, err := put(sales, fmt.Sprintf("/api/books/%d", bookID),
			bookBody(isbn, "หนังสือทดสอบระบบ", 299, 1), 200); err != nil {
			return err
		}
		items, err := getList(sales, fmt.Sprintf("/api/books/%d/change-logs", bookID))
		if err != nil {
			return err
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["oldValue"], "พัฒนาตนเอง"); err != nil {
			return err
		}
		return expect(latest["newValue"], "วรรณกรรมและนวนิยาย")
	})
	check("ใช้ ISBN ของเล่มอื่น → 409 ISBN_TAKEN", func() error {
		return expectError("PUT", fmt.Sprintf("/api/books/%d", bookID), sales,
			bookBody("978-616-0001-01", "หนังสือทดสอบระบบ", 299, 1), 409, "ISBN_TAKEN")
	})
	check("แก้หนังสือที่ไม่มีอยู่ → 404 BOOK_NOT_FOUND", func() error {
		return expectError("PUT", "/api/books/999999", sales,
			bookBody(isbn+"-none", "ไม่มีเล่มนี้", 100, 1), 404, "BOOK_NOT_FOUND")
	})

	section("เปิด/ปิดการขาย")
	check("ปิดการขาย → INACTIVE และประวัติเก็บป้ายไทย", func() error {
		body, err := post(sales, fmt.Sprintf("/api/books/%d/status", bookID),
			map[string]any{"status": "INACTIVE"}, 200)
		if err != nil {
			return err
		}
		if err := expect(body["status"], "INACTIVE"); err != nil {
			return err
		}
		items, err := getList(sales, fmt.Sprintf("/api/books/%d/change-logs", bookID))
		if err != nil {
			return err
		}
		latest := items[0].(map[string]any)
		if err := expect(latest["changedField"], "status"); err != nil {
			return err
		}
		if err := expect(latest["oldValue"], "ใช้งาน"); err != nil {
			return err
		}
		return expect(latest["newValue"], "ปิดการขาย")
	})
	check("กรองตามสถานะ INACTIVE เจอเล่มที่เพิ่งปิดการขาย", func() error {
		items, err := getList(sales, "/api/books?status=INACTIVE")
		if err != nil {
			return err
		}
		found := false
		for _, entry := range items {
			row := entry.(map[string]any)
			if got := row["status"]; got != "INACTIVE" {
				return fmt.Errorf("มีเล่มสถานะ %v หลุดมาในผลกรอง", got)
			}
			if int(row["bookId"].(float64)) == bookID {
				found = true
			}
		}
		if !found {
			return fmt.Errorf("ไม่พบเล่มที่เพิ่งปิดการขายในผลกรอง (%d เล่ม)", len(items))
		}
		return nil
	})
	check("สถานะนอก enum → 422 INVALID_BOOK_STATUS", func() error {
		return expectError("POST", fmt.Sprintf("/api/books/%d/status", bookID), sales,
			map[string]any{"status": "SOLD_OUT"}, 422, "INVALID_BOOK_STATUS")
	})
	check("คลังสินค้าปิดการขายไม่ได้ → 403", func() error {
		return expectStatus("POST", fmt.Sprintf("/api/books/%d/status", bookID), warehouse,
			map[string]any{"status": "ACTIVE"}, 403)
	})
	check("เปิดการขายกลับ → ACTIVE", func() error {
		body, err := post(sales, fmt.Sprintf("/api/books/%d/status", bookID),
			map[string]any{"status": "ACTIVE"}, 200)
		if err != nil {
			return err
		}
		return expect(body["status"], "ACTIVE")
	})

	section("ค้นหาหนังสือ (Book.search)")
	check("ค้นด้วย ISBN เจอเฉพาะเล่มที่เพิ่งสร้าง", func() error {
		items, err := getList(sales, "/api/books?q="+urlEncode(isbn))
		if err != nil {
			return err
		}
		if len(items) != 1 {
			return fmt.Errorf("ค้นแล้วได้ %d เล่ม ต้องการ 1", len(items))
		}
		return expect(int(items[0].(map[string]any)["bookId"].(float64)), bookID)
	})
	check("กรองตามหมวดหมู่ได้เฉพาะเล่มในหมวดนั้น", func() error {
		items, err := getList(sales, "/api/books?categoryId=5")
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return fmt.Errorf("หมวดตำราและวิชาการต้องมีหนังสืออยู่")
		}
		for _, entry := range items {
			if got := entry.(map[string]any)["categoryId"]; got != float64(5) {
				return fmt.Errorf("มีเล่มนอกหมวดหลุดมา: categoryId = %v", got)
			}
		}
		return nil
	})
}
