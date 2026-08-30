// notify.go — การแจ้งเตือนของระบบย่อยจัดซื้อ
//
// ช่อง "email" เป็นการจำลอง บันทึกลงตารางไว้ให้ SCR-27 แสดงเส้นทางเอกสาร แต่ไม่ได้ส่งออกจริง
package service

import (
	"fmt"

	"gorm.io/gorm"

	"bookstore-t03/internal/model"
	"bookstore-t03/internal/repository"
)

// ── การแจ้งเตือน ────────────────────────────────────────────────────────

// notifySubmitted — U6 postcondition: ใบขอสั่งซื้อวิ่งไปหาผู้จัดการอัตโนมัติ
func (s *PurchasingService) notifySubmitted(tx *gorm.DB, pr *model.PurchaseRequisition) error {
	supplier, err := s.suppliers.FindByID(pr.SupplierID)
	if err != nil {
		return err
	}
	body := fmt.Sprintf("%s · %s · ฿%.2f · ผู้ขอ %s",
		model.FormatPRCode(pr.PRID), supplier.CompanyName,
		model.DocumentTotal(pr.Items), pr.RequestedBy)

	return s.notify(tx, model.RoleManager, model.NotifyPRSubmitted,
		"ใบขอสั่งซื้อรออนุมัติ", body,
		fmt.Sprintf("/admin/purchasing/pr/%d/approve", pr.PRID))
}

// notify — บันทึกแจ้งเตือนทั้งในระบบและ "อีเมล" (อีเมลเป็นการจำลอง ไม่ได้ส่งจริง)
func (s *PurchasingService) notify(tx *gorm.DB, to model.Role, kind model.NotificationKind, title, body, link string) error {
	return pushBothChannels(tx, s.notifications, to, kind, title, body, link)
}

// pushBothChannels — ใช้ร่วมกันระหว่างระบบย่อย เพราะทุกระบบย่อยแจ้งเตือนรูปแบบเดียวกัน
func pushBothChannels(
	tx *gorm.DB, notifications *repository.NotificationRepository,
	to model.Role, kind model.NotificationKind, title, body, link string,
) error {
	return notifications.Push(tx, []model.Notification{
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelInApp},
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelEmail},
	})
}

// notifyInApp — แจ้งเตือนเฉพาะในระบบ ไม่ส่งอีเมล (การรับสินค้าเป็นข้อมูลภายใน)
func (s *PurchasingService) notifyInApp(tx *gorm.DB, to model.Role, kind model.NotificationKind, title, body, link string) error {
	return s.notifications.Push(tx, []model.Notification{
		{To: to, Kind: kind, Title: title, Body: body, Link: link, Channel: model.ChannelInApp},
	})
}
