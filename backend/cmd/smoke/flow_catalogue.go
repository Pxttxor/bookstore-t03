// flow_catalogue.go — แคตตาล็อกหน้าร้าน (เส้นทางสาธารณะ)
//
// เคสทั้งหมดเรียกด้วย token ว่าง เพราะจุดสำคัญของเส้นทางชุดนี้คือ "คนยังไม่ล็อกอินก็ต้องอ่านได้"
// ถ้าเผลอย้ายไปลงทะเบียนผ่าน register() เมื่อไร เคสแรกจะ FAIL ด้วย 401 ทันที
//
// จงใจไม่ตรวจ "จำนวนเล่มรวม" เพราะ runBookFlow สร้างหนังสือเล่มใหม่ทุกรอบและไม่ได้ลบทิ้ง
// จึงตรวจเป็นเซ็ต: รหัสที่ seed ไว้ว่าขายอยู่ต้องมาครบ 22 ตัว และเล่มที่ปิดการขายต้องไม่มา
package main

import (
	"fmt"
)

// seededActiveBooks — รหัสหนังสือที่ข้อมูลตั้งต้นกำหนดว่าขายอยู่ (101–123 ยกเว้น 118)
func seededActiveBooks() []int {
	ids := make([]int, 0, 22)
	for id := 101; id <= 123; id++ {
		if id == 118 { // ปิดการขาย — สำนักพิมพ์เลิกกิจการ
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

// catalogueByID — แคตตาล็อกทั้งชุด แปลงเป็นแผนที่ bookId → แถว
func catalogueByID() (map[int]map[string]any, error) {
	items, err := getList("", "/api/catalogue")
	if err != nil {
		return nil, err
	}
	index := make(map[int]map[string]any, len(items))
	for _, entry := range items {
		row, ok := entry.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("แถวในแคตตาล็อกไม่ใช่ object: %v", entry)
		}
		index[int(row["bookId"].(float64))] = row
	}
	return index, nil
}

// runCatalogueFlow — แคตตาล็อกที่หน้าร้านอ่าน
func runCatalogueFlow(e *env) {
	warehouse := e.warehouse

	section("แคตตาล็อกหน้าร้าน (ไม่ต้องล็อกอิน)")

	check("อ่านแคตตาล็อกได้โดยไม่มี token", func() error {
		return expectStatus("GET", "/api/catalogue", "", nil, 200)
	})
	check("อ่านหมวดหมู่ได้โดยไม่มี token ครบ 6 หมวด", func() error {
		items, err := getList("", "/api/catalogue/categories")
		if err != nil {
			return err
		}
		return expect(len(items), 6)
	})
	check("หนังสือที่ขายอยู่มาครบทั้ง 22 เล่มของข้อมูลตั้งต้น", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		for _, id := range seededActiveBooks() {
			if _, ok := index[id]; !ok {
				return fmt.Errorf("ไม่พบหนังสือรหัส %d ในแคตตาล็อก", id)
			}
		}
		return nil
	})
	check("เล่มที่ปิดการขาย (118) ไม่โผล่ในแคตตาล็อก", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		if _, ok := index[118]; ok {
			return fmt.Errorf("เล่ม 118 ปิดการขายอยู่แต่ยังโผล่หน้าร้าน")
		}
		return nil
	})

	section("แคตตาล็อกต้องตรงกับตาราง book และ inventory_item")

	check("ราคาเป็นบาทตรงกับตาราง book (เล่ม 101 = 438)", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		if err := expect(index[101]["price"], float64(438)); err != nil {
			return err
		}
		return expect(index[101]["categoryName"], "พัฒนาตนเอง")
	})
	check("ยอดคงเหลือทุกเล่มตรงกับ /api/inventory", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		items, err := getList(warehouse, "/api/inventory")
		if err != nil {
			return err
		}
		for _, entry := range items {
			item := entry.(map[string]any)
			bookID := int(item["bookId"].(float64))
			row, ok := index[bookID]
			if !ok {
				continue // เล่มที่ปิดการขายไม่อยู่ในแคตตาล็อก ไม่ต้องเทียบ
			}
			if row["quantityOnHand"] != item["quantityOnHand"] {
				return fmt.Errorf("เล่ม %d: หน้าร้าน %v แต่คลัง %v",
					bookID, row["quantityOnHand"], item["quantityOnHand"])
			}
		}
		return nil
	})
	check("ระดับสต็อกคำนวณตรงกับยอดคงเหลือ", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		for id, row := range index {
			qty := int(row["quantityOnHand"].(float64))
			want := "OK"
			switch {
			case qty == 0:
				want = "OUT"
			case qty < 10:
				want = "LOW"
			}
			if row["stockLevel"] != want {
				return fmt.Errorf("เล่ม %d: ยอด %d ได้ระดับ %v ต้องการ %s",
					id, qty, row["stockLevel"], want)
			}
			if row["stockLevelLabel"] == "" {
				return fmt.Errorf("เล่ม %d ไม่มีป้ายไทยของระดับสต็อก", id)
			}
		}
		return nil
	})

	section("หน้ารายละเอียดหนังสือ")

	check("เปิดรายละเอียดเล่ม 101 ได้โดยไม่มี token", func() error {
		body, err := get("", "/api/catalogue/101")
		if err != nil {
			return err
		}
		if err := expect(body["title"], "Atomic Habits"); err != nil {
			return err
		}
		if _, ok := body["reviews"].([]any); !ok {
			return fmt.Errorf("ไม่มีรายการรีวิวติดมากับรายละเอียด")
		}
		return nil
	})
	check("รีวิวที่ติดมามีแต่ที่เผยแพร่แล้ว และคะแนนเฉลี่ยตรงกับจำนวน", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		for id, row := range index {
			count := int(row["ratingCount"].(float64))
			average := row["ratingAverage"].(float64)
			if count == 0 && average != 0 {
				return fmt.Errorf("เล่ม %d ไม่มีรีวิวแต่มีคะแนนเฉลี่ย %v", id, average)
			}
			if count > 0 && (average < 1 || average > 5) {
				return fmt.Errorf("เล่ม %d คะแนนเฉลี่ย %v หลุดช่วง 1–5", id, average)
			}
		}
		return nil
	})
	check("จำนวนรีวิวบนรายละเอียดตรงกับ ratingCount บนลิสต์", func() error {
		index, err := catalogueByID()
		if err != nil {
			return err
		}
		for id, row := range index {
			if int(row["ratingCount"].(float64)) == 0 {
				continue
			}
			body, err := get("", fmt.Sprintf("/api/catalogue/%d", id))
			if err != nil {
				return err
			}
			reviews, _ := body["reviews"].([]any)
			if len(reviews) != int(row["ratingCount"].(float64)) {
				return fmt.Errorf("เล่ม %d: ลิสต์บอก %v รีวิว แต่รายละเอียดมี %d",
					id, row["ratingCount"], len(reviews))
			}
		}
		return nil
	})

	section("แคตตาล็อก — เส้นทางผิดปกติ")

	check("เปิดเล่มที่ปิดการขาย (118) → 404 BOOK_NOT_FOUND", func() error {
		return expectError("GET", "/api/catalogue/118", "", nil, 404, "BOOK_NOT_FOUND")
	})
	check("เปิดรหัสที่ไม่มีอยู่ → 404 BOOK_NOT_FOUND", func() error {
		return expectError("GET", "/api/catalogue/99999", "", nil, 404, "BOOK_NOT_FOUND")
	})
	check("รหัสที่ไม่ใช่ตัวเลข → 422", func() error {
		return expectStatus("GET", "/api/catalogue/abc", "", nil, 422)
	})
}
