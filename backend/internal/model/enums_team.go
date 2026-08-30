// enums_team.go — enum ของระบบย่อยที่เพื่อนร่วมทีมเป็นเจ้าของคลาส
//
// แยกไฟล์จาก enums.go เพื่อให้เห็นชัดว่าตัวไหนมาจาก class diagram ของใคร
// กติกาเดียวกันทุกตัว: ค่าเป็น SCREAMING_SNAKE ตรงกับ diagram · มี IsValid() · ไม่มี fmt.Stringer
package model

// AccountStatus — สถานะบัญชีผู้ใช้ (UserAccount.status)
//
// UNVERIFIED = สมัครแล้วแต่ยังไม่ยืนยัน OTP · SUSPENDED = ถูกผู้จัดการระงับ
type AccountStatus string

const (
	AccountStatusUnverified AccountStatus = "UNVERIFIED"
	AccountStatusActive     AccountStatus = "ACTIVE"
	AccountStatusSuspended  AccountStatus = "SUSPENDED"
)

func (s AccountStatus) IsValid() bool {
	switch s {
	case AccountStatusUnverified, AccountStatusActive, AccountStatusSuspended:
		return true
	}
	return false
}

// StockCountStatus — สถานะรอบการตรวจนับสต็อก
//
// class diagram พิมพ์เป็น string เฉย ๆ · ทำเป็น enum ให้ตรงกับ union ฝั่งหน้าจอ
// ซึ่งมีแค่สองค่านี้จริง ๆ (deviation ข้อเดียวกับ GRStatus/ReturnStatus)
type StockCountStatus string

const (
	StockCountStatusDraft StockCountStatus = "DRAFT"
	StockCountStatusDone  StockCountStatus = "DONE"
)

func (s StockCountStatus) IsValid() bool {
	switch s {
	case StockCountStatusDraft, StockCountStatusDone:
		return true
	}
	return false
}

// ApprovalStatus — ผลการตัดสินรายงานผลต่างสต็อกโดยผู้จัดการร้าน
type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "PENDING"
	ApprovalStatusApproved ApprovalStatus = "APPROVED"
	ApprovalStatusRejected ApprovalStatus = "REJECTED"
)

func (s ApprovalStatus) IsValid() bool {
	switch s {
	case ApprovalStatusPending, ApprovalStatusApproved, ApprovalStatusRejected:
		return true
	}
	return false
}

// StockLevel — ระดับยอดคงเหลือของรายงาน "หนังสือใกล้หมด"
//
// **คนละเรื่องกับ IsBelowReorder()** — อันนั้นใช้จุดสั่งซื้อรายเล่มของ U5 เพื่อเปิดใบขอสั่งซื้อ
// อันนี้ใช้เกณฑ์คงที่ LowStockThreshold ของรายงานอ่านอย่างเดียว · ห้ามยุบรวมกัน
type StockLevel string

const (
	StockLevelOut StockLevel = "OUT"
	StockLevelLow StockLevel = "LOW"
	StockLevelOK  StockLevel = "OK"
)

// LowStockThreshold — เกณฑ์ "เหลือน้อย" ของรายงาน (ตรงกับ LOW_STOCK_THRESHOLD ฝั่งหน้าจอ)
const LowStockThreshold = 10
