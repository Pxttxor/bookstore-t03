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
