// notification.go — การแจ้งเตือนในระบบ (ส่วนขยายนอก class diagram)
package model

import "time"

// Notification — แจ้งเตือนในระบบ (U6/U7/U9/U10)
// ช่อง "email" เป็นการจำลอง บันทึกไว้ให้ SCR-27 แสดงเส้นทางเอกสาร แต่ไม่ได้ส่งจริง
type Notification struct {
	ID         int                 `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	To         Role                `gorm:"column:to_role;type:varchar(20);not null;index" json:"to"`
	CustomerID *int                `gorm:"column:customer_id;index" json:"customerId,omitempty"`
	Kind       NotificationKind    `gorm:"column:kind;type:varchar(40);not null" json:"kind"`
	Title      string              `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Body       string              `gorm:"column:body;type:text;not null" json:"body"`
	Link       string              `gorm:"column:link;type:varchar(300);not null" json:"link"`
	Channel    NotificationChannel `gorm:"column:channel;type:varchar(20);not null" json:"channel"`
	Read       bool                `gorm:"column:read;not null;default:false" json:"read"`
	CreatedAt  time.Time           `gorm:"column:created_at;type:timestamptz;not null" json:"createdAt"`
}

func (Notification) TableName() string { return "notification" }
