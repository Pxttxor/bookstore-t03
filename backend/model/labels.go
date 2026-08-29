// labels.go — ป้ายภาษาไทยของ enum ทุกตัว (คู่กับค่า SCREAMING_SNAKE)
// mirror กับฝั่ง frontend (*_STATUS_LABELS ใน BookHeven) ตามกติกาในคู่มือ:
// ค่า enum เป็นอังกฤษ ส่วนข้อความที่ผู้ใช้เห็นเป็นไทย
package model

// SupplierStatusLabels — ป้ายไทยของสถานะผู้จัดจำหน่าย
var SupplierStatusLabels = map[SupplierStatus]string{
	SupplierStatusActive:    "ใช้งาน",
	SupplierStatusCancelled: "ยกเลิก",
}

// String คืนป้ายไทย (ถ้าไม่พบคืนค่าดิบ) — ทำให้ fmt แสดงผลเป็นภาษาไทย
func (s SupplierStatus) String() string {
	if label, ok := SupplierStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// PRStatusLabels — ป้ายไทยของสถานะใบขอสั่งซื้อ
var PRStatusLabels = map[PRStatus]string{
	PRStatusDraft:     "ร่าง",
	PRStatusSubmitted: "ส่งขออนุมัติ",
	PRStatusApproved:  "อนุมัติแล้ว",
	PRStatusRejected:  "ปฏิเสธ",
}

func (s PRStatus) String() string {
	if label, ok := PRStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// POStatusLabels — ป้ายไทยของสถานะใบสั่งซื้อ
var POStatusLabels = map[POStatus]string{
	POStatusPendingApproval: "รออนุมัติ",
	POStatusApproved:        "อนุมัติแล้ว",
	POStatusConfirmed:       "ยืนยันแล้ว",
	POStatusReceivedPartial: "รับสินค้าบางส่วน",
	POStatusReceivedFull:    "รับสินค้าครบแล้ว",
	POStatusReturned:        "ส่งคืนแล้ว",
	POStatusCancelled:       "ยกเลิก",
}

func (s POStatus) String() string {
	if label, ok := POStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// BookStatusLabels — ป้ายไทยของสถานะหนังสือ
var BookStatusLabels = map[BookStatus]string{
	BookStatusActive:   "ใช้งาน",
	BookStatusInactive: "ปิดการขาย",
}

func (s BookStatus) String() string {
	if label, ok := BookStatusLabels[s]; ok {
		return label
	}
	return string(s)
}

// StockTxnTypeLabels — ป้ายไทยของประเภทการเคลื่อนไหวสต็อก
var StockTxnTypeLabels = map[StockTxnType]string{
	StockTxnTypeReceiveIn:  "รับเข้า",
	StockTxnTypeSaleOut:    "ขายออก",
	StockTxnTypeReturn:     "ส่งคืน",
	StockTxnTypeAdjustment: "ปรับปรุงยอด",
}

func (s StockTxnType) String() string {
	if label, ok := StockTxnTypeLabels[s]; ok {
		return label
	}
	return string(s)
}
