// types.go — ชนิดข้อมูลร่วม
package model

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

// DateLayout — รูปแบบวันที่ที่ frontend ใช้ (new Date().toISOString().slice(0, 10))
const DateLayout = "2006-01-02"

// Date — ชนิด date ของ class diagram
//
// เก็บใน PostgreSQL เป็น date แต่ส่งออก JSON เป็น string "YYYY-MM-DD"
// เพราะ TypeScript ฝั่ง frontend ประกาศ createdDate/orderDate/receivedDate เป็น string ล้วน
// ถ้าปล่อยเป็น time.Time จะได้ RFC3339 พร้อมเวลา ซึ่งไม่ตรงสัญญา
type Date struct {
	time.Time
}

// NewDate — ตัดเวลาทิ้ง เหลือเฉพาะวันที่
func NewDate(t time.Time) Date {
	y, m, d := t.Date()
	return Date{time.Date(y, m, d, 0, 0, 0, 0, time.UTC)}
}

func Today() Date { return NewDate(time.Now()) }

// AddDays — วันที่ล่วงหน้า ใช้ตั้ง expectedDeliveryDate ตอนออก PO
func (d Date) AddDays(days int) Date { return NewDate(d.AddDate(0, 0, days)) }

// Before — เทียบวันที่ (ใช้ตรวจว่าวันที่คาดว่าจะได้รับไม่ย้อนหลัง)
func (d Date) Before(other Date) bool { return d.Time.Before(other.Time) }

func (d Date) After(other Date) bool { return d.Time.After(other.Time) }

// ParseDate — อ่านค่าจาก body ของ request (รองรับทั้ง YYYY-MM-DD, DD/MM/YYYY และ ISO)
func ParseDate(value string) (Date, error) {
	v := strings.TrimSpace(value)
	for _, layout := range []string{
		DateLayout,
		"2006/01/02",
		"02/01/2006",
		"02-01-2006",
		"2006-1-2",
		"2-1-2006",
	} {
		if t, err := time.Parse(layout, v); err == nil {
			return NewDate(t), nil
		}
	}
	return Date{}, fmt.Errorf("รูปแบบวันที่ต้องเป็น YYYY-MM-DD: %q", value)
}

func (d Date) String() string { return d.Format(DateLayout) }

func (d Date) MarshalJSON() ([]byte, error) {
	return []byte(`"` + d.Format(DateLayout) + `"`), nil
}

func (d *Date) UnmarshalJSON(data []byte) error {
	raw := strings.Trim(string(data), `"`)
	if raw == "" || raw == "null" {
		*d = Date{}
		return nil
	}
	// เผื่อ frontend ส่ง ISO เต็มมา (เช่น new Date().toISOString())
	if len(raw) > len(DateLayout) {
		raw = raw[:len(DateLayout)]
	}
	parsed, err := ParseDate(raw)
	if err != nil {
		return err
	}
	*d = parsed
	return nil
}

// Value / Scan — ให้ GORM เก็บลงคอลัมน์ชนิด date ได้
func (d Date) Value() (driver.Value, error) {
	if d.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

func (d *Date) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*d = Date{}
	case time.Time:
		*d = NewDate(v)
	case string:
		parsed, err := ParseDate(v)
		if err != nil {
			return err
		}
		*d = parsed
	default:
		return fmt.Errorf("แปลงค่า %T เป็น Date ไม่ได้", value)
	}
	return nil
}

// GormDataType — บอก GORM ว่าคอลัมน์นี้เป็น date ไม่ใช่ timestamp
func (Date) GormDataType() string { return "date" }
