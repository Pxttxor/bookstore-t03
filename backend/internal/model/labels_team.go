// labels_team.go — ป้ายภาษาไทยของ enum ในระบบย่อยที่เพื่อนร่วมทีมเป็นเจ้าของคลาส
//
// คู่กับ enums_team.go แบบหนึ่งต่อหนึ่ง · ข้อความยึดตามที่ frontend แสดงจริง
// (กติกาโปรเจกต์: ป้ายไทยที่ frontend กับ backend ไม่ตรงกัน ให้ยึดฝั่ง frontend)
package model

var AccountStatusLabels = map[AccountStatus]string{
	AccountStatusUnverified: "รอยืนยันตัวตน",
	AccountStatusActive:     "ใช้งาน",
	AccountStatusSuspended:  "ระงับการใช้งาน",
}

func (s AccountStatus) Label() string { return lookup(AccountStatusLabels, s) }

// BookFieldLabels — ป้ายไทยของฟิลด์หนังสือที่บันทึกประวัติการแก้ไข
// ตรงกับ BOOK_FIELD_LABELS ใน frontend/src/admin/books/books.ts ทีละตัว
var BookFieldLabels = map[BookField]string{
	BookFieldISBN:        "ISBN",
	BookFieldTitle:       "ชื่อหนังสือ",
	BookFieldAuthor:      "ผู้แต่ง",
	BookFieldPublisher:   "สำนักพิมพ์",
	BookFieldPrice:       "ราคาปก",
	BookFieldDescription: "รายละเอียด",
	BookFieldCategoryID:  "หมวดหมู่",
	BookFieldStatus:      "สถานะ",
}

var StockCountStatusLabels = map[StockCountStatus]string{
	StockCountStatusDraft: "ร่าง",
	StockCountStatusDone:  "ตรวจนับแล้ว",
}

var ApprovalStatusLabels = map[ApprovalStatus]string{
	ApprovalStatusPending:  "รออนุมัติ",
	ApprovalStatusApproved: "อนุมัติแล้ว",
	ApprovalStatusRejected: "ปฏิเสธ",
}

var StockLevelLabels = map[StockLevel]string{
	StockLevelOut: "หมด",
	StockLevelLow: "เหลือน้อย",
	StockLevelOK:  "ปกติ",
}

func (s StockCountStatus) Label() string { return lookup(StockCountStatusLabels, s) }
func (s ApprovalStatus) Label() string   { return lookup(ApprovalStatusLabels, s) }
func (l StockLevel) Label() string       { return lookup(StockLevelLabels, l) }
