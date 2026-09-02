// labels.go — ป้ายภาษาไทยของทุก enum
//
// ข้อความเหล่านี้คือสิ่งที่ผู้ใช้เห็นบนหน้าจอ กรรมการเทียบข้อความตรงตัวกับ Figma spec
// จึงยึดตาม *_STATUS_LABELS ใน frontend/src/admin/**.ts เป็นหลัก
// (ต่างจาก labels.go ชุดเดิมของ Go model 5 คำ เช่น SUBMITTED เดิม "ส่งขออนุมัติ" → "รออนุมัติ")
package model

var SupplierStatusLabels = map[SupplierStatus]string{
	SupplierStatusActive:    "ใช้งาน",
	SupplierStatusCancelled: "ยกเลิก",
}

var PRStatusLabels = map[PRStatus]string{
	PRStatusDraft:     "ร่าง",
	PRStatusSubmitted: "รออนุมัติ",
	PRStatusApproved:  "อนุมัติแล้ว",
	PRStatusRejected:  "ตีกลับ",
}

var POStatusLabels = map[POStatus]string{
	POStatusPendingApproval: "รออนุมัติ",
	POStatusApproved:        "อนุมัติแล้ว รอส่ง",
	POStatusConfirmed:       "ยืนยันแล้ว",
	POStatusReceivedPartial: "รับบางส่วน",
	POStatusReceivedFull:    "รับครบ",
	POStatusReturned:        "ส่งคืน",
	POStatusCancelled:       "ยกเลิก",
}

var GRStatusLabels = map[GRStatus]string{
	GRStatusPartial: "รับบางส่วน",
	GRStatusFull:    "รับครบ",
}

var ReturnStatusLabels = map[ReturnStatus]string{
	ReturnStatusTracking:  "กำลังติดตาม",
	ReturnStatusEscalated: "ส่งต่อผู้จัดการ",
	ReturnStatusClosed:    "ปิดรายการ",
}

var ItemConditionLabels = map[ItemCondition]string{
	ItemConditionNormal:  "ปกติ",
	ItemConditionDamaged: "ขาด/ชำรุด",
}

var CompensationTypeLabels = map[CompensationType]string{
	CompensationReplacement: "สินค้าทดแทน",
	CompensationCreditNote:  "ใบลดหนี้",
}

var BookStatusLabels = map[BookStatus]string{
	BookStatusActive:   "ใช้งาน",
	BookStatusInactive: "ปิดการขาย",
}

var StockTxnTypeLabels = map[StockTxnType]string{
	StockTxnTypeReceiveIn:  "รับเข้า",
	StockTxnTypeSaleOut:    "ขายออก",
	StockTxnTypeReturn:     "ส่งคืน",
	StockTxnTypeAdjustment: "ปรับปรุงยอด",
}

var RoleLabels = map[Role]string{
	RoleWarehouse: "พนักงานคลังสินค้า",
	RoleManager:   "ผู้จัดการร้าน",
	RoleSales:     "พนักงานฝ่ายขาย",
	RoleDelivery:  "พนักงานจัดส่ง",
	RoleCustomer:  "ลูกค้า",
}

// Label — ป้ายไทยของสถานะ ใช้ประกอบข้อความแจ้งเตือนและข้อความ error
//
// จงใจไม่ implement fmt.Stringer บน enum เหล่านี้ เพราะ %s/%v จะพิมพ์ไทยแทนค่า
// SCREAMING_SNAKE ที่ wire format ต้องการ (ปัญหาที่ labels.go ชุดเดิมมี)
func (s SupplierStatus) Label() string { return lookup(SupplierStatusLabels, s) }
func (s PRStatus) Label() string       { return lookup(PRStatusLabels, s) }
func (s POStatus) Label() string       { return lookup(POStatusLabels, s) }
func (s GRStatus) Label() string       { return lookup(GRStatusLabels, s) }
func (s ReturnStatus) Label() string   { return lookup(ReturnStatusLabels, s) }
func (c ItemCondition) Label() string  { return lookup(ItemConditionLabels, c) }
func (t StockTxnType) Label() string   { return lookup(StockTxnTypeLabels, t) }
func (s BookStatus) Label() string     { return lookup(BookStatusLabels, s) }
func (r Role) Label() string           { return lookup(RoleLabels, r) }

// lookup — คืนป้ายไทย ถ้าไม่พบคืนค่า enum ดิบ (ไม่ให้ข้อความว่างหลุดไปหน้าจอ)
func lookup[K ~string](m map[K]string, key K) string {
	if label, ok := m[key]; ok {
		return label
	}
	return string(key)
}
