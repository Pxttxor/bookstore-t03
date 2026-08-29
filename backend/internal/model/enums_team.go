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
